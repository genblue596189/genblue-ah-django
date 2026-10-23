import io,json
from urllib.error import HTTPError
from unittest.mock import patch
from django.test import SimpleTestCase,override_settings
from .views import upstream,GatewayError


@override_settings(SUPABASE_URL='https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY='public-key')
class RecordTransportTests(SimpleTestCase):
    def test_reviewed_sql_code_survives_without_raw_database_details(self):
        error=HTTPError('https://example.supabase.co',409,'Conflict',{},io.BytesIO(json.dumps({
            'code':'23505','message':'private details and patient identifier'}).encode()))
        with patch('clinic.views.urlopen',side_effect=error),self.assertRaises(GatewayError) as caught:
            upstream('/rest/v1/owners?select=*','caller',method='POST',payload=[],record_errors=True)
        self.assertEqual(caught.exception.status,409)
        self.assertEqual(caught.exception.code,'23505')
        self.assertNotIn('private details',caught.exception.message)

    def test_unknown_upstream_failure_does_not_claim_definitive_rejection(self):
        error=HTTPError('https://example.supabase.co',500,'Failure',{},io.BytesIO(b'{"code":"XX000","message":"internal"}'))
        with patch('clinic.views.urlopen',side_effect=error),self.assertRaises(GatewayError) as caught:
            upstream('/rest/v1/pets?select=*','caller',method='POST',payload=[],record_errors=True)
        self.assertEqual(caught.exception.status,502)
        self.assertIsNone(caught.exception.code)
