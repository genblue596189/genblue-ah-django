from unittest.mock import patch
from django.test import SimpleTestCase, override_settings
from clinic.views import upstream

class SessionTests(SimpleTestCase):
    def test_no_token_never_contacts_supabase(self):
        with patch('clinic.views.upstream') as call:
            response=self.client.get('/api/session/')
            self.assertEqual(response.status_code,401)
            call.assert_not_called()
            self.assertIn('no-store',response.headers['Cache-Control'])

    def test_verified_user_controls_profile_not_query_tenant(self):
        with patch('clinic.views.upstream',side_effect=[{'id':'verified-id','email':'a@example.test'},[{'tenant_id':'hospital-A','role':'staff'}],None]) as call:
            response=self.client.get('/api/session/?tenant_id=hospital-B',HTTP_AUTHORIZATION='Bearer token-A')
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['profile']['tenant_id'],'hospital-A')
            self.assertIn('user_id=eq.verified-id',call.call_args_list[1].args[0])
            self.assertTrue(all(c.args[1]=='token-A' for c in call.call_args_list))

    def test_expired_trial_blocks_session(self):
        with patch('clinic.views.upstream',side_effect=[{'id':'u'},[{'tenant_id':'A'}],'2020-01-01T00:00:00Z']):
            self.assertEqual(self.client.get('/api/session/',HTTP_AUTHORIZATION='Bearer t').status_code,403)

    def test_missing_profile_blocks_before_trial(self):
        with patch('clinic.views.upstream',side_effect=[{'id':'u'},[]]) as call:
            self.assertEqual(self.client.get('/api/session/',HTTP_AUTHORIZATION='Bearer t').status_code,403)
            self.assertEqual(call.call_count,2)

    def test_upstream_failure_is_closed(self):
        from clinic.views import GatewayError
        with patch('clinic.views.upstream',side_effect=GatewayError(502)):
            self.assertEqual(self.client.get('/api/session/',HTTP_AUTHORIZATION='Bearer t').status_code,502)

    def test_invalid_trial_is_closed(self):
        with patch('clinic.views.upstream',side_effect=[{'id':'u'},[{'tenant_id':'A'}],'bad-date']):
            self.assertEqual(self.client.get('/api/session/',HTTP_AUTHORIZATION='Bearer t').status_code,502)

    def test_pages_and_method(self):
        for path in ['/', '/booking.html','/imaging-share.html']:
            self.assertEqual(self.client.get(path).status_code,200)
        self.assertEqual(self.client.post('/api/session/').status_code,405)

from urllib.parse import urlsplit, parse_qs
from clinic.search import pattern

class SearchTests(SimpleTestCase):
    def perform(self, responses, params=None):
        identity = [{'id':'user-A'},[{'tenant_id':'clinic-A'}],None]
        with patch('clinic.views.upstream', side_effect=identity), patch('clinic.search.upstream', side_effect=responses) as call:
            response = self.client.get('/api/search/pets/', params or {'query':'money'}, HTTP_AUTHORIZATION='Bearer user-token')
            return response, call.call_args_list

    def test_pet_match_retains_owner_object(self):
        pet={'id':'p1','name':'money','owners':{'id':'o1','name':'王先生'}}
        response,calls=self.perform([[pet]])
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['pets'],[pet])
        self.assertEqual(len(calls),1)
        self.assertIn('no-store',response.headers['Cache-Control'])

    def test_tenant_always_from_verified_profile_and_same_token(self):
        response,calls=self.perform([[],[]],{'query':'123','tenant_id':'clinic-B'})
        self.assertEqual(response.json()['tenant_id'],'clinic-A')
        for call in calls:
            params=parse_qs(urlsplit(call.args[0]).query)
            self.assertEqual(params['tenant_id'],['eq.clinic-A'])
            self.assertEqual(call.args[1],'user-token')
            self.assertNotIn('clinic-B',call.args[0])

    def test_phone_or_owner_fallback_fetches_their_pets(self):
        response,calls=self.perform([[],[{'id':'o1'}],[{'id':'p1','owner_id':'o1'}]],{'query':'0912345678'})
        self.assertEqual(response.json()['pets'][0]['id'],'p1')
        self.assertEqual(len(calls),3)
        self.assertIn('/owners?',calls[1].args[0])
        self.assertIn('phone.ilike',parse_qs(urlsplit(calls[1].args[0]).query)['or'][0])
        self.assertEqual(parse_qs(urlsplit(calls[2].args[0]).query)['owner_id'],['in.("o1")'])

    def test_pet_and_owner_combined(self):
        response,calls=self.perform([[]],{'query':'money','owner_name':'陳'})
        params=parse_qs(urlsplit(calls[0].args[0]).query)
        self.assertIn('owners!inner(',params['select'][0])
        self.assertEqual(params['owners.name'],['ilike.%陳%'])
        self.assertIn('name.ilike',params['or'][0])

    def test_same_owner_button(self):
        response,calls=self.perform([[{'id':'p2'}]],{'owner_id':'o1'})
        params=parse_qs(urlsplit(calls[0].args[0]).query)
        self.assertEqual(params['owner_id'],['eq.o1'])
        self.assertNotIn('or',params)

    def test_empty_does_not_load_all_pets(self):
        response,calls=self.perform([],{'query':'  '})
        self.assertEqual(response.json()['pets'],[])
        self.assertEqual(len(calls),0)

    def test_no_session_never_reads_pets(self):
        with patch('clinic.search.upstream') as call:
            self.assertEqual(self.client.get('/api/search/pets/?query=money').status_code,401)
            call.assert_not_called()

    def test_expired_trial_never_reads_pets(self):
        with patch('clinic.views.upstream',side_effect=[{'id':'u'},[{'tenant_id':'A'}],'2020-01-01T00:00:00Z']), patch('clinic.search.upstream') as call:
            self.assertEqual(self.client.get('/api/search/pets/?query=money',HTTP_AUTHORIZATION='Bearer t').status_code,403)
            call.assert_not_called()

    def test_punctuation_is_quoted_and_wildcards_literal(self):
        keyword='a\",name.eq.x)%_*'
        response,calls=self.perform([[],[]],{'query':keyword})
        value=parse_qs(urlsplit(calls[0].args[0]).query)['or'][0]
        self.assertIn('\\"',value)
        self.assertIn('\\\\%',value)
        self.assertIn('\\\\_',value)
        self.assertIn('\\\\*',value)
        self.assertEqual(response.status_code,200)

    def test_long_input_does_not_query_pets(self):
        response,calls=self.perform([],{'query':'x'*201})
        self.assertEqual(response.status_code,400)
        self.assertEqual(calls,[])

    def test_all_pages_are_returned(self):
        with patch('clinic.search.PAGE_SIZE',2):
            response,calls=self.perform([[{'id':'p1'},{'id':'p2'}],[{'id':'p3'}]])
        self.assertEqual(len(response.json()['pets']),3)
        self.assertEqual(parse_qs(urlsplit(calls[1].args[0]).query)['offset'],['2'])

    def test_server_error_never_returns_partial_matches(self):
        from clinic.views import GatewayError
        with patch('clinic.search.PAGE_SIZE',2):
            response,calls=self.perform([[{'id':'p1'},{'id':'p2'}],GatewayError(502)])
        self.assertEqual(response.status_code,502)
        self.assertNotIn('pets',response.json())

import json
from uuid import uuid4
from clinic.registration import with_purpose

class RegistrationTests(SimpleTestCase):
    def setUp(self):
        self.request_id=str(uuid4())
        self.data={'pet_id':'pet-A','request_id':self.request_id,'purpose':'疫苗','session':'夜診'}
        self.context={'user':{'id':'user-A'},'profile':{'tenant_id':'tenant-A','role':'staff','permission_appointment':True},'trial_end':None}
        self.pet={'id':'pet-A','owner_id':'owner-from-db'}
        self.row={'id':self.request_id,'tenant_id':'tenant-A','pet_id':'pet-A','owner_id':'owner-from-db','status':'候診中','scheduled_at':'2026-01-01T00:00:00Z'}

    def perform(self, responses, data=None, context=None):
        with patch('clinic.registration.verified_context',return_value=context or self.context), patch('clinic.registration.upstream',side_effect=responses) as call:
            response=self.client.post('/api/registration/',data=json.dumps(data or self.data),content_type='application/json',HTTP_AUTHORIZATION='Bearer token-A')
            return response,call.call_args_list

    def test_new_visit_uses_verified_tenant_and_database_owner(self):
        data=dict(self.data,tenant_id='bad-tenant',owner_id='bad-owner',status='已完診')
        response,calls=self.perform([[self.pet],[],[],[],[self.row]],data)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['kind'],'added')
        write=calls[-1]
        self.assertEqual(write.kwargs['method'],'POST')
        row=write.kwargs['payload'][0]
        self.assertEqual(row['tenant_id'],'tenant-A')
        self.assertEqual(row['owner_id'],'owner-from-db')
        self.assertEqual(row['status'],'候診中')
        self.assertEqual(row['id'],self.request_id)
        self.assertEqual(row['session'],'夜診')
        self.assertEqual(row['notes'],'[來院目的] 疫苗')
        self.assertTrue(all(c.args[1]=='token-A' for c in calls))

    def test_existing_waiting_visit_never_writes(self):
        response,calls=self.perform([[self.pet],[],[self.row],[self.row]])
        self.assertEqual(response.json()['kind'],'existing')
        self.assertTrue(all(not c.kwargs for c in calls))

    def test_retry_with_same_request_never_writes_again(self):
        response,calls=self.perform([[self.pet],[self.row]])
        self.assertEqual(response.status_code,200)
        self.assertEqual(len(calls),2)
        self.assertEqual(response.json()['kind'],'existing')

    def test_wrong_tenant_pet_is_rejected_before_any_write(self):
        response,calls=self.perform([[]])
        self.assertEqual(response.status_code,403)
        self.assertEqual(len(calls),1)

    def test_no_permission_is_rejected_before_pet_lookup(self):
        context={**self.context,'profile':{'tenant_id':'tenant-A','role':'staff','permission_appointment':False}}
        response,calls=self.perform([],context=context)
        self.assertEqual(response.status_code,403)
        self.assertEqual(calls,[])

    def test_admin_permission_matches_current_ui(self):
        context={**self.context,'profile':{'tenant_id':'tenant-A','role':'admin','permission_appointment':False}}
        response,_=self.perform([[self.pet],[self.row]],context=context)
        self.assertEqual(response.status_code,200)

    def reservation(self, scheduled='2099-01-01T00:00:00Z'):
        return {**self.row,'id':'reservation-A','status':'已預約','scheduled_at':scheduled,'notes':'[來院目的] 看診\n既有備註'}

    def test_future_reservation_requires_confirmation_without_write(self):
        appointment=self.reservation()
        response,calls=self.perform([[self.pet],[],[appointment],[]])
        self.assertEqual(response.status_code,409)
        self.assertEqual(response.json()['code'],'early_check_in')
        self.assertTrue(all(not c.kwargs for c in calls))

    def test_confirmed_reservation_updates_conditionally(self):
        appointment=self.reservation()
        data={**self.data,'confirm_early':{'id':appointment['id'],'scheduled_at':appointment['scheduled_at']}}
        saved={**appointment,'status':'候診中'}
        response,calls=self.perform([[self.pet],[],[appointment],[],[saved]],data)
        self.assertEqual(response.status_code,200)
        self.assertEqual(calls[-1].kwargs['method'],'PATCH')
        params=parse_qs(urlsplit(calls[-1].args[0]).query)
        self.assertEqual(params['status'],['eq.已預約'])
        self.assertEqual(params['scheduled_at'],['eq.2099-01-01T00:00:00Z'])
        self.assertEqual(calls[-1].kwargs['payload']['notes'],'[來院目的] 疫苗\n既有備註')

    def test_changed_reservation_requires_new_confirmation(self):
        data={**self.data,'confirm_early':{'id':'old-id','scheduled_at':'2098-01-01T00:00:00Z'}}
        response,calls=self.perform([[self.pet],[],[self.reservation()],[]],data)
        self.assertEqual(response.json()['code'],'early_check_in')
        self.assertEqual(len(calls),4)

    def test_past_reservation_does_not_prompt(self):
        appointment=self.reservation('2020-01-01T00:00:00Z')
        response,calls=self.perform([[self.pet],[],[appointment],[],[{**appointment,'status':'候診中'}]])
        self.assertEqual(response.status_code,200)
        self.assertEqual(calls[-1].kwargs['method'],'PATCH')

    def test_concurrent_change_does_not_report_success(self):
        appointment=self.reservation('2020-01-01T00:00:00Z')
        response,_=self.perform([[self.pet],[],[appointment],[],[]])
        self.assertEqual(response.status_code,409)

    def test_closed_idempotent_request_does_not_create_new_visit(self):
        response,calls=self.perform([[self.pet],[{**self.row,'status':'已完診'}]])
        self.assertEqual(response.status_code,409)
        self.assertEqual(len(calls),2)

    def test_bad_inputs_never_write(self):
        for data in [{**self.data,'request_id':'bad'}, {**self.data,'purpose':'unknown'}, {**self.data,'session':'晚診'}]:
            response,calls=self.perform([],data)
            self.assertEqual(response.status_code,400)
            self.assertEqual(calls,[])

    def test_no_bearer_rejected_even_with_cookie(self):
        with patch('clinic.registration.upstream') as call:
            self.client.cookies['sessionid']='cookie'
            response=self.client.post('/api/registration/',data=json.dumps(self.data),content_type='application/json')
            self.assertEqual(response.status_code,401)
            call.assert_not_called()

    def test_get_cannot_write(self):
        self.assertEqual(self.client.get('/api/registration/').status_code,405)

    def test_notes_preserved(self):
        self.assertEqual(with_purpose('[來院目的] 拿藥\n長期備註','看診'),'[來院目的] 看診\n長期備註')

    def test_two_threads_registering_same_pet_create_one_row_in_process(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.test import Client
        barrier=Barrier(2)
        database=[]
        writes=[]
        def identity(token):
            barrier.wait(timeout=5)
            return self.context
        def fake(path,token,**kwargs):
            params=parse_qs(urlsplit(path).query)
            if '/pets?' in path: return [self.pet]
            if kwargs.get('method')=='POST':
                row=kwargs['payload'][0]
                database.append(row)
                writes.append(row)
                return [row]
            if 'id' in params:
                identifier=params['id'][0][3:]
                return [r for r in database if r['id']==identifier]
            return list(database)
        def send(identifier):
            data={**self.data,'request_id':identifier}
            return Client().post('/api/registration/',data=json.dumps(data),content_type='application/json',HTTP_AUTHORIZATION='Bearer token-A')
        with patch('clinic.registration.verified_context',side_effect=identity),patch('clinic.registration.upstream',side_effect=fake):
            with ThreadPoolExecutor(max_workers=2) as pool:
                results=list(pool.map(send,[str(uuid4()),str(uuid4())]))
        self.assertTrue(all(r.status_code==200 for r in results))
        self.assertEqual(len(writes),1)
        self.assertEqual({r.json()['kind'] for r in results},{'added','existing'})

class UpstreamWriteTests(SimpleTestCase):
    @override_settings(SUPABASE_URL='https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY='public-key')
    def test_transport_sends_user_token_and_json_body(self):
        import io
        with patch('clinic.views.urlopen',return_value=io.BytesIO(b'[{"id":"a"}]')) as opener:
            result=upstream('/rest/v1/appointments?select=*','user-token',method='POST',payload=[{'status':'候診中'}])
            req=opener.call_args.args[0]
            self.assertEqual(req.get_method(),'POST')
            self.assertEqual(req.get_header('Authorization'),'Bearer user-token')
            self.assertEqual(req.get_header('Prefer'),'return=representation')
            self.assertEqual(json.loads(req.data),[{'status':'候診中'}])
            self.assertEqual(result,[{'id':'a'}])

class DoctorActionTests(SimpleTestCase):
    def setUp(self):
        self.context={'user':{'id':'user-A'},'profile':{'tenant_id':'tenant-A','role':'staff','permission_appointment':True}}
        self.appointment={'id':'appointment-A','pet_id':'pet-A','tenant_id':'tenant-A','status':'候診中'}

    def perform(self,action,args,responses,context=None):
        with patch('clinic.doctors.verified_context',return_value=context or self.context),patch('clinic.doctors.upstream',side_effect=responses) as call:
            response=self.client.post('/api/clinic/'+action+'/',data=json.dumps(args),content_type='application/json',HTTP_AUTHORIZATION='Bearer token-A')
            return response,call.call_args_list

    def test_roster_keeps_existing_claim_information(self):
        roster={'enabled':True,'doctors':[{'id':'doctor-A','name':'醫師甲'}],'claims':[{'pet_id':'pet-A','clinician_id':'doctor-A'}]}
        response,calls=self.perform('clinic_doctor_state_v51',{},[roster])
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['data'],roster)
        self.assertEqual(calls[0].kwargs,{'method':'POST','payload':{}})
        self.assertEqual(calls[0].args[1],'token-A')

    def test_assignment_preserves_compare_and_set_arguments(self):
        args={'p_appointment_id':'appointment-A','p_doctor_id':'doctor-A','p_expected_doctor_id':None,'p_expected_doctor':None}
        result={'ok':True,'appointment':self.appointment}
        response,calls=self.perform('assign_waiting_doctor_v54',args,[[self.appointment],result])
        self.assertEqual(response.status_code,200)
        self.assertEqual(calls[-1].kwargs['payload'],args)
        self.assertIn('/rpc/assign_waiting_doctor_v54',calls[-1].args[0])
        params=parse_qs(urlsplit(calls[0].args[0]).query)
        self.assertEqual(params['tenant_id'],['eq.tenant-A'])

    def test_assignment_conflict_remains_business_result(self):
        args={'p_appointment_id':'appointment-A','p_doctor_id':None,'p_expected_doctor_id':'doctor-A','p_expected_doctor':'醫師甲'}
        response,_=self.perform('assign_waiting_doctor_v54',args,[[self.appointment],{'ok':False,'reason':'conflict'}])
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['data']['reason'],'conflict')

    def test_no_assignment_permission_never_calls_sql(self):
        context={**self.context,'profile':{'tenant_id':'tenant-A','role':'staff','permission_appointment':False}}
        response,calls=self.perform('waiting_doctor_state_v54',{'p_appointment_id':'appointment-A'},[],context)
        self.assertEqual(response.status_code,403)
        self.assertEqual(calls,[])

    def test_claim_uses_existing_atomic_sql_transaction(self):
        args={'p_pet_id':'pet-A','p_appointment_id':'appointment-A'}
        result={'ok':True,'claim_id':'claim-A','name':'醫師甲','appointment':{**self.appointment,'status':'診間看診中'}}
        response,calls=self.perform('claim_clinic_visit_v51',args,[[{'id':'pet-A'}],[self.appointment],result])
        self.assertEqual(response.status_code,200)
        self.assertEqual(calls[-1].args[0],'/rest/v1/rpc/claim_clinic_visit_v51')
        self.assertEqual(calls[-1].kwargs['payload'],args)

    def test_occupied_claim_preserves_busy_response_without_new_write(self):
        args={'p_pet_id':'pet-A','p_appointment_id':None}
        response,calls=self.perform('claim_clinic_visit_v51',args,[[{'id':'pet-A'}],{'ok':False,'reason':'busy','name':'其他醫師'}])
        self.assertFalse(response.json()['data']['ok'])
        self.assertEqual(len(calls),2)

    def test_verify_false_is_not_coerced_to_success(self):
        response,_=self.perform('verify_clinic_visit_v51',{'p_pet_id':'pet-A','p_claim_id':'claim-A'},[[{'id':'pet-A'}],False])
        self.assertEqual(response.status_code,200)
        self.assertIs(response.json()['data'],False)

    def test_verify_malformed_response_is_closed(self):
        response,_=self.perform('verify_clinic_visit_v51',{'p_pet_id':'pet-A','p_claim_id':'claim-A'},[[{'id':'pet-A'}],'true'])
        self.assertEqual(response.status_code,502)

    def test_admin_release_allows_void_sql_result(self):
        context={**self.context,'profile':{'tenant_id':'tenant-A','role':'admin'}}
        response,calls=self.perform('release_clinic_visit_v51',{'p_pet_id':'pet-A','p_appointment_id':'appointment-A'},[[{'id':'pet-A'}],[self.appointment],None],context)
        self.assertEqual(response.status_code,200)
        self.assertIsNone(response.json()['data'])
        self.assertEqual(calls[-1].kwargs['method'],'POST')

    def test_staff_cannot_release(self):
        response,calls=self.perform('release_clinic_visit_v51',{'p_pet_id':'pet-A','p_appointment_id':'appointment-A'},[])
        self.assertEqual(response.status_code,403)
        self.assertEqual(calls,[])

    def test_wrong_clinic_or_pet_relation_prevents_claim(self):
        for replies in [[[]],[[{'id':'pet-A'}],[{**self.appointment,'pet_id':'other-pet'}]]]:
            response,calls=self.perform('claim_clinic_visit_v51',{'p_pet_id':'pet-A','p_appointment_id':'appointment-A'},replies)
            self.assertEqual(response.status_code,403)
            self.assertTrue(all('/rpc/' not in c.args[0] for c in calls))

    def test_unknown_rpc_and_injected_scope_parameters_rejected(self):
        response,calls=self.perform('checkout_clinic_doctor_v57',{},[])
        self.assertEqual(response.status_code,404)
        self.assertEqual(calls,[])
        response,calls=self.perform('clinic_doctor_state_v51',{'tenant_id':'other'},[])
        self.assertEqual(response.status_code,400)
        self.assertEqual(calls,[])

    def test_no_auth_no_sql_even_with_cookies(self):
        with patch('clinic.doctors.upstream') as call:
            self.client.cookies['sessionid']='cookie'
            response=self.client.post('/api/clinic/clinic_doctor_state_v51/',data='{}',content_type='application/json')
            self.assertEqual(response.status_code,401)
            call.assert_not_called()

    def test_get_cannot_claim(self):
        self.assertEqual(self.client.get('/api/clinic/claim_clinic_visit_v51/').status_code,405)

    def test_wrong_appointment_response_is_rejected(self):
        response,_=self.perform('waiting_doctor_state_v54',{'p_appointment_id':'appointment-A'},[[self.appointment],{'appointment':{**self.appointment,'id':'other'}}])
        self.assertEqual(response.status_code,502)

    def test_empty_void_upstream_response_supported(self):
        import io
        with override_settings(SUPABASE_URL='https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY='public-key'),patch('clinic.views.urlopen',return_value=io.BytesIO(b'')):
            self.assertIsNone(upstream('/rest/v1/rpc/release_clinic_visit_v51','token',method='POST',payload={}))
