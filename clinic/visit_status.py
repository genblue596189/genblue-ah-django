"""Medical visit state transitions; existing SQL triggers release visit claims."""
import json
from datetime import datetime,timezone
from urllib.parse import urlencode
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .views import bearer_token,verified_context,upstream,GatewayError,error_response
from .medical import uuid_value


def parameters(request,action):
    if request.content_type!='application/json' or len(request.body)>4096: raise GatewayError(400)
    try:
        data=json.loads(request.body)
        if not isinstance(data,dict) or set(data)!={'pet_id','appointment_id','claim_id','record_id'}: raise ValueError()
        for key in ('pet_id','appointment_id','claim_id'): uuid_value(data[key])
        if data['record_id'] is not None: uuid_value(data['record_id'])
        if action=='state' and data['record_id'] is not None: raise ValueError()
        return data
    except (ValueError,TypeError,KeyError,UnicodeDecodeError): raise GatewayError(400) from None


def rows(table,params,token):
    data=upstream('/rest/v1/'+table+'?'+urlencode(params),token)
    if not isinstance(data,list) or any(not isinstance(row,dict) for row in data): raise GatewayError(502)
    return data


def appointment(data,tenant,token):
    found=rows('appointments',{'select':'*','id':'eq.'+data['appointment_id'],'pet_id':'eq.'+data['pet_id'],'tenant_id':'eq.'+tenant,'limit':'2'},token)
    if len(found)!=1 or found[0].get('id')!=data['appointment_id'] or found[0].get('pet_id')!=data['pet_id'] or found[0].get('tenant_id')!=tenant:
        raise GatewayError(403,'找不到本院這筆掛號／病患，請保留輸入並核對。')
    return found[0]


def verify_record(data,tenant,action,token):
    if data['record_id'] is None: return
    found=rows('medical_records',{'select':'id,pet_id,status,prescription_details','id':'eq.'+data['record_id'],'pet_id':'eq.'+data['pet_id'],'tenant_id':'eq.'+tenant,'limit':'2'},token)
    status='已完成' if action=='complete-archive' else '候診中'
    if len(found)!=1 or found[0].get('id')!=data['record_id'] or found[0].get('pet_id')!=data['pet_id'] or found[0].get('status')!=status:
        raise GatewayError(409,'尚未確認本次病歷已儲存，掛號狀態沒有更新。')
    if action=='complete-archive' and found[0].get('prescription_details')!=[]:
        raise GatewayError(409,'此筆仍有處方，不適用不收費歸檔。')


def transition(action,data,context,token):
    tenant=context['profile']['tenant_id']; user=context['user']['id']
    current=appointment(data,tenant,token)
    # Existing v57 attribution is retained when leaving consultation.
    if current.get('clinician_id_v57')!=user:
        raise GatewayError(403,'本筆不是目前登入醫師接診的掛號，請保留輸入並核對。')
    if action=='state': return {'appointment':current,'replayed':False}
    target='候診中' if action=='waiting' else '已完成'
    verify_record(data,tenant,action,token)
    if current.get('status')==target:
        # Read-only confirmation of a completed transition, never rewrites notes.
        return {'appointment':current,'replayed':True}
    if current.get('status')!='診間看診中':
        raise GatewayError(409,'掛號狀態已改變，本次沒有覆寫，請保留畫面核對。')
    verified=upstream('/rest/v1/rpc/verify_clinic_visit_v51',token,method='POST',payload={'p_pet_id':data['pet_id'],'p_claim_id':data['claim_id']})
    if verified is not True:
        raise GatewayError(403,'接診權已變更，請保留輸入並核對，掛號狀態沒有更新。')
    params={'select':'*','id':'eq.'+data['appointment_id'],'tenant_id':'eq.'+tenant,
            'pet_id':'eq.'+data['pet_id'],'status':'eq.診間看診中','clinician_id_v57':'eq.'+user}
    payload={'status':target}
    if action=='complete-archive':
        label='僅病歷歸檔（未收費）' if data['record_id'] else '僅查閱舊資料（未收費）'
        notes=current.get('notes')
        params['notes']='is.null' if notes is None else 'eq.'+notes
        payload.update({'completed_at':datetime.now(timezone.utc).isoformat(),
                        'notes':'\n'.join(x for x in [notes,label] if x)})
    saved=upstream('/rest/v1/appointments?'+urlencode(params),token,method='PATCH',payload=payload)
    if not isinstance(saved,list) or len(saved)!=1:
        raise GatewayError(409,'候診資料剛被更動，未確認狀態更新成功，請保留畫面核對。')
    row=saved[0]
    if not isinstance(row,dict) or row.get('id')!=data['appointment_id'] or row.get('pet_id')!=data['pet_id'] or row.get('tenant_id')!=tenant or row.get('status')!=target:
        raise GatewayError(502)
    return {'appointment':row,'replayed':False}


# Cookies alone cannot authorize these transitions.
@csrf_exempt
@never_cache
@require_POST
def visit_status_action(request,action):
    if action not in ('state','waiting','complete-archive'):
        return JsonResponse({'error':'不支援的看診狀態操作。'},status=404)
    try:
        token=bearer_token(request);context=verified_context(token)
        data=parameters(request,action)
        result=transition(action,data,context,token)
        return JsonResponse(dict(result,tenant_id=context['profile']['tenant_id'],user_id=context['user']['id']))
    except GatewayError as exc: return error_response(exc)
