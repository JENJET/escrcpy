@echo off
chcp 65001 >nul
pushd "%~dp0.."

echo ========================================
echo  Escrcpy C# Tracker Builder (Dev Mode)
echo ========================================
echo.

REM Find csc.exe
set CSC=
for %%d in (v4.0.30319 v3.5) do (
  if exist "%windir%\Microsoft.NET\Framework64\%%d\csc.exe" set "CSC=%windir%\Microsoft.NET\Framework64\%%d\csc.exe"
  if exist "%windir%\Microsoft.NET\Framework\%%d\csc.exe" set "CSC=%windir%\Microsoft.NET\Framework\%%d\csc.exe"
)
if not defined CSC for /f "delims=" %%i in ('where csc 2^>nul') do set "CSC=%%i"
if not defined CSC (
  echo ERROR: csc.exe not found. Install .NET Framework SDK.
  pause
  exit /b 1
)

set SRC=desktop\electron\modules\sidebar
set DIST=desktop\dist-electron

echo [Compile] tracker.cs ^-^> t.exe
"%CSC%" /nologo /target:exe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /out:%SRC%\t.exe %SRC%\tracker.cs
if errorlevel 1 (
  echo ERROR: Compilation failed!
  pause
  exit /b 1
)
echo OK

echo [Copy] t.exe ^-^> dist-electron
copy %SRC%\t.exe %DIST%\t.exe /Y >nul
echo OK
echo.

echo ========================================
echo  Done! t.exe ready
echo ========================================
popd
