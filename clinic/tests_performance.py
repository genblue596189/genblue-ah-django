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
