"""Django HTTP boundary checks with mocked upstreams; no live clinic data."""
import copy
import json
from unittest.mock import patch
from uuid import uuid4
from django.test import SimpleTestCase
from .views import GatewayError


class WorkflowHttpTests(SimpleTestCase):
    def setUp(self):
        self.job, self.claim, self.appt, self.pet, self.owner = [str(uuid4()) for _ in range(5)]
        self.context = {'profile': {'tenant_id': 'clinic-A', 'role': 'admin'}, 'user': {'id': 'fixture-user'}}
        self.draft = {'billingAppointmentId': self.appt, 'billingPetId': self.pet, 'ownerId': self.owner,
                      'lines': [], 'medicationGroups': []}
        self.send = {'id': self.job, 'claim_id': self.claim, 'draft': self.draft,
                     'prescription': [{'medicine_id': 'fixture', 'quantity': .33, 'custom_dose': '.33 ml'}], 'chief': 'fixture'}
        self.job_result = {'id': self.job, 'tenant_id': 'clinic-A', 'appointment_id': self.appt,
                           'prescription': self.send['prescription'], 'chief': 'fixture'}

    def perform(self, area, action, data, result=None, error=None, role='admin', auth=True):
        module = {'pos': 'pos_workflow', 'pharmacy': 'pharmacy', 'checkout': 'checkout'}[area]
        context = copy.deepcopy(self.context); context['profile']['role'] = role
        with patch('clinic.'+module+'.verified_context', return_value=context), patch('clinic.'+module+'.upstream', return_value=result, side_effect=error) as remote:
            response = self.client.post('/api/'+area+'/'+action+'/', data=json.dumps(data), content_type='application/json', **({'HTTP_AUTHORIZATION': 'Bearer local-test'} if auth else {}))
        return response, remote

    def test_pos_all_named_routes_preserve_original_payload(self):
        fixtures = [('list', {}, {'pending': [], 'methods': [], 'history': [], 'movements': []}),
                    ('work_list_v854', {'offset': 50}, {'paid': [], 'reissues': []}),
                    ('finance_status', {'invoice_ids': [self.job]}, {'statuses': []}),
                    ('reissue_links_v854', {'invoice_ids': [self.job]}, {'rows': []}),
                    ('daily_summary', {}, {}), ('bank_pending', {'offset': 0}, {'rows': []}),
                    ('dispensing', {'id': self.job, 'version': 3, 'value': '已調劑', 'reason': ''}, {'ok': True, 'version': 4})]
        for action, data, result in fixtures:
            with self.subTest(action=action):
                response, remote = self.perform('pos', action, data, {'tenant_id': 'clinic-A', **result})
                self.assertEqual(response.status_code, 200)
                self.assertIn('no-store', response.headers['Cache-Control'])
                self.assertEqual(remote.call_count, 1)
                self.assertEqual(remote.call_args.args, ('/rest/v1/rpc/pos_v77', 'local-test'))
                self.assertEqual(remote.call_args.kwargs['payload'], {'p_action': action, 'p_data': data})

    def test_pos_foreign_response_is_not_success(self):
        response, _ = self.perform('pos', 'list', {}, {'tenant_id': 'clinic-B', 'pending': []})
        self.assertEqual(response.status_code, 502)

    def test_pos_invalid_version_rejected_before_sql(self):
        response, remote = self.perform('pos', 'dispensing', {'id': self.job, 'version': True, 'value': '已交付'})
        self.assertEqual(response.status_code, 400); remote.assert_not_called()

    def test_new_routes_require_bearer_and_post(self):
        for area, action in [('pos', 'list'), ('pharmacy', 'counts')]:
            with self.subTest(area=area):
                response, remote = self.perform(area, action, {}, auth=False)
                self.assertEqual(response.status_code, 401); remote.assert_not_called()
                self.assertEqual(self.client.get('/api/'+area+'/'+action+'/').status_code, 405)

    def test_unknown_routes_cannot_forward_arbitrary_actions(self):
        for area in ('pos', 'pharmacy'):
            response, remote = self.perform(area, 'delete_everything', {})
            self.assertEqual(response.status_code, 404); remote.assert_not_called()

    def test_pharmacy_send_keeps_uuid_doses_and_original_draft(self):
        response, remote = self.perform('pharmacy', 'send', self.send, {'tenant_id': 'clinic-A', 'job': self.job_result})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(remote.call_count, 1)
        self.assertEqual(remote.call_args.kwargs['payload'], {'p_action': 'send', 'p_data': self.send})
        self.assertEqual(response.json()['data']['job']['id'], self.job)
        self.assertIn('no-store', response.headers['Cache-Control'])

    def test_pharmacy_management_requires_admin(self):
        for action, data in [('staff', {}), ('export', {}), ('permission', {'user_id': self.owner, 'enabled': True})]:
            response, remote = self.perform('pharmacy', action, data, role='doctor')
            self.assertEqual(response.status_code, 403); remote.assert_not_called()

    def test_pharmacy_cannot_accept_other_job_or_clinic(self):
        for job in [{**self.job_result, 'id': self.owner}, {**self.job_result, 'tenant_id': 'clinic-B'}]:
            response, _ = self.perform('pharmacy', 'send', self.send, {'tenant_id': 'clinic-A', 'job': job})
            self.assertEqual(response.status_code, 502)
            self.assertNotIn('code', response.json())

    def test_pharmacy_uncertain_write_does_not_retry_or_clear_recovery(self):
        response, remote = self.perform('pharmacy', 'send', self.send, error=GatewayError(502))
        self.assertEqual(response.status_code, 502); self.assertEqual(remote.call_count, 1)
        self.assertNotIn('code', response.json())

    def test_pharmacy_rejects_client_tenant_override(self):
        response, remote = self.perform('pharmacy', 'send', {**self.send, 'tenant_id': 'clinic-B'})
        self.assertEqual(response.status_code, 400); remote.assert_not_called()

    def test_pending_edit_uses_same_id_and_version(self):
        data = {'id': self.job, 'version': 3, 'draft': self.draft}
        response, remote = self.perform('checkout', 'edit', data, {'ok': True})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(remote.call_args.kwargs['payload'], {'p_action': 'edit', 'p_data': data})

    def test_pending_cancel_requires_admin(self):
        response, remote = self.perform('checkout', 'cancel', {'id': self.job, 'version': 3}, role='staff')
        self.assertEqual(response.status_code, 403); remote.assert_not_called()
