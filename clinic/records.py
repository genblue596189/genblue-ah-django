"""Create owner/pet records using stable caller UUIDs and existing SQL triggers."""
import json
import math
from datetime import date
from urllib.parse import urlencode
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .medical import uuid_value, invalid_json_constant
from .views import bearer_token, verified_context, upstream, GatewayError, error_response

FIELDS={
    'owners':{'id','tenant_id','owner_code','name','mobile','phone','email','address','notes'},
    'pets':{'id','tenant_id','owner_id','name','species','breed','gender','birthday','weight','microchip'},
}


def rejected(message):
    return GatewayError(400,message+'；尚未建檔。','GB_RECORD_REJECTED')


def parameters(request, entity, tenant):
    if request.content_type!='application/json' or len(request.body)>32768:raise rejected('建檔內容格式不正確')
    try:
        payload=json.loads(request.body,parse_constant=invalid_json_constant)
        if not isinstance(payload,dict) or set(payload)!=FIELDS[entity]:raise ValueError()
        uuid_value(payload['id'])
        if payload['tenant_id']!=tenant:raise ValueError()
        text_fields=FIELDS[entity]-{'weight'}
        if any(payload[k] is not None and not isinstance(payload[k],str) for k in text_fields):raise ValueError()
        required=('name','mobile') if entity=='owners' else ('name','species','gender','owner_id')
        if any(not payload[k] or not payload[k].strip() for k in required):raise ValueError()
        if entity=='pets':
            uuid_value(payload['owner_id'])
            if payload['birthday'] is not None:date.fromisoformat(payload['birthday'])
            weight=payload['weight']
            if weight is not None and (isinstance(weight,bool) or not isinstance(weight,(int,float)) or not math.isfinite(weight) or weight<0):raise ValueError()
        return payload
    except (ValueError,TypeError,KeyError,UnicodeDecodeError,OverflowError):
        raise rejected('請核對姓名、手機、寵物必填欄位、日期與非負體重') from None


def lookup(entity, identifier, tenant, token):
    query=urlencode({'select':'*','id':'eq.'+identifier,'tenant_id':'eq.'+tenant,'limit':'2'})
    rows=upstream('/rest/v1/'+entity+'?'+query,token)
    if not isinstance(rows,list) or len(rows)>1 or any(not isinstance(row,dict) for row in rows):raise GatewayError(502)
    return rows[0] if rows else None


def confirm(row,payload):
    if not isinstance(row,dict) or any(row.get(key)!=value for key,value in payload.items()):
        raise GatewayError(409,'此建檔編號已有不同內容；未覆寫，請保留欄位並先查詢原建檔結果。','GB_RECORD_CONFLICT')
    return row


@csrf_exempt
@never_cache
@require_POST
def create_record(request,entity):
    if entity not in FIELDS:return JsonResponse({'error':'不支援的建檔類型。'},status=404)
    try:
        token=bearer_token(request);context=verified_context(token)
        profile=context['profile'];tenant=profile['tenant_id']
        permission=profile.get('permission_operational')
        if profile.get('role')!='admin' and not (permission is True or permission is None and profile.get('role')=='staff'):
            raise GatewayError(403,'此帳號沒有飼主／寵物建檔權限。','GB_RECORD_REJECTED')
        payload=parameters(request,entity,tenant)
        previous=lookup(entity,payload['id'],tenant,token)
        replayed=previous is not None
        if previous is None:
            if entity=='pets' and lookup('owners',payload['owner_id'],tenant,token) is None:
                raise rejected('找不到本院飼主，請重新選擇')
            try:
                rows=upstream('/rest/v1/'+entity+'?select=*',token,method='POST',payload=[payload],record_errors=True)
                if not isinstance(rows,list) or len(rows)!=1:raise GatewayError(502)
                previous=rows[0]
            except GatewayError as exc:
                # A confirmed rejection or ambiguous transport result is resolved
                # by the same UUID, never by a second blind insert.
                if exc.status not in (409,502):raise
                previous=lookup(entity,payload['id'],tenant,token)
                if previous is None:raise exc
                replayed=True
        row=confirm(previous,payload)
        return JsonResponse({'data':row,'replayed':replayed,'tenant_id':tenant,'user_id':context['user']['id']})
    except GatewayError as exc:return error_response(exc)
