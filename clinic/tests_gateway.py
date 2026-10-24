import io,json
from urllib.error import HTTPError,URLError
from unittest.mock import patch
from django.test import SimpleTestCase,override_settings
from django.conf import settings
from .gateway import classify,destination,MANIFEST
from .views import GatewayError

class Reply(io.BytesIO):
    def __init__(self,body=b'[]',status=200,headers=None):
        super().__init__(body);self.status=status;self.headers=headers or {'Content-Type':'application/json'}

@override_settings(SUPABASE_URL='https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY='fixed-public-key',GENBLUE_UPSTREAM_TIMEOUT=120)
class GatewayTests(SimpleTestCase):
    def send(self,path,method='GET',body=b'',reply=None,headers=None):
        h={'HTTP_AUTHORIZATION':'Bearer user-token'};h.update(headers or {})
        with patch('clinic.gateway.read_context',return_value={'user':{'id':'u'},'profile':{'tenant_id':'clinic-A'}}) as verify,patch('clinic.gateway.verified_context', side_effect=verify),patch('clinic.gateway.send',return_value=reply or Reply()) as send:
            response=self.client.generic(method,'/api/supabase/'+path,body,content_type=h.pop('CONTENT_TYPE','application/json'),**h)
            return response,send,verify

    def test_queries_headers_and_counts_preserved_without_requoting(self):
        path='rest/v1/pets?id=eq.00000000-0000-4000-8000-000000000001&or=%28name.ilike.%22%25money%25%22%29'
        response,send,verify=self.send(path,headers={'HTTP_RANGE':'0-99','HTTP_PREFER':'count=exact','HTTP_APIKEY':'attacker'},reply=Reply(b'[]',206,{'Content-Type':'application/json','Content-Range':'0-99/7406'}))
        self.assertEqual(response.status_code,206)
        self.assertEqual(response['Content-Range'],'0-99/7406')
        req=send.call_args.args[0]
        self.assertEqual(req.full_url,'https://example.supabase.co/'+path)
        self.assertEqual(req.get_header('Authorization'),'Bearer user-token')
        self.assertEqual(req.get_header('Apikey'),'fixed-public-key')
        self.assertEqual(req.get_header('Range'),'0-99')
        verify.assert_called_once_with('user-token')
        self.assertIn('no-store',response['Cache-Control'])

    def test_postgrest_object_accept_and_empty_maybe_single_error_preserved(self):
        raw=b'{"code":"PGRST116","details":"The result contains 0 rows","message":"Cannot coerce"}'
        response,send,_=self.send('rest/v1/pets?select=*',headers={'HTTP_ACCEPT':'application/vnd.pgrst.object+json'},reply=Reply(raw,406))
        self.assertEqual(response.status_code,406);self.assertEqual(response.content,raw)
        self.assertEqual(send.call_args.args[0].get_header('Accept'),'application/vnd.pgrst.object+json')

    def test_raw_json_writes_not_reserialized_and_no_retry(self):
        raw='[{"custom":"0.33 ml","integer":9007199254740993,"text":"中文"}]'.encode()
        response,send,_=self.send('rest/v1/medical_records','POST',raw,Reply(b'[]',201),{'HTTP_PREFER':'return=representation'})
        self.assertEqual(response.status_code,201)
        self.assertEqual(send.call_args.args[0].data,raw);self.assertEqual(send.call_count,1)

    def test_put_patch_delete_methods_and_204_preserved(self):
        for method in ('PUT','PATCH','DELETE'):
            response,send,_=self.send('rest/v1/items?id=eq.some-id',method,b'{}',Reply(b'',204))
            self.assertEqual(response.status_code,204)
            self.assertEqual(send.call_args.args[0].get_method(),method)

    def test_sql_rpc_error_code_and_text_preserved_for_frozen_requests(self):
        raw=b'{"code":"P0001","message":"transaction rejected"}'
        with patch('clinic.gateway.verified_context'),patch('clinic.gateway.send',side_effect=HTTPError('url',400,'Bad Request',{'Content-Type':'application/json'},io.BytesIO(raw))) as send:
            response=self.client.post('/api/supabase/rest/v1/rpc/pos_v77',data='{}',content_type='application/json',HTTP_AUTHORIZATION='Bearer token')
        self.assertEqual(response.status_code,400);self.assertEqual(response.content,raw);self.assertEqual(send.call_count,1)

    def test_timeout_is_ambiguous_and_never_retried(self):
        with patch('clinic.gateway.verified_context'),patch('clinic.gateway.send',side_effect=TimeoutError) as send:
            response=self.client.post('/api/supabase/rest/v1/rpc/pos_v77',data='{}',content_type='application/json',HTTP_AUTHORIZATION='Bearer token')
        self.assertEqual(response.status_code,502)
        self.assertEqual(response.json()['code'],'GB_UPSTREAM_UNCONFIRMED');self.assertEqual(send.call_count,1)

    def test_storage_multipart_and_binary_roundtrip(self):
        raw=b'--boundary\r\nraw-file\x00\xff\r\n--boundary--'
        response,send,verify=self.send('storage/v1/object/clinic-imaging/clinic-A/pet/study/image.jpg','POST',raw,Reply(b'{"Key":"path"}',200),{'CONTENT_TYPE':'multipart/form-data; boundary=boundary','HTTP_X_UPSERT':'false'})
        self.assertEqual(response.status_code,200);self.assertEqual(send.call_args.args[0].data,raw)
        self.assertEqual(send.call_args.args[0].get_header('Content-type'),'multipart/form-data; boundary=boundary')
        binary=b'\xff\xd8\x00\xff'
        response,_,verify=self.send('storage/v1/object/sign/clinic-imaging/clinic-A/pet/a.jpg?token=signed','GET',reply=Reply(binary,200,{'Content-Type':'image/jpeg'}))
        self.assertEqual(response.content,binary);verify.assert_not_called()

    def test_upload_above_default_django_form_limit_is_supported(self):
        self.assertGreater(settings.DATA_UPLOAD_MAX_MEMORY_SIZE,50*1024*1024)
        raw=b'x'*(3*1024*1024)
        response,send,_=self.send('storage/v1/object/clinic-imaging/a/file.jpg','POST',raw,Reply(b'{}'),{'CONTENT_TYPE':'image/jpeg'})
        self.assertEqual(response.status_code,200);self.assertEqual(len(send.call_args.args[0].data),len(raw))

    def test_auth_password_refresh_user_and_logout_routes_keep_sdk_behavior(self):
        for path,method in [('auth/v1/token?grant_type=password','POST'),('auth/v1/token?grant_type=refresh_token','POST'),('auth/v1/user','PUT'),('auth/v1/logout?scope=global','POST')]:
            response,_,verify=self.send(path,method,b'{}',Reply(b'{}'))
            self.assertEqual(response.status_code,200);verify.assert_not_called()

    def test_public_booking_turnstile_payload_and_share_token_pass_unchanged(self):
        for name in ('online-booking','imaging-share-v76'):
            raw=b'{"token":"one-use-token","request_id":"keep-this-id"}'
            response,send,verify=self.send('functions/v1/'+name,'POST',raw,Reply(b'{}'))
            self.assertEqual(response.status_code,200);verify.assert_not_called();self.assertEqual(send.call_args.args[0].data,raw)

    def test_admin_edge_function_requires_verified_user(self):
        response,_,verify=self.send('functions/v1/manage-staff','POST',b'{}',Reply(b'{}'))
        self.assertEqual(response.status_code,200);verify.assert_called_once()

    def test_private_paths_require_bearer_not_cookie(self):
        with patch('clinic.gateway.send') as send:
            self.client.cookies['sessionid']='cookie'
            response=self.client.get('/api/supabase/rest/v1/pets')
        self.assertEqual(response.status_code,401);send.assert_not_called()

    def test_profile_trial_or_auth_rejection_never_reaches_data_api(self):
        with patch('clinic.gateway.read_context',side_effect=GatewayError(403)),patch('clinic.gateway.send') as send:
            response=self.client.get('/api/supabase/rest/v1/pets',HTTP_AUTHORIZATION='Bearer expired')
        self.assertEqual(response.status_code,403);send.assert_not_called()

    def test_route_schema_bucket_and_redirect_restrictions(self):
        for path in ('rest/v1/unknown_table','rest/v1/rpc/arbitrary_function','storage/v1/object/another-bucket/x','functions/v1/unknown-function','auth/v1/admin'):
            response,send,_=self.send(path)
            self.assertEqual(response.status_code,404);send.assert_not_called()
        response,send,_=self.send('rest/v1/pets',headers={'HTTP_ACCEPT_PROFILE':'private'})
        self.assertEqual(response.status_code,403);send.assert_not_called()
        response,_,_=self.send('rest/v1/pets',reply=Reply(b'',302,{'Location':'https://other.example/'}))
        self.assertEqual(response.status_code,502);self.assertNotIn('Location',response)

    def test_path_traversal_and_arbitrary_target_rejected(self):
        for path in ('rest/v1/../auth/v1/admin','https://other.example','rest//v1/pets','rest/v1/pets%2F..','rest\\v1\\pets'):
            with self.assertRaises(GatewayError):classify(path,'GET','')
        with override_settings(SUPABASE_URL='https://user:pass@example.supabase.co'):
            with self.assertRaises(GatewayError):destination('rest/v1/pets','')

    def test_all_pages_load_gateway_before_existing_sdk_and_use_server_config(self):
        for path in ('/','/booking.html','/imaging-share.html'):
            response=self.client.get(path)
            self.assertEqual(response.status_code,200)
            source=response.content.decode()
            self.assertEqual(source.count('/assets/integrated-gateway.js'),1)
            import re
            local_scripts=re.findall(r'<script\b[^>]*src="(/assets/frontend/[^"]+)"',source)
            self.assertTrue(local_scripts)
            for script_url in local_scripts:
                self.assertLess(source.index('/assets/integrated-gateway.js'),source.index(script_url))
            script_source=''.join(b''.join(self.client.get(url).streaming_content).decode() for url in local_scripts)
            self.assertIn('window.GENBLUE_CONFIG',script_source)
        response=self.client.get('/assets/integrated-gateway.js')
        self.assertContains(response,'https://example.supabase.co')
        self.assertContains(response,'fixed-public-key')
        self.assertNotContains(response,'service_role')

    def test_views_and_dynamic_backup_tables_present(self):
        for name in ('v_controlled_drug_ledger','v_regulatory_transactions','medical_records','clinic_trials','report_export_profiles'):
            self.assertIn(name,MANIFEST['tables'])
        for name in ('pharmacy_room_v9133','ob_staff','pos_v77','preview_clinic_restore_raw_v63','restore_missing_clinic_raw_v63','period_fees_v932'):
            self.assertIn(name,MANIFEST['rpcs'])
