"""Pharmacy handoff boundary. Existing pharmacy SQL remains authoritative.

Forward the original job UUID/version, draft and prescription without mutation.
Sending or recovering a job is never automatically retried here.
"""
import json
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .medical import uuid_value, invalid_json_constant
from .views import bearer_token, verified_context, upstream, GatewayError, error_response

READ_ACTIONS = {'list', 'counts', 'staff', 'export'}
JOB_ACTIONS = {'send', 'claim', 'complete', 'return', 'cancel', 'handed'}
ACTIONS = READ_ACTIONS | JOB_ACTIONS | {'permission'}


def parameters(request, action):
    try:
        if request.content_type != 'application/json' or len(request.body) > 2097152:
            raise ValueError()
        data = json.loads(request.body, parse_constant=invalid_json_constant)
        required, optional = {
            'list': (set(), {'query', 'filter', 'offset'}),
            'counts': (set(), set()), 'staff': (set(), set()), 'export': (set(), set()),
            'permission': ({'user_id', 'enabled'}, set()),
            'send': ({'id', 'claim_id', 'draft', 'prescription', 'chief'}, set()),
            'claim': ({'id', 'version'}, set()),
            'complete': ({'id', 'version', 'checked'}, set()),
            'return': ({'id', 'version', 'reason'}, set()),
            'cancel': ({'id', 'version', 'reason'}, set()),
            'handed': ({'id', 'version'}, set()),
        }[action]
        if not isinstance(data, dict) or not required <= set(data) <= required | optional:
            raise ValueError()
        if 'id' in data:
            uuid_value(data['id'])
        if 'version' in data and (type(data['version']) is not int or not 1 <= data['version'] <= 2147483647):
            raise ValueError()
        if 'offset' in data and (type(data['offset']) is not int or not 0 <= data['offset'] <= 2147483647):
            raise ValueError()
        if 'query' in data and (not isinstance(data['query'], str) or len(data['query']) > 100):
            raise ValueError()
        if 'filter' in data and (not isinstance(data['filter'], str) or
                data['filter'] not in ('active', 'all', 'waiting', 'preparing', 'returned', 'ready')):
            raise ValueError()
        if 'reason' in data and (not isinstance(data['reason'], str) or not data['reason'].strip() or len(data['reason']) > 20000):
            raise ValueError()
        if action == 'permission':
            uuid_value(data['user_id'])
            if type(data['enabled']) is not bool:
                raise ValueError()
        if action == 'complete' and data['checked'] is not True:
            raise ValueError()
        if action == 'send':
            uuid_value(data['claim_id'])
            draft = data['draft']
            if not isinstance(draft, dict) or not isinstance(draft.get('lines'), list) or not isinstance(draft.get('medicationGroups'), list):
                raise ValueError()
            uuid_value(draft['billingAppointmentId'])
            uuid_value(draft['billingPetId'])
            uuid_value(draft['ownerId'])
            rx = data['prescription']
            if not isinstance(rx, list) or not 1 <= len(rx) <= 200 or any(not isinstance(row, dict) for row in rx):
                raise ValueError()
            if not isinstance(data['chief'], str) or len(data['chief']) > 200000:
                raise ValueError()
        return data
    except (ValueError, KeyError, TypeError, UnicodeDecodeError, OverflowError):
        raise GatewayError(400, '配藥交接資料不正確，本次未送出操作。', 'GB_REQUEST_REJECTED') from None


def validate_result(result, action, data, tenant):
    if not isinstance(result, dict) or result.get('tenant_id') != tenant:
        raise GatewayError(502, '配藥室結果尚未確認，請保留原請求並重新讀取核對。')
    if action in JOB_ACTIONS:
        job = result.get('job')
        if not isinstance(job, dict) or job.get('id') != data['id'] or job.get('tenant_id') != tenant:
            raise GatewayError(502, '配藥單回覆不符，請保留原送單編號並核對，勿另外送單。')
        if action == 'send' and (job.get('appointment_id') != data['draft']['billingAppointmentId'] or
                job.get('prescription') != data['prescription'] or job.get('chief') != data['chief']):
            raise GatewayError(502, '配藥單內容回覆不符，請保留原送單編號並核對。')
    key = {'list': 'jobs', 'staff': 'staff', 'export': 'jobs'}.get(action)
    if key:
        rows = result.get(key)
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise GatewayError(502)
        if any('tenant_id' in row and row['tenant_id'] != tenant for row in rows):
            raise GatewayError(502)
    if action == 'permission' and result.get('ok') is not True:
        raise GatewayError(502)


@csrf_exempt
@never_cache
@require_POST
def pharmacy_action(request, action):
    if action not in ACTIONS:
        return JsonResponse({'error': '不支援的配藥室操作。'}, status=404)
    try:
        token = bearer_token(request)
        context = verified_context(token)
        data = parameters(request, action)
        if action in ('staff', 'permission', 'export') and context['profile'].get('role') != 'admin':
            raise GatewayError(403, '只有管理者可以管理配藥權限或匯出紀錄。', 'GB_REQUEST_REJECTED')
        result = upstream('/rest/v1/rpc/pharmacy_room_v9133', token, method='POST',
                          payload={'p_action': action, 'p_data': data}, workflow_errors=True)
        tenant = context['profile']['tenant_id']
        validate_result(result, action, data, tenant)
        return JsonResponse({'data': result, 'tenant_id': tenant, 'user_id': context['user']['id']})
    except GatewayError as exc:
        return error_response(exc)
