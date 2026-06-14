# Lyube dev: backend + frontend HMR
$Root = $PSScriptRoot

$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:Root\backend
    if (-not (Test-Path ".venv")) {
        python -m venv .venv
        & .\.venv\Scripts\pip install -r requirements.txt
    }
    & .\.venv\Scripts\python run.py
}

Start-Sleep -Seconds 2

Push-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) { npm install }
Write-Host ">>> Backend: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host ">>> Frontend: http://127.0.0.1:5173 (use this URL in dev)" -ForegroundColor Green
npm run dev
