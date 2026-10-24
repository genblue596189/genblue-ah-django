import os, secrets
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY') or secrets.token_urlsafe(48)
DEBUG = False
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '[::1]']
ROOT_URLCONF = 'config.urls'
INSTALLED_APPS = []
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'django.middleware.gzip.GZipMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
DATABASES = {}
USE_TZ = True
TIME_ZONE = 'Asia/Taipei'
SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_PUBLISHABLE_KEY = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '')

# Existing clinic uploads allow up to 50 MiB; leave room for multipart/restore JSON.
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get('GENBLUE_MAX_UPLOAD_BYTES', str(128*1024*1024)))
GENBLUE_UPSTREAM_TIMEOUT = int(os.environ.get('GENBLUE_UPSTREAM_TIMEOUT', '120'))
