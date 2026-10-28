import copy
import json
from unittest.mock import patch
from urllib.parse import parse_qs,urlsplit
from uuid import uuid4
from django.test import SimpleTestCase
from .views import GatewayError

class MedicalWriteTests(SimpleTestCase):
    def setUp(self):
        self.pet,self.appointment,self.claim,self.record=[str(uuid4()) for _ in range(4)]
        self.context={'user':{'id':'doctor-A'},'profile':{'tenant_id':'clinic-A','role':'doctor'}}
        self.args={'pet_id':self.pet,'appointment_id':self.appointment,'claim_id':self.claim,'request_id':self.record,
                   'mode':'waiting','chief':'主訴：回診\n體重 4.2 kg','prescriptions':[
                       {'medicine_id':'drug-A','custom_dose':'0.5 mg/kg bid po','quantity':'2.5'},
                       {'medicine_id':'drug-B','custom_dose':'0.33 ml','quantity':0.33,'dispense_volume':'30 ml'}]}
        self.app={'id':self.appointment,'pet_id':self.pet,'status':'診間看診中'}

    def row(self):
        return {'id':self.record,'pet_id':self.pet,'tenant_id':'clinic-A','status':'候診中',
                'chief_complaint':self.args['chief'],'prescription_details':copy.deepcopy(self.args['prescriptions'])}

    def perform(self,responses,data=None,action='save'):
        # Route fixtures by endpoint: the saved-record read may now overlap the
        # claim check, so global side-effect order would depend on scheduling.
        from threading import Lock
        pending=list(responses);lock=Lock()
        appointment=pending.pop(0) if pending else None
        claim=pending.pop(0) if pending else None
        def upstream(path,*args,**kwargs):
            if path.startswith('/rest/v1/appointments?'): value=appointment
            elif path=='/rest/v1/rpc/verify_clinic_visit_v51': value=claim
            else:
                with lock: value=pending.pop(0)
            if isinstance(value,Exception): raise value
            return value
        with patch('clinic.medical.verified_context',return_value=self.context),patch('clinic.medical.upstream',side_effect=upstream) as call:
            response=self.client.post('/api/medical/'+action+'/',data=json.dumps(data or self.args,ensure_ascii=False),content_type='application/json',HTTP_AUTHORIZATION='Bearer doctor-token')
            return response,call.call_args_list

    def test_save_retains_exact_text_units_doses_and_quantities(self):
        response,calls=self.perform([[self.app],True,[],[self.row()]])
        self.assertEqual(response.status_code,200)
        payload=calls[-1].kwargs['payload'][0]
        self.assertEqual(payload['chief_complaint'],self.args['chief'])
        self.assertEqual(payload['prescription_details'],self.args['prescriptions'])
        self.assertEqual(payload['tenant_id'],'clinic-A')
        self.assertEqual(payload['status'],'候診中')
        self.assertEqual(payload['id'],self.record)
        self.assertTrue(all(c.args[1]=='doctor-token' for c in calls))
        params=parse_qs(urlsplit(calls[0].args[0]).query)
        self.assertEqual(params['id'],['eq.'+self.appointment])
        self.assertIn('no-store',response.headers['Cache-Control'])

    def test_checkout_saves_medical_only_without_invoice_or_stock(self):
        data={**self.args,'mode':'checkout'}
        row={**self.row(),'status':'診間看診中','vaccine_info':{'django_visit_v1':{'appointment_id':self.appointment,'claim_id':self.claim}}}
        response,calls=self.perform([[self.app],True,[],[row]],data)
        self.assertEqual(response.status_code,200)
        self.assertEqual(calls[-1].kwargs['payload'][0]['status'],'診間看診中')
        self.assertTrue(all('invoice' not in c.args[0] and 'inventory' not in c.args[0] for c in calls))

    def test_repeated_request_does_not_insert_second_record(self):
        response,calls=self.perform([[self.app],True,[self.row()]])
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.json()['data']['replayed'])
        self.assertTrue(all(c.kwargs.get('method')!='POST' or '/rpc/' in c.args[0] for c in calls))

    def test_existing_different_content_not_overwritten(self):
        row={**self.row(),'chief_complaint':'別的內容'}
        response,calls=self.perform([[self.app],True,[row]])
        self.assertEqual(response.status_code,409)
        self.assertEqual(len(calls),3)

    def test_simultaneous_same_uuid_resolves_to_same_saved_record(self):
        response,calls=self.perform([[self.app],True,[],GatewayError(409),[self.row()]])
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.json()['data']['replayed'])
        self.assertEqual(sum(c.kwargs.get('method')=='POST' and '/medical_records' in c.args[0] for c in calls),1)

    def test_lost_insert_response_never_reports_success_or_blindly_retries(self):
        response,calls=self.perform([[self.app],True,[],GatewayError(502)])
        self.assertEqual(response.status_code,502)
        self.assertEqual(len(calls),4)

    def test_lost_claim_blocks_medical_write(self):
        response,calls=self.perform([[self.app],False,[]])
        self.assertEqual(response.status_code,403)
        self.assertTrue(all(c.kwargs.get('method')!='POST' or '/rpc/' in c.args[0] for c in calls))

    def test_wrong_or_changed_visit_blocks_before_verification(self):
        for apps in [[],[{**self.app,'pet_id':str(uuid4())}],[{**self.app,'status':'已完成'}]]:
            response,calls=self.perform([apps])
            self.assertEqual(response.status_code,409)
            self.assertEqual(len(calls),1)

    def test_input_cannot_override_tenant_or_status(self):
        for key,value in [('tenant_id','clinic-B'),('status','已完成')]:
            response,calls=self.perform([],{**self.args,key:value})
            self.assertEqual(response.status_code,400)
            self.assertEqual(calls,[])

    def test_invalid_payloads_block_write(self):
        for data in [{**self.args,'mode':'unknown'},{**self.args,'chief':'x'*200001},{**self.args,'request_id':'bad'},
                     {**self.args,'prescriptions':'text'},{**self.args,'prescriptions':[1]}]:
            response,calls=self.perform([],data)
            self.assertEqual(response.status_code,400)
            self.assertEqual(calls,[])

    def test_archive_keeps_expected_version_and_existing_sql_contract(self):
        data={k:v for k,v in self.args.items() if k not in ('mode','prescriptions')}
        data['expected_version']=3
        response,calls=self.perform([[self.app],True,{'id':self.record,'row_version':4}],data,'archive')
        self.assertEqual(response.status_code,200)
        self.assertEqual(calls[-1].args[0],'/rest/v1/rpc/save_archive_medical_v53')
        self.assertEqual(calls[-1].kwargs['payload'],{'p_id':self.record,'p_pet_id':self.pet,'p_expected_version':3,'p_chief':data['chief']})

    def test_archive_version_conflict_not_reported_success(self):
        data={k:v for k,v in self.args.items() if k not in ('mode','prescriptions')}
        data['expected_version']=1
        response,_=self.perform([[self.app],True,GatewayError(409)],data,'archive')
        self.assertEqual(response.status_code,409)

    def test_no_auth_cookie_cannot_write(self):
        with patch('clinic.medical.upstream') as call:
            self.client.cookies['sessionid']='cookie'
            self.assertEqual(self.client.post('/api/medical/save/',data='{}',content_type='application/json').status_code,401)
            call.assert_not_called()

    def test_get_and_unknown_action_cannot_write(self):
        self.assertEqual(self.client.get('/api/medical/save/').status_code,405)
        self.assertEqual(self.client.post('/api/medical/delete/',data='{}',content_type='application/json').status_code,404)


class ConsultationRevisionTests(SimpleTestCase):
    setUp = MedicalWriteTests.setUp
    perform = MedicalWriteTests.perform

    def revision(self, version=4):
        return {**self.args, 'mode': 'checkout', 'expected_version': version}

    def test_revision_preserves_record_claim_and_expected_version(self):
        data = self.revision()
        response, calls = self.perform([[self.app], True, {'id': self.record, 'pet_id': self.pet, 'row_version': 5}], data, 'revise')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[-1].args[0], '/rest/v1/rpc/revise_consultation_draft_v1')
        self.assertEqual(calls[-1].kwargs['payload'], {
            'p_record_id': self.record, 'p_pet_id': self.pet, 'p_appointment_id': self.appointment,
            'p_claim_id': self.claim, 'p_expected_version': 4, 'p_chief': data['chief'],
            'p_prescriptions': data['prescriptions'], 'p_mode': 'checkout'})
        self.assertEqual(response.json()['data']['row_version'], 5)
        self.assertTrue(all('/medical_records?' not in c.args[0] for c in calls))

    def test_revision_requires_positive_integer_version(self):
        for version in (0, -1, True, '4'):
            response, calls = self.perform([], self.revision(version), 'revise')
            self.assertEqual(response.status_code, 400)
            self.assertEqual(calls, [])

    def test_stale_revision_does_not_fall_back_to_new_record(self):
        response, calls = self.perform([[self.app], True, GatewayError(409)], self.revision(), 'revise')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(len(calls), 3)
        self.assertTrue(all('/medical_records?' not in c.args[0] for c in calls))

    def test_revision_wrong_record_or_pet_is_ambiguous(self):
        for reply in [{'id': str(uuid4()), 'pet_id': self.pet, 'row_version': 5},
                      {'id': self.record, 'pet_id': str(uuid4()), 'row_version': 5}]:
            response, calls = self.perform([[self.app], True, reply], self.revision(), 'revise')
            self.assertEqual(response.status_code, 502)
            self.assertEqual(len(calls), 3)
            self.assertNotIn('code', response.json())

    def test_failed_claim_prevents_revision_rpc(self):
        response, calls = self.perform([[self.app], False], self.revision(), 'revise')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(calls), 2)
