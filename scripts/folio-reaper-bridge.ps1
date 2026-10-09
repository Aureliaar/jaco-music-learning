Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$rackPath = Join-Path $projectRoot 'rack\Folio Sound Rack.rpp'
$channelMapPath = Join-Path $projectRoot 'rack\folio-channel-one.jsfx'
$bridgeTool = Join-Path $projectRoot 'rack\bridge\folio-midi-bridge.exe'
$reaper = 'C:\Program Files\REAPER (x64)\reaper.exe'
$sendPort = 'Folio to REAPER'
$receivePort = 'REAPER from Folio'
$bridge = $null
$bridgeOwned = $false
$adoptedEndpoints = $false
$readyEvent = $null
$stopEvent = $null
$launcherStop = $null

if (-not (Test-Path -LiteralPath $bridgeTool)) {
  throw "The Folio MIDI bridge is missing: $bridgeTool"
}
if (-not (Test-Path -LiteralPath $reaper)) {
  throw "REAPER is missing: $reaper"
}
if (-not (Test-Path -LiteralPath $rackPath)) {
  throw "The Folio sound rack is missing: $rackPath"
}
if (-not (Test-Path -LiteralPath $channelMapPath)) {
  throw "The Folio MIDI channel mapper is missing: $channelMapPath"
}

# If a previous launcher was interrupted after starting the bridge, ask that
# bridge to clean up before taking ownership of the two reserved endpoint names.
try {
  $oldStop = [Threading.EventWaitHandle]::OpenExisting('Local\FolioReaperStop')
  $oldStop.Set() | Out-Null
  $oldStop.Dispose()
  Start-Sleep -Milliseconds 500
} catch [Threading.WaitHandleCannotBeOpenedException] {}

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class FolioMidiPorts {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)]
  struct Caps { public ushort mid, pid; public uint version;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string name;
    public uint support; }
  [DllImport("winmm.dll")] static extern uint midiInGetNumDevs();
  [DllImport("winmm.dll", CharSet=CharSet.Auto)] static extern uint midiInGetDevCaps(UIntPtr id, out Caps caps, uint size);
  [DllImport("winmm.dll")] static extern uint midiOutGetNumDevs();
  [DllImport("winmm.dll", CharSet=CharSet.Auto)] static extern uint midiOutGetDevCaps(UIntPtr id, out Caps caps, uint size);
  public static int InputIndex(string wanted) { for (uint i=0;i<midiInGetNumDevs();i++) {
    Caps c; if (midiInGetDevCaps((UIntPtr)i,out c,(uint)Marshal.SizeOf<Caps>())==0 &&
      String.Equals(c.name,wanted,StringComparison.OrdinalIgnoreCase)) return (int)i; } return -1; }
  public static bool HasInput(string wanted) { for (uint i=0;i<midiInGetNumDevs();i++) {
    Caps c; if (midiInGetDevCaps((UIntPtr)i,out c,(uint)Marshal.SizeOf<Caps>())==0 &&
      String.Equals(c.name,wanted,StringComparison.OrdinalIgnoreCase)) return true; } return false; }
  public static bool HasOutput(string wanted) { for (uint i=0;i<midiOutGetNumDevs();i++) {
    Caps c; if (midiOutGetDevCaps((UIntPtr)i,out c,(uint)Marshal.SizeOf<Caps>())==0 &&
      String.Equals(c.name,wanted,StringComparison.OrdinalIgnoreCase)) return true; } return false; }
}
'@

function Set-IniValue([string] $text, [string] $key, [string] $value) {
  $line = "$key=$value"
  $pattern = [regex]::new(('(?m)^{0}=.*$' -f [regex]::Escape($key)))
  if ($pattern.IsMatch($text)) { return $pattern.Replace($text, $line, 1) }
  if ($text.Length -and -not $text.EndsWith("`n")) { $text += "`r`n" }
  return $text + $line + "`r`n"
}

function Start-BridgeProcess {
  $start = [Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $bridgeTool
  $start.WorkingDirectory = Split-Path -Parent $bridgeTool
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $start
  if (-not $process.Start()) { throw 'The Folio MIDI bridge process could not start.' }
  return $process
}

function Prepare-Reaper([int] $inputIndex) {
  $iniPath = Join-Path $env:APPDATA 'REAPER\reaper.ini'
  if (-not (Test-Path -LiteralPath $iniPath)) {
    throw "REAPER has not created its preferences yet: $iniPath"
  }

  $ini = [IO.File]::ReadAllText($iniPath)
  $audio = [ordered]@{
    mode = '5'
    wasapi_driver_out = '"Speakers (USB Audio CODEC )"'
    wasapi_mode = '0'
    wasapi_srate = '48000'
    wasapi_bps = '16'
    wasapi_devin = '-1'
    wasapi_devout = '-1'
    wasapi_devin2 = '-1'
    wasapi_devout2 = '0'
    wasapi_bs = '256'
    wasapi_nch_in = '2'
    wasapi_nch_out = '2'
  }
  foreach ($entry in $audio.GetEnumerator()) {
    $ini = Set-IniValue $ini $entry.Key $entry.Value
  }

  # REAPER stores enabled MIDI devices in four 32-bit masks. Keep every
  # existing device enabled and add only the transient Folio receive side.
  $suffixes = @('', '_h', '_x', '_x_h')
  $word = [Math]::Floor($inputIndex / 32)
  if ($word -lt 0 -or $word -ge $suffixes.Count) {
    throw "REAPER cannot address the Folio MIDI input at index $inputIndex."
  }
  $bit = $inputIndex % 32
  foreach ($stem in @('midiins', 'midiins_all')) {
    $key = $stem + $suffixes[$word]
    $match = [regex]::Match($ini, ('(?m)^{0}=(-?\d+)$' -f [regex]::Escape($key)))
    $current = if ($match.Success) { [uint32]([int64]$match.Groups[1].Value -band 0xffffffffL) } else { [uint32]0 }
    $enabled = [uint32]($current -bor ([uint32]1 -shl $bit))
    $ini = Set-IniValue $ini $key ([string]$enabled)
  }

  [IO.File]::WriteAllText($iniPath, $ini, [Text.UTF8Encoding]::new($false))

  # Folio uses channels to select its three renderer seats. REAPER filters
  # each track to one of those channels, but SINE's saved instruments listen
  # on channel 1. Install the checked-in stateless mapper used immediately
  # before each SINE instance; this is rack plumbing, not composition state.
  $effectDir = Join-Path $env:APPDATA 'REAPER\Effects\Folio'
  [IO.Directory]::CreateDirectory($effectDir) | Out-Null
  [IO.File]::Copy($channelMapPath, (Join-Path $effectDir 'channel-one'), $true)
}

function Restart-HubBrowser {
  # The Hub owns a dedicated persistent browser profile for Folio. Recreate
  # only that process after the MIDI port is verified, preserving the Web MIDI
  # grant while giving the rack a known-clean page connection.
  try {
    $body = @{ name = 'daw'; target = 'local' } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri 'http://127.0.0.1:7777/api/browser/restart' `
      -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 8 | Out-Null
    Write-Host 'Folio opened in its Experiments Hub browser.'
  } catch {
    Write-Warning 'Experiments Hub browser unavailable; open Folio manually after the rack is ready.'
  }
}

try {
  $launcherStop = [Threading.EventWaitHandle]::new(
    $false, [Threading.EventResetMode]::ManualReset, 'Local\FolioReaperLauncherStop')
  $launcherStop.Reset() | Out-Null

  $ready = $false
  for ($attempt = 1; $attempt -le 3 -and -not $ready; $attempt++) {
    $bridge = Start-BridgeProcess
    $deadline = [DateTime]::UtcNow.AddSeconds(12)
    do {
      Start-Sleep -Milliseconds 250
      if ($bridge.HasExited) { break }
      if (-not $readyEvent) {
        try { $readyEvent = [Threading.EventWaitHandle]::OpenExisting('Local\FolioReaperReady') }
        catch [Threading.WaitHandleCannotBeOpenedException] {}
      }
      $ready = $readyEvent -and $readyEvent.WaitOne(0) -and
        [FolioMidiPorts]::HasOutput($sendPort) -and [FolioMidiPorts]::HasInput($receivePort)
    } until ($ready -or [DateTime]::UtcNow -ge $deadline)

    if (-not $ready) {
      $bridgeOut = ''
      $bridgeError = ''
      if ($bridge.HasExited) {
        $bridgeOut = $bridge.StandardOutput.ReadToEnd().Trim()
        $bridgeError = $bridge.StandardError.ReadToEnd().Trim()
      }

      # A bridge can be interrupted after Windows has published both ports but
      # before its loopback entry remains visible to MidiLoopbackManager. The
      # ports are still a usable Folio pair (and may survive until MidiSrv is
      # restarted), but trying to recreate their fixed identifiers only fails.
      # Adopt that pair for this rack run; the health endpoint still gates use
      # of it, so Folio returns to own tones when REAPER closes.
      if ([FolioMidiPorts]::HasOutput($sendPort) -and
          [FolioMidiPorts]::HasInput($receivePort)) {
        $adoptedEndpoints = $true
        $ready = $true
        Write-Host 'The Folio MIDI ports already exist; adopting the working endpoint pair.'
        break
      }

      if ($bridgeOut) { Write-Host $bridgeOut }
      if ($bridgeError) { Write-Warning $bridgeError }

      if ($bridge -and -not $bridge.HasExited) {
        Stop-Process -Id $bridge.Id -Force -ErrorAction SilentlyContinue
        $bridge.WaitForExit()
      }
      if ($readyEvent) { $readyEvent.Dispose(); $readyEvent = $null }
      if ($attempt -lt 3) {
        Write-Warning "The MIDI endpoint was not ready (attempt $attempt of 3); waiting for Windows MIDI Services to release it."
        Start-Sleep -Seconds 2
      }
    }
  }
  if (-not $ready) {
    throw 'Windows MIDI Services could not create the Folio endpoint after three attempts.'
  }

  $inputIndex = [FolioMidiPorts]::InputIndex($receivePort)
  if ($inputIndex -lt 0) { throw 'REAPER could not locate the Folio MIDI input.' }
  if ($adoptedEndpoints) {
    Write-Host "Folio MIDI endpoint pair ready (adopted, REAPER input $inputIndex)."
  } else {
    $bridgeOwned = $true
    Write-Host "Folio MIDI bridge ready (PID $($bridge.Id), REAPER input $inputIndex)."
  }
  Prepare-Reaper $inputIndex
  Restart-HubBrowser

  Write-Host 'Leave this window open. Closing the REAPER rack restores Folio own tones.'
  $rack = Start-Process -FilePath $reaper -ArgumentList @('-newinst', ('"{0}"' -f $rackPath)) -PassThru
  Write-Host "REAPER rack started (PID $($rack.Id))."
  Start-Sleep -Seconds 1
  if ($rack.HasExited) { throw 'REAPER exited before the Folio sound rack became ready.' }
  Write-Host 'Folio sound is ready: Ratio lead / Crux bass / Roads Rhodes chords.'
  while (-not $rack.WaitForExit(250)) {
    if ($launcherStop.WaitOne(0)) {
      Write-Host 'Experiments Hub requested a graceful rack stop.'
      if (-not $rack.CloseMainWindow() -or -not $rack.WaitForExit(5000)) {
        Stop-Process -Id $rack.Id -Force -ErrorAction SilentlyContinue
      }
      break
    }
    if ($bridgeOwned -and $bridge.HasExited) {
      throw "The Folio MIDI bridge exited while REAPER was still open (code $($bridge.ExitCode))."
    }
    if ($adoptedEndpoints -and
        (-not [FolioMidiPorts]::HasOutput($sendPort) -or
         -not [FolioMidiPorts]::HasInput($receivePort))) {
      throw 'The adopted Folio MIDI endpoint pair disappeared while REAPER was still open.'
    }
  }
  Write-Host 'REAPER rack closed; Folio is returning to own tones.'
}
finally {
  if ($bridge -and -not $bridge.HasExited) {
    try {
      $stopEvent = [Threading.EventWaitHandle]::OpenExisting('Local\FolioReaperStop')
      $stopEvent.Set() | Out-Null
      if (-not $bridge.WaitForExit(5000)) { Stop-Process -Id $bridge.Id -Force -ErrorAction SilentlyContinue }
    } catch [Threading.WaitHandleCannotBeOpenedException] {
      Stop-Process -Id $bridge.Id -Force -ErrorAction SilentlyContinue
    }
  }
  if ($readyEvent) { $readyEvent.Dispose() }
  if ($stopEvent) { $stopEvent.Dispose() }
  if ($launcherStop) { $launcherStop.Dispose() }
}
