"""Thread-local HTTPS reuse. No write retries, redirects, or default credentials."""
import http.client
import io
import ssl
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

_local = threading.local()
_tls = ssl.create_default_context()

class Reply(io.BytesIO):
    def __init__(self, body, status, headers):
        super().__init__(body)
        self.status = status
        self.headers = headers


def urlopen(request, timeout=15):
    target = urlsplit(request.full_url)
    if target.scheme not in ('http', 'https') or target.username or target.password:
        raise URLError('Invalid upstream URL')
    key = (target.scheme, target.hostname, target.port)
    method = request.get_method()
    path = target.path or '/'
    if target.query:
        path += '?' + target.query
    for attempt in range(2 if method in ('GET', 'HEAD') else 1):
        saved = getattr(_local, 'connection', None)
        if saved and (saved[0] != key or time.monotonic() - saved[2] > 15):
            saved[1].close()
            saved = None
        conn = saved[1] if saved else (
            http.client.HTTPSConnection(target.hostname, target.port, timeout=timeout, context=_tls)
            if target.scheme == 'https' else
            http.client.HTTPConnection(target.hostname, target.port, timeout=timeout)
        )
        conn.timeout = timeout
        if conn.sock is not None:
            conn.sock.settimeout(timeout)
        try:
            conn.request(method, path, body=request.data, headers=dict(request.header_items()))
            response = conn.getresponse()
            status, headers = response.status, response.headers
            body = response.read()
            if response.will_close:
                conn.close()
                _local.connection = None
            else:
                _local.connection = (key, conn, time.monotonic())
            if status >= 300:
                raise HTTPError(request.full_url, status, 'Upstream response', headers, io.BytesIO(body))
            return Reply(body, status, headers)
        except HTTPError:
            raise
        except (OSError, http.client.HTTPException) as exc:
            conn.close()
            _local.connection = None
            # Recover stale reused connections only for GET/HEAD, never writes.
            if saved and method in ('GET', 'HEAD') and attempt == 0:
                continue
            raise URLError('Upstream connection failed') from exc
