"""Update the explicit asset inventory after editing JS/CSS/images."""
from pathlib import Path
import hashlib
import json

root=Path(__file__).resolve().parents[1]/'assets/frontend'
types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
       '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'}
entries={}
for path in sorted(root.rglob('*')):
    if not path.is_file() or path.suffix not in types: continue
    if any(part.startswith('.') for part in path.relative_to(root).parts): continue
    entries[str(path.relative_to(root)).replace('\\','/')]={
        'content_type':types[path.suffix], 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(root/'manifest.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
print(f'Inventoried {len(entries)} frontend assets')
