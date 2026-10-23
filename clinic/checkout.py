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

ACTIONS={'stage','direct','pay'}
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
        if not isinstance(data,dict) or set(data)!=expected: raise ValueError()
        uuid_value(data['id'])
        if action=='stage':
            if not isinstance(data['draft'],dict): raise ValueError()
            uuid_value(data['draft']['billingAppointmentId'])
        else:
            uuid_value(data['shift_id'])
            if not isinstance(data['method'],str) or data['method'] not in METHODS: raise ValueError()
            if action=='pay':
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
        if action=='stage':
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
        # Stage eligibility/claim ownership is checked by existing POS SQL.
        if action in ('direct','pay') and not can_bill(context['profile']):
            raise GatewayError(403,'此帳號沒有收款權限，尚未送出收款。','GB_REQUEST_REJECTED')
        result=upstream('/rest/v1/rpc/pos_v77',token,method='POST',payload={'p_action':action,'p_data':data},pos_errors=True)
        validate_result(result,action,data,tenant)
        return JsonResponse({'data':result,'tenant_id':tenant,'user_id':context['user']['id']})
    except GatewayError as exc:return error_response(exc)
