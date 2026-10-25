"""Phone review uses the existing employee login and tenant-scoped booking RPC."""
import json,os
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST,require_GET
from django.conf import settings
from .views import page,bearer_token,verified_context,upstream,GatewayError,error_response
from .medical import uuid_value,invalid_json_constant
from .transport import urlopen
_pool=ThreadPoolExecutor(max_workers=1,thread_name_prefix='booking-notify')

def dispatch_notifications():
    secret=os.environ.get('LINE_DISPATCH_SECRET','')
    if not secret:return
    req=Request(settings.SUPABASE_URL+'/functions/v1/online-booking',data=b'{}',method='POST',headers={'Authorization':'Bearer '+secret,'Content-Type':'application/json'})
    try:
        with urlopen(req,timeout=30) as response:response.read()
    except Exception:
        # Durable outbox and scheduled worker own retries. Never undo a confirmed review.
        pass

@require_GET
@never_cache
def review_page(request):return page('booking-review.html')

@csrf_exempt
@never_cache
@require_POST
def review_action(request,action):
    if action not in ('list','search_pets','approve','reject','message'):return JsonResponse({'error':'不支援此操作'},status=404)
    try:
        token=bearer_token(request);context=verified_context(token);profile=context['profile']
        permission=profile.get('permission_appointment')
        allowed=profile.get('role')=='admin' or (permission is True if permission is not None else profile.get('role') in ('staff','doctor'))
        if not allowed:raise GatewayError(403,'此帳號沒有預約管理權限。')
        try:
            if request.content_type!='application/json' or len(request.body)>10000:raise ValueError()
            data=json.loads(request.body,parse_constant=invalid_json_constant)
            fields={'list':set(),'search_pets':{'query'},'approve':{'id','pet_id','verify_member'},'reject':{'id'},'message':{'id','message_id','text'}}[action]
            if not isinstance(data,dict) or set(data)!=fields:raise ValueError()
            if action in ('approve','reject','message'):uuid_value(data['id'])
            if action=='approve':
                uuid_value(data['pet_id'])
                if type(data['verify_member']) is not bool:raise ValueError()
            if action=='message':
                uuid_value(data['message_id'])
                if not isinstance(data['text'],str) or not 1<=len(data['text'].strip())<=1000:raise ValueError()
            if action=='search_pets' and (not isinstance(data['query'],str) or not 1<=len(data['query'].strip())<=100):raise ValueError()
        except (ValueError,KeyError,TypeError,UnicodeDecodeError):raise GatewayError(400,'請核對審核資料。') from None
        result=upstream('/rest/v1/rpc/ob_line_staff_v1',token,method='POST',payload={'p_action':action,'p_data':data})
        if not isinstance(result,dict):raise GatewayError(502,'未確認操作結果，請重新讀取，勿重複送出。')
        if action in ('list','search_pets') and (result.get('tenant_id') or (result.get('config') or {}).get('tenant_id'))!=profile['tenant_id']:raise GatewayError(502)
        if action in ('approve','reject','message'):
            if result.get('ok') is not True:raise GatewayError(502)
            _pool.submit(dispatch_notifications)
        return JsonResponse({'data':result,'tenant_id':profile['tenant_id'],'user_id':context['user']['id']})
    except GatewayError as exc:return error_response(exc)
