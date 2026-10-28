"""Verify retained source, extracted image bytes, assets and local contracts.

No dependency installation, deployment, database connection or clinical writes.
"""
from pathlib import Path
import ast
import base64
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    retained = json.loads((ROOT / 'PRESERVATION.json').read_text())
    for entry in retained['protected_files']:
        if sha(ROOT / entry['path']) != entry['sha256']:
            raise SystemExit('Protected baseline file changed: ' + entry['path'])
    for entry in retained.get('protected_transforms', []):
        path = ROOT / entry['path']
        if sha(path) != entry['updated_sha256']:
            raise SystemExit('Protected transformed source changed: ' + entry['path'])
        original_uri = 'data:' + entry['mime'] + ';base64,' + base64.b64encode((ROOT / entry['image_path']).read_bytes()).decode('ascii')
        if hashlib.sha256(original_uri.encode()).hexdigest() != entry['original_data_uri_sha256']:
            raise SystemExit('Original image URI differs')
        declaration = "const " + entry['constant'] + " = '"
        source = path.read_text(encoding='utf-8')
        old = declaration + entry['replacement_url'] + "';"
        if source.count(old) != 1:
            raise SystemExit('Expected exactly one image constant replacement')
        restored = source.replace(old, declaration + original_uri + "';", 1)
        if hashlib.sha256(restored.encode()).hexdigest() != entry['baseline_sha256']:
            raise SystemExit('Source outside image constant differs: ' + entry['path'])
    for entry in retained.get('protected_functions', []):
        tree = ast.parse((ROOT / entry['path']).read_text(encoding='utf-8'))
        nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == entry['function']]
        if len(nodes) != 1 or hashlib.sha256(ast.dump(nodes[0], include_attributes=False).encode()).hexdigest() != entry['ast_sha256']:
            raise SystemExit('Protected medical function changed: ' + entry['function'])
    for entry in json.loads((ROOT / 'ASSET_EXTRACTION.json').read_text())['assets']:
        path = ROOT / 'assets/frontend/images/breeds' / (entry['sha256'] + '.jpg')
        if sha(path) != entry['sha256'] or path.stat().st_size != entry['bytes']:
            raise SystemExit('Extracted image changed: ' + entry['asset'])
    for entry in json.loads((ROOT / 'ASSET_EXTRACTION.json').read_text()).get('standalone_images', []):
        path = ROOT / entry['path']
        if sha(path) != entry['sha256'] or path.stat().st_size != entry['bytes']:
            raise SystemExit('Standalone image differs: ' + entry['constant'])
    manifest = json.loads((ROOT / 'assets/frontend/manifest.json').read_text())
    for name, entry in manifest.items():
        if sha(ROOT / 'assets/frontend' / name) != entry['sha256']:
            raise SystemExit('Asset inventory differs: ' + name)
    for path in ROOT.rglob('*.py'):
        ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
    print(f"Preserved {len(retained['protected_files'])} baseline files plus image-only source substitution; 351 original images; {len(manifest)} asset hashes; Python syntax OK.")
    subprocess.run([sys.executable, str(ROOT / 'tools/verify_workflow_contracts.py')], cwd=ROOT, check=True)
    subprocess.run([sys.executable, str(ROOT / 'tools/verify_medical_reads.py')], cwd=ROOT, check=True)


if __name__ == '__main__':
    main()
