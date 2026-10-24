"""Homepage lookup only. Uses verified tenant plus the caller's RLS token."""
import re
from urllib.parse import urlencode
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET
from .views import bearer_token, read_context as verified_context, upstream, GatewayError, error_response

PAGE_SIZE = 1000
FIELDS = '*,owners(id,name,phone,mobile,owner_code,system_code)'

def quoted(value):
    # PostgREST quoted filter value, preventing punctuation from creating filters.
    return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"') + '"'

def literal_pattern(value):
    # User punctuation is literal; only our outer wildcards perform matching.
    value = re.sub(r'([%_*\\])', r'\\\1', value)
    return '%' + value + '%'

def pattern(value):
    return quoted(literal_pattern(value))

def any_field(fields, value):
    term = pattern(value)
    return '(' + ','.join(field + '.ilike.' + term for field in fields) + ')'

def rows(table, params, token):
    result = []
    offset = 0
    while True:
        query = dict(params, order='id', limit=str(PAGE_SIZE), offset=str(offset))
        batch = upstream('/rest/v1/' + table + '?' + urlencode(query), token)
        if not isinstance(batch, list) or any(not isinstance(row, dict) or 'id' not in row for row in batch):
            raise GatewayError(502)
        result.extend(batch)
        if len(batch) < PAGE_SIZE:
            return result
        offset += len(batch)

def lookup(tenant, token, query, owner_name, owner_id):
    pets_query = {'select':FIELDS, 'tenant_id':'eq.' + str(tenant)}
    if owner_id:
        return rows('pets', dict(pets_query, owner_id='eq.' + str(owner_id)), token)
    if owner_name:
        pets_query['select'] = FIELDS.replace('owners(', 'owners!inner(')
        pets_query['owners.name'] = 'ilike.' + literal_pattern(owner_name)
        if query:
            pets_query['or'] = any_field(('name','microchip'), query)
        return rows('pets', pets_query, token)
    pets_query['or'] = any_field(('name','microchip'), query)
    pets = rows('pets', pets_query, token)
    if pets:
        return pets
    owners = rows('owners', {'select':'id', 'tenant_id':'eq.' + str(tenant),
                            'or':any_field(('name','phone','mobile','owner_code','system_code'), query)}, token)
    pets_query.pop('or')
    for start in range(0, len(owners), 200):
        ids = ','.join(quoted(owner['id']) for owner in owners[start:start+200])
        pets.extend(rows('pets', dict(pets_query, owner_id='in.(' + ids + ')'), token))
    return list({pet['id']:pet for pet in pets}.values())

@never_cache
@require_GET
def search_pets(request):
    try:
        token = bearer_token(request)
        context = verified_context(token)
        query = request.GET.get('query', '').strip()
        owner_name = request.GET.get('owner_name', '').strip()
        owner_id = request.GET.get('owner_id', '').strip()
        if any(len(value) > 200 or any(ord(c) < 32 for c in value) for value in (query, owner_name, owner_id)):
            raise GatewayError(400)
        tenant = context['profile']['tenant_id']
        pets = lookup(tenant, token, query, owner_name, owner_id) if query or owner_name or owner_id else []
        return JsonResponse({'pets':pets, 'tenant_id':tenant, 'user_id':context['user']['id']})
    except GatewayError as exc:
        return error_response(exc)
