import json
from uuid import uuid4
from unittest.mock import patch
from urllib.parse import urlsplit,parse_qs
from django.test import SimpleTestCase
from .views import GatewayError


class RecordCreationTests(SimpleTestCase):
    def setUp(self):
        self.owner={'id':str(uuid4()),'tenant_id':'clinic-A','owner_code':None,'name':'飼主',
                    'mobile':'0912345678','phone':'','email':'','address':'','notes':None}
        self.pet={'id':str(uuid4()),'tenant_id':'clinic-A','owner_id':self.owner['id'],'name':'Money',
                  'species':'貓','breed':None,'gender':'公 (未結紮)','birthday':'2020-02-29','weight':4.25,'microchip':None}
        self.context={'user':{'id':'user-A'},'profile':{'tenant_id':'clinic-A','role':'staff','permission_operational':True}}

    def post(self,entity,payload,responses):
        with patch('clinic.records.verified_context',return_value=self.context),patch('clinic.records.upstream',side_effect=responses) as call:
            result=self.client.post('/api/records/'+entity+'/',json.dumps(payload),content_type='application/json',HTTP_AUTHORIZATION='Bearer caller')
            return result,call.call_args_list

    def test_owner_number_comes_from_sql(self):
        row={**self.owner,'system_code':'A5503'}
        response,calls=self.post('owners',self.owner,[[],[row]])
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['data']['system_code'],'A5503')
        self.assertNotIn('system_code',calls[-1].kwargs['payload'][0])
        self.assertEqual(calls[-1].kwargs['payload'],[self.owner])
        self.assertIn('no-store',response['Cache-Control'])

    def test_same_owner_new_pet_checks_tenant_owner(self):
        response,calls=self.post('pets',self.pet,[[],[self.owner],[self.pet]])
        self.assertEqual(response.status_code,200)
        query=parse_qs(urlsplit(calls[1].args[0]).query)
        self.assertEqual(query['tenant_id'],['eq.clinic-A'])
        self.assertEqual(query['id'],['eq.'+self.owner['id']])

    def test_missing_or_foreign_owner_blocks_insert(self):
        response,calls=self.post('pets',self.pet,[[],[]])
        self.assertEqual(response.status_code,400)
        self.assertEqual(response.json()['code'],'GB_RECORD_REJECTED')
        self.assertTrue(all(c.kwargs.get('method')!='POST' for c in calls))

    def test_existing_uuid_replays_without_insert(self):
        response,calls=self.post('pets',self.pet,[[self.pet]])
        self.assertTrue(response.json()['replayed'])
        self.assertEqual(len(calls),1)

    def test_same_uuid_different_content_never_overwrites(self):
        response,calls=self.post('pets',self.pet,[[{**self.pet,'name':'Other'}]])
        self.assertEqual(response.status_code,409)
        self.assertEqual(response.json()['code'],'GB_RECORD_CONFLICT')
        self.assertEqual(len(calls),1)

    def test_lost_insert_response_is_resolved_by_uuid(self):
        response,calls=self.post('pets',self.pet,[[],[self.owner],GatewayError(502),[self.pet]])
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.json()['replayed'])
        self.assertEqual(sum(c.kwargs.get('method')=='POST' for c in calls),1)

    def test_ambiguous_missing_result_stays_unconfirmed(self):
        response,calls=self.post('pets',self.pet,[[],[self.owner],GatewayError(502),[]])
        self.assertEqual(response.status_code,502)
        self.assertEqual(sum(c.kwargs.get('method')=='POST' for c in calls),1)

    def test_simultaneous_insert_same_uuid_is_resolved(self):
        response,calls=self.post('pets',self.pet,[[],[self.owner],GatewayError(409),[self.pet]])
        self.assertEqual(response.status_code,200)
        self.assertTrue(response.json()['replayed'])

    def test_explicit_database_rejection_is_preserved(self):
        response,calls=self.post('pets',self.pet,[[],[self.owner],GatewayError(409,'建檔被拒絕','23505'),[]])
        self.assertEqual(response.status_code,409)
        self.assertEqual(response.json()['code'],'23505')

    def test_tenant_and_system_code_cannot_be_overridden(self):
        for payload in ({**self.owner,'tenant_id':'clinic-B'},{**self.owner,'system_code':'A0001'}):
            response,calls=self.post('owners',payload,[])
            self.assertEqual(response.status_code,400)
            self.assertEqual(calls,[])

    def test_invalid_weight_or_date_block_read_and_write(self):
        for change in ({'weight':-1},{'weight':True},{'birthday':'2020-02-30'},{'owner_id':'bad'},{'name':''}):
            response,calls=self.post('pets',{**self.pet,**change},[])
            self.assertEqual(response.status_code,400)
            self.assertEqual(calls,[])

    def test_disabled_operational_permission_blocks_admin_exception_only(self):
        self.context['profile']['permission_operational']=False
        response,calls=self.post('owners',self.owner,[])
        self.assertEqual(response.status_code,403)
        self.assertEqual(calls,[])
        self.context['profile']['role']='admin'
        response,_=self.post('owners',self.owner,[[self.owner]])
        self.assertEqual(response.status_code,200)
