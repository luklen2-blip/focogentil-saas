@echo off
title FocoGentil V2 - Servidor & Tunel Mobile
color 0A
cd /d "C:\Users\luciano\.gemini\antigravity\scratch\neuro-copilot"
echo ========================================================
echo    FOCOGENTIL V2 COMERCIAL - INICIANDO SISTEMA
echo ========================================================
echo.
echo 1. Iniciando servidor Node.js (Porta 3000)...
start "FocoGentil Servidor" cmd /k "node server.js"

timeout /t 2 /nobreak >nul

echo 2. Iniciando Tunel Cloudflare para Celular...
start "FocoGentil Tunel Cloudflare" cmd /k "node tunnel_manager.js"

echo.
echo ========================================================
echo   SISTEMA ATIVO!
echo   Local: http://localhost:3000/
echo   Para Celular: consulte o link na janela do tunel.
echo ========================================================
echo.
pause
