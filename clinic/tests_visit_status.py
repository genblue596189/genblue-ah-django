import json
from datetime import datetime
from urllib.parse import urlsplit,parse_qs
from unittest.mock import patch
from uuid import uuid4
from django.test import SimpleTestCase
from .views import GatewayError

class VisitStatusTests(SimpleTestCase):
    def setUp(self):
        self.pet,self.app,self.claim,self.record=[str(uuid4()) for _ in range(4)]
        self.context={'user':{'id':'doctor-A'},'profile':{'tenant_id':'clinic-A','role':'doctor'}}
        self.args={'pet_id':self.pet,'appointment_id':self.app,'claim_id':self.claim,'record_id':None}
        self.current={'id':self.app,'pet_id':self.pet,'tenant_id':'clinic-A','status':'診間看診中','clinician_id_v57':'doctor-A','notes':'[來院目的] 看診\n原備註'}

    def perform(self,replies,action='waiting',args=None):
        with patch('clinic.visit_status.verified_context',return_value=self.context),patch('clinic.visit_status.upstream',side_effect=replies) as call:
            response=self.client.post('/api/medical-visit/'+action+'/',data=json.dumps(args or self.args),content_type='application/json',HTTP_AUTHORIZATION='Bearer doctor-token')
            return response,call.call_args_list

    def test_return_waiting_uses_conditional_update_and_caller_token(self):
        response,calls=self.perform([[self.current],True,[{**self.current,'status':'候診中'}]])
        self.assertEqual(response.status_code,200)
        patch_call=calls[-1]
        self.assertEqual(patch_call.kwargs,{'method':'PATCH','payload':{'status':'候診中'}})
        params=parse_qs(urlsplit(patch_call.args[0]).query)
        self.assertEqual(params['id'],['eq.'+self.app])
        self.assertEqual(params['tenant_id'],['eq.clinic-A'])
        self.assertEqual(params['status'],['eq.診間看診中'])
        self.assertEqual(params['clinician_id_v57'],['eq.doctor-A'])
        self.assertTrue(all(c.args[1]=='doctor-token' for c in calls))
        self.assertIn('no-store',response.headers['Cache-Control'])

    def test_saved_waiting_record_is_confirmed_before_status_update(self):
        record={'id':self.record,'pet_id':self.pet,'status':'候診中','prescription_details':[{'custom_dose':'0.33 ml'}]}
        response,calls=self.perform([[self.current],[record],True,[{**self.current,'status':'候診中'}]],args={**self.args,'record_id':self.record})
        self.assertEqual(response.status_code,200)
        self.assertIn('/medical_records?',calls[1].args[0])

    def test_complete_archive_keeps_notes_and_sets_time_on_server(self):
        record={'id':self.record,'pet_id':self.pet,'status':'已完成','prescription_details':[]}
        response,calls=self.perform([[self.current],[record],True,[{**self.current,'status':'已完成'}]],'complete-archive',{**self.args,'record_id':self.record})
        self.assertEqual(response.status_code,200)
        payload=calls[-1].kwargs['payload']
        self.assertEqual(payload['notes'],self.current['notes']+'\n僅病歷歸檔（未收費）')
        self.assertEqual(payload['status'],'已完成')
        self.assertIsNotNone(datetime.fromisoformat(payload['completed_at']).tzinfo)
        self.assertEqual(parse_qs(urlsplit(calls[-1].args[0]).query)['notes'],['eq.'+self.current['notes']])

    def test_read_only_archive_adds_only_viewing_label(self):
        response,calls=self.perform([[{**self.current,'notes':None}],True,[{**self.current,'status':'已完成'}]],'complete-archive')
        self.assertEqual(response.status_code,200)
        self.assertEqual(calls[-1].kwargs['payload']['notes'],'僅查閱舊資料（未收費）')
        self.assertEqual(parse_qs(urlsplit(calls[-1].args[0]).query)['notes'],['is.null'])

    def test_repeat_complete_does_not_duplicate_notes_or_rewrite(self):
        row={**self.current,'status':'已完成','notes':'原備註\n僅查閱舊資料（未收費）'}
        response,calls=self.perform([[row]],'complete-archive')
        self.assertTrue(response.json()['replayed'])
        self.assertEqual(response.json()['appointment']['notes'],row['notes'])
        self.assertEqual(len(calls),1)

    def test_repeat_waiting_is_read_only(self):
        response,calls=self.perform([[{**self.current,'status':'候診中'}]])
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.json()['replayed'])
        self.assertEqual(len(calls),1)

    def test_lost_claim_prevents_any_patch(self):
        response,calls=self.perform([[self.current],False])
        self.assertEqual(response.status_code,403)
        self.assertTrue(all(c.kwargs.get('method')!='PATCH' for c in calls))

    def test_other_clinician_or_wrong_tenant_rejected(self):
        for row in [{**self.current,'clinician_id_v57':'doctor-B'},{**self.current,'tenant_id':'clinic-B'},{**self.current,'pet_id':str(uuid4())}]:
            response,calls=self.perform([[row]])
            self.assertEqual(response.status_code,403)
            self.assertEqual(len(calls),1)

    def test_archive_refuses_missing_record_or_prescription_record(self):
        for records in [[],[{'id':self.record,'pet_id':self.pet,'status':'已完成','prescription_details':[{'quantity':1}]}]]:
            response,calls=self.perform([[self.current],records],'complete-archive',{**self.args,'record_id':self.record})
            self.assertEqual(response.status_code,409)
            self.assertTrue(all(c.kwargs.get('method')!='PATCH' for c in calls))

    def test_concurrent_status_or_notes_change_returns_conflict(self):
        response,_=self.perform([[self.current],True,[]])
        self.assertEqual(response.status_code,409)

    def test_network_failure_never_claims_success(self):
        response,_=self.perform([[self.current],True,GatewayError(502)])
        self.assertEqual(response.status_code,502)

    def test_state_read_does_not_write(self):
        response,calls=self.perform([[self.current]],'state')
        self.assertEqual(response.status_code,200)
        self.assertEqual(len(calls),1)

    def test_arbitrary_status_and_tenant_parameters_rejected(self):
        for key,value in [('status','已完成'),('tenant_id','clinic-B'),('notes','overwrite')]:
            response,calls=self.perform([],args={**self.args,key:value})
            self.assertEqual(response.status_code,400)
            self.assertEqual(calls,[])

    def test_auth_method_and_action_requirements(self):
        with patch('clinic.visit_status.upstream') as call:
            self.assertEqual(self.client.post('/api/medical-visit/waiting/',data='{}',content_type='application/json').status_code,401)
            self.assertEqual(self.client.get('/api/medical-visit/waiting/').status_code,405)
            self.assertEqual(self.client.post('/api/medical-visit/delete/',data='{}',content_type='application/json').status_code,404)
            call.assert_not_called()
