"""Performance behavior without production credentials or business writes."""
import json
import threading
from unittest.mock import patch
from django.test import SimpleTestCase, override_settings
from django.conf import settings
from . import views


@override_settings(SUPABASE_URL='https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY='public')
class VerificationParallelTests(SimpleTestCase):
    def test_profile_and_trial_overlap_after_authentication(self):
        barrier = threading.Barrier(2)
        authenticated = threading.Event()
        def remote(path, token):
            self.assertEqual(token, 'test')
            if path == '/auth/v1/user':
                authenticated.set()
                return {'id': 'user'}
            self.assertTrue(authenticated.is_set())
            barrier.wait(timeout=2)
            if path.startswith('/rest/v1/user_profiles?'):
                return [{'tenant_id': 'clinic'}]
            self.assertEqual(path, '/rest/v1/rpc/my_trial_expires_at')
            return None
        with patch.object(views, 'upstream', side_effect=remote):
            self.assertEqual(views.verified_context('test')['profile']['tenant_id'], 'clinic')

    def test_authentication_failure_does_not_launch_other_checks(self):
        with patch.object(views, 'upstream', return_value={}) as remote:
            with self.assertRaises(views.GatewayError):
                views.verified_context('test')
            self.assertEqual(remote.call_count, 1)


class AssetCacheTests(SimpleTestCase):
    def test_versioned_assets_cache_and_old_urls_revalidate(self):
        entries=json.loads((settings.BASE_DIR/'assets/frontend/manifest.json').read_text())
        name, entry=next(iter(entries.items()))
        url='/assets/frontend/'+name
        response=self.client.get(url+'?v='+entry['sha256'])
        self.assertIn('immutable', response['Cache-Control'])
        response.close()
        fresh=self.client.get(url)
        self.assertEqual(fresh['Cache-Control'], 'no-cache')
        etag=fresh['ETag'];fresh.close()
        unchanged=self.client.get(url, HTTP_IF_NONE_MATCH=etag)
        self.assertEqual(unchanged.status_code,304)
        self.assertEqual(unchanged.content,b'')
        stale=self.client.get(url+'?v=old')
        self.assertEqual(stale['Cache-Control'],'no-cache');stale.close()

    def test_html_uses_current_content_hashes(self):
        entries=json.loads((settings.BASE_DIR/'assets/frontend/manifest.json').read_text())
        text=self.client.get('/').content.decode()
        self.assertIn('/assets/frontend/index/block-01.js?v='+entries['index/block-01.js']['sha256'],text)


@override_settings(SUPABASE_URL='https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY='public')
class LiveVerificationHintTests(SimpleTestCase):
    user_id = '11111111-1111-4111-8111-111111111111'

    def token(self):
        import base64
        payload=base64.urlsafe_b64encode(json.dumps({'sub':self.user_id}).encode()).decode().rstrip('=')
        return 'header.'+payload+'.signature'

    def test_all_three_live_checks_overlap_and_use_same_bearer(self):
        barrier=threading.Barrier(3)
        def remote(path, token):
            self.assertEqual(token,self.token())
            barrier.wait(timeout=3)
            if path=='/auth/v1/user':return {'id':self.user_id}
            if path.startswith('/rest/v1/user_profiles?'):
                self.assertIn(self.user_id,path)
                return [{'tenant_id':'clinic'}]
            return None
        with patch.object(views,'upstream',side_effect=remote):
            self.assertEqual(views.verified_context(self.token())['profile']['tenant_id'],'clinic')

    def test_forged_subject_cannot_authorize_profile(self):
        def remote(path, token):
            if path=='/auth/v1/user':return {'id':'different-user'}
            if path.startswith('/rest/v1/user_profiles?'):return [{'tenant_id':'other-clinic'}]
            return None
        with patch.object(views,'upstream',side_effect=remote):
            with self.assertRaises(views.GatewayError) as caught:views.verified_context(self.token())
        self.assertEqual(caught.exception.status,401)

    def test_auth_failure_and_trial_expiry_still_reject(self):
        for failure in ('auth','trial'):
            def remote(path, token):
                if path=='/auth/v1/user':
                    if failure=='auth':raise views.GatewayError(401)
                    return {'id':self.user_id}
                if path.startswith('/rest/v1/user_profiles?'):return [{'tenant_id':'clinic'}]
                return '2000-01-01T00:00:00Z'
            with patch.object(views,'upstream',side_effect=remote):
                with self.assertRaises(views.GatewayError) as caught:views.verified_context(self.token())
            self.assertEqual(caught.exception.status,401 if failure=='auth' else 403)
