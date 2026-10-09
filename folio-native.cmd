@echo off
rem Folio Native: the folio page and the SINE rack in one window.
rem Needs the folio server (folio.cmd) up; it never starts one itself.
set EXE=%~dp0folio-native\build\FolioNative_artefacts\Release\Folio.exe
if not exist "%EXE%" (
  echo Folio Native is not built yet. Run folio-native\build.cmd first.
  pause
  exit /b 1
)
start "" "%EXE%" %*
