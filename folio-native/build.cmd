@echo off
rem Checks out the JUCE submodule and fetches the WebView2 SDK if missing, then builds Folio.exe.
setlocal
cd /d "%~dp0"
set CMAKE=%ProgramFiles%\Microsoft Visual Studio\2022\Professional\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe
if not exist "%CMAKE%" set CMAKE=cmake
if not exist JUCE\CMakeLists.txt git -C .. submodule update --init --depth 1 folio-native/JUCE || exit /b 1
set WV2=deps\Microsoft.Web.WebView2.1.0.2903.40
if not exist "%WV2%" (
  mkdir "%WV2%"
  curl -sL -o deps\wv2.zip https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2903.40 || exit /b 1
  tar -xf deps\wv2.zip -C "%WV2%" || exit /b 1
)
"%CMAKE%" -S . -B build -G "Visual Studio 17 2022" -A x64 || exit /b 1
"%CMAKE%" --build build --config Release -- -m -v:m || exit /b 1
echo Built: %~dp0build\FolioNative_artefacts\Release\Folio.exe
