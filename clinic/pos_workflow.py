"""Named POS read/progress contracts; existing SQL owns state and permissions.

No schema changes, stock operations, write retries, or service-role credentials.
"""
import json
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .medical import uuid_value, invalid_json_constant
from .views import bearer_token, verified_context, upstream, GatewayError, error_response

READ_ACTIONS = {'list', 'work_list_v854', 'finance_status', 'reissue_links_v854',
                'daily_summary', 'bank_pending'}
ACTIONS = READ_ACTIONS | {'dispensing'}


def parameters(request, action):
    try:
        if request.content_type != 'application/json' or len(request.body) > 100000:
            raise ValueError()
        data = json.loads(request.body, parse_constant=invalid_json_constant)
        required, optional = {
            'list': (set(), set()),
            'daily_summary': (set(), set()),
            'work_list_v854': (set(), {'offset', 'reissue_offset'}),
            'bank_pending': (set(), {'offset'}),
            'finance_status': ({'invoice_ids'}, set()),
            'reissue_links_v854': ({'invoice_ids'}, set()),
            'dispensing': ({'id', 'version', 'value'}, {'reason'}),
        }[action]
        if not isinstance(data, dict) or not required <= set(data) <= required | optional:
            raise ValueError()
        for key in ('offset', 'reissue_offset'):
            if key in data and (type(data[key]) is not int or not 0 <= data[key] <= 2147483647):
                raise ValueError()
        if 'invoice_ids' in data:
            if not isinstance(data['invoice_ids'], list) or len(data['invoice_ids']) > 500:
                raise ValueError()
            for identifier in data['invoice_ids']:
                uuid_value(identifier)
        if action == 'dispensing':
            uuid_value(data['id'])
            if type(data['version']) is not int or not 1 <= data['version'] <= 2147483647:
                raise ValueError()
            if not isinstance(data['value'], str) or data['value'] not in ('未調劑', '已調劑', '已交付'):
                raise ValueError()
            if 'reason' in data and (not isinstance(data['reason'], str) or len(data['reason']) > 20000):
                raise ValueError()
        return data
    except (ValueError, KeyError, TypeError, UnicodeDecodeError, OverflowError):
        raise GatewayError(400, '待付款／調劑資料不正確，本次未送出操作。', 'GB_REQUEST_REJECTED') from None


def validate_result(result, action, tenant):
    if not isinstance(result, dict):
        raise GatewayError(502)
    if action in READ_ACTIONS and result.get('tenant_id') != tenant:
        raise GatewayError(502)
    if 'tenant_id' in result and result['tenant_id'] != tenant:
        raise GatewayError(502)
    collections = {
        'list': ('pending', 'methods', 'history', 'movements'),
        'work_list_v854': ('paid', 'reissues'),
        'finance_status': ('statuses',), 'reissue_links_v854': ('rows',),
        'bank_pending': ('rows',),
    }.get(action, ())
    for key in collections:
        rows = result.get(key)
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise GatewayError(502)
        if any('tenant_id' in row and row['tenant_id'] != tenant for row in rows):
            raise GatewayError(502)
    if action == 'dispensing' and (result.get('ok') is not True or
            type(result.get('version')) is not int or result['version'] < 1):
        raise GatewayError(502, '調劑進度結果尚未確認，請重新讀取原帳單核對，勿直接重送。')


@csrf_exempt
@never_cache
@require_POST
def pos_action(request, action):
    if action not in ACTIONS:
        return JsonResponse({'error': '不支援的待付款／調劑操作。'}, status=404)
    try:
        token = bearer_token(request)
        context = verified_context(token)
        data = parameters(request, action)
        result = upstream('/rest/v1/rpc/pos_v77', token, method='POST',
                          payload={'p_action': action, 'p_data': data}, pos_errors=True)
        tenant = context['profile']['tenant_id']
        validate_result(result, action, tenant)
        return JsonResponse({'data': result, 'tenant_id': tenant, 'user_id': context['user']['id']})
    except GatewayError as exc:
        return error_response(exc)
