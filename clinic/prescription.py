import json
from urllib.parse import urlencode
from uuid import UUID
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .views import bearer_token, read_context as verified_context, upstream, GatewayError, error_response
from .prescription_math import calculate


@csrf_exempt
@never_cache
@require_POST
def prescription_calculate(request):
    try:
        token = bearer_token(request)
        context = verified_context(token)
        if request.content_type != 'application/json' or len(request.body) > 4096:
            raise GatewayError(400)
        try:
            data = json.loads(request.body)
            if not isinstance(data,dict) or set(data) != {'medicine_id','route','dose','weight','frequency','days','unit'}:
                raise ValueError()
            if str(UUID(data['medicine_id'])) != data['medicine_id']: raise ValueError()
            if data['route'] not in ('口服藥','皮下注射','肌肉注射','靜脈注射'): raise ValueError()
            if data['unit'] not in ('mg/kg','IU/kg','ml/kg','ml',''): raise ValueError()
            if any(isinstance(data[k],bool) or not isinstance(data[k],(str,int,float)) for k in ('dose','weight','frequency','days')):
                raise ValueError()
            for key in ('dose','weight','frequency','days'): float(data[key] or 0)
        except (ValueError,TypeError,KeyError,UnicodeDecodeError,AttributeError,OverflowError):
            raise GatewayError(400) from None
        query = urlencode({'select':'id,usage_dose','id':'eq.'+data['medicine_id'],
                           'tenant_id':'eq.'+context['profile']['tenant_id'],'limit':'2'})
        medicines = upstream('/rest/v1/medicines?'+query,token)
        if not isinstance(medicines,list): raise GatewayError(502)
        if len(medicines) != 1: raise GatewayError(404,'找不到本院藥品，請重新選擇。')
        return JsonResponse(calculate(data,medicines[0]))
    except GatewayError as exc:
        return error_response(exc)
