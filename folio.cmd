@echo off
rem Folio: the one button. Opens Folio Native, which starts the folio's
rem server itself (pm2's folio-dev) if it isn't already running.
rem The server alone, without the window: node server.mjs
set EXE=%~dp0folio-native\build\FolioNative_artefacts\Release\Folio.exe
if not exist "%EXE%" call "%~dp0folio-native\build.cmd" || (pause & exit /b 1)
start "" "%EXE%" %*
