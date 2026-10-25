# EconoCausal — One-Click PowerShell Launcher
# Usage: powershell -ExecutionPolicy Bypass -File .\run.ps1

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "                     EconoCausal Dashboard Launcher                   " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

# Verify Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python was not found on PATH. Please install Python 3.11." -ForegroundColor Red
    pause
    exit 1
}

# Verify npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm was not found on PATH. Please install Node.js." -ForegroundColor Red
    pause
    exit 1
}

# Ensure synthetic dataset exists
if (-not (Test-Path "$Root\data\synthetic_retail.csv")) {
    Write-Host "[INFO] Generating synthetic dataset in data\synthetic_retail.csv..." -ForegroundColor Yellow
    python "$Root\scripts\generate_data.py"
}

Write-Host "[1/3] Launching FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
$BackendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\backend'; python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000" -PassThru

Write-Host "[2/3] Waiting for backend initialization..." -ForegroundColor Green
Start-Sleep -Seconds 3

Write-Host "[3/3] Opening dashboard at http://localhost:5173 ..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Backend running in separate window (PID: $($BackendProcess.Id))." -ForegroundColor Gray
Write-Host "  Starting Vite frontend in this terminal. Press Ctrl+C to terminate." -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "$Root\frontend"
npm run dev
