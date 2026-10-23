"""Build the single installer from ordered SQL modules (Python standard library only)."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
names=[
 '01_session_schemas.sql','02_functions_rowtype_prerequisite.sql',
 '03_tables_views.sql','04_constraints_indexes.sql','05_triggers_foreign_keys.sql',
 '06_rls_policies.sql','07_explicit_grants.sql','08_default_privileges.sql','09_storage.sql',
]
text=(root/'modules/00_preflight.sql').read_text(encoding='utf-8')
for name in names:
 text+='\n-- ========== '+name+' ==========\n'+(root/'modules'/name).read_text(encoding='utf-8')
text+='\n'+(root/'modules/10_commit.sql').read_text(encoding='utf-8')
(root/'00_install_empty.sql').write_text(text,encoding='utf-8',newline='\n')
print('Built',root/'00_install_empty.sql')
