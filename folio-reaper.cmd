@echo off
node "%~dp0scripts\folio-reaper-service.mjs" %*
if errorlevel 1 pause
