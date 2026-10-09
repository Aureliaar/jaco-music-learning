Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Folio's REAPER launcher, over one persistent installed virtual MIDI cable.
#
# The cable is system infrastructure, not a component this script owns. It is
# never created, adopted, repaired, or removed here, and the Windows MIDI
# service is never restarted. A missing cable is a precise startup failure with
# recovery guidance, not a reason to manufacture a temporary substitute.
#
# `scripts/folio-reaper-bridge.ps1` remains the previous transient-endpoint
# launcher, kept as an explicit rollback path during this migration.

$projectRoot = Split-Path -Parent $PSScriptRoot
$rackPath = Join-Path $projectRoot 'rack\Folio Sound Rack.rpp'
$channelMapPath = Join-Path $projectRoot 'rack\folio-channel-one.jsfx'
$reaper = 'C:\Program Files\REAPER (x64)\reaper.exe'

# One cable, one name. Folio opens it as a Web MIDI output; REAPER listens to
# the identically named input. loopMIDI publishes both sides of a port under
# the single name it was configured with.
$cablePort = 'Folio to REAPER'

# The launch promise itself. Folio reads this intent once at boot. The local
# server also writes the same promise into every page it serves on this
# machine, so the parameter is no longer the only thing keeping own tone out.
$folioUrl = 'http://localhost:4173/?renderer=reaper'

$launcherStop = $null
$reported = $false

# The status service reads these lines; the surrounding prose is for the human
# reading the launcher window. Only the first terminal state is reported, so a
# failure during shutdown cannot overwrite the reason the rack actually died.
function Report([string] $state, [string] $detail) {
  if ($reported) { return }
  if ($state -ne 'ready' -and $state -ne 'starting') { $script:reported = $true }
  Write-Host ("FOLIO-STATE {0}|{1}" -f $state, $detail)
}

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
  public static bool HasInput(string wanted) { return InputIndex(wanted) >= 0; }
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
  # existing device enabled and add only the persistent Folio cable.
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

function Open-FolioBrowser {
  # Folio's browser belongs to Experiments Hub. The Hub restarts it on its own
  # profile (same Web MIDI grant), back on the page it was showing, and knows
  # it is running. A restart rather than an open: a browser that was already
  # open may have listed its MIDI ports before this cable existed, and would
  # never hear the rack. The rack promise needs nothing in the address any
  # more; the local server writes it into every page it serves.
  #
  # The installed-path acceptance runs exercise the rack itself and must not
  # close a browser the player is using, so they set FOLIO_RACK_NO_BROWSER.
  if ($env:FOLIO_RACK_NO_BROWSER) {
    Write-Host 'Skipping the Folio browser (FOLIO_RACK_NO_BROWSER is set).'
    return
  }

  try {
    $body = @{ name = 'daw'; target = 'local' } | ConvertTo-Json -Compress
    $opened = Invoke-RestMethod -Uri 'http://127.0.0.1:7777/api/browser/restart' `
      -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 45
    Write-Host "Folio opened in its own browser: $($opened.url)"
    return
  } catch {
    Write-Warning "Experiments Hub did not open Folio's browser ($($_.Exception.Message)); opening it directly."
  }

  # Without the Hub: the same profile, started the way the Hub starts it, so
  # the Hub can take it over once it is back.

  # Hub names each managed profile by the first sixteen hex digits of the
  # SHA-256 of the project name, under .experiments-hub next to its registry.
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $id = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes('daw')) |
      ForEach-Object { $_.ToString('x2') })
  } finally { $sha.Dispose() }
  $profileDir = Join-Path (Split-Path -Parent $projectRoot) `
    ('.experiments-hub\browser-profiles\{0}' -f $id.Substring(0, 16))

  $chrome = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

  if (-not $chrome -or -not (Test-Path -LiteralPath $profileDir)) {
    Write-Warning "Could not open the Folio browser; open $folioUrl manually once the rack is ready."
    return
  }
  Start-Process -FilePath $chrome -ArgumentList @(
    ('--user-data-dir={0}' -f $profileDir),
    '--remote-debugging-port=0',
    '--new-window', '--no-first-run', '--no-default-browser-check',
    $folioUrl) | Out-Null
  Write-Host "Folio opened with its renderer promised: $folioUrl"
}

try {
  Report 'starting' 'verifying the persistent Folio MIDI cable'

  $launcherStop = [Threading.EventWaitHandle]::new(
    $false, [Threading.EventResetMode]::ManualReset, 'Local\FolioReaperLauncherStop')
  $launcherStop.Reset() | Out-Null

  if (-not ([FolioMidiPorts]::HasOutput($cablePort) -and [FolioMidiPorts]::HasInput($cablePort))) {
    Report 'port-missing' "no installed MIDI cable named '$cablePort'"
    throw ("The persistent MIDI cable '$cablePort' is not present. " +
      'Start the installed virtual MIDI cable (loopMIDI) and make sure it ' +
      "publishes one port named exactly '$cablePort', then run this again. " +
      'This launcher never creates or removes MIDI ports.')
  }
  $inputIndex = [FolioMidiPorts]::InputIndex($cablePort)
  Write-Host "Persistent Folio MIDI cable found (REAPER input $inputIndex)."

  if (-not (Test-Path -LiteralPath $reaper)) {
    Report 'reaper-missing' 'the expected REAPER executable is absent'
    throw "REAPER is missing: $reaper"
  }
  if (-not (Test-Path -LiteralPath $rackPath)) {
    Report 'rack-missing' 'the fixed Folio sound rack project is absent'
    throw "The Folio sound rack is missing: $rackPath"
  }
  if (-not (Test-Path -LiteralPath $channelMapPath)) {
    Report 'rack-missing' 'the Folio MIDI channel mapper is absent'
    throw "The Folio MIDI channel mapper is missing: $channelMapPath"
  }

  Report 'starting' 'opening the REAPER sound rack'
  Prepare-Reaper $inputIndex
  Open-FolioBrowser

  Write-Host 'Leave this window open. Closing the REAPER rack stops the Folio renderer.'
  $rack = Start-Process -FilePath $reaper -ArgumentList @('-newinst', ('"{0}"' -f $rackPath)) -PassThru
  Write-Host "REAPER rack started (PID $($rack.Id))."
  Start-Sleep -Seconds 1
  if ($rack.HasExited) {
    Report 'reaper-failed' 'REAPER exited during startup'
    throw 'REAPER exited before the Folio sound rack became ready.'
  }
  Report 'ready' 'Ratio lead / Crux bass / Roads Rhodes chords'
  Write-Host 'Folio sound is ready: Ratio lead / Crux bass / Roads Rhodes chords.'

  while (-not $rack.WaitForExit(250)) {
    if ($launcherStop.WaitOne(0)) {
      Write-Host 'Experiments Hub requested a graceful rack stop.'
      if (-not $rack.CloseMainWindow() -or -not $rack.WaitForExit(5000)) {
        Stop-Process -Id $rack.Id -Force -ErrorAction SilentlyContinue
      }
      Report 'not-requested' 'the rack was stopped on request'
      break
    }
    if (-not ([FolioMidiPorts]::HasOutput($cablePort) -and [FolioMidiPorts]::HasInput($cablePort))) {
      Report 'renderer-lost' "the '$cablePort' cable disappeared while the rack was open"
      throw "The persistent MIDI cable '$cablePort' disappeared while REAPER was still open."
    }
  }
  if (-not $reported) {
    Report 'renderer-lost' 'the REAPER rack closed'
    Write-Host 'REAPER rack closed; the Folio renderer is no longer available.'
  }
}
catch {
  # A failure before any state was named is still a renderer failure; the
  # status service must never be left describing a launch that has ended.
  if (-not $reported) { Report 'reaper-failed' 'the launcher failed during startup' }
  throw
}
finally {
  if ($launcherStop) { $launcherStop.Dispose() }
}
