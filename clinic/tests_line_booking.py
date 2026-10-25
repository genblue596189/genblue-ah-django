import json
from uuid import uuid4
from unittest.mock import patch
from django.test import SimpleTestCase
from .views import GatewayError

class LineReviewTests(SimpleTestCase):
    def call(self,action,data,result=None,profile=None):
        context={'user':{'id':'u'},'profile':profile or {'tenant_id':'A','role':'staff','permission_appointment':True}}
        with patch('clinic.line_booking.verified_context',return_value=context),patch('clinic.line_booking.upstream',return_value=result) as rpc,patch('clinic.line_booking._pool.submit') as dispatch:
            response=self.client.post('/api/booking-review/'+action+'/',json.dumps(data),content_type='application/json',HTTP_AUTHORIZATION='Bearer token')
        return response,rpc,dispatch
    def test_list_scoped(self):
        response,rpc,_=self.call('list',{}, {'config':{'tenant_id':'A'},'requests':[]})
        self.assertEqual(response.status_code,200)
        self.assertEqual(rpc.call_args.kwargs['payload'],{'p_action':'list','p_data':{}})
    def test_wrong_tenant_reply_blocked(self):
        response,_,_=self.call('list',{}, {'config':{'tenant_id':'B'},'requests':[]})
        self.assertEqual(response.status_code,502)
    def test_permission_rejected(self):
        response,rpc,_=self.call('list',{},profile={'tenant_id':'A','role':'staff','permission_appointment':False})
        self.assertEqual(response.status_code,403);rpc.assert_not_called()
    def test_approval_explicit_membership(self):
        data={'id':str(uuid4()),'pet_id':str(uuid4()),'verify_member':True}
        response,rpc,dispatch=self.call('approve',data,{'ok':True})
        self.assertEqual(response.status_code,200);self.assertEqual(rpc.call_args.kwargs['payload']['p_data'],data);dispatch.assert_called_once()
    def test_browser_cannot_supply_line_identity(self):
        data={'id':str(uuid4()),'pet_id':str(uuid4()),'verify_member':True,'line_user_id':'Ufake'}
        response,rpc,_=self.call('approve',data)
        self.assertEqual(response.status_code,400);rpc.assert_not_called()
    def test_message_key_forwarded(self):
        data={'id':str(uuid4()),'message_id':str(uuid4()),'text':'請來電確認時間'}
        response,rpc,dispatch=self.call('message',data,{'ok':True})
        self.assertEqual(response.status_code,200);self.assertEqual(rpc.call_args.kwargs['payload']['p_data'],data);dispatch.assert_called_once()
    def test_unauthenticated(self):
        response=self.client.post('/api/booking-review/list/',data='{}',content_type='application/json')
        self.assertEqual(response.status_code,401)
