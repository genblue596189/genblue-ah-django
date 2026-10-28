"""Bounded POS gateway. SQL remains authoritative for money and stock.

No preflight stock/shift queries or automatic retries: an existing request may
already have committed, and must reach the SQL replay check unchanged.
"""
import json
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .views import bearer_token,verified_context,upstream,GatewayError,error_response
from .medical import uuid_value,invalid_json_constant

ACTIONS={'stage','direct','pay','family_pending','edit','cancel'}
PENDING_ACTIONS={'edit','cancel'}
FUNCTIONS={'checkout_with_inventory','checkout_clinic_doctor_v57','checkout_clinic_medicine_groups_v64','checkout_family_v74'}
METHODS={'現金','信用卡','轉帳','行動支付'}


def rejected(message='結帳資料不完整，尚未送出收款，請核對後重試。'):
    return GatewayError(400,message,'GB_REQUEST_REJECTED')


def can_bill(profile):
    if profile.get('role')=='admin': return True
    value=profile.get('permission_checkout')
    if value is not None: return value is True
    return profile.get('role')=='staff' or (profile.get('role')=='doctor' and profile.get('can_checkout') is True)


def parameters(request,action,tenant):
    if request.content_type!='application/json' or len(request.body)>2_000_000: raise rejected()
    try:
        data=json.loads(request.body,parse_constant=invalid_json_constant)
        expected={'id','draft'} if action=='stage' else ({'id','payload','method','shift_id','tendered'} if action=='direct' else {'id','pending_id','version','method','shift_id','tendered'})
        if action=='family_pending': expected={'id','entries','method','shift_id','tendered'}
        if action in PENDING_ACTIONS:
            expected={'id','version','draft'} if action=='edit' else {'id','version'}
        if not isinstance(data,dict) or set(data)!=expected: raise ValueError()
        uuid_value(data['id'])
        if action in PENDING_ACTIONS:
            if type(data['version']) is not int or data['version']<1: raise ValueError()
            if action=='edit':
                if not isinstance(data['draft'],dict): raise ValueError()
                uuid_value(data['draft']['billingAppointmentId'])
        elif action=='stage':
            if not isinstance(data['draft'],dict): raise ValueError()
            uuid_value(data['draft']['billingAppointmentId'])
        else:
            uuid_value(data['shift_id'])
            if not isinstance(data['method'],str) or data['method'] not in METHODS: raise ValueError()
            if action=='family_pending':
                entries=data['entries']
                if not isinstance(entries,list) or not 1<=len(entries)<=20: raise ValueError()
                for entry in entries:
                    if not isinstance(entry,dict) or set(entry)!={'id','pending_id','version'}: raise ValueError()
                    uuid_value(entry['id']);uuid_value(entry['pending_id'])
                    if type(entry['version']) is not int or entry['version']<1: raise ValueError()
                if len({e['id'] for e in entries})!=len(entries) or len({e['pending_id'] for e in entries})!=len(entries): raise ValueError()
            elif action=='pay':
                uuid_value(data['pending_id'])
                if type(data['version']) is not int or data['version']<1: raise ValueError()
            else:
                payload=data['payload']
                if not isinstance(payload,dict) or set(payload)!={'name','args'}: raise ValueError()
                if not isinstance(payload['name'],str) or payload['name'] not in FUNCTIONS or not isinstance(payload['args'],dict): raise ValueError()
                args=payload['args']
                if args.get('p_tenant_id')!=tenant: raise ValueError()
                if payload['name']=='checkout_family_v74':
                    if not isinstance(args.get('p_entries'),list) or not args['p_entries'] or any(not isinstance(entry,dict) for entry in args['p_entries']): raise ValueError()
                    for entry in args['p_entries']:
                        if 'p_tenant_id' in entry and entry['p_tenant_id']!=tenant: raise ValueError()
        return data
    except (ValueError,TypeError,KeyError,UnicodeDecodeError,OverflowError): raise rejected() from None


def validate_result(result,action,data,tenant):
    try:
        if isinstance(result,dict) and 'tenant_id' in result and result['tenant_id']!=tenant: raise ValueError()
        if action in PENDING_ACTIONS:
            if not isinstance(result,dict) or result.get('ok') is not True: raise ValueError()
        elif action=='family_pending':
            if not isinstance(result,dict) or result.get('request_id')!=data['id'] or not isinstance(result.get('invoices'),list): raise ValueError()
            if {e['pending_id'] for e in result['invoices']}!={e['pending_id'] for e in data['entries']} or len(result['invoices'])!=len(data['entries']): raise ValueError()
            for entry in result['invoices']: uuid_value(entry['invoice_id'])
        elif action=='stage':
            if not isinstance(result,dict) or result.get('id')!=data['id']: raise ValueError()
            uuid_value(result['id'])
        elif isinstance(result,str):
            # Existing retail checkout returns a JSON UUID scalar.
            if action!='direct' or data['payload']['name']!='checkout_with_inventory': raise ValueError()
            uuid_value(result)
        elif isinstance(result,dict):
            family=action=='direct' and data['payload']['name']=='checkout_family_v74'
            if family:
                if result.get('request_id')!=data['payload']['args'].get('p_request_id') or not isinstance(result.get('invoices'),list) or len(result['invoices'])!=len(data['payload']['args']['p_entries']): raise ValueError()
            else: uuid_value(result['invoice_id'])
        else: raise ValueError()
    except (ValueError,TypeError,KeyError):
        # SQL could already have committed. Never mark this as a rejected request.
        if action in PENDING_ACTIONS:
            raise GatewayError(502,'待付款變更結果尚未確認，請重新載入原帳單核對，勿直接重送或另建帳單。') from None
        raise GatewayError(502,'收款回覆未能完整確認，請保留原請求並核對上次收款，勿重新建帳。') from None


@csrf_exempt
@never_cache
@require_POST
def checkout_action(request,action):
    if action not in ACTIONS:return JsonResponse({'error':'不支援的結帳操作。'},status=404)
    try:
        token=bearer_token(request);context=verified_context(token)
        tenant=context['profile']['tenant_id']
        data=parameters(request,action,tenant)
        if action in PENDING_ACTIONS and not can_bill(context['profile']):
            raise GatewayError(403,'此帳號沒有修改待付款的權限，本次未送出變更。','GB_REQUEST_REJECTED')
        if action=='cancel' and context['profile'].get('role')!='admin':
            raise GatewayError(403,'只有管理者可以取消待付款，本次未送出變更。','GB_REQUEST_REJECTED')
        # Stage eligibility/claim ownership is checked by existing POS SQL.
        if action in ('direct','pay','family_pending') and not can_bill(context['profile']):
            raise GatewayError(403,'此帳號沒有收款權限，尚未送出收款。','GB_REQUEST_REJECTED')
        result=upstream('/rest/v1/rpc/'+('pos_family_pending_v20261025' if action=='family_pending' else 'pos_v77'),token,method='POST',payload=({'p_data':data} if action=='family_pending' else {'p_action':action,'p_data':data}),pos_errors=True)
        validate_result(result,action,data,tenant)
        return JsonResponse({'data':result,'tenant_id':tenant,'user_id':context['user']['id']})
    except GatewayError as exc:return error_response(exc)
