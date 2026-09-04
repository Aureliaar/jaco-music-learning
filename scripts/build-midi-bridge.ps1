Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$cache = Join-Path $root 'tmp\folio-midi-bridge'
$packages = Join-Path $cache 'packages'
$midiVersion = '0.99.57-devpreview.5'
$cppVersion = '3.0.260520.1'

function Expand-Package([string]$uri, [string]$name, [string]$destination) {
  if (Test-Path -LiteralPath $destination) { return }
  New-Item -ItemType Directory -Path $cache -Force | Out-Null
  $archive = Join-Path $cache $name
  $zip = "$archive.zip"
  Invoke-WebRequest -Uri $uri -OutFile $archive
  Copy-Item -LiteralPath $archive -Destination $zip
  Expand-Archive -LiteralPath $zip -DestinationPath $destination -Force
}

$midiPackage = Join-Path $packages "Windows.Devices.Midi2.$midiVersion"
$cppPackage = Join-Path $packages "Microsoft.Windows.CppWinRT.$cppVersion"
Expand-Package `
  'https://github.com/microsoft/MIDI/releases/download/inbox-dev-preview-5/Windows.Devices.Midi2.0.99.57-devpreview.5.nupkg' `
  'Windows.Devices.Midi2.nupkg' $midiPackage
Expand-Package `
  'https://api.nuget.org/v3-flatcontainer/microsoft.windows.cppwinrt/3.0.260520.1/microsoft.windows.cppwinrt.3.0.260520.1.nupkg' `
  'Microsoft.Windows.CppWinRT.nupkg' $cppPackage

$vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
$visualStudio = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $visualStudio) { throw 'Visual Studio C++ build tools were not found.' }
$msbuild = Join-Path $visualStudio 'MSBuild\Current\Bin\MSBuild.exe'
$project = Join-Path $PSScriptRoot 'folio-midi-bridge\folio-midi-bridge.vcxproj'
& $msbuild $project /m /p:Configuration=Release /p:Platform=x64 /v:minimal
if ($LASTEXITCODE -ne 0) { throw "MIDI bridge build failed with exit code $LASTEXITCODE." }

$output = Join-Path $cache 'bin'
$destination = Join-Path $root 'rack\bridge'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $output 'folio-midi-bridge.exe') -Destination $destination -Force
Copy-Item -LiteralPath (Join-Path $output 'Windows.Devices.Midi2.dll') -Destination $destination -Force
Copy-Item -LiteralPath (Join-Path $output 'Windows.Devices.Midi2.pri') -Destination $destination -Force
Copy-Item -LiteralPath (Join-Path $output 'Windows.Devices.Midi2.winmd') -Destination $destination -Force
Write-Host "Built $destination"
