"""Regression at the real HTTP request boundary, not mock-only RPC arguments."""
import io
import json
from uuid import UUID
from urllib.parse import urlsplit, parse_qs
from urllib.error import HTTPError
from unittest.mock import patch
from django.test import SimpleTestCase,override_settings
from .views import upstream, GatewayError

PET='00000000-0000-4000-8000-000000000001'
APPOINTMENT='00000000-0000-4000-8000-000000000002'
DOCTOR='00000000-0000-4000-8000-000000000003'

@override_settings(SUPABASE_URL='https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY='public-key')
class ScalarFilterRegressionTests(SimpleTestCase):
    def test_open_already_assigned_appointment_with_strict_uuid_endpoint(self):
        appointment={'id':APPOINTMENT,'pet_id':PET,'tenant_id':'clinic-A','status':'候診中','doctor':'醫師甲','assigned_doctor_id':DOCTOR}
        paths=[]
        def respond(req,**kwargs):
            parsed=urlsplit(req.full_url)
            paths.append(parsed.path)
            if parsed.path=='/auth/v1/user': result={'id':DOCTOR}
            elif parsed.path=='/rest/v1/user_profiles': result=[{'tenant_id':'clinic-A','role':'admin'}]
            elif parsed.path=='/rest/v1/rpc/my_trial_expires_at': result=None
            elif parsed.path=='/rest/v1/appointments':
                params=parse_qs(parsed.query)
                try:
                    identifier=params['id'][0].removeprefix('eq.')
                    UUID(identifier)  # Mirrors the UUID conversion that rejected quoted IDs.
                except ValueError:
                    error=io.BytesIO(json.dumps({'code':'22P02','message':'invalid UUID input'}).encode())
                    raise HTTPError(req.full_url,400,'Bad request',{},error)
                self.assertEqual(identifier,APPOINTMENT)
                self.assertEqual(params['tenant_id'],['eq.clinic-A'])
                result=[{'id':APPOINTMENT,'pet_id':PET}]
            elif parsed.path=='/rest/v1/rpc/waiting_doctor_state_v54':
                self.assertEqual(json.loads(req.data),{'p_appointment_id':APPOINTMENT})
                result={'appointment':appointment}
            else: raise AssertionError('Unexpected path '+parsed.path)
            return io.BytesIO(json.dumps(result).encode())
        with patch('clinic.views.urlopen',side_effect=respond):
            response=self.client.post('/api/clinic/waiting_doctor_state_v54/',data=json.dumps({'p_appointment_id':APPOINTMENT}),content_type='application/json',HTTP_AUTHORIZATION='Bearer verified-token')
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['data']['appointment']['assigned_doctor_id'],DOCTOR)
        self.assertIn('/rest/v1/rpc/waiting_doctor_state_v54',paths)

    def test_logical_quotes_retained_but_standalone_filters_are_literal(self):
        from .search import lookup
        with patch('clinic.search.upstream',return_value=[]) as call:
            lookup('clinic-A','token','money','王,"先生','')
        params=parse_qs(urlsplit(call.call_args.args[0]).query)
        self.assertEqual(params['tenant_id'],['eq.clinic-A'])
        self.assertEqual(params['owners.name'],['ilike.%王,"先生%'])
        self.assertIn('name.ilike."%money%"',params['or'][0])

    def test_reviewed_business_error_keeps_safe_message(self):
        message='請先完成掛號／報到；看診中的病患不能直接更換指定醫師'
        error=HTTPError('https://example.supabase.co',400,'Bad request',{},io.BytesIO(json.dumps({'code':'P0001','message':message}).encode()))
        with patch('clinic.views.urlopen',side_effect=error):
            with self.assertRaises(GatewayError) as raised:
                upstream('/rest/v1/rpc/waiting_doctor_state_v54','token',method='POST',payload={})
        self.assertEqual(raised.exception.status,409)
        self.assertEqual(raised.exception.message,message)

    def test_unreviewed_sql_details_are_not_exposed(self):
        error=HTTPError('https://example.supabase.co',400,'Bad request',{},io.BytesIO(json.dumps({'code':'22P02','message':'SQL internals and identifiers'}).encode()))
        with patch('clinic.views.urlopen',side_effect=error):
            with self.assertRaises(GatewayError) as raised:
                upstream('/rest/v1/rpc/waiting_doctor_state_v54','token',method='POST',payload={})
        self.assertEqual(raised.exception.status,502)
        self.assertIsNone(raised.exception.message)
