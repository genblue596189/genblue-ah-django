import os

bind = '0.0.0.0:' + os.environ.get('PORT', '10000')
# Registration locks are process-local: keep a single process and instance.
workers = 1
worker_class = 'gthread'
threads = 8
timeout = 180
graceful_timeout = 180
accesslog = None  # Signed URLs and patient query strings must not enter access logs.
errorlog = '-'
capture_output = True
