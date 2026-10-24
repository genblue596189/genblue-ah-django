import io
import threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from unittest.mock import patch,MagicMock
from urllib.request import Request
from urllib.error import HTTPError,URLError
from django.test import SimpleTestCase
from . import transport

class TransportTests(SimpleTestCase):
    def tearDown(self):
        saved=getattr(transport._local,'connection',None)
        if saved:saved[1].close()
        transport._local.connection=None
    def test_real_keepalive_preserves_caller_headers_body_and_sql_errors(self):
        class Server(ThreadingHTTPServer):
            count=0
            def get_request(self):
                self.count+=1
                return super().get_request()
        class Handler(BaseHTTPRequestHandler):
            protocol_version='HTTP/1.1'
            def log_message(self,*args):pass
            def do_GET(self):
                body=self.headers.get('Authorization','').encode()
                self.send_response(409 if self.path=='/error' else 200)
                self.send_header('Content-Length',str(len(body)))
                self.send_header('Content-Type','application/octet-stream')
                self.end_headers();self.wfile.write(body)
            def do_POST(self):
                body=self.rfile.read(int(self.headers['Content-Length']))
                self.send_response(200);self.send_header('Content-Length',str(len(body)))
                self.end_headers();self.wfile.write(body)
        server=Server(('127.0.0.1',0),Handler)
        worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
        base='http://127.0.0.1:'+str(server.server_port)
        try:
            for caller in ('Bearer A','Bearer B'):
                with transport.urlopen(Request(base+'/',headers={'Authorization':caller})) as r:
                    self.assertEqual(r.read(),caller.encode())
            raw=b'\x00\xffbinary'
            with transport.urlopen(Request(base+'/',data=raw,method='POST')) as r:self.assertEqual(r.read(),raw)
            with self.assertRaises(HTTPError) as caught:transport.urlopen(Request(base+'/error',headers={'Authorization':'SQL body'}))
            self.assertEqual(caught.exception.code,409)
            self.assertEqual(caught.exception.read(),b'SQL body')
            self.assertEqual(server.count,1)
        finally:
            self.tearDown();server.shutdown();server.server_close();worker.join()
    def test_failed_write_is_never_retried(self):
        conn=MagicMock();conn.request.side_effect=ConnectionResetError()
        with patch.object(transport.http.client,'HTTPSConnection',return_value=conn),self.assertRaises(URLError):
            transport.urlopen(Request('https://upstream.example/',data=b'{}',method='POST'))
        self.assertEqual(conn.request.call_count,1)
    def test_redirect_is_not_followed(self):
        conn=MagicMock();response=conn.getresponse.return_value
        response.status=302;response.headers={'Location':'https://elsewhere.example/'};response.read.return_value=b'';response.will_close=False
        with patch.object(transport.http.client,'HTTPSConnection',return_value=conn),self.assertRaises(HTTPError) as caught:
            transport.urlopen(Request('https://upstream.example/'))
        self.assertEqual(caught.exception.code,302);self.assertEqual(conn.request.call_count,1)
