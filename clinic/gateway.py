"""Compatible Django transport for the existing Supabase SDK.

Preserves request bytes, PostgREST queries, error codes, counts and binary files.
Only the configured project and a source-derived API allowlist are reachable.
All private requests use the caller's verified token; no service-role key exists.
"""
import json
from pathlib import Path
from urllib.parse import quote,urlsplit,parse_qs
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError,URLError
from django.conf import settings
from django.http import HttpResponse,JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods
from .transport import urlopen as pooled_open
from .views import bearer_token,verified_context,read_context,invalidate_context,GatewayError,error_response

MANIFEST=json.loads((Path(__file__).parent/'api_manifest.json').read_text(encoding='utf-8'))
REQUEST_HEADERS={'accept','content-type','prefer','range','range-unit','x-upsert','if-none-match','if-match','x-client-info','x-supabase-api-version','origin'}
RESPONSE_HEADERS={'content-type','content-range','range-unit','accept-ranges','etag','last-modified','content-encoding','x-relay-error','x-supabase-response-error'}

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None


def classify(path,method,query):
    if not path or any(c in path for c in ('\\','%','\x00','?','#')): raise GatewayError(400)
    parts=path.split('/')
    if any(part in ('','.', '..') for part in parts): raise GatewayError(400)
    if parts[:2]==['rest','v1']:
        if len(parts)==3 and parts[2] in MANIFEST['tables']:
            return 'private'
        if len(parts)==4 and parts[2]=='rpc' and parts[3] in MANIFEST['rpcs'] and method in ('GET','HEAD','POST'):
            return 'private'
    elif parts[:2]==['auth','v1'] and len(parts)==3:
        endpoint=parts[2]
        if endpoint=='token' and method=='POST' and parse_qs(query).get('grant_type',[''])[0] in ('password','refresh_token','pkce'):
            return 'auth'
        if endpoint=='user' and method in ('GET','PUT') or endpoint=='logout' and method=='POST':
            return 'auth'
    elif parts[:2]==['functions','v1'] and len(parts)==3 and parts[2] in MANIFEST['functions'] and method in ('GET','POST'):
        return 'public' if parts[2] in ('online-booking','imaging-share-v76') else 'private'
    elif parts[:3]==['storage','v1','object']:
        remaining=parts[3:]
        if remaining and remaining[0] in ('sign','list','authenticated','info','public'):
            kind=remaining.pop(0)
        else:kind='object'
        if remaining and remaining[0] in MANIFEST['buckets']:
            if kind=='sign' and method in ('GET','HEAD') and parse_qs(query).get('token'): return 'public'
            return 'private'
    raise GatewayError(404,'此資料介面未列入目前系統整合範圍。')


def destination(path,query):
    base=settings.SUPABASE_URL
    parsed=urlsplit(base)
    local=parsed.hostname in ('localhost','127.0.0.1','::1')
    if not base or not settings.SUPABASE_PUBLISHABLE_KEY or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('','/') or (parsed.scheme!='https' and not(parsed.scheme=='http' and local)):
        raise GatewayError(503)
    if any(c in query for c in ('\r','\n','\x00')):raise GatewayError(400)
    return base.rstrip('/')+'/'+quote(path,safe='/')+('?' +query if query else '')


def send(req):
    # No retry or authenticated redirects, including for money/stock writes.
    return pooled_open(req,timeout=settings.GENBLUE_UPSTREAM_TIMEOUT)


def copy_response(response,status):
    if 300<=status<400:
        return JsonResponse({'message':'上游回傳轉址，未自動跟隨；請保留操作內容並核對結果。','code':'GB_UPSTREAM_UNCONFIRMED'},status=502)
    body=response.read()
    result=HttpResponse(body,status=status)
    for key,value in response.headers.items():
        if key.lower() in RESPONSE_HEADERS:result[key]=value
    return result


@csrf_exempt
@never_cache
@require_http_methods(['GET','HEAD','POST','PUT','PATCH','DELETE'])
def gateway(request,upstream_path):
    try:
        query=request.META.get('QUERY_STRING','')
        kind=classify(upstream_path,request.method,query)
        url=destination(upstream_path,query)
        for header in ('Accept-Profile','Content-Profile'):
            if request.headers.get(header,'public')!='public':raise GatewayError(403,'只允許目前系統的 public 資料介面。')
        token=request.headers.get('Authorization','')
        if kind=='private':
            bearer=bearer_token(request)
            if request.method in ('GET', 'HEAD'):
                read_context(bearer)
            else:
                invalidate_context(bearer)
                verified_context(bearer)  # Writes always check current permissions.
        headers={key:value for key,value in request.headers.items() if key.lower() in REQUEST_HEADERS}
        headers['apikey']=settings.SUPABASE_PUBLISHABLE_KEY
        if token:headers['Authorization']=token
        if kind=='auth' and token.lower().startswith('bearer '):
            invalidate_context(token.split(None, 1)[1])
        body=request.body if request.method not in ('GET','HEAD') else None
        req=Request(url,data=body,headers=headers,method=request.method)
        try:
            with send(req) as response:
                if kind=='private' and response.status in (401,403):invalidate_context(bearer)
                return copy_response(response,response.status)
        except HTTPError as exc:
            if kind=='private' and exc.code in (401,403):invalidate_context(bearer)
            # Pass SQL rejection codes unchanged for existing retry/CAS handling.
            return copy_response(exc,exc.code)
        except (URLError,TimeoutError,OSError):
            return JsonResponse({'message':'上游結果尚未確認，請保留內容並核對原請求，勿重新建帳。','code':'GB_UPSTREAM_UNCONFIRMED'},status=502)
    except GatewayError as exc:
        if exc.status==404:return JsonResponse({'message':exc.message,'code':'GB_ROUTE_NOT_ALLOWED'},status=404)
        response=error_response(exc)
        payload=json.loads(response.content)
        return JsonResponse({'message':payload['error'],'code':'GB_ACCESS_UNCONFIRMED'},status=exc.status)


def gateway_script(request):
    config={'supabaseUrl':settings.SUPABASE_URL,'publishableKey':settings.SUPABASE_PUBLISHABLE_KEY,'edition':'performance-20261024'}
    text=json.dumps(config,ensure_ascii=True).replace('<','\\u003c')
    script=(settings.BASE_DIR/'assets'/'integrated-gateway.js').read_text(encoding='utf-8')
    response=HttpResponse('window.GENBLUE_CONFIG='+text+';\n'+script,content_type='text/javascript; charset=utf-8')
    response['Cache-Control']='no-store'
    return response
