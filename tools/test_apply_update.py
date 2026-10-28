import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('updater', Path(__file__).with_name('apply_update.py'))
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.src, self.dst = root / 'source', root / 'target'
        self.src.mkdir(); self.dst.mkdir()
        (self.dst / 'clinic').mkdir()
        (self.dst / 'manage.py').write_text('old')
        self.git('init', '-q'); self.git('config', 'user.name', 'Test')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('add', '.'); self.git('commit', '-qm', 'baseline')
        (self.src / 'manage.py').write_text('new')
        (self.src / 'extra.txt').write_text('added')
        self.manifest = {'baseline_commit': self.git('rev-parse', 'HEAD'), 'files': [
            {'path': 'manage.py', 'baseline_sha256': u.sha(self.dst / 'manage.py'), 'updated_sha256': u.sha(self.src / 'manage.py')},
            {'path': 'extra.txt', 'baseline_sha256': None, 'updated_sha256': u.sha(self.src / 'extra.txt')}]}
        self.save()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.dst), *args], text=True).strip()

    def save(self):
        (self.src / 'CHANGESET-20261028.json').write_text(json.dumps(self.manifest))

    def test_check_and_apply(self):
        self.assertEqual(u.install(self.src, self.dst)['files_to_copy'], 2)
        self.assertEqual((self.dst / 'manage.py').read_text(), 'old')
        result = u.install(self.src, self.dst, True)
        self.assertEqual((self.dst / 'manage.py').read_text(), 'new')
        self.assertEqual((Path(result['backup']) / 'files/manage.py').read_text(), 'old')
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.manifest['baseline_commit'])

    def test_dirty(self):
        (self.dst / 'manage.py').write_text('local')
        with self.assertRaises(ValueError): u.install(self.src, self.dst, True)

    def test_untracked(self):
        (self.dst / 'local').write_text('keep')
        with self.assertRaises(ValueError): u.install(self.src, self.dst, True)

    def test_wrong_head(self):
        self.manifest['baseline_commit'] = '0' * 40; self.save()
        with self.assertRaises(ValueError): u.install(self.src, self.dst, True)

    def test_tampered_source(self):
        (self.src / 'extra.txt').write_text('bad')
        with self.assertRaises(ValueError): u.install(self.src, self.dst, True)
        self.assertEqual((self.dst / 'manage.py').read_text(), 'old')

    def test_traversal(self):
        self.manifest['files'][1]['path'] = '../outside'; self.save()
        with self.assertRaises(ValueError): u.install(self.src, self.dst, True)

    def test_symlink(self):
        (self.src / 'extra.txt').unlink()
        (self.src / 'extra.txt').symlink_to(self.src / 'manage.py')
        with self.assertRaises(ValueError): u.install(self.src, self.dst, True)

    def test_rollback(self):
        original = u.shutil.copy2
        def fail(src, dst):
            if Path(dst) == self.dst / 'extra.txt': raise OSError('simulated copy failure')
            return original(src, dst)
        with patch.object(u.shutil, 'copy2', side_effect=fail):
            with self.assertRaises(OSError): u.install(self.src, self.dst, True)
        self.assertEqual((self.dst / 'manage.py').read_text(), 'old')
        self.assertFalse((self.dst / 'extra.txt').exists())


if __name__ == '__main__': unittest.main()
