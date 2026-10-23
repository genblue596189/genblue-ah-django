"""Developer verification of the cumulative source tree; never writes clinic data."""
from pathlib import Path
import argparse
import csv
import hashlib
import json
import re
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]


def run(args):
    subprocess.run(args,cwd=ROOT,check=True)


def audit():
    manifest=json.loads((ROOT/'assets/frontend/manifest.json').read_text(encoding='utf-8'))
    for name,entry in manifest.items():
        path=ROOT/'assets/frontend'/name
        assert path.is_file(),name
        assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256'],name
    pages=[]
    for page in sorted((ROOT/'web').glob('*.html')):
        text=page.read_text(encoding='utf-8')
        refs=re.findall(r'(?:src|href)="/assets/frontend/([^"]+)"',text)
        assert all(ref in manifest for ref in refs),page.name
        gateway=text.index('/assets/integrated-gateway.js')
        for ref in re.findall(r'<script\b[^>]*src="/assets/frontend/([^"]+)"',text):
            assert gateway<text.index('/assets/frontend/'+ref),page.name
        pages.append({'page':page.name,'local_asset_references':len(refs)})
    api=json.loads((ROOT/'clinic/api_manifest.json').read_text(encoding='utf-8'))
    tables=set();rpcs=set();edges=set()
    for path in (ROOT/'assets/frontend').rglob('*.js'):
        text=path.read_text(encoding='utf-8')
        tables.update(re.findall(r"\.from\(['\"]([^'\"]+)",text))
        rpcs.update(re.findall(r"\.rpc\(['\"]([^'\"]+)",text))
        edges.update(re.findall(r"\.functions\.invoke\(['\"]([^'\"]+)",text))
    assert tables <= set(api['tables'])|set(api['buckets']),tables-set(api['tables'])-set(api['buckets'])
    assert rpcs <= set(api['rpcs']),rpcs-set(api['rpcs'])
    assert edges <= set(api['functions']),edges-set(api['functions'])
    database=ROOT/'database'
    if database.is_dir():
        functions=list(csv.DictReader((database/'FUNCTIONS.csv').open(encoding='utf-8',newline='')))
        objects=list(csv.DictReader((database/'OBJECTS.csv').open(encoding='utf-8',newline='')))
        names={row['function'] for row in functions if row['schema']=='public'}
        relations={row['object'] for row in objects if row['kind'] in ('table','view')}
        assert set(api['rpcs'])<=names,set(api['rpcs'])-names
        assert {'public.'+name for name in api['tables']}<=relations
    result={'pages':pages,'frontend_assets':len(manifest),'javascript_files':sum(n.endswith('.js') for n in manifest),
            'literal_table_or_bucket_references':len(tables),'literal_rpc_references':len(rpcs),
            'all_literal_api_references_allowlisted':True,'database_interface_names_matched':database.is_dir(),
            'uses_live_patient_data':False}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--python-only',action='store_true',help='Skip Node-based UI simulations')
    options=parser.parse_args()
    audit()
    run([sys.executable,'manage.py','check'])
    run([sys.executable,'manage.py','test','clinic','--verbosity','0'])
    if not options.python_only:
        node=shutil.which('node')
        if not node:raise SystemExit('Node.js is required for the full developer verification suite.')
        for path in sorted((ROOT/'assets/frontend').rglob('*.js')):run([node,'--check',str(path)])
        for path in sorted((ROOT/'tests').glob('*-ui.cjs')):run([node,str(path)])
    print('PROJECT CHECKS PASSED (no live business writes performed)')
