"""Exercise actual medical functions with coordinated local reads, no Django/SQL.

Events prove overlap without asserting unreliable timing or clinical outcomes.
"""
import ast
from concurrent.futures import ThreadPoolExecutor
import copy
from pathlib import Path
from threading import Event, Lock
from urllib.parse import urlencode
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]


def load(path, names, scope):
    tree = ast.parse((ROOT / path).read_text())
    nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in names]
    exec(compile(ast.Module(body=nodes, type_ignores=[]), path, 'exec'), scope)


def main():
    scope = {'urlencode': urlencode, '_UNREAD': object()}
    load('clinic/views.py', {'GatewayError'}, scope)
    error = scope['GatewayError']
    load('clinic/medical.py', {'verify_visit', 'rows', 'saved_record', 'matches', 'save_record'}, scope)
    pet, appt, claim, request_id = [str(uuid4()) for _ in range(4)]
    data = {'pet_id': pet, 'appointment_id': appt, 'claim_id': claim, 'request_id': request_id,
            'mode': 'checkout', 'chief': 'fixture',
            'prescriptions': [{'medicine_id': 'fixture-drug', 'quantity': 0.33, 'custom_dose': '0.33 ml'}]}
    record = {'id': request_id, 'tenant_id': 'clinic-A', 'pet_id': pet, 'status': '診間看診中',
              'chief_complaint': data['chief'], 'prescription_details': copy.deepcopy(data['prescriptions']),
              'vaccine_info': {'django_visit_v1': {'appointment_id': appt, 'claim_id': claim}}}
    context = {'profile': {'tenant_id': 'clinic-A'}}
    total = 0
    with ThreadPoolExecutor(max_workers=2) as pool:
        scope['_record_read_pool'] = pool
        for scenario in ('new', 'replay', 'different-content', 'denied', 'bad-appointment',
                         'claim-network-failure', 'read-failure', 'write-response-lost'):
            started, checked = Event(), Event()
            calls, lock = [], Lock()
            def upstream(path, token, method='GET', payload=None):
                with lock: calls.append((path, token, method, payload))
                assert token == 'fixture-token'
                if path.startswith('/rest/v1/appointments?'):
                    assert 'tenant_id=eq.clinic-A' in path
                    return [] if scenario == 'bad-appointment' else [{'id': appt, 'pet_id': pet, 'status': '診間看診中'}]
                if path == '/rest/v1/rpc/verify_clinic_visit_v51':
                    assert started.wait(2), 'Saved-record read did not overlap claim verification'
                    checked.set()
                    if scenario == 'claim-network-failure': raise error(502)
                    return scenario != 'denied'
                if path.startswith('/rest/v1/medical_records?') and method == 'GET':
                    started.set()
                    assert checked.wait(2), 'Claim check blocked behind saved-record read'
                    if scenario == 'read-failure': raise error(502)
                    if scenario == 'replay': return [copy.deepcopy(record)]
                    if scenario == 'different-content': return [{**record, 'chief_complaint': 'other content'}]
                    return []
                if path.startswith('/rest/v1/medical_records?') and method == 'POST':
                    assert checked.is_set(), 'Write ran before claim confirmation'
                    assert payload == [record], 'Medical text/doses/units/request ID changed'
                    if scenario == 'write-response-lost': raise error(502)
                    return [copy.deepcopy(record)]
                raise AssertionError('Unexpected endpoint: ' + path)
            scope['upstream'] = upstream
            try:
                previous = scope['verify_visit'](data, context, 'fixture-token', prefetch_record=True)
                result = scope['save_record'](data, 'clinic-A', 'fixture-token', previous=previous)
                assert scenario in ('new', 'replay')
                assert result['id'] == request_id and result['replayed'] == (scenario == 'replay')
            except error as exc:
                expected = {'different-content': 409, 'denied': 403, 'bad-appointment': 409,
                            'claim-network-failure': 502, 'read-failure': 502, 'write-response-lost': 502}
                assert exc.status == expected[scenario]
            # Drain local read jobs before changing fixtures for the next case.
            pool.submit(lambda: None).result()
            writes = [c for c in calls if c[2] == 'POST' and '/medical_records?' in c[0]]
            assert len(writes) == (1 if scenario in ('new', 'write-response-lost') else 0)
            if scenario != 'bad-appointment':
                assert len([c for c in calls if c[2] == 'GET' and '/medical_records?' in c[0]]) == 1
            assert all('invoice' not in c[0] and 'inventory' not in c[0] for c in calls)
            total += 1
    print(f'{total} coordinated medical scenarios passed: read overlap, unchanged payload/UUID, replay, denial and uncertain-write guards; no external writes.')


if __name__ == '__main__':
    main()
