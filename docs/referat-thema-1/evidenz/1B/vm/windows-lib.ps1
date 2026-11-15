# 1B-Labor, Windows-Weg: Hilfsfunktionen ohne WSL (zum Dot-Sourcen aus vm-windows.ps1).
# Reines ASCII wegen Windows PowerShell 5.1. Tests: windows-lib.Tests.ps1 (laufen auch unter Linux-pwsh).
#
# Quellen:
# - VHD-Format (Fusszeile, CHS-Geometrie, Pruefsumme): Microsoft "Virtual Hard Disk Image Format
#   Specification" (VHD), Abschnitte "Hard Disk Footer Format" und "CHS Calculation".
# - qcow2: Spezifikation docs/interop/qcow2.txt im QEMU-Quellbaum. Das Ubuntu-Image
#   ubuntu-24.04-server-cloudimg-amd64.img ist qcow2 v3 (zlib, ohne Basis-Image); das tar.gz daneben
#   enthaelt nur die Root-Partition ohne Bootloader und taugt nicht (geprueft 2026-11-13).
# - cloud-init NoCloud akzeptiert iso9660 oder vfat mit Label cidata/CIDATA:
#   https://docs.cloud-init.io/en/latest/reference/datasources/nocloud.html
# - ISO ohne Zusatzwerkzeuge: IMAPI2 (IMAPI2FS.MsftFileSystemImage), wie im Projekt
#   github.com/schtritoff/hyperv-vm-provisioning (New-ISOFile.ps1); Joliet noetig fuer user-data.


function Get-VhdGeometry {
  # CHS nach der VHD-Spezifikation (ganzzahlig, abgerundet).
  param([Parameter(Mandatory)][uint64]$Bytes)
  [uint64]$ts = [Math]::Floor($Bytes / 512)
  [uint64]$max = 65535 * 16 * 255
  if ($ts -gt $max) { $ts = $max }
  if ($ts -ge 65535 * 16 * 63) {
    $spt = 255; $heads = 16
    [uint64]$cth = [Math]::Floor($ts / $spt)
  }
  else {
    $spt = 17
    [uint64]$cth = [Math]::Floor($ts / $spt)
    $heads = [uint64][Math]::Floor(($cth + 1023) / 1024)
    if ($heads -lt 4) { $heads = 4 }
    if ($cth -ge ($heads * 1024) -or $heads -gt 16) {
      $spt = 31; $heads = 16
      $cth = [Math]::Floor($ts / $spt)
    }
    if ($cth -ge ($heads * 1024)) {
      $spt = 63; $heads = 16
      $cth = [Math]::Floor($ts / $spt)
    }
  }
  [pscustomobject]@{ Zylinder = [uint64][Math]::Floor($cth / $heads); Koepfe = [uint64]$heads; Sektoren = [uint64]$spt }
}

function Write-BeZahl([byte[]]$Buffer, [int]$Offset, [int]$Length, [uint64]$Value) {
  for ($i = $Length - 1; $i -ge 0; $i--) {
    $Buffer[$Offset + $i] = [byte]($Value -band 0xFF)
    $Value = $Value -shr 8
  }
}

function Get-VhdFooter {
  # 512-Byte-Fusszeile einer festen VHD (Disk Type 2) fuer eine Rohdatei der Groesse $Bytes.
  param(
    [Parameter(Mandatory)][uint64]$Bytes,
    [Parameter(Mandatory)][uint32]$Zeitstempel,
    [Parameter(Mandatory)][byte[]]$UniqueId
  )
  if ($Bytes % 512 -ne 0) { throw "Rohgroesse $Bytes ist kein Vielfaches von 512 Bytes." }
  if ($UniqueId.Length -ne 16) { throw 'UniqueId braucht 16 Bytes.' }
  $f = [byte[]]::new(512)
  [Text.Encoding]::ASCII.GetBytes('conectix').CopyTo($f, 0)
  Write-BeZahl $f 8 4 2                       # Features: reserviert, immer gesetzt
  Write-BeZahl $f 12 4 0x00010000             # Formatversion 1.0
  Write-BeZahl $f 16 8 ([uint64]::MaxValue)   # Data Offset: feste Platte
  Write-BeZahl $f 24 4 $Zeitstempel           # Sekunden seit 2000-01-01 UTC
  [Text.Encoding]::ASCII.GetBytes('win ').CopyTo($f, 28)
  Write-BeZahl $f 32 4 0x000A0000             # Creator Version
  [Text.Encoding]::ASCII.GetBytes('Wi2k').CopyTo($f, 36)
  Write-BeZahl $f 40 8 $Bytes                 # Original Size
  Write-BeZahl $f 48 8 $Bytes                 # Current Size
  $g = Get-VhdGeometry -Bytes $Bytes
  Write-BeZahl $f 56 2 $g.Zylinder
  $f[58] = [byte]$g.Koepfe
  $f[59] = [byte]$g.Sektoren
  Write-BeZahl $f 60 4 2                      # Disk Type: fest
  $UniqueId.CopyTo($f, 68)
  [uint64]$sum = 0
  foreach ($b in $f) { $sum += $b }     # Pruefsummenfeld ist hier noch 0
  Write-BeZahl $f 64 4 ((-bnot [uint32]($sum -band 0xFFFFFFFF)) -band 0xFFFFFFFF)
  return , $f
}

function Add-VhdFooter {
  # Macht aus einer Rohdatei in place eine feste VHD (Fusszeile anhaengen).
  param([Parameter(Mandatory)][string]$Path)
  $len = (Get-Item -LiteralPath $Path).Length
  if ($len -ge 512) {
    $s = [IO.File]::OpenRead($Path)
    try {
      [void]$s.Seek(-512, 'End')
      $tail = [byte[]]::new(8)
      [void]$s.Read($tail, 0, 8)
    }
    finally { $s.Dispose() }
    if ([Text.Encoding]::ASCII.GetString($tail) -eq 'conectix') { throw "$Path hat schon eine VHD-Fusszeile." }
  }
  $ts = [uint32][Math]::Floor(([DateTime]::UtcNow - [DateTime]::new(2000, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)).TotalSeconds)
  $footer = Get-VhdFooter -Bytes ([uint64]$len) -Zeitstempel $ts -UniqueId ([Guid]::NewGuid().ToByteArray())
  $s = [IO.File]::Open($Path, 'Append', 'Write')
  try { $s.Write($footer, 0, 512) } finally { $s.Dispose() }
}

function Get-RepoStand {
  # Repo-Wurzel und Commit von HEAD aus dem .git-Ordner lesen, ohne git.exe (lose Ref, packed-refs, detached).
  param([Parameter(Mandatory)][string]$Start)
  # ProviderPath statt Path: unter \\wsl.localhost\... liefert .Path sonst 'Microsoft.PowerShell.Core\FileSystem::...'.
  $d = (Resolve-Path -LiteralPath $Start).ProviderPath
  while ($d -and -not (Test-Path -LiteralPath (Join-Path $d '.git'))) {
    $p = Split-Path -Parent $d
    if ($p -eq $d) { $d = $null } else { $d = $p }
  }
  if (-not $d) { throw "Unter $Start liegt kein Git-Repo (Ordner .git nicht gefunden). Das Skript muss im Clone des Repos liegen." }
  $git = Join-Path $d '.git'
  if (-not (Test-Path -LiteralPath $git -PathType Container)) {
    throw "$git ist eine Datei (Git-Worktree). Bitte das Skript aus dem Haupt-Clone starten, nicht aus einem Worktree."
  }
  $head = ([IO.File]::ReadAllText((Join-Path $git 'HEAD'))).Trim()
  if ($head -match '^[0-9a-f]{40}$') { return [pscustomobject]@{ Wurzel = $d; Commit = $head } }
  if ($head -notmatch '^ref: (.+)$') { throw "Unerwarteter Inhalt in .git/HEAD: $head" }
  $ref = $Matches[1]
  $lose = Join-Path $git ($ref -replace '/', [IO.Path]::DirectorySeparatorChar)
  if (Test-Path -LiteralPath $lose) {
    return [pscustomobject]@{ Wurzel = $d; Commit = ([IO.File]::ReadAllText($lose)).Trim() }
  }
  $packed = Join-Path $git 'packed-refs'
  if (Test-Path -LiteralPath $packed) {
    foreach ($z in [IO.File]::ReadAllLines($packed)) {
      if ($z -match "^([0-9a-f]{40}) $([regex]::Escape($ref))$") { return [pscustomobject]@{ Wurzel = $d; Commit = $Matches[1] } }
    }
  }
  throw "Commit fuer $ref nicht gefunden (weder lose Referenz noch packed-refs)."
}

function ConvertTo-IpRange([string]$Prefix) {
  # "a.b.c.d/n" -> Start und Ende als Zahl fuer den Ueberlappungstest.
  $addr, $len = $Prefix.Split('/')
  $b = ([Net.IPAddress]::Parse($addr)).GetAddressBytes()
  [Array]::Reverse($b)
  $ip = [BitConverter]::ToUInt32($b, 0)
  $size = [Math]::Pow(2, 32 - [int]$len)
  $start = [Math]::Floor($ip / $size) * $size
  return @{ Start = [double]$start; End = [double]$start + $size - 1 }
}

function Test-Overlap([string]$A, [string]$B) {
  $x = ConvertTo-IpRange $A
  $y = ConvertTo-IpRange $B
  return ($x.Start -le $y.End -and $y.Start -le $x.End)
}

function Get-VorpruefungUrteil {
  # Bewertet gesammelte Fakten des Rechners. Ergebnis: je Pruefung Status OK, HINWEIS oder FEHLER,
  # bei FEHLER mit konkreter Abhilfe. Reine Funktion, damit sie ohne Windows testbar ist.
  param([Parameter(Mandatory)][hashtable]$Fakten)
  $netz = '192.168.150.0/24'
  $e = [Collections.Generic.List[object]]::new()
  function Add([string]$P, [string]$S, [string]$T, [string]$A = '') {
    $e.Add([pscustomobject]@{ Pruefung = $P; Status = $S; Text = $T; Abhilfe = $A })
  }
  $f = $Fakten

  if ($f.Admin) { Add 'Admin' 'OK' 'Administratorrechte' }
  else { Add 'Admin' 'FEHLER' 'Keine Administratorrechte' 'PowerShell mit Rechtsklick > "Als Administrator ausfuehren" starten.' }

  if ($f.Edition -eq 'Core' -or $f.HyperV -eq 'Missing') {
    Add 'Edition' 'FEHLER' "Windows-Edition '$($f.Edition)' ohne Hyper-V" 'Hyper-V gibt es nur in Windows 10/11 Pro, Education oder Enterprise (nicht Home).'
  }
  else {
    Add 'Edition' 'OK' "Windows-Edition $($f.Edition)"
    if ($f.HyperV -ne 'Enabled') {
      if ($f.VirtualisierungFirmware -eq $false) {
        Add 'Virtualisierung' 'FEHLER' 'Virtualisierung ist im BIOS/UEFI ausgeschaltet' 'Im BIOS/UEFI Intel VT-x bzw. AMD-V (SVM) einschalten, danach neu starten.'
      }
      Add 'Hyper-V' 'FEHLER' 'Hyper-V ist nicht aktiviert' 'Skript mit -EnableHyperV aufrufen (aktiviert Hyper-V), danach Windows neu starten und erneut aufrufen.'
    }
    elseif (-not $f.HypervisorLaeuft) {
      Add 'Virtualisierung' 'FEHLER' 'Hyper-V ist aktiviert, aber der Hypervisor laeuft nicht' ('Nach dem Aktivieren neu starten; sonst im BIOS/UEFI Intel VT-x bzw. AMD-V einschalten ' +
        'und pruefen: bcdedit /enum | findstr hypervisorlaunchtype (muss Auto sein).')
    }
    else {
      Add 'Hyper-V' 'OK' 'Hyper-V aktiv, Hypervisor laeuft'
      if ($f.HyperVModul) { Add 'Hyper-V-Modul' 'OK' 'PowerShell-Modul Hyper-V vorhanden' }
      else { Add 'Hyper-V-Modul' 'FEHLER' 'PowerShell-Modul Hyper-V fehlt' 'Admin-PowerShell: Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-Management-PowerShell, danach neu starten.' }
    }
  }

  if ($f.Ssh) { Add 'OpenSSH' 'OK' 'ssh.exe und scp.exe vorhanden' }
  else { Add 'OpenSSH' 'FEHLER' 'ssh.exe/scp.exe fehlen' 'Admin-PowerShell: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0' }

  if ($f.Tar) { Add 'tar' 'OK' 'tar.exe vorhanden' }
  else { Add 'tar' 'FEHLER' 'tar.exe fehlt' 'tar.exe ist ab Windows 10 1803 eingebaut; Windows aktualisieren.' }

  if ($f.Adresskonflikt) {
    Add 'Labornetz' 'FEHLER' "Adresse im Labornetz schon vergeben: $($f.Adresskonflikt)" "Das Labor braucht $netz exklusiv. VPN trennen oder das andere Netz umstellen."
  }
  else { Add 'Labornetz' 'OK' "$netz ist frei" }

  foreach ($n in @($f.AndereNat)) {
    if (Test-Overlap $n.Prefix $netz) {
      Add 'NAT' 'FEHLER' "NAT '$($n.Name)' ($($n.Prefix)) ueberschneidet $netz" "Wenn nicht mehr gebraucht: Remove-NetNat -Name '$($n.Name)'; sonst das andere NAT umstellen."
    }
    else {
      Add 'NAT' 'HINWEIS' "Es gibt schon ein NAT '$($n.Name)' ($($n.Prefix))" 'Windows unterstuetzt offiziell nur ein NAT-Netz; schlaegt das Anlegen fehl, das andere NAT entfernen.'
    }
  }

  if ($f.ContainsKey('Akku') -and $f.Akku) {
    Add 'Strom' 'HINWEIS' 'Der Rechner laeuft auf Akku' 'Netzteil anschliessen: Aufbau und Laeufe dauern lange, im Akkubetrieb drosselt Windows die CPU.'
  }

  if ($f.ContainsKey('Speicherort') -and $f.Speicherort) {
    $o = $f.Speicherort
    if (-not $o.Lokal) {
      Add 'Speicherort' 'FEHLER' "VM-Ordner $($o.Pfad) liegt nicht auf einem lokalen Laufwerk" 'Hyper-V braucht ein lokales Laufwerk: -VmDir auf z. B. D:\arsnova-1b setzen.'
    }
    elseif ($o.Dateisystem -notin @('NTFS', 'ReFS')) {
      Add 'Speicherort' 'FEHLER' "VM-Ordner $($o.Pfad) liegt auf $($o.Dateisystem)" 'Hyper-V-Disks brauchen NTFS oder ReFS (nicht exFAT/FAT32): anderes Laufwerk mit -VmDir waehlen.'
    }
    else { Add 'Speicherort' 'OK' "VM-Ordner $($o.Pfad) ($($o.Dateisystem))" }
  }

  if ($f.PlatteFreiGib -lt $f.PlatteNoetigGib) {
    Add 'Platte' 'FEHLER' "Nur $($f.PlatteFreiGib) GB frei" "Mindestens $($f.PlatteNoetigGib) GB frei machen (erwarteter Bedarf plus Reserve)."
  }
  else { Add 'Platte' 'OK' "$($f.PlatteFreiGib) GB frei (noetig $($f.PlatteNoetigGib) GB)" }

  if ($f.ContainsKey('DnsExtern') -and -not $f.DnsExtern) {
    Add 'DNS' 'FEHLER' 'Externe Namensaufloesung (1.1.1.1) gesperrt' ('Die VMs fragen 1.1.1.1 und 9.9.9.9 direkt (Port 53). Uni- oder Firmennetze sperren das oft: ' +
      'ein anderes Netz nutzen (z. B. Handy-Hotspot) oder VPN trennen.')
  }
  elseif ($f.ContainsKey('DnsExtern')) { Add 'DNS' 'OK' 'Externe Namensaufloesung (1.1.1.1) geht' }

  foreach ($h in @($f.Internet.Keys | Sort-Object)) {
    if ($f.Internet[$h]) { Add 'Internet' 'OK' "$h erreichbar" }
    else { Add 'Internet' 'FEHLER' "$h nicht erreichbar" "Internetverbindung pruefen; Proxy oder Firewall muss $h (HTTPS) erlauben." }
  }
  return $e.ToArray()
}

function Get-SpeicherortEmpfehlung {
  # Laufwerke: @{ Buchstabe; FreiGib; Dateisystem; Typ }. Hyper-V braucht ein lokales NTFS- oder ReFS-Laufwerk.
  # Empfehlung: das geeignete mit dem meisten freien Platz (C: unter ProgramData, sonst <L>:\arsnova-1b).
  param([Parameter(Mandatory)][object[]]$Laufwerke)
  $gut = @($Laufwerke | Where-Object { $_.Typ -eq 'Fixed' -and $_.Dateisystem -in @('NTFS', 'ReFS') } |
      Sort-Object { $_.FreiGib } -Descending)
  $schlecht = @($Laufwerke | Where-Object { -not ($_.Typ -eq 'Fixed' -and $_.Dateisystem -in @('NTFS', 'ReFS')) })
  $empf = $null
  if ($gut.Count -gt 0) {
    $b = $gut[0].Buchstabe
    $empf = if ($b -eq 'C') { 'C:\ProgramData\arsnova-1b' } else { "${b}:\arsnova-1b" }
  }
  [pscustomobject]@{ Empfehlung = $empf; Geeignet = $gut; Ungeeignet = $schlecht }
}

function Get-Restzeit {
  # Restzeit = Summe der geschaetzten Sekunden aller noch offenen Schritte.
  param([Parameter(Mandatory)][int[]]$Plan, [Parameter(Mandatory)][int]$Erledigt)
  $rest = 0
  for ($i = $Erledigt; $i -lt $Plan.Count; $i++) { $rest += $Plan[$i] }
  return [TimeSpan]::FromSeconds($rest)
}

function Get-RamVorschau {
  # Reicht der gerade verfuegbare RAM fuer den Start der VMs plus Reserve? Fuer groessen und vor up,
  # damit niemand 15 min vorbereitet und dann am RAM-Schutz scheitert (Windows-Test 2026-11-13).
  param([Parameter(Mandatory)][int]$VerfuegbarGib, [Parameter(Mandatory)][int]$PlanGib, [Parameter(Mandatory)][int]$ReserveGib)
  $rest = $VerfuegbarGib - $PlanGib
  $reicht = $rest -ge $ReserveGib
  $t = "RAM fuer den Start: jetzt verfuegbar $VerfuegbarGib GB, die VMs belegen $PlanGib GB, danach blieben $rest GB (noetig: $ReserveGib GB)"
  if ($reicht) { $t += ' - reicht.' }
  else { $t += ' - so startet das Labor nicht. Programme schliessen (auch WSL/Docker Desktop), kleinere Groessen waehlen oder einen Rechner mit mehr RAM nehmen (realistisch ab 24 GB).' }
  [pscustomobject]@{ Reicht = $reicht; RestGib = $rest; Text = $t }
}

function Format-RamFresser {
  # Prozesse: @{ Name; Bytes } (Arbeitsspeicher). Fasst gleichnamige zusammen, zeigt die fuenf groessten ab
  # 0,5 GB, mit Tipp fuer die typischen Verursacher (WSL 2 reserviert bis zur Haelfte des RAMs, Docker Desktop).
  param([Parameter(Mandatory)][AllowEmptyCollection()][object[]]$Prozesse)
  $summe = @{}
  foreach ($p in $Prozesse) { $summe[$p.Name] = [double]($summe[$p.Name]) + [double]$p.Bytes }
  $kultur = [Globalization.CultureInfo]::GetCultureInfo('de-DE')
  $summe.GetEnumerator() | Where-Object { $_.Value -ge 0.5GB } | Sort-Object Value -Descending | Select-Object -First 5 | ForEach-Object {
    $gb = ($_.Value / 1GB).ToString('0.#', $kultur)
    $name = [string]$_.Key   # in switch waere $_ der gepruefte Wert, nicht der Eintrag
    if ($name -match '^(?i)vmmem') { "WSL ($name) belegt $gb GB -> dauerhaft begrenzen: in %USERPROFILE%\.wslconfig unter [wsl2] memory=6GB eintragen, einmal wsl --shutdown (oder kurz: wsl --shutdown)" }
    elseif ($name -match '^(?i)(com\.docker|docker desktop)') { "Docker Desktop ($name) belegt $gb GB -> Docker Desktop beenden" }
    else { "$name belegt $gb GB" }
  }
}

function Get-LaborPlan {
  # Geschaetzte Sekunden je Schritt von labor.ps1 -Mode up (ThinkPad P50 als Massstab, eher grosszuegig):
  # 1 Vorpruefung, 2 Netz, 3 Image, 4-5 VMs anlegen, 6 Start, 7 Repo und cloud-init, 8 Stand,
  # 9 llm-host einrichten, 10 app-host einrichten, 11 Pruefen.
  return , @(45, 15, 300, 45, 45, 15, 720, 15, 900, 1500, 180)
}

function Get-WachFlag {
  # ES_CONTINUOUS (0x80000000) | ES_SYSTEM_REQUIRED (0x1). Als Dezimalzahl: das Literal 0x80000001 waere
  # in PowerShell ein negativer Int32 (Windows-Test 2026-11-13).
  param([bool]$An = $true)
  if ($An) { return [uint32]2147483649 }
  return [uint32]2147483648
}

function Set-WachHalten {
  # Verhindert Ruhezustand und Standby, solange dieser Prozess laeuft (SetThreadExecutionState,
  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED). Endet automatisch mit dem Prozess. Nur Windows.
  [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseShouldProcessForStateChangingFunctions', '',
    Justification = 'Gilt nur fuer diesen Prozess und endet mit ihm; -WhatIf ist hier nicht vorgesehen.')]
  param([bool]$An = $true)
  if (-not ('LaborWach' -as [type])) {
    Add-Type -Namespace '' -Name 'LaborWach' -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
  }
  [void][LaborWach]::SetThreadExecutionState((Get-WachFlag -An $An))
}

function Add-JsonFeld {
  # Haengt "Name": Wert an ein JSON-Objekt an, als Text: Die Messwerte bleiben Zeichen fuer Zeichen,
  # wie lauf.sh sie geschrieben hat (ConvertTo-Json in PowerShell 5.1 wuerde Zahlen und Zeichen umschreiben).
  param([Parameter(Mandatory)][string]$Json, [Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string]$Wert)
  $t = $Json.TrimEnd()
  if (-not ($t.StartsWith('{') -and $t.EndsWith('}'))) { throw 'Add-JsonFeld erwartet ein JSON-Objekt.' }
  $innen = $t.Substring(0, $t.Length - 1).TrimEnd()
  $komma = if ($innen -eq '{') { '' } else { ',' }
  return "$innen$komma`n  `"$Name`": $Wert`n}`n"
}

function Format-Dauer([TimeSpan]$Dauer) {
  if ($Dauer.TotalHours -ge 1) { return '{0}:{1:00}:{2:00}' -f [int][Math]::Floor($Dauer.TotalHours), $Dauer.Minutes, $Dauer.Seconds }
  return '{0}:{1:00}' -f [int][Math]::Floor($Dauer.TotalMinutes), $Dauer.Seconds
}

function Format-SchrittZeile {
  # Eine Fortschrittszeile, gleich wie labor.sh (fortschritt.sh):
  # [n/N] Text (dauert ...) - seit Beginn M:SS, noch etwa M:SS, fertig gegen HH:mm
  param([int]$Nr, [int]$Gesamt, [string]$Text, [string]$Dauer, [TimeSpan]$SeitBeginn, [TimeSpan]$Rest, [datetime]$Jetzt = (Get-Date))
  $d = if ($Dauer) { " (dauert $Dauer)" } else { '' }
  return "[$Nr/$Gesamt] $Text$d - seit Beginn $(Format-Dauer $SeitBeginn), noch etwa $(Format-Dauer $Rest), fertig gegen $($Jetzt.Add($Rest).ToString('HH:mm'))"
}

function ConvertFrom-Qcow2 {
  # qcow2 (v2/v3, zlib) -> Rohdisk, ohne qemu-img. Nach der Spezifikation docs/interop/qcow2.txt (QEMU):
  # Header, L1/L2-Tabellen, komprimierte Cluster als rohes Deflate. Lehnt ab, was hier nicht vorkommt
  # (Basis-Image, Verschluesselung, externe Daten, erweiterte L2-Tabellen, andere Kompression).
  # Getestet bitgenau gegen qemu-img convert (windows-lib.Tests.ps1, Ubuntu-Image 2026-11-13).
  param([Parameter(Mandatory)][string]$Pfad, [Parameter(Mandatory)][string]$Ziel)
  if (-not ('LaborQcow2' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.IO.Compression;
public static class LaborQcow2 {
  static ulong Be(byte[] b, int o, int n) { ulong v = 0; for (int i = 0; i < n; i++) v = (v << 8) | b[o + i]; return v; }
  static byte[] Lies(FileStream f, long pos, int n) {
    byte[] b = new byte[n]; f.Position = pos; int g = 0;
    while (g < n) { int r = f.Read(b, g, n - g); if (r <= 0) break; g += r; }
    if (g < n) Array.Resize(ref b, g);
    return b;
  }
  public static void ZuRaw(string pfad, string ziel) {
    using (FileStream f = new FileStream(pfad, FileMode.Open, FileAccess.Read, FileShare.Read)) {
      byte[] h = Lies(f, 0, 112);
      if (h.Length < 72 || h[0] != 0x51 || h[1] != 0x46 || h[2] != 0x49 || h[3] != 0xFB)
        throw new InvalidDataException("kein qcow2 (Kennung fehlt): " + pfad);
      uint version = (uint)Be(h, 4, 4);
      if (version != 2 && version != 3) throw new InvalidDataException("qcow2-Version " + version + " nicht unterstuetzt");
      if (Be(h, 8, 8) != 0) throw new InvalidDataException("qcow2 mit Basis-Image nicht unterstuetzt");
      int cbits = (int)Be(h, 20, 4);
      long size = (long)Be(h, 24, 8);
      if (Be(h, 32, 4) != 0) throw new InvalidDataException("verschluesseltes qcow2 nicht unterstuetzt");
      int l1n = (int)Be(h, 36, 4);
      long l1off = (long)Be(h, 40, 8);
      if (cbits < 9 || cbits > 21) throw new InvalidDataException("Clustergroesse 2^" + cbits + " ungueltig");
      if (version == 3) {
        ulong inc = Be(h, 72, 8);
        if ((inc & ~0x9UL) != 0) throw new InvalidDataException("qcow2-Merkmale 0x" + inc.ToString("x") + " nicht unterstuetzt (z. B. externe Daten, erweiterte L2)");
        uint hlen = (uint)Be(h, 100, 4);
        if ((inc & 0x8UL) != 0 && hlen > 104 && h.Length > 104 && h[104] != 0)
          throw new InvalidDataException("qcow2-Kompression ist nicht zlib");
      }
      int cs = 1 << cbits;
      int l2n = cs / 8;
      ulong offMask = 0x00fffffffffffe00UL;
      int x = 62 - (cbits - 8);
      ulong kMask = (1UL << x) - 1;
      ulong sMask = (1UL << (cbits - 8)) - 1;
      byte[] l1 = Lies(f, l1off, l1n * 8);
      using (FileStream o = new FileStream(ziel, FileMode.Create, FileAccess.Write, FileShare.None)) {
        o.SetLength(size);
        byte[] cl = new byte[cs];
        for (int i = 0; i < l1n; i++) {
          ulong l2off = Be(l1, i * 8, 8) & offMask;
          if (l2off == 0) continue;
          byte[] l2 = Lies(f, (long)l2off, cs);
          for (int j = 0; j < l2n; j++) {
            long gpos = ((long)i * l2n + j) * cs;
            if (gpos >= size) break;
            ulong e = Be(l2, j * 8, 8);
            int n = (int)Math.Min(cs, size - gpos);
            if ((e & (1UL << 62)) != 0) {
              long hoff = (long)(e & kMask);
              int clen = (int)((((e >> x) & sMask) + 1) * 512 - (ulong)(hoff & 511));
              byte[] c = Lies(f, hoff, clen);
              using (DeflateStream d = new DeflateStream(new MemoryStream(c), CompressionMode.Decompress)) {
                int g = 0;
                while (g < cs) { int r = d.Read(cl, g, cs - g); if (r <= 0) break; g += r; }
                if (g < n) throw new InvalidDataException("komprimierter Cluster bei " + gpos + " zu kurz");
              }
            } else {
              ulong hoff = e & offMask;
              if (hoff == 0 || (e & 1UL) != 0) continue;   // nicht belegt oder Nullcluster
              byte[] c = Lies(f, (long)hoff, n);
              if (c.Length < n) throw new InvalidDataException("Cluster bei " + gpos + " ragt ueber das Dateiende");
              Buffer.BlockCopy(c, 0, cl, 0, n);
            }
            o.Position = gpos;
            o.Write(cl, 0, n);
          }
        }
      }
    }
  }
}
'@
  }
  try { [LaborQcow2]::ZuRaw($Pfad, $Ziel) }
  catch {
    $m = if ($_.Exception.InnerException) { $_.Exception.InnerException.Message } else { $_.Exception.Message }
    Remove-Item -Force -ErrorAction SilentlyContinue $Ziel
    throw $m
  }
}

function New-SeedIso {
  # NoCloud-Seed als ISO (iso9660 + Joliet, Label cidata) mit IMAPI2, ohne Zusatzwerkzeuge. Nur Windows.
  [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseShouldProcessForStateChangingFunctions', '',
    Justification = 'Laborskript: schreibt nur eine Datei im Laborordner; -WhatIf ist hier nicht vorgesehen.')]
  param([Parameter(Mandatory)][string]$Ordner, [Parameter(Mandatory)][string]$Ziel)
  if (-not ('LaborIsoSchreiber' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices.ComTypes;
public static class LaborIsoSchreiber {
  public static void Schreibe(string pfad, object strom, int blockGroesse, int bloecke) {
    IStream s = (IStream)strom;
    byte[] puffer = new byte[blockGroesse];
    using (FileStream f = File.Create(pfad)) {
      for (int i = 0; i < bloecke; i++) {
        s.Read(puffer, blockGroesse, IntPtr.Zero);
        f.Write(puffer, 0, blockGroesse);
      }
    }
  }
}
'@
  }
  $fs = New-Object -ComObject IMAPI2FS.MsftFileSystemImage
  $fs.FileSystemsToCreate = 3   # ISO9660 + Joliet (Joliet erhaelt Kleinbuchstaben und Bindestriche)
  $fs.VolumeName = 'cidata'
  $fs.Root.AddTree($Ordner, $false)
  $img = $fs.CreateResultImage()
  if (Test-Path -LiteralPath $Ziel) { Remove-Item -Force -LiteralPath $Ziel }
  [LaborIsoSchreiber]::Schreibe($Ziel, $img.ImageStream, $img.BlockSize, $img.TotalBlocks)
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($fs)
}
