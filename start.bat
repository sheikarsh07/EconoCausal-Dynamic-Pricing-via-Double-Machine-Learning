@echo off
title EconoCausal - One-Click Launcher
setlocal EnableDelayedExpansion

echo ======================================================================
echo                     EconoCausal Dashboard Launcher
echo ======================================================================
echo.

:: Switch to script directory
cd /d "%~dp0"

:: 1. Check Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python was not found in your PATH.
    echo Please install Python 3.11 and add it to PATH.
    pause
    exit /b 1
)

:: 2. Check Node / npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm was not found in your PATH.
    echo Please install Node.js and add it to PATH.
    pause
    exit /b 1
)

:: 3. Generate sample data if not present
if not exist "data\synthetic_retail.csv" (
    echo [INFO] Generating sample dataset in data\synthetic_retail.csv...
    python scripts\generate_data.py
)

echo [1/3] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "EconoCausal Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && echo Starting FastAPI server... && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [2/3] Waiting for backend initialization...
timeout /t 3 /nobreak >nul

echo [3/3] Opening dashboard in browser at http://localhost:5173 ...
start "" http://localhost:5173

echo.
echo ======================================================================
echo   Backend is running in the background window (Port 8000)
echo   Frontend Vite server is starting below (Port 5173)
echo   Close this window or press Ctrl+C to stop the frontend.
echo ======================================================================
echo.

cd /d "%~dp0frontend"
npm run dev
