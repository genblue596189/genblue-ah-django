import copy
import json
from unittest.mock import patch
from uuid import uuid4
from django.test import SimpleTestCase
from .prescription_validation import validate_prescriptions
from .views import GatewayError


class PrescriptionValidationTests(SimpleTestCase):
    def setUp(self):
        self.row={'medicine_id':'drug-A','quantity':'0.33','custom_dose':'0.1 ml/kg',
                  'dispensing_group':{'id':'g1','frequency':'2','days':'14',
                    'preparation_v94':{'form':'調製藥水','mode':'total','total':'30','notes':'冷藏'}},
                  'future_field':{'value':'保留'}}

    def test_delivery_total_is_preserved_without_course_multiplication(self):
        rows=[self.row,copy.deepcopy(self.row)]
        before=json.dumps(rows,ensure_ascii=False)
        validate_prescriptions(rows)
        self.assertEqual(json.dumps(rows,ensure_ascii=False),before)
        self.assertEqual(rows[0]['dispensing_group']['preparation_v94']['total'],'30')

    def test_invalid_quantities(self):
        for value in (None,'',0,'-0.1',True,{},'Infinity','NaN',float('inf'),'1_000'):
            with self.subTest(value=value),self.assertRaises(GatewayError):
                validate_prescriptions([{**self.row,'quantity':value}])

    def test_zero_frequency_prn_is_valid(self):
        self.row['dispensing_group']['frequency']='0'
        validate_prescriptions([self.row])

    def test_fractional_days_are_rejected(self):
        self.row['dispensing_group']['days']='1.5'
        with self.assertRaises(GatewayError):validate_prescriptions([self.row])

    def test_dose_units_must_be_confirmed(self):
        for value in ('','10','0.5 單位','2（劑量待確認）',None):
            with self.subTest(value=value),self.assertRaises(GatewayError):
                validate_prescriptions([{**self.row,'custom_dose':value}])

    def test_manual_dose_text_and_legacy_group_are_preserved(self):
        self.row['custom_dose']='患部薄擦，每日兩次'
        self.row['dispensing_group']['preparation_v94']={'mode':'per','per':'3','form':'調製藥水'}
        validate_prescriptions([self.row])
        self.assertNotIn('total',self.row['dispensing_group']['preparation_v94'])

    def test_old_ungrouped_and_empty_prescriptions_remain_valid(self):
        validate_prescriptions([])
        validate_prescriptions([{'quantity':.33,'custom_dose':'0.33 ml'}])

    def test_unconfirmed_delivery_total_is_not_invented(self):
        self.row['dispensing_group']['preparation_v94']['total']=''
        validate_prescriptions([self.row])
        self.assertEqual(self.row['dispensing_group']['preparation_v94']['total'],'')

    @patch('clinic.medical.verified_context',return_value={'profile':{'tenant_id':'clinic-A'}})
    @patch('clinic.medical.upstream')
    def test_invalid_prescription_is_rejected_before_visit_or_database_write(self,upstream,context):
        self.row['quantity']='-1'
        payload={key:str(uuid4()) for key in ('pet_id','appointment_id','claim_id','request_id')}
        payload.update(mode='waiting',chief='未儲存的主訴',prescriptions=[self.row])
        response=self.client.post('/api/medical/save/',json.dumps(payload),content_type='application/json',HTTP_AUTHORIZATION='Bearer test')
        self.assertEqual(response.status_code,400)
        self.assertEqual(response.json()['code'],'GB_PRESCRIPTION_INVALID')
        self.assertIn('第 1 筆',response.json()['error'])
        upstream.assert_not_called()
