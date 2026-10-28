"""Offline, guarded integration installer. Defaults to read-only inspection."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise ValueError(f'Not a regular file: {path}')
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def safe(root, relative):
    p = Path(relative)
    if p.is_absolute() or '..' in p.parts or '\\' in relative or ':' in relative:
        raise ValueError(f'Unsafe path: {relative}')
    target = root / p
    for component in [target, *target.parents]:
        if component == root.parent:
            break
        if component.is_symlink():
            raise ValueError(f'Symlink path: {relative}')
    if not target.resolve().is_relative_to(root):
        raise ValueError(f'Outside project: {relative}')
    return target


def git(target, *args):
    return subprocess.check_output(['git', '-C', str(target), *args], text=True).strip()


def install(source, target, apply=False):
    source, target = source.resolve(), target.resolve()
    if source == target or source.is_relative_to(target) or target.is_relative_to(source):
        raise ValueError('Extract the integration outside the target repository.')
    if not (target / 'manage.py').is_file() or not (target / 'clinic').is_dir():
        raise ValueError('Target must contain manage.py and clinic/.')
    if Path(git(target, 'rev-parse', '--show-toplevel')).resolve() != target:
        raise ValueError('Target must be the Git repository root.')
    manifest = json.loads((source / 'CHANGESET-20261028.json').read_text(encoding='utf-8'))
    if git(target, 'rev-parse', 'HEAD') != manifest['baseline_commit']:
        raise ValueError('HEAD differs from baseline; merge manually. Nothing copied.')
    if git(target, 'status', '--porcelain', '--untracked-files=all'):
        raise ValueError('Uncommitted or untracked files exist; preserve them first. Nothing copied.')
    plan, seen = [], set()
    for entry in manifest['files']:
        name = entry['path']
        if name in seen:
            raise ValueError(f'Duplicate path: {name}')
        seen.add(name)
        src, dst = safe(source, name), safe(target, name)
        if sha(src) != entry['updated_sha256']:
            raise ValueError(f'Package checksum mismatch: {name}')
        actual = sha(dst)
        if actual == entry['updated_sha256']:
            continue
        if actual != entry['baseline_sha256']:
            raise ValueError(f'Target conflict: {name}')
        plan.append((entry, src, dst))
    if not apply:
        return {'mode': 'check', 'files_to_copy': len(plan), 'changed': False}
    if not plan:
        return {'mode': 'apply', 'files_to_copy': 0, 'changed': False}
    backup = Path(tempfile.mkdtemp(prefix=target.name + '-update-backup-', dir=target.parent))
    journal = []
    for entry, src, dst in plan:
        if dst.exists():
            saved = backup / 'files' / entry['path']
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dst, saved)
        journal.append(entry)
    (backup / 'recovery.json').write_text(json.dumps({'target': str(target), 'files': journal}, indent=2), encoding='utf-8')
    touched = []
    try:
        for entry, src, dst in plan:
            if sha(dst) != entry['baseline_sha256']:
                raise ValueError(f'Target changed during update: {entry["path"]}')
            dst.parent.mkdir(parents=True, exist_ok=True)
            touched.append((entry, dst))
            shutil.copy2(src, dst)
            if sha(dst) != entry['updated_sha256']:
                raise ValueError(f'Copy verification failed: {entry["path"]}')
    except Exception:
        for entry, dst in reversed(touched):
            if entry['baseline_sha256'] is None:
                dst.unlink(missing_ok=True)
            else:
                shutil.copy2(backup / 'files' / entry['path'], dst)
        raise
    return {'mode': 'apply', 'files_copied': len(plan), 'backup': str(backup), 'deployed': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', required=True, type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(install(ROOT, args.target, args.apply), ensure_ascii=False, indent=2))
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f'Update stopped: {exc}\n')


if __name__ == '__main__':
    main()
