# Lyube 开发模式：同时启动后端 + 前端热更新
$Root = $PSScriptRoot

# 后端
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:Root\backend
    if (-not (Test-Path ".venv")) {
        python -m venv .venv
        & .\.venv\Scripts\pip install -r requirements.txt
    }
    & .\.venv\Scripts\python run.py
}

Start-Sleep -Seconds 2

# 前端
Push-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) { npm install }
Write-Host ">>> 后端: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host ">>> 前端: http://127.0.0.1:5173 （开发请用这个地址）" -ForegroundColor Green
npm run dev
