"""HTTPS deployment behind Render's trusted reverse proxy."""
from .settings import *
import hashlib
from django.core.exceptions import ImproperlyConfigured

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if len(SECRET_KEY) < 32:
    raise ImproperlyConfigured('Set a random DJANGO_SECRET_KEY of at least 32 characters.')
SECRET_KEY = hashlib.sha512(SECRET_KEY.encode()).hexdigest()
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',') if h.strip()]
if os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.environ['RENDER_EXTERNAL_HOSTNAME'])
if not ALLOWED_HOSTS or '*' in ALLOWED_HOSTS:
    raise ImproperlyConfigured('Configure explicit allowed host names.')
if not SUPABASE_URL.startswith('https://') or not SUPABASE_PUBLISHABLE_KEY:
    raise ImproperlyConfigured('Configure Supabase HTTPS URL and publishable key.')
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 3600
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
WSGI_APPLICATION = 'config.wsgi.application'
