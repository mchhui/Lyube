# Lyube production: single port 8000
$Root = $PSScriptRoot

Write-Host ">>> Checking frontend build..." -ForegroundColor Cyan
if (-not (Test-Path "$Root\frontend\dist\index.html")) {
    Write-Host ">>> Building frontend..." -ForegroundColor Cyan
    Push-Location "$Root\frontend"
    if (-not (Test-Path "node_modules")) { npm install }
    npm run build
    Pop-Location
}

Write-Host ">>> Starting backend http://127.0.0.1:8000" -ForegroundColor Green
Push-Location "$Root\backend"
if (-not (Test-Path ".venv")) {
    python -m venv .venv
    .\.venv\Scripts\pip install -r requirements.txt
}
.\.venv\Scripts\python run.py
