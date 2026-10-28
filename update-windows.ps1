[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Target,
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$engine = Join-Path $PSScriptRoot 'tools/apply_update.py'
$pythonArgs = @($engine, '--target', $Target)
if ($Apply) { $pythonArgs += '--apply' }
if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 @pythonArgs
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python @pythonArgs
} else {
    throw 'Python 3.10+ is required. No files were copied.'
}
if ($LASTEXITCODE -ne 0) { throw 'Update stopped. See the error above.' }
