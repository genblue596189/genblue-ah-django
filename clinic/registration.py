"""Homepage check-in, preserving Supabase RLS and existing workflow.

Striped locks serialize requests within one Python process. Cross-process
uniqueness still relies on the existing database constraints; this module does
not claim a distributed transaction or change the SQL schema.
"""
import json
import re
from datetime import datetime, timezone
from threading import Lock
from uuid import UUID
from urllib.parse import urlencode
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .views import bearer_token, verified_context, upstream, GatewayError, error_response

_LOCKS = [Lock() for _ in range(256)]
PURPOSES = {'看診','疫苗','回診','檢查','拿藥','急診','住院'}
SESSIONS = {'上午診','下午診','夜診'}
ACTIVE = {'已預約','候診中','診間看診中'}

def appointment_params(tenant, pet_id):
    return {'tenant_id':'eq.' + str(tenant), 'pet_id':'eq.' + str(pet_id)}

def get_rows(table, params, token):
    data = upstream('/rest/v1/' + table + '?' + urlencode(params), token)
    if not isinstance(data, list) or any(not isinstance(row, dict) for row in data):
        raise GatewayError(502)
    return data

def allowed(profile):
    if profile.get('role') == 'admin': return True
    permission = profile.get('permission_appointment')
    return permission is True if permission is not None else profile.get('role') in ('staff','doctor')

def parse_input(request):
    if request.content_type != 'application/json' or len(request.body) > 4096:
        raise GatewayError(400)
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict): raise ValueError()
        pet_id = data['pet_id']
        request_id = data['request_id']
        if not isinstance(pet_id, str) or not 1 <= len(pet_id) <= 200 or any(ord(c)<32 for c in pet_id):
            raise ValueError()
        if not isinstance(request_id, str) or str(UUID(request_id)) != request_id:
            raise ValueError()
        if data.get('purpose') not in PURPOSES or data.get('session') not in SESSIONS:
            raise ValueError()
        confirm = data.get('confirm_early')
        if confirm is not None and (not isinstance(confirm, dict) or not isinstance(confirm.get('id'), str) or not isinstance(confirm.get('scheduled_at'), str)):
            raise ValueError()
        return data
    except (ValueError, KeyError, TypeError, UnicodeDecodeError):
        raise GatewayError(400) from None

def response_appointment(appointment, tenant, pet_id):
    if (not isinstance(appointment, dict) or not appointment.get('id') or
        appointment.get('pet_id') != pet_id or appointment.get('tenant_id') != tenant or
        appointment.get('status') not in {'候診中','診間看診中'}):
        raise GatewayError(409, '未取得正確的候診紀錄，請更新候診核對後再重試。')
    return appointment

def with_purpose(notes, purpose):
    remainder = re.sub(r'^\[來院目的\] .*\n?', '', str(notes or ''), flags=re.MULTILINE).strip()
    return '[來院目的] ' + purpose + ('\n' + remainder if remainder else '')

def perform_check_in(context, token, data):
    tenant = context['profile']['tenant_id']
    pet_id = data['pet_id']
    # Do not trust an owner_id, pet name, status or tenant supplied by the browser.
    pets = get_rows('pets', {'select':'id,owner_id', 'tenant_id':'eq.' + str(tenant),
                            'id':'eq.' + str(pet_id), 'limit':'2'}, token)
    if len(pets) != 1 or not pets[0].get('owner_id'):
        raise GatewayError(403, '找不到此院所的寵物或飼主關聯，請重新搜尋。')
    params = appointment_params(tenant, pet_id)
    # Stable client UUID also resolves a lost response without making a new row.
    previous = get_rows('appointments', dict(params, select='*', id='eq.' + str(data['request_id']), limit='2'), token)
    if previous:
        if len(previous) != 1: raise GatewayError(409)
        appointment = response_appointment(previous[0], tenant, pet_id)
        return {'kind':'existing','appointment':appointment}
    active = get_rows('appointments', dict(params, select='*', status='in.(已預約,候診中,診間看診中)',
                                         order='scheduled_at.asc,id.asc', limit='1'), token)
    # Preserve priority: already waiting/in consultation before any reservation.
    current = get_rows('appointments', dict(params, select='*', status='in.(候診中,診間看診中)',
                                          order='scheduled_at.asc,id.asc', limit='1'), token)
    appointment = current[0] if current else (active[0] if active else None)
    if appointment and appointment.get('status') in {'候診中','診間看診中'}:
        return {'kind':'existing','appointment':response_appointment(appointment,tenant,pet_id)}
    now = datetime.now(timezone.utc)
    iso = now.isoformat()
    if appointment:
        if appointment.get('status') != '已預約' or not appointment.get('id'):
            raise GatewayError(409)
        scheduled = appointment.get('scheduled_at')
        try:
            when = datetime.fromisoformat(scheduled.replace('Z','+00:00'))
            if when.tzinfo is None: raise ValueError()
        except (ValueError, AttributeError): raise GatewayError(409) from None
        confirm = data.get('confirm_early') or {}
        if when > now and (confirm.get('id') != appointment['id'] or confirm.get('scheduled_at') != scheduled):
            return {'code':'early_check_in', 'appointment':{'id':appointment['id'], 'scheduled_at':scheduled},
                    'error':'尚未到原預約時間，是否提前報到？'}
        # Compare id, status, scheduled time and notes to avoid overwriting changes.
        update_params = dict(params, id='eq.' + str(appointment['id']), status='eq.已預約',
                             scheduled_at='eq.' + str(scheduled), select='*',
                             notes='is.null' if appointment.get('notes') is None else 'eq.' + str(appointment['notes']))
        saved = upstream('/rest/v1/appointments?' + urlencode(update_params), token, method='PATCH',
                         payload={'status':'候診中','checked_in_at':iso,'notes':with_purpose(appointment.get('notes'),data['purpose'])})
    else:
        saved = upstream('/rest/v1/appointments?select=*', token, method='POST', payload=[{
            'id':data['request_id'], 'tenant_id':tenant, 'pet_id':pet_id, 'owner_id':pets[0]['owner_id'],
            'scheduled_at':iso, 'checked_in_at':iso, 'status':'候診中',
            'notes':with_purpose('',data['purpose']), 'session':data['session'],
            'doctor':None, 'assigned_doctor_id':None}])
    if not isinstance(saved, list) or len(saved) != 1:
        raise GatewayError(409)
    return {'kind':'added','appointment':response_appointment(saved[0],tenant,pet_id)}

# This endpoint does not authenticate cookies. A verified Authorization bearer
# is required for every POST, so cross-site cookie submission grants no access.
@csrf_exempt
@never_cache
@require_POST
def register_pet(request):
    try:
        token = bearer_token(request)
        context = verified_context(token)
        if not allowed(context['profile']):
            raise GatewayError(403, '此帳號沒有掛號權限。')
        data = parse_input(request)
        key = (context['profile']['tenant_id'], data['pet_id'])
        with _LOCKS[hash(key) % len(_LOCKS)]:
            result = perform_check_in(context, token, data)
        if result.get('code') == 'early_check_in':
            return JsonResponse(result, status=409)
        return JsonResponse(dict(result, user_id=context['user']['id']))
    except GatewayError as exc:
        return error_response(exc)
