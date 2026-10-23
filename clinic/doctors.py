"""Explicit Django boundary for existing SQL doctor/claim transactions.

SQL functions keep enforcing clinician eligibility, tenant membership, claim
ownership and compare-and-set assignment. Requests use the verified caller's
bearer token, never a service-role credential.
"""
import json
from urllib.parse import urlencode
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .views import bearer_token, verified_context, upstream, GatewayError, error_response
from .registration import allowed

# Exact function/parameter contracts, not an arbitrary RPC proxy.
ACTIONS = {
    'clinic_doctor_state_v51': {},
    'waiting_doctor_state_v54': {'p_appointment_id':False},
    'assign_waiting_doctor_v54': {'p_appointment_id':False,'p_doctor_id':True,
                                'p_expected_doctor_id':True,'p_expected_doctor':True},
    'claim_clinic_visit_v51': {'p_pet_id':False,'p_appointment_id':True},
    'verify_clinic_visit_v51': {'p_pet_id':False,'p_claim_id':False},
    'release_clinic_visit_v51': {'p_pet_id':False,'p_appointment_id':False},
}

def parameters(request, contract):
    if request.content_type != 'application/json' or len(request.body) > 4096:
        raise GatewayError(400)
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError): raise GatewayError(400) from None
    if not isinstance(data, dict) or set(data) != set(contract): raise GatewayError(400)
    for key, nullable in contract.items():
        value = data[key]
        if value is None and nullable: continue
        if not isinstance(value, str) or not value or len(value)>500 or any(ord(c)<32 for c in value):
            # An empty legacy doctor label is a valid expected value.
            if key == 'p_expected_doctor' and value == '': continue
            raise GatewayError(400)
    return data

def get_rows(table, params, token):
    data=upstream('/rest/v1/'+table+'?'+urlencode(params),token)
    if not isinstance(data,list) or any(not isinstance(row,dict) for row in data):
        raise GatewayError(502)
    return data

def check_scope(data, tenant, token):
    pet_id=data.get('p_pet_id')
    if pet_id:
        pets=get_rows('pets',{'select':'id','tenant_id':'eq.' + str(tenant),'id':'eq.' + str(pet_id),'limit':'2'},token)
        if len(pets)!=1 or pets[0].get('id')!=pet_id:
            raise GatewayError(403,'找不到此院所的寵物，請更新候診核對。')
    appointment_id=data.get('p_appointment_id')
    if appointment_id:
        appointments=get_rows('appointments',{'select':'id,pet_id','tenant_id':'eq.' + str(tenant),'id':'eq.' + str(appointment_id),'limit':'2'},token)
        if len(appointments)!=1 or appointments[0].get('id')!=appointment_id or (pet_id and appointments[0].get('pet_id')!=pet_id):
            raise GatewayError(403,'掛號與目前院所／寵物不符，請更新候診核對。')

def validate_result(action, data, args, tenant):
    if action=='verify_clinic_visit_v51':
        if not isinstance(data,bool): raise GatewayError(502)
        return
    if action=='release_clinic_visit_v51':
        # Existing SQL void functions may return an empty response or JSON null.
        return
    if not isinstance(data,dict): raise GatewayError(502)
    if action=='clinic_doctor_state_v51':
        if (data.get('enabled') is not None and not isinstance(data['enabled'],bool)) or any(data.get(key) is not None and not isinstance(data[key],list) for key in ('doctors','claims')):
            raise GatewayError(502)
        return
    if action in ('claim_clinic_visit_v51','assign_waiting_doctor_v54'):
        if not isinstance(data.get('ok'),bool): raise GatewayError(502)
        if not data['ok']: return
        if action=='claim_clinic_visit_v51' and (not isinstance(data.get('claim_id'),str) or not data['claim_id']):
            raise GatewayError(502)
    appointment=data.get('appointment')
    if not isinstance(appointment,dict) or not appointment.get('id'): raise GatewayError(502)
    if args.get('p_appointment_id') and appointment['id']!=args['p_appointment_id']: raise GatewayError(502)
    if args.get('p_pet_id') and appointment.get('pet_id')!=args['p_pet_id']: raise GatewayError(502)
    if appointment.get('tenant_id') is not None and appointment['tenant_id']!=tenant: raise GatewayError(502)

# Cookie authentication is not accepted; every call requires a verified bearer.
@csrf_exempt
@never_cache
@require_POST
def doctor_action(request, action):
    if action not in ACTIONS:
        return JsonResponse({'error':'不支援的接診操作。'},status=404)
    try:
        token=bearer_token(request)
        context=verified_context(token)
        profile=context['profile']
        args=parameters(request,ACTIONS[action])
        if action in ('waiting_doctor_state_v54','assign_waiting_doctor_v54') and not allowed(profile):
            raise GatewayError(403,'此帳號沒有指定醫師權限。')
        if action=='release_clinic_visit_v51' and profile.get('role')!='admin':
            raise GatewayError(403,'只有管理者可以解除看診占用。')
        tenant=profile['tenant_id']
        check_scope(args,tenant,token)
        result=upstream('/rest/v1/rpc/'+action,token,method='POST',payload=args)
        validate_result(action,result,args,tenant)
        return JsonResponse({'data':result,'tenant_id':tenant,'user_id':context['user']['id']})
    except GatewayError as exc:
        return error_response(exc)
