import copy,io,json
from uuid import uuid4
from urllib.error import HTTPError,URLError
from unittest.mock import patch
from django.test import SimpleTestCase,override_settings
from .views import GatewayError,upstream

class CheckoutGatewayTests(SimpleTestCase):
    def setUp(self):
        self.id,self.shift,self.invoice,self.pending=[str(uuid4()) for _ in range(4)]
        self.context={'user':{'id':'user-A'},'profile':{'tenant_id':'clinic-A','role':'staff','permission_checkout':True}}
        self.args={'p_tenant_id':'clinic-A','p_total':251.33,'p_subtotal':270,'p_discount':18.67,
                   'p_lines':[{'item_name':'藥水','quantity':0.33,'unit_price':10,'stock_kind':'medicine'}]}
        self.direct={'id':self.id,'payload':{'name':'checkout_with_inventory','args':self.args},'method':'現金','shift_id':self.shift,'tendered':300}
        self.pay={'id':self.id,'pending_id':self.pending,'version':3,'method':'轉帳','shift_id':self.shift,'tendered':None}

    def perform(self,action,data,result=None,error=None,context=None):
        with patch('clinic.checkout.verified_context',return_value=context or self.context),patch('clinic.checkout.upstream',return_value=result,side_effect=error) as call:
            response=self.client.post('/api/checkout/'+action+'/',data=json.dumps(data,ensure_ascii=False),content_type='application/json',HTTP_AUTHORIZATION='Bearer user-token')
            return response,call

    def test_direct_passes_original_frozen_payload_unchanged(self):
        original=copy.deepcopy(self.direct)
        response,call=self.perform('direct',self.direct,self.invoice)
        self.assertEqual(response.status_code,200)
        self.assertEqual(call.call_count,1)
        self.assertEqual(call.call_args.args,('/rest/v1/rpc/pos_v77','user-token'))
        self.assertEqual(call.call_args.kwargs,{'method':'POST','payload':{'p_action':'direct','p_data':original},'pos_errors':True})
        self.assertEqual(response.json()['data'],self.invoice)
        self.assertIn('no-store',response.headers['Cache-Control'])

    def test_pay_keeps_request_shift_and_version(self):
        response,call=self.perform('pay',self.pay,{'invoice_id':self.invoice})
        self.assertEqual(response.status_code,200)
        self.assertEqual(call.call_args.kwargs['payload']['p_data'],self.pay)

    def test_stage_sends_draft_without_creating_payment_or_stock_calls(self):
        data={'id':self.id,'draft':{'billingAppointmentId':str(uuid4()),'lines':[{'quantity':0.33}],'total':3.3}}
        response,call=self.perform('stage',data,{'id':self.id,'tenant_id':'clinic-A'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(call.call_count,1)
        self.assertEqual(call.call_args.kwargs['payload'],{'p_action':'stage','p_data':data})

    def test_family_payload_and_complete_result_preserved(self):
        request_id=str(uuid4())
        data={**self.direct,'payload':{'name':'checkout_family_v74','args':{'p_tenant_id':'clinic-A','p_request_id':request_id,'p_entries':[{'p_total':100},{'p_total':200}]}}}
        result={'request_id':request_id,'invoices':[{'invoice_id':str(uuid4())},{'invoice_id':str(uuid4())}]}
        response,call=self.perform('direct',data,result)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['data'],result)
        self.assertEqual(call.call_args.kwargs['payload']['p_data'],data)

    def test_clinical_checkout_function_is_allowlisted(self):
        for name in ('checkout_clinic_doctor_v57','checkout_clinic_medicine_groups_v64'):
            data={**self.direct,'payload':{'name':name,'args':self.args}}
            response,_=self.perform('direct',data,{'invoice_id':self.invoice})
            self.assertEqual(response.status_code,200)

    def test_no_preflight_shift_or_stock_checks_can_block_replay(self):
        response,call=self.perform('direct',self.direct,self.invoice)
        self.assertEqual(response.status_code,200)
        self.assertEqual(call.call_count,1)
        self.assertEqual(call.call_args.kwargs['payload']['p_data']['id'],self.id)

    def test_database_rejection_keeps_definitive_code(self):
        response,_=self.perform('pay',self.pay,error=GatewayError(409,'帳單已更新，請重載後核對','P0001'))
        self.assertEqual(response.status_code,409)
        self.assertEqual(response.json()['code'],'P0001')

    def test_network_failure_has_no_definitive_rejection_code(self):
        response,call=self.perform('direct',self.direct,error=GatewayError(502))
        self.assertEqual(response.status_code,502)
        self.assertNotIn('code',response.json())
        self.assertEqual(call.call_count,1)

    def test_incomplete_success_has_no_rejection_code_because_commit_possible(self):
        response,_=self.perform('pay',self.pay,{'missing_invoice':True})
        self.assertEqual(response.status_code,502)
        self.assertNotIn('code',response.json())

    def test_stage_wrong_request_or_tenant_response_is_ambiguous(self):
        data={'id':self.id,'draft':{'billingAppointmentId':str(uuid4())}}
        for result in [{'id':str(uuid4())},{'id':self.id,'tenant_id':'clinic-B'}]:
            response,_=self.perform('stage',data,result)
            self.assertEqual(response.status_code,502)
            self.assertNotIn('code',response.json())

    def test_wrong_tenant_or_function_rejected_before_sql(self):
        for payload in [{'name':'delete_everything','args':self.args},{'name':'checkout_with_inventory','args':{**self.args,'p_tenant_id':'clinic-B'}}]:
            response,call=self.perform('direct',{**self.direct,'payload':payload})
            self.assertEqual(response.status_code,400)
            self.assertEqual(response.json()['code'],'GB_REQUEST_REJECTED')
            call.assert_not_called()

    def test_cashier_permission_matches_existing_sql(self):
        denied={**self.context,'profile':{'tenant_id':'clinic-A','role':'doctor','permission_checkout':False}}
        response,call=self.perform('pay',self.pay,context=denied)
        self.assertEqual(response.status_code,403)
        call.assert_not_called()
        admin={**self.context,'profile':{'tenant_id':'clinic-A','role':'admin','permission_checkout':False}}
        self.assertEqual(self.perform('pay',self.pay,{'invoice_id':self.invoice},context=admin)[0].status_code,200)

    def test_stage_eligibility_still_goes_through_authoritative_sql(self):
        context={**self.context,'profile':{'tenant_id':'clinic-A','role':'doctor','permission_checkout':False}}
        data={'id':self.id,'draft':{'billingAppointmentId':str(uuid4())}}
        response,call=self.perform('stage',data,{'id':self.id},context=context)
        self.assertEqual(response.status_code,200)
        self.assertEqual(call.call_count,1)

    def test_no_auth_cookies_get_and_other_actions_cannot_charge(self):
        with patch('clinic.checkout.upstream') as call:
            self.client.cookies['sessionid']='cookie'
            self.assertEqual(self.client.post('/api/checkout/pay/',data='{}',content_type='application/json').status_code,401)
            self.assertEqual(self.client.get('/api/checkout/pay/').status_code,405)
            self.assertEqual(self.client.post('/api/checkout/refund/',data='{}',content_type='application/json').status_code,404)
            call.assert_not_called()

@override_settings(SUPABASE_URL='https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY='public-key')
class CheckoutErrorTransportTests(SimpleTestCase):
    def test_reviewed_sql_rejection_preserves_code_and_message(self):
        error=HTTPError('https://example.supabase.co',400,'Bad request',{},io.BytesIO(json.dumps({'code':'P0001','message':'收到現金不足'}).encode()))
        with patch('clinic.views.urlopen',side_effect=error):
            with self.assertRaises(GatewayError) as caught:
                upstream('/rest/v1/rpc/pos_v77','token',method='POST',payload={},pos_errors=True)
        self.assertEqual(caught.exception.code,'P0001')
        self.assertEqual(caught.exception.message,'收到現金不足')

    def test_unreviewed_sql_details_are_hidden_but_rollback_code_retained(self):
        error=HTTPError('https://example.supabase.co',409,'Conflict',{},io.BytesIO(json.dumps({'code':'23505','message':'secret constraint and identifiers'}).encode()))
        with patch('clinic.views.urlopen',side_effect=error):
            with self.assertRaises(GatewayError) as caught:
                upstream('/rest/v1/rpc/pos_v77','token',method='POST',payload={},pos_errors=True)
        self.assertEqual(caught.exception.code,'23505')
        self.assertNotIn('secret',caught.exception.message)

    def test_timeout_is_never_a_definitive_rejection(self):
        with patch('clinic.views.urlopen',side_effect=TimeoutError):
            with self.assertRaises(GatewayError) as caught:
                upstream('/rest/v1/rpc/pos_v77','token',method='POST',payload={},pos_errors=True)
        self.assertEqual(caught.exception.status,502)
        self.assertIsNone(caught.exception.code)

class FamilyPendingGatewayTests(CheckoutGatewayTests):
    def family_request(self):
        return {'id':self.id,'entries':[{'id':str(uuid4()),'pending_id':self.pending,'version':3}], 'method':'現金','shift_id':self.shift,'tendered':300}

    def test_atomic_family_rpc(self):
        data=self.family_request(); result={'request_id':self.id,'invoices':[{'pending_id':self.pending,'invoice_id':self.invoice}]}
        response,call=self.perform('family_pending',data,result)
        self.assertEqual(response.status_code,200)
        self.assertEqual(call.call_args.args[0],'/rest/v1/rpc/pos_family_pending_v20261025')
        self.assertEqual(call.call_args.kwargs['payload'],{'p_data':data})

    def test_duplicate_pending_rejected_before_rpc(self):
        data=self.family_request();data['entries']*=2
        response,call=self.perform('family_pending',data)
        self.assertEqual(response.status_code,400);call.assert_not_called()

    def test_partial_response_is_uncertain(self):
        data=self.family_request();response,_=self.perform('family_pending',data,{'request_id':self.id,'invoices':[]})
        self.assertEqual(response.status_code,502)
        self.assertNotEqual(response.json().get('code'),'GB_REQUEST_REJECTED')

    def test_doctor_without_checkout_cannot_pay_family(self):
        data=self.family_request()
        response,call=self.perform('family_pending',data,context={'user':{'id':'u'},'profile':{'tenant_id':'clinic-A','role':'doctor','permission_checkout':False}})
        self.assertEqual(response.status_code,403);call.assert_not_called()
