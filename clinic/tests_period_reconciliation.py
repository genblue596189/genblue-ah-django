import json
from unittest.mock import patch
from django.test import SimpleTestCase

class PeriodReconciliationBridgeTests(SimpleTestCase):
    def setUp(self):
        self.context={'user':{'id':'u'},'profile':{'role':'admin','tenant_id':'A'}}
    def post(self,body):
        return self.client.post('/api/period-reconciliation/',data=json.dumps(body),content_type='application/json',HTTP_AUTHORIZATION='Bearer token')
    def test_report_and_admin_action_pass_real_bearer_to_sql(self):
        with patch('clinic.period_reconciliation.verified_context',return_value=self.context),patch('clinic.period_reconciliation.upstream',return_value={'tenant_id':'A'}) as upstream:
            for action in ('report','confirm_paid','exclude_test','revoke'):
                self.assertEqual(self.post({'action':action,'data':{}}).status_code,200)
                self.assertEqual(upstream.call_args.args[1],'token')
                self.assertEqual(upstream.call_args.kwargs['payload']['p_action'],action)
    def test_staff_cannot_write_but_can_read(self):
        context={'user':{'id':'u'},'profile':{'role':'staff','tenant_id':'A'}}
        with patch('clinic.period_reconciliation.verified_context',return_value=context),patch('clinic.period_reconciliation.upstream',return_value={'tenant_id':'A'}) as upstream:
            self.assertEqual(self.post({'action':'confirm_paid','data':{}}).status_code,403)
            upstream.assert_not_called()
            self.assertEqual(self.post({'action':'report','data':{}}).status_code,200)
    def test_wrong_tenant_and_invalid_action_block(self):
        with patch('clinic.period_reconciliation.verified_context',return_value=self.context),patch('clinic.period_reconciliation.upstream',return_value={'tenant_id':'B'}) as upstream:
            self.assertEqual(self.post({'action':'report','data':{}}).status_code,502)
            upstream.reset_mock()
            self.assertEqual(self.post({'action':'delete','data':{}}).status_code,400)
            upstream.assert_not_called()
    def test_cookie_not_sufficient(self):
        with patch('clinic.period_reconciliation.upstream') as upstream:
            self.client.cookies['sessionid']='cookie'
            response=self.client.post('/api/period-reconciliation/',data='{}',content_type='application/json')
            self.assertEqual(response.status_code,401);upstream.assert_not_called()
