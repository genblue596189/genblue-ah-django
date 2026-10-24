import base64,json,time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from django.test import SimpleTestCase,override_settings
from . import views

@override_settings(SUPABASE_URL='https://cache-test.supabase.co',SUPABASE_PUBLISHABLE_KEY='public')
class ContextCacheTests(SimpleTestCase):
    def setUp(self):
        views._context_cache.clear()
        self.token='header.'+base64.urlsafe_b64encode(json.dumps({'exp':time.time()+3600}).encode()).decode().rstrip('=')+'.signature'
        self.context={'user':{'id':'u'},'profile':{'tenant_id':'A'},'trial_end':None}
    def test_burst_reuses_verified_result_and_returns_isolated_copy(self):
        with patch.object(views,'verified_context',return_value=self.context) as remote:
            with ThreadPoolExecutor(max_workers=8) as pool:
                results=list(pool.map(views.read_context,[self.token]*8))
            self.assertEqual(remote.call_count,1)
            results[0]['profile']['tenant_id']='changed'
            self.assertEqual(views.read_context(self.token)['profile']['tenant_id'],'A')
    def test_expiry_and_invalidation_require_new_verification(self):
        with patch.object(views,'verified_context',return_value=self.context) as remote:
            views.read_context(self.token)
            views.invalidate_context(self.token)
            views.read_context(self.token)
            with patch.object(views.time,'monotonic',return_value=time.monotonic()+6):
                views.read_context(self.token)
            self.assertEqual(remote.call_count,3)
    def test_different_tokens_and_projects_never_share_results(self):
        with patch.object(views,'verified_context',return_value=self.context) as remote:
            views.read_context(self.token)
            views.read_context(self.token+'other')
            with override_settings(SUPABASE_URL='https://other.supabase.co'):
                views.read_context(self.token)
            self.assertEqual(remote.call_count,3)
    def test_expired_opaque_and_failed_tokens_never_cached(self):
        with patch.object(views,'verified_context',return_value=self.context) as remote:
            for _ in range(2):views.read_context('opaque')
            self.assertEqual(remote.call_count,2)
        with patch.object(views,'verified_context',side_effect=views.GatewayError(401)) as remote:
            for _ in range(2):
                with self.assertRaises(views.GatewayError):views.read_context(self.token)
            self.assertEqual(remote.call_count,2)
    def test_writes_always_verify_live(self):
        from .tests_gateway import Reply
        with patch('clinic.gateway.verified_context',return_value=self.context) as live,patch('clinic.gateway.read_context') as cached,patch('clinic.gateway.send',side_effect=lambda req:Reply()):
            for _ in range(2):
                response=self.client.post('/api/supabase/rest/v1/pets',data='{}',content_type='application/json',HTTP_AUTHORIZATION='Bearer '+self.token)
                self.assertEqual(response.status_code,200)
            self.assertEqual(live.call_count,2)
            cached.assert_not_called()
