@echo off
rem ===================================================================
rem  neu - local dev server
rem
rem  ES modules and importmaps do NOT work over file:// - the browser
rem  blocks them as cross-origin. Both the site and the glass proof
rem  need a real HTTP server, which is all this does.
rem
rem  serve.py is preferred because it disables caching. Without that,
rem  Firefox will happily keep serving a stylesheet it fetched ten
rem  edits ago, and the page looks stale in one browser but not another.
rem
rem  Change PORT below if something else is already using it.
rem ===================================================================

setlocal
set "PORT=8123"

rem --- second instance: wait for the server, then open the browser ---
if "%~1"=="--open" (
  timeout /t 2 /nobreak >nul
  start "" "http://localhost:%PORT%/site/"
  exit /b
)

title neu - local server  [port %PORT%]
cd /d "%~dp0"

echo.
echo   neu - local server
echo   ==================
echo.
echo     site         http://localhost:%PORT%/site/
echo     glass proof  http://localhost:%PORT%/glass-proof.html
echo.
echo   Close this window to stop the server.
echo.

start "neu-open" /min "%~f0" --open

where py >nul 2>&1
if not errorlevel 1 (
  if exist "serve.py" (
    py -3 serve.py %PORT%
    goto done
  )
  py -3 -m http.server %PORT%
  goto done
)

where python >nul 2>&1
if not errorlevel 1 (
  if exist "serve.py" (
    python serve.py %PORT%
    goto done
  )
  python -m http.server %PORT%
  goto done
)

where npx >nul 2>&1
if not errorlevel 1 (
  npx --yes http-server -p %PORT% -c-1
  goto done
)

echo   No Python or Node found on PATH.
echo   Install Python from https://www.python.org/downloads/ then run this again.
echo.
pause

:done
endlocal
