$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!$env:SUPABASE_URL) { $env:SUPABASE_URL = 'https://rfprsbftkwtwjqrjcalq.supabase.co' }
if (!$env:SUPABASE_PUBLISHABLE_KEY) { $env:SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mbbz-W9Mwg-yzcokP8Yk3g_2Gqf1wum' }
if (!(Test-Path '.venv\Scripts\python.exe')) {
    py -3 -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Python environment failed' }
}
& .\.venv\Scripts\python.exe -c "import importlib.util,sys; s=importlib.util.find_spec('django'); sys.exit(0 if s and __import__('django').VERSION[:2]==(5,2) else 1)"
if ($LASTEXITCODE -ne 0) {
    & .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
}
& .\.venv\Scripts\python.exe manage.py check
if ($LASTEXITCODE -ne 0) { throw 'Django configuration check failed' }
& .\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
