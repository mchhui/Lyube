# Lyube 一键启动（生产模式：单端口 8000）
$Root = $PSScriptRoot

Write-Host ">>> 检查前端构建..." -ForegroundColor Cyan
if (-not (Test-Path "$Root\frontend\dist\index.html")) {
    Write-Host ">>> 正在构建前端..." -ForegroundColor Cyan
    Push-Location "$Root\frontend"
    if (-not (Test-Path "node_modules")) { npm install }
    npm run build
    Pop-Location
}

Write-Host ">>> 启动后端 http://127.0.0.1:8000" -ForegroundColor Green
Push-Location "$Root\backend"
if (-not (Test-Path ".venv")) {
    python -m venv .venv
    .\.venv\Scripts\pip install -r requirements.txt
}
.\.venv\Scripts\python run.py
