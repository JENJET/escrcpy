@echo off
chcp 65001 >nul

REM ========================================
REM Self-elevate to Administrator
REM ========================================
>nul 2>&1 net session
if errorlevel 1 (
    echo Escrcpy Release Builder needs administrator privileges.
    echo Requesting elevation...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit
)
pushd "%~dp0"

title Escrcpy Release Builder
cd /d "%~dp0.."

echo ========================================
echo  Escrcpy Release Builder
echo ========================================
echo.

REM ---- Mirrors ----
set NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

echo All mirrors configured.
echo.

REM Clean
echo [Clean] Remove previous build...
rmdir /s /q desktop\dist-release 2>nul
echo OK
echo.

REM [1/5] Compile C# tracker
echo [1/5] Compile C# tracker...
cd desktop\electron\modules\sidebar
if not exist tracker.cs goto err_no_cs

setlocal enabledelayedexpansion
set CSC=
for %%d in (v4.0.30319 v3.5) do (
  if exist "%windir%\Microsoft.NET\Framework64\%%d\csc.exe" set "CSC=%windir%\Microsoft.NET\Framework64\%%d\csc.exe"
  if exist "%windir%\Microsoft.NET\Framework\%%d\csc.exe" set "CSC=%windir%\Microsoft.NET\Framework\%%d\csc.exe"
)
if not defined CSC for /f "delims=" %%i in ('where csc 2^>nul') do set "CSC=%%i"
if not defined CSC goto err_compile

"%CSC%" /nologo /target:exe /reference:System.Windows.Forms.dll /out:t.exe tracker.cs
if errorlevel 1 goto err_compile
if not exist t.exe goto err_compile
endlocal
echo OK

REM Copy t.exe to extra resources (for electron-builder to pick up)
copy t.exe ..\..\resources\extra\win\t.exe /Y >nul
echo OK
echo.

REM [2/5] Install dependencies
echo [2/5] Install dependencies...
cd ..\..\..\..
call pnpm install --registry=https://registry.npmmirror.com
if errorlevel 1 goto err_install
echo OK
echo.

REM [3/5] Vite build only
echo [3/5] Build renderer + main process...
cd desktop
call pnpm exec vite build
if errorlevel 1 goto err_build
echo OK
echo.

REM [4/5] Copy C# tracker to dist-electron
echo [4/5] Copy C# tracker to output...
copy electron\modules\sidebar\t.exe dist-electron\t.exe /Y >nul
echo OK
echo.

REM [5/5] Package release
echo [5/5] Package release...
call pnpm exec electron-builder --config=./electron-builder.config.js --publish=never --win --x64
if errorlevel 1 goto err_package
echo OK

echo.
echo ========================================
echo  Done! Output: desktop\dist-release
echo ========================================
pause
goto :EOF

:err_no_cs
echo ERROR: tracker.cs not found!
pause
exit /b 1

:err_compile
echo ERROR: C# compilation failed!
pause
exit /b 1

:err_install
echo ERROR: pnpm install failed!
pause
exit /b 1

:err_build
echo ERROR: Build failed!
pause
exit /b 1

:err_package
echo ERROR: Packaging failed!
pause
exit /b 1
