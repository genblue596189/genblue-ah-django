"""Medical record writes only; visit transitions and billing keep their routes."""
import json
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID
from urllib.parse import urlencode
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .views import bearer_token, verified_context, upstream, GatewayError, error_response
from .prescription_validation import validate_prescriptions

# Only authenticated reads run here. Claim verification remains in the caller;
# no medical write, billing operation or automatic retry is submitted to this pool.
_record_read_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix='medical-read')
_UNREAD = object()


def uuid_value(value):
    if not isinstance(value,str): raise ValueError()
    if str(UUID(value))!=value: raise ValueError()
    return value


def invalid_json_constant(value):
    raise ValueError('Non-finite number')


def parameters(request, action):
    if request.content_type!='application/json' or len(request.body)>2_000_000: raise GatewayError(400)
    try:
        data=json.loads(request.body,parse_constant=invalid_json_constant)
        common={'pet_id','appointment_id','claim_id','request_id','chief'}
        expected=common|({'mode','prescriptions'} if action=='save' else {'mode','prescriptions','expected_version'} if action=='revise' else {'expected_version'})
        if not isinstance(data,dict) or set(data)!=expected: raise ValueError()
        for key in ('pet_id','appointment_id','claim_id','request_id'): uuid_value(data[key])
        if not isinstance(data['chief'],str) or len(data['chief'])>200000: raise ValueError()
        if action in ('save','revise'):
            if action=='revise' and (type(data['expected_version']) is not int or data['expected_version']<1): raise ValueError()
            if data['mode'] not in ('waiting','checkout'): raise ValueError()
            if not isinstance(data['prescriptions'],list) or any(not isinstance(row,dict) for row in data['prescriptions']): raise ValueError()
            validate_prescriptions(data['prescriptions'])
        elif type(data['expected_version']) is not int or data['expected_version']<0: raise ValueError()
        return data
    except (ValueError,KeyError,TypeError,UnicodeDecodeError): raise GatewayError(400) from None


def rows(table, params, token):
    result=upstream('/rest/v1/'+table+'?'+urlencode(params),token)
    if not isinstance(result,list) or any(not isinstance(row,dict) for row in result): raise GatewayError(502)
    return result


def verify_visit(data, context, token, prefetch_record=False):
    tenant=context['profile']['tenant_id']
    appointments=rows('appointments',{'select':'id,pet_id,status', 'tenant_id':'eq.'+tenant,
                                     'id':'eq.'+data['appointment_id'],'pet_id':'eq.'+data['pet_id'],'limit':'2'},token)
    if len(appointments)!=1 or appointments[0].get('id')!=data['appointment_id'] or appointments[0].get('pet_id')!=data['pet_id'] or appointments[0].get('status')!='診間看診中':
        raise GatewayError(409,'本次掛號已不是這筆看診狀態，請保留輸入並核對候診。')
    record_job = _record_read_pool.submit(saved_record, data, tenant, token) if prefetch_record else None
    try:
        verified=upstream('/rest/v1/rpc/verify_clinic_visit_v51',token,method='POST',payload={'p_pet_id':data['pet_id'],'p_claim_id':data['claim_id']})
        if verified is not True:
            raise GatewayError(403,'接診權已變更或沒有病歷編輯權限，請保留輸入並重新核對。')
        return record_job.result() if record_job is not None else None
    finally:
        if record_job is not None:
            # Cancellation only affects a read that has not started. A running
            # read may finish, but its result is never used after failed checks.
            record_job.cancel()


def saved_record(data, tenant, token):
    result=rows('medical_records',{'select':'*','id':'eq.'+data['request_id'],'tenant_id':'eq.'+tenant,'pet_id':'eq.'+data['pet_id'],'limit':'2'},token)
    if len(result)>1: raise GatewayError(502)
    return result[0] if result else None


def matches(record, payload):
    return isinstance(record,dict) and all(record.get(key)==value for key,value in payload.items())


def save_record(data, tenant, token, previous=_UNREAD):
    payload={'id':data['request_id'],'tenant_id':tenant,'pet_id':data['pet_id'],
             'status':'候診中' if data['mode']=='waiting' else '診間看診中',
             'chief_complaint':data['chief'],'prescription_details':data['prescriptions']}
    if data['mode']=='checkout':
        payload['vaccine_info']={'django_visit_v1':{'appointment_id':data['appointment_id'],'claim_id':data['claim_id']}}
    if previous is _UNREAD:
        previous=saved_record(data,tenant,token)
    replayed=bool(previous)
    if previous is None:
        try:
            result=upstream('/rest/v1/medical_records?select=*',token,method='POST',payload=[payload])
            if not isinstance(result,list) or len(result)!=1: raise GatewayError(502)
            previous=result[0]
        except GatewayError as exc:
            # Resolve a simultaneous insert using the same record UUID, never
            # perform a blind second insert after an uncertain response.
            if exc.status!=409: raise
            previous=saved_record(data,tenant,token)
            if previous is None: raise
            replayed=True
    if not matches(previous,payload):
        raise GatewayError(409,'這筆儲存編號已有不同內容；本次未覆寫，請保留輸入並核對病歷。')
    return {'id':previous['id'],'pet_id':previous['pet_id'],'row_version':previous.get('row_version',1),'replayed':replayed}


def revise_record(data, token):
    result=upstream('/rest/v1/rpc/revise_consultation_draft_v1',token,method='POST',payload={
        'p_record_id':data['request_id'],'p_pet_id':data['pet_id'],'p_appointment_id':data['appointment_id'],
        'p_claim_id':data['claim_id'],'p_expected_version':data['expected_version'],'p_chief':data['chief'],
        'p_prescriptions':data['prescriptions'],'p_mode':data['mode']})
    if not isinstance(result,dict) or result.get('id')!=data['request_id'] or result.get('pet_id')!=data['pet_id'] or type(result.get('row_version')) is not int or result['row_version']<1:
        raise GatewayError(502,'病歷更新結果尚未確認，請保留輸入並核對。')
    return result


def save_archive(data, token):
    result=upstream('/rest/v1/rpc/save_archive_medical_v53',token,method='POST',payload={
        'p_id':data['request_id'],'p_pet_id':data['pet_id'],
        'p_expected_version':data['expected_version'],'p_chief':data['chief']})
    if not isinstance(result,dict) or result.get('id')!=data['request_id'] or type(result.get('row_version')) is not int or result['row_version']<1:
        raise GatewayError(502)
    return result


# A verified bearer is required; cookies never authorize medical writes.
@csrf_exempt
@never_cache
@require_POST
def medical_action(request, action):
    if action not in ('save','revise','archive'):
        return JsonResponse({'error':'不支援的病歷操作。'},status=404)
    try:
        token=bearer_token(request)
        context=verified_context(token)
        data=parameters(request,action)
        previous=verify_visit(data,context,token,prefetch_record=action=='save')
        result=save_record(data,context['profile']['tenant_id'],token,previous=previous) if action=='save' else revise_record(data,token) if action=='revise' else save_archive(data,token)
        return JsonResponse({'data':result,'tenant_id':context['profile']['tenant_id'],'user_id':context['user']['id']})
    except GatewayError as exc:
        return error_response(exc)
