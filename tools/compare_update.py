"""Read-only comparison before merging this integration into an existing tree.

No copy, write, git operation, network call or deployment is performed.
"""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', required=True, type=Path)
    args = parser.parse_args()
    target = args.target.resolve()
    if not (target / 'manage.py').is_file() or not (target / 'clinic').is_dir():
        raise SystemExit('Target must be the existing project root containing manage.py and clinic/.')
    changes = json.loads((ROOT / 'CHANGESET-20261028.json').read_text())
    conflicts = []
    ready = already = 0
    for entry in changes['files']:
        path = target / entry['path']
        if not path.resolve().is_relative_to(target):
            conflicts.append(entry['path'])
            continue
        actual = digest(path)
        if actual == entry['updated_sha256']:
            already += 1
        elif actual == entry['baseline_sha256']:
            ready += 1
        else:
            conflicts.append(entry['path'])
    print(json.dumps({'ready_to_merge': ready, 'already_matches': already,
                      'conflicts_keep_current_files': conflicts,
                      'external_systems_modified': False}, ensure_ascii=False, indent=2))
    if conflicts:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
