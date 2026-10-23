import json
from pathlib import Path
from django.conf import settings
from django.test import SimpleTestCase


class FrontendAssetsTests(SimpleTestCase):
    def test_declared_assets_load_with_correct_types(self):
        root=settings.BASE_DIR/'assets/frontend'
        for name,entry in json.loads((root/'manifest.json').read_text()).items():
            with self.subTest(asset=name):
                response=self.client.get('/assets/frontend/'+name)
                self.assertEqual(response.status_code,200)
                self.assertEqual(response['Content-Type'],entry['content_type'])
                self.assertEqual(b''.join(response.streaming_content),(root/name).read_bytes())
                self.assertEqual(response['X-Content-Type-Options'],'nosniff')

    def test_inventory_and_project_files_are_not_public_assets(self):
        for name in ('manifest.json','../../config/settings.py','index/../../../manage.py','index/nonexistent.js'):
            self.assertEqual(self.client.get('/assets/frontend/'+name).status_code,404)
