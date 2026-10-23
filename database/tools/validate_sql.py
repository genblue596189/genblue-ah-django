"""Static verification; requires pglast. No database or network calls."""
from pathlib import Path
import json,re,collections
from pglast import parse_sql,split
from pglast.parser import parse_sql_json,parse_plpgsql_json

root=Path(__file__).resolve().parents[1]
files=sorted(root.rglob('*.sql'))
for f in files:parse_sql(f.read_text(encoding='utf-8'))
original=(root/'source/00_original_snapshot.sql').read_text(encoding='utf-8')
old="ARRAY['owner'::\"text\", 'admin'::\"text\", 'vet'::\"text\", 'staff'::\"text\"]"
new=old[:-1]+", 'doctor'::\"text\"]"
assert original.count(old)==1
expected=re.sub(r'(?m)^SET ', 'SET LOCAL ',original.replace(old,new))
expected=expected.replace("set_config('search_path', '', false)","set_config('search_path', '', true)")
modules='\n'.join(f.read_text(encoding='utf-8') for f in sorted((root/'modules').glob('*.sql')) if f.name[:2] in [f'{i:02}' for i in range(1,9)])
def normalize(x):
 if isinstance(x,dict):return {k:normalize(v) for k,v in x.items() if k!='location' and not k.endswith('_location') and k not in ['stmt_len','list_start','list_end']}
 if isinstance(x,list):return [normalize(v) for v in x]
 return x
assert normalize(json.loads(parse_sql_json(expected)))==normalize(json.loads(parse_sql_json(modules)))
installed=(root/'00_install_empty.sql').read_text(encoding='utf-8')
parsed=parse_sql(installed);raw=split(installed)
assert len(parsed)==1116
counts=collections.Counter(type(n.stmt).__name__ for n in parsed)
assert counts['CreateStmt']==54 and counts['CreateFunctionStmt']==114
assert counts['CreateTrigStmt']==27 and counts['CreatePolicyStmt']==130
assert counts['IndexStmt']==55 and counts['ViewStmt']==2
assert not any(type(n.stmt).__name__ in ['DropStmt','DeleteStmt','TruncateStmt','UpdateStmt'] for n in parsed)
original_fns={tuple(x.sval for x in n.stmt.funcname):next(o.arg[0].sval for o in n.stmt.options if o.defname=='as') for n in parse_sql(original) if type(n.stmt).__name__=='CreateFunctionStmt'}
pl_ok=[];pl_unresolved=[];sql_ok=[]
for n,t in zip(parsed,raw):
 if type(n.stmt).__name__!='CreateFunctionStmt':continue
 fn=n.stmt;name=tuple(x.sval for x in fn.funcname);opts={o.defname:o.arg for o in fn.options}
 assert opts['as'][0].sval==original_fns[name],name
 if opts['language'].sval=='sql':parse_sql(opts['as'][0].sval);sql_ok.append('.'.join(name))
 elif opts['language'].sval=='plpgsql':
  try:parse_plpgsql_json(t);pl_ok.append('.'.join(name))
  except Exception as e:
   if 'Not implemented (LookupExplicitNamespace only supports pg_catalog and public)' not in str(e):raise
   pl_unresolved.append('.'.join(name))
result={'sql_files_parsed':len(files),'installer_statements':len(parsed),'source_ast_preserved_except_documented_settings_and_role':True,'function_bodies_unchanged':114,'sql_function_bodies_parsed':len(sql_ok),'plpgsql_function_bodies_parsed':len(pl_ok),'plpgsql_parser_namespace_limit':pl_unresolved,'live_database_execution':False}
(root/'VALIDATION.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
