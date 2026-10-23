import json
from unittest.mock import patch
from django.test import SimpleTestCase, Client
from django.conf import settings
from .prescription_math import calculate, volume
from .views import GatewayError


class PrescriptionTests(SimpleTestCase):
    def test_144_legacy_javascript_results(self):
        fixtures=json.loads((settings.BASE_DIR/'tests/prescription-parity.json').read_text(encoding='utf-8'))
        self.assertEqual(len(fixtures['cases']),144)
        for case in fixtures['cases']:
            with self.subTest(input=case['input']):
                self.assertEqual(calculate(case['input'],{'usage_dose':case['input']['strength']}),case['expected'])

    def setUp(self):
        self.client = Client()
        self.data = {'medicine_id':'00000000-0000-4000-8000-000000000001','route':'皮下注射',
                     'dose':'100','weight':'12.8','frequency':'2','days':'14','unit':'IU/kg'}

    def post(self, data=None):
        return self.client.post('/api/prescription/calculate/',json.dumps(self.data if data is None else data),
                                content_type='application/json',HTTP_AUTHORIZATION='Bearer test')

    @patch('clinic.prescription.verified_context',return_value={'profile':{'tenant_id':'clinic-A'}})
    @patch('clinic.prescription.upstream',return_value=[{'usage_dose':'2000IU/0.3ml'}])
    def test_reads_tenant_medicine_and_ignores_injection_course(self, upstream, context):
        response=self.post()
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['quantity'],'0.192')
        query=upstream.call_args.args[0]
        self.assertIn('tenant_id=eq.clinic-A',query)
        self.assertIn('id=eq.'+self.data['medicine_id'],query)
        self.assertEqual(response.headers['Cache-Control'],'max-age=0, no-cache, no-store, must-revalidate, private')

    @patch('clinic.prescription.verified_context',side_effect=GatewayError(401))
    @patch('clinic.prescription.upstream')
    def test_invalid_token_never_reads_medicine(self, upstream, context):
        self.assertEqual(self.post().status_code,401)
        upstream.assert_not_called()

    @patch('clinic.prescription.verified_context',return_value={'profile':{'tenant_id':'clinic-A'}})
    @patch('clinic.prescription.upstream',return_value=[])
    def test_other_tenant_medicine_not_found(self, upstream, context):
        self.assertEqual(self.post().status_code,404)

    @patch('clinic.prescription.verified_context',return_value={'profile':{'tenant_id':'clinic-A'}})
    @patch('clinic.prescription.upstream')
    def test_rejects_browser_supplied_strength(self, upstream, context):
        self.assertEqual(self.post({**self.data,'strength':'1IU/ml'}).status_code,400)
        upstream.assert_not_called()

    def test_incompatible_concentration(self):
        self.assertEqual(calculate(self.data,{'usage_dose':'10mg/ml'})['quantity'],'')

    def test_no_rounding_to_zero(self):
        self.assertEqual(calculate({**self.data,'dose':'.001'}, {'usage_dose':'2000IU/ml'})['quantity'],'')

    def test_solid_total_keeps_frequency_and_days(self):
        result=calculate({**self.data,'route':'口服藥','dose':'10','weight':'5','frequency':'2','days':'14'}, {'usage_dose':'250mg/顆'})
        self.assertEqual(result['quantity'],'5.6')

    def test_manual_prn_and_invalid_days(self):
        for changes in ({'frequency':'0'},{'days':'1.5'},{'weight':'NaN'}):
            self.assertEqual(calculate({**self.data,'route':'口服藥',**changes},{'usage_dose':'250mg'})['quantity'],'')
