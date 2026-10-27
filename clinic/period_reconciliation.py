"""Period report and audited manager decisions; cash and invoices are untouched."""
import json
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .views import bearer_token, verified_context, upstream, GatewayError, error_response

@csrf_exempt
@never_cache
@require_POST
def reconcile(request):
    try:
        token=bearer_token(request)
        context=verified_context(token)
        if request.content_type!='application/json' or len(request.body)>20000:raise GatewayError(400)
        try:
            body=json.loads(request.body)
            if not isinstance(body,dict) or set(body)!={'action','data'} or body['action'] not in ('report','confirm_paid','exclude_test','revoke') or not isinstance(body['data'],dict):raise ValueError()
        except (ValueError,TypeError,UnicodeDecodeError):raise GatewayError(400) from None
        if body['action']!='report' and context['profile'].get('role')!='admin':
            raise GatewayError(403,'只有管理者可以核對或撤銷。')
        result=upstream('/rest/v1/rpc/period_reconcile_v20261027',token,method='POST',payload={'p_action':body['action'],'p_data':body['data']})
        if not isinstance(result,dict) or result.get('tenant_id')!=context['profile']['tenant_id']:raise GatewayError(502)
        return JsonResponse({'data':result,'user_id':context['user']['id']})
    except GatewayError as exc:return error_response(exc)
