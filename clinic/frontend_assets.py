"""Serve only explicitly inventoried application assets, never arbitrary files."""
import json
from functools import lru_cache
from pathlib import Path
from django.conf import settings
from django.http import FileResponse, Http404, HttpResponseNotModified
from django.utils.http import parse_etags
from django.views.decorators.http import require_GET


@lru_cache(maxsize=4)
def manifest(root):
    return json.loads((Path(root) / 'manifest.json').read_text(encoding='utf-8'))


@require_GET
def frontend_asset(request, asset_path):
    root = settings.BASE_DIR / 'assets' / 'frontend'
    entry = manifest(str(root)).get(asset_path)
    if not entry:
        raise Http404()
    path = root / asset_path
    if not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
        raise Http404()
    etag = '"' + entry['sha256'] + '"'
    matches = parse_etags(request.headers.get('If-None-Match', ''))
    response = (HttpResponseNotModified() if '*' in matches or any(tag.removeprefix('W/') == etag for tag in matches)
                else FileResponse(path.open('rb'), content_type=entry['content_type']))
    response['ETag'] = etag
    # Only a content-addressed URL can be cached without revalidation.
    response['Cache-Control'] = ('public, max-age=31536000, immutable'
                                 if request.GET.get('v') == entry['sha256'] else 'no-cache')
    response['X-Content-Type-Options'] = 'nosniff'
    return response
