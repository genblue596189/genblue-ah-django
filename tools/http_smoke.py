"""Real HTTP transport QA using a local fake upstream, never a Supabase account."""
import argparse
import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit,parse_qs
from wsgiref.simple_server import make_server,WSGIRequestHandler

ROOT=Path(__file__).resolve().parents[1]
USER='00000000-0000-4000-8000-000000000001'
PET='00000000-0000-4000-8000-000000000002'
CALLS=[]


def encoded(value):return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b'=').decode()
TOKEN=encoded({'alg':'HS256','typ':'JWT'})+'.'+encoded({'sub':USER,'exp':4102444800})+'.fixture'


class Fixture(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):self.handle_request()
    def do_POST(self):self.handle_request()
    def handle_request(self):
        parsed=urlsplit(self.path);path=parsed.path
        body=self.rfile.read(int(self.headers.get('Content-Length','0')))
        CALLS.append((path,parsed.query,body))
        status=200;headers={};result=None;binary=None
        if path=='/auth/v1/token':
            result={'access_token':TOKEN,'refresh_token':'fixture-refresh','token_type':'bearer','expires_in':3600,
                    'user':{'id':USER,'aud':'authenticated','email':'fixture@example.test','created_at':'2026-01-01T00:00:00Z'}}
        elif path=='/auth/v1/user':result={'id':USER,'email':'fixture@example.test'}
        elif path=='/auth/v1/logout':status=204;binary=b''
        elif path=='/rest/v1/user_profiles':result=[{'tenant_id':'clinic-A','role':'admin'}]
        elif path=='/rest/v1/rpc/my_trial_expires_at':result=None
        elif path=='/rest/v1/pets':result=[{'id':PET,'name':'Fixture'}];headers['Content-Range']='0-0/1'
        elif path=='/rest/v1/rpc/pos_v77':status=400;result={'code':'P0001','message':'fixture SQL rejection'}
        elif path=='/rest/v1/rpc/night_work_v93':result=json.loads(body)
        elif path=='/storage/v1/object/sign/clinic-imaging/clinic-A/pet/file.bin':
            if self.command=='POST':result={'signedURL':'/object/sign/clinic-imaging/clinic-A/pet/file.bin?token=fixture'}
            else:binary=bytes([0,255,1])
        elif path=='/storage/v1/object/clinic-imaging/clinic-A/pet/file.bin':result={'Key':'clinic-imaging/clinic-A/pet/file.bin'}
        elif path=='/functions/v1/manage-staff':result=[]
        else:status=404;result={'message':'unknown fixture route'}
        raw=binary if binary is not None else json.dumps(result).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/octet-stream' if binary else 'application/json')
        for k,v in headers.items():self.send_header(k,v)
        self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)


class Quiet(WSGIRequestHandler):
    def log_message(self,*args):pass


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--sdk-file',required=True);options=parser.parse_args()
    sdk=Path(options.sdk_file).resolve()
    if not sdk.is_file():raise SystemExit('Provide the same Supabase SDK UMD file used by the web page.')
    node=shutil.which('node')
    if not node:raise SystemExit('Node.js is required for this developer transport check.')
    fixture=ThreadingHTTPServer(('127.0.0.1',0),Fixture)
    threading.Thread(target=fixture.serve_forever,daemon=True).start()
    upstream=f'http://127.0.0.1:{fixture.server_port}'
    os.environ.update(DJANGO_SETTINGS_MODULE='config.settings',SUPABASE_URL=upstream,SUPABASE_PUBLISHABLE_KEY='public-test-key')
    sys.path.insert(0,str(ROOT))
    from django.core.wsgi import get_wsgi_application
    app=make_server('127.0.0.1',0,get_wsgi_application(),handler_class=Quiet)
    threading.Thread(target=app.serve_forever,daemon=True).start()
    try:
        subprocess.run([node,str(ROOT/'tools/sdk_smoke.cjs'),str(sdk),f'http://127.0.0.1:{app.server_port}',upstream],check=True)
        assert not any(path=='/rest/v1/not-allowed' for path,_,_ in CALLS)
        uploads=[body for path,_,body in CALLS if path=='/storage/v1/object/clinic-imaging/clinic-A/pet/file.bin']
        assert len(uploads)==1 and bytes([0,255,1]) in uploads[0]
        queries=[parse_qs(query) for path,query,_ in CALLS if path=='/rest/v1/pets']
        assert len(queries)==1 and queries[0]['id']==['eq.'+PET]
        assert sum(path=='/rest/v1/rpc/pos_v77' for path,_,_ in CALLS)==1
        print('Fixture assertions passed: exact filter, no duplicate RPC/upload and no forbidden upstream route.')
    finally:
        app.shutdown();app.server_close();fixture.shutdown();fixture.server_close()
