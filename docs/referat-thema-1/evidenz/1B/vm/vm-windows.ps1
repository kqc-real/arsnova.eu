<#
.SYNOPSIS
  1B-Labor: zwei Hyper-V-VMs unter Windows, Gegenstueck zu vm-linux.sh (ADR 1B-002, 1B-003, 1B-009, 1B-010).

.DESCRIPTION
  Ohne WSL (seit 2026-11-13): Image, Seed und Repo-Stand entstehen mit Windows-Bordmitteln
  (tar.exe, Hyper-V-Cmdlets, IMAPI2). Anleitung: WINDOWS.md in diesem Ordner.

    vm-windows.ps1 -Mode up        Vorpruefung, Netz, Image, VMs anlegen und starten, Repo-Stand kopieren
    vm-windows.ps1 -Mode up -NurVorbereiten   wie up, aber ohne VMs zu starten (zum Pruefen)
    vm-windows.ps1 -Mode pruefen   nur die Vorpruefung, aendert nichts
    vm-windows.ps1 -Mode sync      nur den Repo-Stand in beide VMs bringen
    vm-windows.ps1 -Mode status    Zustand, IPs, SSH, docker version, ausgehendes NAT
    vm-windows.ps1 -Mode stop|start  VMs herunterfahren bzw. starten (Disks bleiben)
    vm-windows.ps1 -Mode destroy   VMs, Disks, Seeds, NAT und Switch entfernen (nur arsnova-1b)

  Aufruf in einer Admin-PowerShell (Windows 10/11 Pro, Education oder Enterprise mit Hyper-V):
    powershell -ExecutionPolicy Bypass -File .\vm-windows.ps1 -Mode up

  up ist wiederaufnehmbar: ein erneuter Aufruf ueberspringt, was schon fertig ist.
  Reines ASCII: Windows PowerShell 5.1 liest Skripte ohne BOM als ANSI.

  Quellen (geprueft 2026-11-12/13):
  - NAT-Netz mit internem Switch, nur ein NAT pro Host:
    https://learn.microsoft.com/windows-server/virtualization/hyper-v/setup-nat-network
  - Secure-Boot-Template fuer Linux (MicrosoftUEFICertificateAuthority):
    https://learn.microsoft.com/windows-server/virtualization/hyper-v/generation-2-virtual-machine-security-features#secure-boot
  - Ubuntu 24.04 auf Hyper-V Gen 2: https://learn.microsoft.com/windows-server/virtualization/hyper-v/supported-ubuntu-virtual-machines-on-hyper-v
  - Hyper-V-Anforderungen: https://learn.microsoft.com/windows-server/virtualization/hyper-v/host-hardware-requirements
  - Image (raw im tar.gz) und Seed (IMAPI2), VHD-Fusszeile: windows-lib.ps1
  - cloud-init NoCloud und Netzwerk v2: https://docs.cloud-init.io/en/latest/reference/datasources/nocloud.html

  Gueltigkeitsgrenze: Hyper-V bietet kein CPU-Pinning (nur Anzahl, Reserve, Gewicht).
#>
[CmdletBinding()]
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '',
  Justification = 'Interaktives Laborskript: Meldungen gehen bewusst nur an die Konsole, nicht in die Pipeline.')]
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSReviewUnusedParameter', '',
  Justification = 'Fehlalarm: die Skriptparameter werden in den Funktionen unten gelesen; die Regel prueft nur den Skriptkoerper.')]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('up', 'pruefen', 'sync', 'status', 'stop', 'start', 'destroy')]
  [string]$Mode,
  [string]$SshKey = (Join-Path $env:USERPROFILE '.ssh\arsnova-1b_ed25519.pub'),
  [string]$VmDir = 'C:\ProgramData\arsnova-1b',
  [ValidateRange(1, 64)][int]$LlmCpus = 4,
  [ValidateRange(1, 512)][int]$LlmRamGB = 12,
  [ValidateRange(1, 64)][int]$AppCpus = 2,
  [ValidateRange(1, 512)][int]$AppRamGB = 6,
  [ValidateRange(20, 2048)][int]$LlmDiskGB = 20,
  [ValidateRange(25, 2048)][int]$AppDiskGB = 25,
  [ValidateRange(2, 64)][int]$RamReserveGB = 4,
  [switch]$NurVorbereiten,
  [ValidateRange(0, 20)][int]$GesamtSchritte = 0,   # labor.ps1 zaehlt weiter (9-11)
  [ValidatePattern('^([0-9a-f]{40})?$')][string]$Commit = '',   # leer = HEAD; sonst z. B. ein Arbeitsstand-Commit
  [switch]$EnableHyperV,
  [switch]$NoSecureBoot
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'windows-lib.ps1')
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'groessen.ps1')

$Net = 'arsnova-1b'
$NetAdapter = "vEthernet ($Net)"
$NetPrefix = '192.168.150.0/24'
$HostIp = '192.168.150.1'
$ImgUrl = 'https://cloud-images.ubuntu.com/releases/noble/release'
# qcow2-Gesamtdisk (GPT, EFI, shim fuer Secure Boot). Das tar.gz enthaelt nur die Root-Partition und bootet nicht.
$ImgFile = 'ubuntu-24.04-server-cloudimg-amd64.img'
$BaseVhdx = 'ubuntu-24.04-base.vhdx'
$KnownHosts = (Join-Path $VmDir 'known_hosts') -replace '\\', '/'
# Ziele, die Aufbau und VMs brauchen (Image, Docker, Pakete, Modell); geprueft vor dem Start.
$InternetZiele = @('cloud-images.ubuntu.com', 'archive.ubuntu.com', 'download.docker.com',
  'registry-1.docker.io', 'deb.nodesource.com', 'huggingface.co', 'ghcr.io')

$Vms = @(
  @{ Name = 'arsnova-1b-app'; Ip = '192.168.150.10'; Mac = '00155D1B0010'; Cpus = $AppCpus; RamGB = $AppRamGB; Reserve = 0; Weight = 100; DiskGB = $AppDiskGB; UserData = 'app-host.user-data.yaml' },
  @{ Name = 'arsnova-1b-llm'; Ip = '192.168.150.20'; Mac = '00155D1B0020'; Cpus = $LlmCpus; RamGB = $LlmRamGB; Reserve = 100; Weight = 200; DiskGB = $LlmDiskGB; UserData = 'llm-host.user-data.yaml' }
)

$script:Beginn = Get-Date
$script:Schritt = 0
$script:Schritte = 1
$script:SchrittName = ''
$script:Plan = $null

function Write-Step([string]$Text, [string]$Dauer = '') {
  $script:Schritt++
  $script:SchrittName = $Text
  $seit = (Get-Date) - $script:Beginn
  Write-Host ''
  if ($script:Plan) {
    $rest = Get-Restzeit -Plan $script:Plan -Erledigt ($script:Schritt - 1)
    Write-Host (Format-SchrittZeile -Nr $script:Schritt -Gesamt $script:Schritte -Text $Text -Dauer $Dauer -SeitBeginn $seit -Rest $rest) -ForegroundColor Cyan
  }
  else {
    # Einzelmodi (pruefen, sync) ohne Plan: keine Restzeit
    $d = if ($Dauer) { " (dauert $Dauer)" } else { '' }
    Write-Host "[$($script:Schritt)/$($script:Schritte)] $Text$d - seit Beginn $(Format-Dauer $seit)" -ForegroundColor Cyan
  }
}
function Write-Info([string]$Text) { Write-Host "      $Text" }
function Write-Warn([string]$Text) { Write-Host "      HINWEIS: $Text" -ForegroundColor Yellow }

function Write-Utf8Lf([string]$Path, [string]$Text) {
  # LF und UTF-8 ohne BOM: cloud-init und bash vertragen weder CRLF noch BOM.
  $clean = $Text -replace "`r`n", "`n" -replace "`r", "`n"
  [IO.File]::WriteAllText($Path, $clean, (New-Object Text.UTF8Encoding $false))
}

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return (New-Object Security.Principal.WindowsPrincipal $id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Mitglied der lokalen Gruppe Hyper-V-Administratoren (SID S-1-5-32-578): darf VMs ohne Admin-Fenster
# starten, stoppen und abfragen. Netz und NAT anlegen (up, destroy) braucht weiter Admin.
function Test-HyperVBerechtigt {
  if (Test-Admin) { return $true }
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $sid = New-Object Security.Principal.SecurityIdentifier 'S-1-5-32-578'
  return (New-Object Security.Principal.WindowsPrincipal $id).IsInRole($sid)
}

function Add-HyperVGruppe {
  # Einmalig im Admin-Lauf: den angemeldeten Nutzer in Hyper-V-Administratoren aufnehmen, damit Alltags-
  # befehle (status, start, stop, Laeufe) und Agenten in WSL ohne Admin-Fenster auskommen.
  # Ueber die SID, nicht den Namen: USERDOMAIN ist je nach Sitzung WORKGROUP, und Microsoft-Konten haben
  # andere Anzeigenamen (Windows-Test 2026-11-13: "Prinzipal WORKGROUP\labor nicht gefunden").
  $ich = [Security.Principal.WindowsIdentity]::GetCurrent()
  $nutzer = $ich.Name
  try {
    $drin = @(Get-LocalGroupMember -SID 'S-1-5-32-578' -ErrorAction Stop | Where-Object { "$($_.SID)" -eq "$($ich.User)" }).Count -gt 0
    if (-not $drin) {
      Add-LocalGroupMember -SID 'S-1-5-32-578' -Member $ich.User.Value -ErrorAction Stop
      Write-Info "$nutzer in Hyper-V-Administratoren aufgenommen: ab der naechsten Anmeldung gehen status/start/stop ohne Admin-Fenster."
    }
  }
  catch { Write-Warn "Hyper-V-Administratoren nicht gesetzt ($($_.Exception.Message)); Alltagsbefehle brauchen dann ein Admin-Fenster." }
}

function Test-Erreichbar([string]$Ziel) {
  # Jede HTTP-Antwort zaehlt als erreichbar (auch 401/404); nur Netz- oder TLS-Fehler nicht.
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $r = [Net.WebRequest]::Create("https://$Ziel/")
    $r.Proxy = $null   # direkt wie die VMs; ein Proxy des Rechners hilft den VMs nicht
    $r.Method = 'HEAD'
    $r.Timeout = 10000
    $r.GetResponse().Close()
    return $true
  }
  catch [Net.WebException] {
    return ($null -ne $_.Exception.Response)
  }
  catch { return $false }
}

function Get-Fakten {
  $os = Get-CimInstance Win32_OperatingSystem
  $edition = try { (Get-WindowsEdition -Online).Edition } catch { [string]$os.Caption }
  $feat = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -ErrorAction SilentlyContinue
  $hv = if (-not $feat) { 'Missing' } else { [string]$feat.State }
  $cs = Get-CimInstance Win32_ComputerSystem
  $fw = $null
  if (-not $cs.HypervisorPresent) {
    # Nur ohne laufenden Hypervisor aussagekraeftig; mit Hyper-V meldet Windows hier immer false.
    $fw = [bool]@(@(Get-CimInstance Win32_Processor) | Where-Object { $_.VirtualizationFirmwareEnabled }).Count
  }
  $nats = @(Get-NetNat -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne $Net } |
      ForEach-Object { @{ Name = $_.Name; Prefix = $_.InternalIPInterfaceAddressPrefix } })
  $clash = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.InterfaceAlias -ne $NetAdapter -and (Test-Overlap "$($_.IPAddress)/32" $NetPrefix) }) | Select-Object -First 1
  $ort = @{ Pfad = $VmDir; Lokal = $false; Dateisystem = '' }
  $frei = 0
  if ($VmDir -match '^([A-Za-z]):\\') {
    $vol = Get-Volume -DriveLetter $Matches[1] -ErrorAction SilentlyContinue
    if ($vol) {
      $ort.Lokal = ([string]$vol.DriveType -eq 'Fixed'); $ort.Dateisystem = [string]$vol.FileSystem
      $frei = [int][Math]::Floor($vol.SizeRemaining / 1GB)
    }
  }
  $akku = [bool]@(@(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue) | Where-Object { $_.BatteryStatus -eq 1 }).Count
  $plan = $LlmDiskGB + $AppDiskGB
  # Beim Fortsetzen belegen vorhandene VMs ihren Platz schon; dann keine Plattenschwelle.
  $vorhanden = (Get-Command Get-VM -ErrorAction SilentlyContinue) -and (Get-VM -Name 'arsnova-1b-*' -ErrorAction SilentlyContinue)
  $dns = $false
  try { $dns = [bool](Resolve-DnsName -Name 'cloud-images.ubuntu.com' -Server 1.1.1.1 -DnsOnly -QuickTimeout -Type A -ErrorAction Stop) } catch { $dns = $false }
  $internet = @{}
  foreach ($z in $InternetZiele) { $internet[$z] = Test-Erreichbar $z }
  return @{
    Admin = (Test-Admin); Edition = $edition; HyperV = $hv; HypervisorLaeuft = [bool]$cs.HypervisorPresent
    VirtualisierungFirmware = $fw; HyperVModul = [bool](Get-Command New-VM -ErrorAction SilentlyContinue)
    Ssh = [bool]((Get-Command ssh.exe -ErrorAction SilentlyContinue) -and (Get-Command scp.exe -ErrorAction SilentlyContinue))
    Tar = [bool](Get-Command tar.exe -ErrorAction SilentlyContinue)
    AndereNat = $nats; Adresskonflikt = $(if ($clash) { "$($clash.IPAddress) auf '$($clash.InterfaceAlias)'" } else { $null })
    PlatteFreiGib = $frei; PlatteNoetigGib = $(if ($vorhanden) { 0 } else { [Math]::Min(31, $plan) + 10 })
    Internet = $internet; DnsExtern = $dns; Speicherort = $ort; Akku = $akku
  }
}

function Invoke-Vorpruefung {
  Write-Step 'Vorpruefung (aendert nichts)'
  if (-not (Test-Admin)) {
    throw 'Bitte PowerShell als Administrator starten (Rechtsklick > "Als Administrator ausfuehren").'
  }
  $f = Get-Fakten
  if ($f.HyperV -ne 'Enabled' -and $f.HyperV -ne 'Missing' -and $EnableHyperV) {
    Write-Info 'Hyper-V wird aktiviert ...'
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All -NoRestart | Out-Null
    Write-Host ''
    Write-Host 'Hyper-V ist aktiviert. Bitte Windows jetzt neu starten und denselben Befehl danach noch einmal aufrufen.' -ForegroundColor Green
    exit 3010   # wie Windows-Installer: Neustart noetig; labor.ps1 haelt dann an
  }
  $e = Get-VorpruefungUrteil $f
  foreach ($z in $e) {
    $farbe = switch ($z.Status) { 'OK' { 'Green' } 'HINWEIS' { 'Yellow' } default { 'Red' } }
    Write-Host ('      {0,-8} {1}' -f $z.Status, $z.Text) -ForegroundColor $farbe
    if ($z.Status -ne 'OK' -and $z.Abhilfe) { Write-Host "               -> $($z.Abhilfe)" }
  }
  $fatal = @($e | Where-Object { $_.Status -eq 'FEHLER' })
  if ($fatal.Count -gt 0) {
    throw "Vorpruefung: $($fatal.Count) Punkt(e) muessen behoben werden (siehe -> oben). Es wurde nichts veraendert."
  }
  New-Item -ItemType Directory -Force -Path $VmDir | Out-Null
  if ($Mode -eq 'up') { Add-HyperVGruppe }
  Initialize-SshKey
}

function Initialize-SshKey {
  $priv = $SshKey -replace '\.pub$', ''
  if (Test-Path $SshKey) {
    # Ein Schluessel mit Passphrase scheitert spaeter still (BatchMode); deshalb hier pruefen.
    if (Test-Path $priv) {
      $p = Start-Process -FilePath 'ssh-keygen.exe' -ArgumentList "-y -P `"`" -f `"$priv`"" -Wait -NoNewWindow -PassThru `
        -RedirectStandardOutput (Join-Path $VmDir 'keycheck.out') -RedirectStandardError (Join-Path $VmDir 'keycheck.err')
      Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $VmDir 'keycheck.out'), (Join-Path $VmDir 'keycheck.err')
      if ($p.ExitCode -ne 0) {
        throw "Der SSH-Schluessel $priv hat eine Passphrase; das Labor braucht einen ohne. Den Parameter -SshKey weglassen (dann legt das Skript einen eigenen an) oder einen anderen angeben."
      }
    }
    Write-Info "SSH-Schluessel: $SshKey"
    return
  }
  Write-Info "SSH-Schluessel fehlt; lege einen nur fuer das Labor an (ohne Passphrase): $priv"
  New-Item -ItemType Directory -Force -Path (Split-Path $priv) | Out-Null
  # Argumente als ein String: so kommt das leere -N unter PowerShell 5.1 und 7 gleich an.
  $p = Start-Process -FilePath 'ssh-keygen.exe' -ArgumentList "-q -t ed25519 -N `"`" -C arsnova-1b-labor -f `"$priv`"" -Wait -NoNewWindow -PassThru
  if ($p.ExitCode -ne 0 -or -not (Test-Path $SshKey)) { throw "ssh-keygen fehlgeschlagen (Code $($p.ExitCode))." }
}

function Initialize-Network {
  Write-Step "Netz $Net ($NetPrefix, Rechner $HostIp, NAT ohne Portweiterleitung)"
  $sw = Get-VMSwitch -Name $Net -ErrorAction SilentlyContinue
  if (-not $sw) {
    New-VMSwitch -Name $Net -SwitchType Internal | Out-Null
    Write-Info 'interner Switch angelegt'
  }
  elseif ($sw.SwitchType -ne 'Internal') {
    throw "Switch $Net existiert, ist aber $($sw.SwitchType) statt Internal. Mit -Mode destroy entfernen."
  }
  else { Write-Info 'Switch vorhanden' }
  if (-not (Get-NetIPAddress -InterfaceAlias $NetAdapter -IPAddress $HostIp -ErrorAction SilentlyContinue)) {
    New-NetIPAddress -InterfaceAlias $NetAdapter -IPAddress $HostIp -PrefixLength 24 | Out-Null
  }
  if (-not (Get-NetNat -Name $Net -ErrorAction SilentlyContinue)) {
    try { New-NetNat -Name $Net -InternalIPInterfaceAddressPrefix $NetPrefix | Out-Null }
    catch {
      throw ("New-NetNat fehlgeschlagen: $($_.Exception.Message)`n" +
        'Windows unterstuetzt nur ein NAT-Netz: Get-NetNat zeigt die vorhandenen; ein nicht mehr gebrauchtes mit Remove-NetNat entfernen.')
    }
    Write-Info 'NAT angelegt'
  }
  else { Write-Info 'NAT vorhanden' }
}

function Save-Datei([string]$Url, [string]$Ziel) {
  $curl = Join-Path $env:SystemRoot 'System32\curl.exe'
  for ($i = 1; $i -le 3; $i++) {
    if (Test-Path $curl) {
      & $curl -fL --retry 3 -C - -o "$Ziel.part" $Url
      $ok = ($LASTEXITCODE -eq 0)
    }
    else {
      try { Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile "$Ziel.part"; $ok = $true } catch { $ok = $false }
    }
    if ($ok) { Move-Item -Force "$Ziel.part" $Ziel; return }
    Write-Warn "Download-Versuch $i fehlgeschlagen; neuer Versuch in 10 s"
    Start-Sleep -Seconds 10
  }
  throw "Download fehlgeschlagen: $Url (Internetverbindung pruefen; erneuter Aufruf setzt fort)."
}

function Initialize-Image {
  $base = Join-Path $VmDir $BaseVhdx
  if (Test-Path $base) { Write-Step 'Ubuntu-Image'; Write-Info "vorhanden: $base"; return }
  Write-Step 'Ubuntu-Image laden, pruefen, fuer Hyper-V umwandeln' '2-10 min, ~600 MB Download'
  $img = Join-Path $VmDir $ImgFile
  $sums = Join-Path $VmDir 'SHA256SUMS'
  Save-Datei "$ImgUrl/SHA256SUMS" $sums
  $line = Get-Content $sums | Where-Object { $_ -match "^([0-9a-f]{64}) \*?$([regex]::Escape($ImgFile))$" } | Select-Object -First 1
  if (-not $line) { throw "$ImgFile nicht in SHA256SUMS gefunden." }
  $soll = ($line -split ' ')[0]
  if ((Test-Path $img) -and (Get-FileHash -Algorithm SHA256 $img).Hash.ToLowerInvariant() -ne $soll) {
    Write-Warn 'vorhandenes Image ist veraltet oder unvollstaendig; lade neu'
    Remove-Item -Force $img
  }
  if (-not (Test-Path $img)) { Save-Datei "$ImgUrl/$ImgFile" $img }
  $ist = (Get-FileHash -Algorithm SHA256 $img).Hash.ToLowerInvariant()
  if ($ist -ne $soll) { Remove-Item -Force $img; throw "SHA-256 stimmt nicht ($ist statt $soll); Datei geloescht, bitte erneut aufrufen." }
  Write-Info 'SHA-256 OK'

  # qcow2 -> Rohdisk (eigener Leser, bitgenau wie qemu-img) -> feste VHD -> dynamische VHDX.
  # Erst unter Zwischennamen fertigstellen, damit ein Abbruch keine halbe Basis hinterlaesst.
  $tmp = Join-Path $VmDir 'img-tmp'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $vhd = Join-Path $tmp 'base.vhd'
  Write-Info 'qcow2 entpacken (etwa 3,5 GB Rohdisk, unter einer Minute) ...'
  ConvertFrom-Qcow2 -Pfad $img -Ziel $vhd
  Add-VhdFooter -Path $vhd
  try { Test-VHD -Path $vhd | Out-Null }
  catch { throw "Hyper-V erkennt die erzeugte VHD nicht: $($_.Exception.Message)" }
  $neu = Join-Path $tmp 'base.vhdx'
  Write-Info 'in dynamische VHDX umwandeln (Convert-VHD) ...'
  Convert-VHD -Path $vhd -DestinationPath $neu -VHDType Dynamic
  Test-VHD -Path $neu | Out-Null
  Move-Item -Force $neu $base
  Remove-Item -Recurse -Force $tmp
  Write-Info "fertig: $base"
}

function Copy-Plain([string]$From, [string]$To) {
  # Frische Datei per Stream (nicht sparse, nicht komprimiert).
  $in = [IO.File]::OpenRead($From)
  try {
    $out = [IO.File]::Create($To)
    try { $in.CopyTo($out, 4MB) } finally { $out.Dispose() }
  }
  finally { $in.Dispose() }
}

function Build-Seed($Vm) {
  $dir = Join-Path $VmDir "$($Vm.Name)-seed"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $key = (Get-Content -Raw $SshKey).Trim()
  $ud = (Get-Content -Raw (Join-Path $PSScriptRoot $Vm.UserData)).Replace('__SSH_KEY__', $key)
  Write-Utf8Lf (Join-Path $dir 'user-data') $ud
  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  Write-Utf8Lf (Join-Path $dir 'meta-data') "instance-id: $($Vm.Name)-$stamp`nlocal-hostname: $($Vm.Name)`n"
  # Netzwerk-Format v2, Treffer ueber die feste MAC. Der NAT-Switch vergibt weder IP noch DNS.
  $mac = (($Vm.Mac.ToLowerInvariant() -split '(..)' | Where-Object { $_ }) -join ':')
  $nc = @"
version: 2
ethernets:
  eth0:
    match:
      macaddress: '$mac'
    set-name: eth0
    addresses: [$($Vm.Ip)/24]
    routes:
      - to: default
        via: $HostIp
    nameservers:
      addresses: [1.1.1.1, 9.9.9.9]
"@
  Write-Utf8Lf (Join-Path $dir 'network-config') ($nc + "`n")
  $iso = Join-Path $VmDir "$($Vm.Name)-seed.iso"
  New-SeedIso -Ordner $dir -Ziel $iso
  return $iso
}

function Initialize-Vm($Vm) {
  $n = $Vm.Name
  Write-Step "VM $n anlegen ($($Vm.Cpus) vCPU, $($Vm.RamGB) GB RAM, Platte bis $($Vm.DiskGB) GB, $($Vm.Ip))"
  $ist = Get-VM -Name $n -ErrorAction SilentlyContinue
  if ($ist) {
    if ($ist.ProcessorCount -ne $Vm.Cpus -or $ist.MemoryStartup -ne ([int64]$Vm.RamGB * 1GB)) {
      throw "$n hat $($ist.ProcessorCount) vCPU und $([Math]::Round($ist.MemoryStartup / 1GB)) GB, gewuenscht $($Vm.Cpus) und $($Vm.RamGB). Erst -Mode destroy, dann neu."
    }
    Write-Info 'existiert schon'
    return
  }
  $vhdx = Join-Path $VmDir "$n.vhdx"
  try {
  Copy-Plain (Join-Path $VmDir $BaseVhdx) $vhdx
  Resize-VHD -Path $vhdx -SizeBytes ([int64]$Vm.DiskGB * 1GB)
  $iso = Build-Seed $Vm
  New-VM -Name $n -Generation 2 -MemoryStartupBytes ([int64]$Vm.RamGB * 1GB) -VHDPath $vhdx -SwitchName $Net -Path $VmDir | Out-Null
  # Statischer Speicher, keine automatischen Checkpoints (sonst .avhdx neben der Disk).
  Set-VM -Name $n -StaticMemory -AutomaticCheckpointsEnabled $false -AutomaticStartAction Nothing -AutomaticStopAction ShutDown
  # Kein Pinning in Hyper-V; Ersatz (ADR 1B-010): llm-host 100 % Reserve und doppeltes Gewicht.
  Set-VMProcessor -VMName $n -Count $Vm.Cpus -Reserve $Vm.Reserve -RelativeWeight $Vm.Weight
  Set-VMNetworkAdapter -VMName $n -StaticMacAddress $Vm.Mac
  Add-VMDvdDrive -VMName $n -Path $iso
  $disk = Get-VMHardDiskDrive -VMName $n | Select-Object -First 1
  if ($NoSecureBoot) { Set-VMFirmware -VMName $n -EnableSecureBoot Off -FirstBootDevice $disk }
  else { Set-VMFirmware -VMName $n -EnableSecureBoot On -SecureBootTemplate MicrosoftUEFICertificateAuthority -FirstBootDevice $disk }
  }
  catch {
    # Halb angelegte VM wieder entfernen, sonst gilt sie beim naechsten Aufruf als fertig.
    if (Get-VM -Name $n -ErrorAction SilentlyContinue) { Remove-VM -Name $n -Force }
    foreach ($p in $vhdx, (Join-Path $VmDir "$n-seed.iso")) { Remove-Item -Force -ErrorAction SilentlyContinue $p }
    throw "VM $n konnte nicht angelegt werden (aufgeraeumt): $($_.Exception.Message)"
  }
  Write-Info 'angelegt'
}

function Assert-RamFrei {
  # Erst direkt vor dem Start: statischer Speicher wird beim Start belegt.
  $laufend = @(Get-VM -Name 'arsnova-1b-*' -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Running' })
  if ($laufend.Count -gt 0) { return }
  # Vorhandene VMs zaehlen mit ihrer echten Groesse (start nach up mit eigenen Groessen).
  $vorhanden = @(Get-VM -Name 'arsnova-1b-*' -ErrorAction SilentlyContinue)
  $need = if ($vorhanden.Count -eq 2) { [int](($vorhanden | Measure-Object -Property MemoryStartup -Sum).Sum / 1GB) } else { $LlmRamGB + $AppRamGB }
  # Verfuegbar = frei + Standby (wie im Task-Manager); Klassenname ist nicht lokalisiert.
  $frei = [int][Math]::Floor((Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).AvailableMBytes / 1024)
  Write-Info "RAM: verfuegbar $frei GB, die VMs belegen $need GB fest; Windows blieben etwa $($frei - $need) GB (Reserve $RamReserveGB GB)."
  $r = Test-LaborRessourcen -FreiRamGib $frei -FreiDiskGib 1000 -PlanRamGib $need -PlanDiskGib 0 -ReserveGib $RamReserveGB
  if ($r.abbruch -eq 'ram-frei') {
    $p = @(Get-Process -ErrorAction SilentlyContinue | ForEach-Object { @{ Name = $_.ProcessName; Bytes = $_.WorkingSet64 } })
    foreach ($l in @(Format-RamFresser -Prozesse $p)) { Write-Info "Speicherverbraucher: $l" }
    throw ("Zu wenig freier RAM: Windows blieben weniger als $RamReserveGB GB. Die VMs sind angelegt, aber nicht gestartet.`n" +
      'Programme schliessen (auch WSL: wsl --shutdown, Docker Desktop) und denselben Befehl erneut aufrufen, oder kleinere Groessen waehlen (dann erst -Mode destroy).')
  }
}

function Start-LaborVm {
  [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseShouldProcessForStateChangingFunctions', '',
    Justification = 'Laborskript: startet nur die eigenen VMs; -WhatIf ist hier nicht vorgesehen.')]
  param()
  Write-Step 'VMs starten' 'Sekunden'
  Assert-RamFrei
  foreach ($vm in ($Vms | Sort-Object { $_.Name } -Descending)) {
    if ((Get-VM -Name $vm.Name).State -ne 'Running') { Start-VM -Name $vm.Name; Write-Info "$($vm.Name) gestartet" }
    else { Write-Info "$($vm.Name) laeuft schon" }
  }
}

function Get-SshOption {
  $o = @('-o', 'StrictHostKeyChecking=accept-new', '-o', "UserKnownHostsFile=$KnownHosts",
    '-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes', '-o', 'LogLevel=ERROR')
  $priv = $SshKey -replace '\.pub$', ''
  if ($priv -ne $SshKey -and (Test-Path $priv)) { $o += @('-i', $priv) }
  return $o
}

function Invoke-Ssh([string]$Ip, [string]$RemoteCommand, [switch]$Quiet) {
  $o = Get-SshOption
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'   # PowerShell 5.1: stderr nativer Programme waere sonst ein Abbruch
  try {
    if ($Quiet) { & ssh.exe @o "labor@$Ip" $RemoteCommand 2>$null | Out-Null }
    else { & ssh.exe @o "labor@$Ip" $RemoteCommand | Out-Host }
  }
  finally { $ErrorActionPreference = $old }
  return $LASTEXITCODE
}

function Wait-Ready([string]$Ip, [string]$Name) {
  $t0 = Get-Date
  Write-Info "warte auf $Name ($Ip): Start, cloud-init, Docker-Installation (bis 20 min)"
  for ($i = 0; $i -lt 120; $i++) {
    if ((Invoke-Ssh $Ip 'test -f /var/lib/labor-basis.done' -Quiet) -eq 0) {
      Write-Info "$Name bereit nach $(Format-Dauer ((Get-Date) - $t0))"
      return
    }
    if ($i % 6 -eq 5) {
      $ssh = if ((Invoke-Ssh $Ip 'true' -Quiet) -eq 0) { 'SSH geht, Einrichtung laeuft noch' } else { 'noch kein SSH' }
      Write-Info "... $(Format-Dauer ((Get-Date) - $t0)): $ssh"
    }
    Start-Sleep -Seconds 10
  }
  throw ("$Name ist nach 20 min nicht bereit. Ansehen mit: vmconnect localhost $Name (Bootausgabe). " +
    "Geht SSH: ssh labor@$Ip 'sudo cloud-init status --long'. Danach denselben Befehl erneut aufrufen.")
}

function Invoke-Sync {
  Write-Step 'Repo-Stand in beide VMs kopieren' '1-3 min'
  # Ohne laufende VMs sofort abbrechen statt bis zu 20 min auf SSH zu warten (Windows-Test 2026-11-13).
  $aus = @($Vms | Where-Object { -not (Get-VM -Name $_.Name -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Running' }) })
  if ($aus.Count -gt 0) { throw "VMs laufen nicht ($(@($aus | ForEach-Object { $_.Name }) -join ', ')): erst labor.ps1 -Mode start." }
  $stand = Get-RepoStand -Start $PSScriptRoot
  if ($Commit) { $stand.Commit = $Commit }
  Write-Info "Repo: $($stand.Wurzel), Commit $($stand.Commit)"
  $arch = Join-Path $VmDir 'repo-git.tgz'
  $quelle = $stand.Wurzel
  if ($quelle.StartsWith('\\')) {
    # Repo auf einem Netzpfad (etwa \\wsl.localhost\...): erst lokal spiegeln, robocopy ist dafuer gebaut.
    $quelle = Join-Path $VmDir 'repo-kopie'
    & robocopy.exe (Join-Path $stand.Wurzel '.git') (Join-Path $quelle '.git') /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:2 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy konnte $($stand.Wurzel)\.git nicht kopieren (Code $LASTEXITCODE)." }
  }
  # Nur .git packen; die VM klont daraus und checkt den Commit aus (wie git bundle unter Linux).
  & tar.exe -czf $arch -C $quelle .git
  if ($LASTEXITCODE -ne 0) { throw "tar.exe konnte $quelle\.git nicht packen (Code $LASTEXITCODE)." }
  $o = Get-SshOption
  foreach ($vm in $Vms) {
    Wait-Ready $vm.Ip $vm.Name
    Push-Location $VmDir   # relativer Pfad, sonst liest scp "C:" als Hostnamen
    try {
      & scp.exe -q @o 'repo-git.tgz' "labor@$($vm.Ip):/tmp/repo-git.tgz"
      if ($LASTEXITCODE -ne 0) { throw "Kopieren nach $($vm.Name) fehlgeschlagen (scp Code $LASTEXITCODE)." }
    }
    finally { Pop-Location }
    $c = $stand.Commit
    $cmd = "set -e; rm -rf /tmp/repo-git; mkdir -p /tmp/repo-git; tar -xzf /tmp/repo-git.tgz -C /tmp/repo-git; " +
      "test -d arsnova.eu || git clone -q --no-checkout /tmp/repo-git/.git arsnova.eu; " +
      "cd arsnova.eu && git fetch -q /tmp/repo-git/.git HEAD '+refs/heads/*:refs/remotes/quelle/*' '+refs/labor/*:refs/labor/*' && " +
      "git checkout -q --detach $c && git log --oneline -1"
    if ((Invoke-Ssh $vm.Ip $cmd) -ne 0) { throw "Checkout von $c in $($vm.Name) fehlgeschlagen." }
  }
  Remove-Item -Force $arch
}

function Invoke-Status {
  $sw = Get-VMSwitch -Name $Net -ErrorAction SilentlyContinue
  $nat = Get-NetNat -Name $Net -ErrorAction SilentlyContinue
  Write-Host "Switch: $(if ($sw) { "$($sw.Name) ($($sw.SwitchType))" } else { 'fehlt' }); NAT: $(if ($nat) { $nat.InternalIPInterfaceAddressPrefix } else { 'fehlt' })"
  foreach ($vm in $Vms) {
    $v = Get-VM -Name $vm.Name -ErrorAction SilentlyContinue
    if (-not $v) { Write-Host "== $($vm.Name) ($($vm.Ip)): fehlt"; continue }
    $p = Get-VMProcessor -VMName $vm.Name
    Write-Host "== $($vm.Name) ($($vm.Ip)): $($v.State), $($p.Count) vCPU ohne Pinning (Reserve $($p.Reserve) %, Gewicht $($p.RelativeWeight)), $([Math]::Round($v.MemoryStartup / 1GB)) GB RAM"
    if ($v.State -ne 'Running') { continue }
    $rc = Invoke-Ssh $vm.Ip 'docker version --format ''docker {{.Server.Version}}''; node --version; curl -fsSI https://deb.debian.org >/dev/null && echo ''ausgehend: ok''; git -C arsnova.eu log --oneline -1 2>/dev/null'
    if ($rc -eq 255) { Write-Host 'SSH nicht erreichbar' }
  }
}

function Invoke-Destroy {
  foreach ($vm in $Vms) {
    $n = $vm.Name
    $v = Get-VM -Name $n -ErrorAction SilentlyContinue
    if ($v) {
      if ($v.State -ne 'Off') { Stop-VM -Name $n -TurnOff -Force -WarningAction SilentlyContinue -ErrorAction SilentlyContinue }
      Remove-VM -Name $n -Force
    }
    foreach ($p in "$n.vhdx", "$n-seed.iso", "$n-seed", $n) {
      $full = Join-Path $VmDir $p
      if (Test-Path $full) { Remove-Item -Recurse -Force $full }
    }
  }
  if (Get-NetNat -Name $Net -ErrorAction SilentlyContinue) { Remove-NetNat -Name $Net -Confirm:$false }
  if (Get-VMSwitch -Name $Net -ErrorAction SilentlyContinue) { Remove-VMSwitch -Name $Net -Force }
  foreach ($p in 'known_hosts', 'repo-git.tgz', 'repo-kopie', 'img-tmp') {
    $full = Join-Path $VmDir $p
    if (Test-Path $full) { Remove-Item -Recurse -Force $full }
  }
  Write-Host "Entfernt. Basis-Image und Download bleiben in $VmDir fuer den naechsten Aufbau (ganz weg: Ordner loeschen)."
}

function Invoke-Stop {
  foreach ($vm in $Vms) {
    $v = Get-VM -Name $vm.Name -ErrorAction SilentlyContinue
    if ($v -and $v.State -ne 'Off') { Stop-VM -Name $vm.Name -Force; Write-Host "$($vm.Name) heruntergefahren" }
  }
  Write-Host 'Beide VMs aus; RAM und CPU sind wieder frei.'
}

function Invoke-Start {
  foreach ($vm in $Vms) {
    if (-not (Get-VM -Name $vm.Name -ErrorAction SilentlyContinue)) { throw "$($vm.Name) fehlt: zuerst labor.ps1 -Mode up" }
  }
  $script:Schritte = 1
  Start-LaborVm
}

function Invoke-Up {
  $script:Schritte = if ($NurVorbereiten) { 5 } elseif ($GesamtSchritte) { $GesamtSchritte } else { 8 }
  $voll = Get-LaborPlan
  $script:Plan = $voll[0..([Math]::Min($script:Schritte, $voll.Count) - 1)]
  Write-Host "Ablauf: $($script:Schritte) Schritte, geschaetzt etwa $(Format-Dauer (Get-Restzeit -Plan $script:Plan -Erledigt 0)) (langsame Rechner oder Downloads: mehr). VM-Ordner: $VmDir"
  Invoke-Vorpruefung
  Initialize-Network
  Initialize-Image
  foreach ($vm in $Vms) { Initialize-Vm $vm }
  if ($NurVorbereiten) {
    Write-Host ''
    Write-Host 'Vorbereitet, VMs nicht gestartet (-NurVorbereiten). Weiter mit demselben Befehl ohne -NurVorbereiten.' -ForegroundColor Green
    return
  }
  Start-LaborVm
  Invoke-Sync
  Write-Step 'Stand der VMs'
  Invoke-Status
}

try {
  if ($Mode -in @('up', 'destroy') -and -not (Test-Admin)) {
    throw 'Bitte PowerShell als Administrator starten (Rechtsklick > "Als Administrator ausfuehren"): up und destroy legen Netz und NAT an bzw. entfernen sie.'
  }
  if ($Mode -in @('status', 'stop', 'start', 'sync') -and -not (Test-HyperVBerechtigt)) {
    throw ('Keine Hyper-V-Rechte: PowerShell als Administrator starten. Einmal labor.ps1 -Mode up als Administrator ' +
      'traegt dich in Hyper-V-Administratoren ein; nach erneuter Anmeldung geht es ohne Admin-Fenster.')
  }
  switch ($Mode) {
    'up' { Invoke-Up }
    'pruefen' { $script:Schritte = 1; Invoke-Vorpruefung; Write-Host ''; Write-Host 'Vorpruefung bestanden.' -ForegroundColor Green }
    'sync' { $script:Schritte = 1; Invoke-Sync }
    'status' { Invoke-Status }
    'stop' { Invoke-Stop }
    'start' { Invoke-Start }
    'destroy' { Invoke-Destroy }
  }
  # Explizit 0, sonst bliebe der Code des letzten ssh-Aufrufs stehen (labor.ps1 prueft ihn).
  exit 0
}
catch {
  Write-Host ''
  $wo = if ($script:SchrittName) { " in Schritt [$($script:Schritt)/$($script:Schritte)] $($script:SchrittName)" } else { '' }
  Write-Host "FEHLER$wo" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($Mode -eq 'up') { Write-Host 'Nach dem Beheben denselben Befehl erneut aufrufen; fertige Schritte werden uebersprungen.' }
  exit 1
}
