"""Dependency-free checks of the actual workflow functions using local fixtures.

This checks request/result/forwarding logic, not Django middleware, live SQL,
browser operation or clinic outcomes. Imports and decorators are not executed.
"""
import ast
import io
import json
from pathlib import Path
from types import SimpleNamespace
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request
from uuid import UUID, uuid4

ROOT = Path(__file__).resolve().parents[1]


def definitions(path, namespace, names=None):
    tree = ast.parse((ROOT / path).read_text(encoding='utf-8'))
    nodes = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and (names is None or node.name in names):
            if isinstance(node, ast.FunctionDef):
                node.decorator_list = []
            nodes.append(node)
        elif names is None and isinstance(node, ast.Assign):
            nodes.append(node)
    exec(compile(ast.Module(body=nodes, type_ignores=[]), path, 'exec'), namespace)


common = {'json': json, 'UUID': UUID}
definitions('clinic/views.py', common, {'GatewayError'})
definitions('clinic/medical.py', common, {'uuid_value', 'invalid_json_constant'})
GatewayError = common['GatewayError']
checks = 0


def check(condition):
    global checks
    assert condition
    checks += 1


def rejects(fn, status, *, definitive=None):
    try:
        fn()
    except GatewayError as error:
        check(error.status == status)
        if definitive is not None:
            check((error.code is not None) == definitive)
    else:
        raise AssertionError('Expected request/result rejection')


def namespace(module):
    scope = dict(common)
    definitions(module, scope)
    return scope


def request(data):
    return SimpleNamespace(content_type='application/json', body=json.dumps(data).encode('utf-8'))


def forwarding(scope, handler, action, data, reply, *, role='admin'):
    calls = []
    context = {'profile': {'tenant_id': 'clinic-A', 'role': role}, 'user': {'id': 'fixture-user'}}
    scope['bearer_token'] = lambda req: 'fixture-bearer'
    scope['verified_context'] = lambda token: context
    def upstream(*args, **kwargs):
        calls.append((args, kwargs))
        return reply
    scope['upstream'] = upstream
    scope['JsonResponse'] = lambda body, status=200: SimpleNamespace(body=body, status=status)
    scope['error_response'] = lambda error: SimpleNamespace(status=error.status, body={'code': error.code})
    original = json.loads(json.dumps(data))
    response = scope[handler](request(data), action)
    check(data == original)
    return response, calls


def main():
    identifiers = [str(uuid4()) for _ in range(6)]
    job_id, claim_id, appointment_id, pet_id, owner_id, medicine_id = identifiers
    draft = {'billingAppointmentId': appointment_id, 'billingPetId': pet_id, 'ownerId': owner_id,
             'medicationGroups': [{'kind': 'oral', 'price': 100, 'drugs': [{'medicine_id': medicine_id, 'quantity': 0.33}]}],
             'lines': [{'item_name': '門診', 'quantity': 1, 'unit_price': 250}], 'total': 350}
    send = {'id': job_id, 'claim_id': claim_id, 'draft': draft,
            'prescription': [{'medicine_id': medicine_id, 'quantity': 0.33, 'custom_dose': '0.33 ml'}], 'chief': 'fixture'}
    pharmacy = namespace('clinic/pharmacy.py')
    valid_job = {'id': job_id, 'tenant_id': 'clinic-A', 'appointment_id': appointment_id,
                 'prescription': send['prescription'], 'chief': send['chief']}
    fixtures = {
        'list': ({'query': '', 'filter': 'active', 'offset': 0}, {'jobs': []}),
        'counts': ({}, {'waiting': 0, 'returned': 0}),
        'staff': ({}, {'staff': []}), 'export': ({}, {'jobs': []}),
        'permission': ({'user_id': owner_id, 'enabled': True}, {'ok': True}),
        'send': (send, {'job': valid_job}),
        'claim': ({'id': job_id, 'version': 7}, {'job': valid_job}),
        'complete': ({'id': job_id, 'version': 7, 'checked': True}, {'job': valid_job}),
        'return': ({'id': job_id, 'version': 7, 'reason': '請核對'}, {'job': valid_job}),
        'cancel': ({'id': job_id, 'version': 7, 'reason': '撤回修改'}, {'job': valid_job}),
        'handed': ({'id': job_id, 'version': 7}, {'job': valid_job}),
    }
    for action, (data, body) in fixtures.items():
        reply = {'tenant_id': 'clinic-A', **body}
        check(pharmacy['parameters'](request(data), action) == data)
        response, calls = forwarding(pharmacy, 'pharmacy_action', action, data, reply)
        check(response.status == 200 and response.body['data'] == reply)
        check(len(calls) == 1)
        check(calls[0] == (('/rest/v1/rpc/pharmacy_room_v9133', 'fixture-bearer'),
                           {'method': 'POST', 'payload': {'p_action': action, 'p_data': data}, 'workflow_errors': True}))
    for bad in [{**send, 'id': 'invalid'}, {**send, 'chief': []}, {**send, 'prescription': []},
                {**send, 'tenant_id': 'clinic-B'}, {**send, 'draft': []}]:
        rejects(lambda: pharmacy['parameters'](request(bad), 'send'), 400, definitive=True)
    rejects(lambda: pharmacy['parameters'](request({'id': job_id, 'version': True}), 'claim'), 400)
    rejects(lambda: pharmacy['parameters'](request({'id': job_id, 'version': 7, 'checked': False}), 'complete'), 400)
    for body in [{'tenant_id': 'clinic-B', 'job': valid_job},
                 {'tenant_id': 'clinic-A', 'job': {**valid_job, 'id': claim_id}},
                 {'tenant_id': 'clinic-A', 'job': {**valid_job, 'prescription': []}}]:
        rejects(lambda: pharmacy['validate_result'](body, 'send', send, 'clinic-A'), 502, definitive=False)
    response, calls = forwarding(pharmacy, 'pharmacy_action', 'permission', fixtures['permission'][0],
                                 {'tenant_id': 'clinic-A', 'ok': True}, role='doctor')
    check(response.status == 403 and not calls)
    pos = namespace('clinic/pos_workflow.py')
    for action, data, body in [
        ('list', {}, {'pending': [], 'methods': [], 'history': [], 'movements': []}),
        ('work_list_v854', {'offset': 50, 'reissue_offset': 0}, {'paid': [], 'reissues': []}),
        ('finance_status', {'invoice_ids': [job_id]}, {'statuses': []}),
        ('reissue_links_v854', {'invoice_ids': [job_id]}, {'rows': []}),
        ('daily_summary', {}, {'summary': {}}), ('bank_pending', {'offset': 0}, {'rows': []}),
        ('dispensing', {'id': job_id, 'version': 7, 'value': '已調劑', 'reason': ''}, {'ok': True, 'version': 8}),
    ]:
        reply = {'tenant_id': 'clinic-A', **body}
        check(pos['parameters'](request(data), action) == data)
        response, calls = forwarding(pos, 'pos_action', action, data, reply)
        check(response.status == 200)
        check(len(calls) == 1 and calls[0][1]['payload'] == {'p_action': action, 'p_data': data})
    rejects(lambda: pos['parameters'](request({'invoice_ids': [job_id] * 501}), 'finance_status'), 400)
    rejects(lambda: pos['parameters'](request({'offset': True}), 'bank_pending'), 400)
    rejects(lambda: pos['validate_result']({'tenant_id': 'clinic-B', 'pending': []}, 'list', 'clinic-A'), 502)
    rejects(lambda: pos['validate_result']({'ok': 1, 'version': 8}, 'dispensing', 'clinic-A'), 502, definitive=False)
    checkout = namespace('clinic/checkout.py')
    for action, data in [('edit', {'id': job_id, 'version': 7, 'draft': draft}),
                         ('cancel', {'id': job_id, 'version': 7})]:
        response, calls = forwarding(checkout, 'checkout_action', action, data, {'ok': True})
        check(response.status == 200 and len(calls) == 1)
        check(calls[0][1]['payload'] == {'p_action': action, 'p_data': data})
    response, calls = forwarding(checkout, 'checkout_action', 'cancel', {'id': job_id, 'version': 7}, {'ok': True}, role='staff')
    check(response.status == 403 and not calls)
    # Exercise the real upstream error decoder with a local opener that only raises.
    transport = dict(common, Request=Request, urlsplit=urlsplit, HTTPError=HTTPError,
                     URLError=URLError, settings=SimpleNamespace(SUPABASE_URL='https://fixture.invalid', SUPABASE_PUBLISHABLE_KEY='fixture-public'))
    definitions('clinic/views.py', transport, {'upstream'})
    for code, status, definite in [('P0001', 409, True), ('42501', 403, True), ('PGRST202', 503, False)]:
        calls = []
        def opener(*args, **kwargs):
            calls.append(args)
            raise HTTPError('https://fixture.invalid', 400, 'fixture', {}, io.BytesIO(json.dumps({'code': code, 'message': 'private database detail'}).encode()))
        transport['urlopen'] = opener
        rejects(lambda: transport['upstream']('/rest/v1/rpc/pharmacy_room_v9133', 'fixture', method='POST', payload={}, workflow_errors=True), status, definitive=definite)
        check(len(calls) == 1)
    print(f'{checks} local workflow contract checks passed (no Django runtime, network, SQL or clinic data).')


if __name__ == '__main__':
    main()
