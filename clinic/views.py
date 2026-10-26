import json
import base64, copy, hashlib, threading, time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, wait
from functools import lru_cache
import re
from datetime import datetime, timezone
from urllib.request import Request
from .transport import urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.cache import never_cache

# Bounded shared workers reuse HTTPS connections across requests.
_verification_pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="clinic-verify")

class GatewayError(Exception):
    def __init__(self, status, message=None, code=None):
        self.status = status
        self.message = message
        self.code = code

def upstream(path, token, method="GET", payload=None, pos_errors=False, record_errors=False):
    url = settings.SUPABASE_URL
    parsed = urlsplit(url)
    local = parsed.hostname in ('localhost', '127.0.0.1', '::1')
    if not settings.SUPABASE_PUBLISHABLE_KEY or not url or parsed.query or parsed.fragment or parsed.username or parsed.path not in ('', '/') or (parsed.scheme != 'https' and not (parsed.scheme == 'http' and local)):
        raise GatewayError(503)
    headers = {'apikey': settings.SUPABASE_PUBLISHABLE_KEY, 'Authorization': 'Bearer ' + token, 'Accept': 'application/json'}
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        headers.update({'Content-Type':'application/json', 'Prefer':'return=representation'})
    req = Request(url + path, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=15) as response:
            body = response.read()
            return json.loads(body) if body.strip() else None
    except HTTPError as exc:
        # Preserve only reviewed business messages, never raw SQL details/IDs.
        doctor_messages = {
            '請先完成掛號／報到；看診中的病患不能直接更換指定醫師',
            '此病患已開始看診，請先確認接診狀態，不能直接更換指定醫師',
            '本筆尚未報到或已開始看診，不能指定醫師',
            '此醫師不屬於本院或未啟用接診資格',
            '沒有本院掛號權限',
            '找不到本院候診紀錄',
            '沒有本院病歷編輯權限',
            '接診權已變更，請保留輸入並重新核對',
            '看診權已變更，請保留輸入並重新確認',
            '歸檔病歷已被修改，請保留輸入並核對，不會覆蓋他人的資料',
        }
        if record_errors or path.startswith('/rest/v1/rpc/') or path.startswith('/rest/v1/medical_records'):
            try:
                detail = json.loads(exc.read(8192))
                message = detail.get('message') if isinstance(detail, dict) else None
                code = detail.get('code') if isinstance(detail, dict) else None
                if record_errors and method == 'POST' and path.split('?')[0] in ('/rest/v1/owners','/rest/v1/pets'):
                    import re
                    if isinstance(code,str) and re.fullmatch(r'(P0001|42501|22[0-9A-Z]{3}|23[0-9A-Z]{3})',code):
                        raise GatewayError(403 if code=='42501' else 409,'資料庫拒絕建檔，請核對必填欄位、資料格式及建檔權限。',code) from None
                if pos_errors and path == '/rest/v1/rpc/pos_v77':
                    import re
                    if isinstance(code,str) and re.fullmatch(r'(P0001|42501|22[0-9A-Z]{3}|23[0-9A-Z]{3}|40001|40P01)',code):
                        safe_messages = {
                            '同一收款請求不能更改內容','請選擇實際收款方式；未付款請送待付款',
                            '請先開班，並重新確認本次班別','待付款帳單不存在',
                            '這筆帳單已由櫃台完成收款，請勿再次收錢','帳單已更新，請重載後核對',
                            '院所不符','此帳單已送櫃台，請從待付款接手','未取得有效結帳結果',
                            '收到現金不足','收到現金不正確','收款金額不正確','沒有結帳與核對權限',
                            '掛號與帳單不符或已結束','只能送出自己的看診帳單','請由原醫師送出待付款',
                            '此掛號已有待付款或已收款資料，請由櫃台清單接手',
                        }
                        safe = message if message in safe_messages else '資料庫已拒絕這次結帳請求，請核對帳單、權限或庫存。'
                        raise GatewayError(403 if code=='42501' else 409,safe,code) from None
                if code in ('P0001','42501','40001') and message in doctor_messages:
                    raise GatewayError(403 if code == '42501' else 409, message) from None
            except (ValueError, OSError):
                pass
        raise GatewayError(401 if exc.code == 401 else 403 if exc.code == 403 else 409 if exc.code == 409 else 502) from None
    except (URLError, TimeoutError, ValueError, OSError): raise GatewayError(502) from None

@lru_cache(maxsize=8)
def _page_text(base_dir, name, modified):
    text = (base_dir / 'web' / name).read_text(encoding='utf-8')
    from .frontend_assets import manifest
    entries = manifest(str(base_dir / 'assets' / 'frontend'))
    def version(match):
        name = match.group(1)
        entry = entries.get(name)
        return '/assets/frontend/' + name + ('?v=' + entry['sha256'] if entry else '') + '"'
    return re.sub(r'/assets/frontend/([^"?]+)"', version, text)

def page(name):
    path = settings.BASE_DIR / 'web' / name
    response=HttpResponse(_page_text(settings.BASE_DIR, name, path.stat().st_mtime_ns), content_type='text/html; charset=utf-8')
    response['Cache-Control']='no-cache'
    return response
@require_GET
def home(request): return page('index.html')
@require_GET
def booking(request): return page('booking.html')
@require_GET
def imaging(request): return page('imaging-share.html')
@require_GET
def health(request): return JsonResponse({'service':'genblue-django', 'edition':'checkout-speed-20261024'})
def bearer_token(request):
    parts = request.headers.get('Authorization', '').split()
    if len(parts) != 2 or parts[0].lower() != 'bearer' or len(parts[1]) > 16384:
        raise GatewayError(401)
    return parts[1]

def verified_context(token):
    invalidate_context(token)
    fields = 'tenant_id,display_name,role,can_checkout,permission_clinical,permission_appointment,permission_operational,permission_checkout'
    # The unverified subject is only a query hint. Never authorize using it:
    # authenticate remotely and compare identities before consuming the profile.
    hint = None
    try:
        part = token.split('.')[1]
        claims = json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))
        candidate = claims.get('sub') if isinstance(claims, dict) else None
        from uuid import UUID
        if isinstance(candidate, str) and str(UUID(candidate)) == candidate:
            hint = candidate
    except (ValueError, TypeError, IndexError):
        pass
    if hint:
        query = urlencode({'select': fields, 'user_id':'eq.' + hint, 'limit':'2'})
        auth_job = _verification_pool.submit(upstream, '/auth/v1/user', token)
        profile_job = _verification_pool.submit(upstream, '/rest/v1/user_profiles?' + query, token)
        trial_job = _verification_pool.submit(upstream, '/rest/v1/rpc/my_trial_expires_at', token)
        wait((auth_job, profile_job, trial_job))
        user = auth_job.result()
        if not isinstance(user, dict) or user.get('id') != hint:
            raise GatewayError(401)
    else:
        user = upstream('/auth/v1/user', token)
        if not isinstance(user, dict) or not user.get('id'):
            raise GatewayError(401)
        query = urlencode({'select': fields, 'user_id':'eq.' + str(user['id']), 'limit':'2'})
        profile_job = _verification_pool.submit(upstream, '/rest/v1/user_profiles?' + query, token)
        trial_job = _verification_pool.submit(upstream, '/rest/v1/rpc/my_trial_expires_at', token)
        wait((profile_job, trial_job))
    profiles = profile_job.result()
    if not isinstance(profiles, list) or len(profiles) != 1 or not profiles[0].get('tenant_id'):
        raise GatewayError(403)
    trial = trial_job.result()
    if trial is not None:
        if not isinstance(trial, str): raise GatewayError(502)
        try:
            expiry = datetime.fromisoformat(trial.replace('Z', '+00:00'))
            if expiry.tzinfo is None: raise ValueError()
        except ValueError: raise GatewayError(502) from None
        if expiry <= datetime.now(timezone.utc):
            raise GatewayError(403, '醫院試用期已結束，請聯絡平台管理者。')
    return {'user':{'id':user['id'], 'email':user.get('email')}, 'profile':profiles[0], 'trial_end':trial}

# Read-only verification reuse. Writes always verify live and invalidate this entry.
_context_cache = OrderedDict()
_context_cache_lock = threading.RLock()
_context_locks = [threading.RLock() for _ in range(32)]

def invalidate_context(token):
    key = _context_key(token)
    with _context_cache_lock:
        _context_cache.pop(key, None)

def _context_key(token):
    return hashlib.sha256((settings.SUPABASE_URL + '\0' + settings.SUPABASE_PUBLISHABLE_KEY + '\0' + token).encode()).digest()

def read_context(token):
    key = _context_key(token)
    # Serialize only matching token buckets, avoiding duplicate burst verification.
    with _context_locks[key[0] % len(_context_locks)]:
        with _context_cache_lock:
            entry = _context_cache.get(key)
            if entry and entry[0] > time.monotonic():
                _context_cache.move_to_end(key)
                return copy.deepcopy(entry[1])
            _context_cache.pop(key, None)
        context = verified_context(token)
        ttl = 5.0
        # Claims are used only to shorten reuse AFTER remote authentication succeeds.
        # Opaque or malformed tokens remain valid upstream but are never cached.
        try:
            part = token.split('.')[1]
            claims = json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))
            ttl = min(ttl, float(claims['exp']) - time.time())
            if context['trial_end'] is not None:
                ttl = min(ttl, (datetime.fromisoformat(context['trial_end'].replace('Z', '+00:00')) - datetime.now(timezone.utc)).total_seconds())
        except (ValueError, TypeError, KeyError, IndexError):
            ttl = 0
        if ttl > 0:
            with _context_cache_lock:
                _context_cache[key] = (time.monotonic() + ttl, copy.deepcopy(context))
                while len(_context_cache) > 256:
                    _context_cache.popitem(last=False)
        return context

def error_response(exc):
    messages = {400:'輸入資料不正確，請核對後重試。',409:'掛號資料已變更，請更新候診核對後再試。',401:'登入已失效，請重新登入。',403:'無法取得院所權限，請聯絡管理者。',503:'Django 尚未設定 Supabase 連線。',502:'無法確認院所狀態或取得搜尋結果，請稍後再試。'}
    body={'error':exc.message or messages[exc.status]}
    if exc.code is not None: body['code']=exc.code
    return JsonResponse(body, status=exc.status)

@never_cache
@require_GET
def session(request):
    try:
        return JsonResponse(verified_context(bearer_token(request)))
    except GatewayError as exc:
        return error_response(exc)
