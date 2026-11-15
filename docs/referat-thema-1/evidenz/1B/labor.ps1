<#
.SYNOPSIS
  1B-Labor unter Windows mit einem Befehl, Gegenstueck zu labor.sh (ADR 1B-010).

.DESCRIPTION
  Ohne WSL (seit 2026-11-13). Getestet: siehe evidenz/1B/2026-11-13-windows-test.md.

    labor.ps1 -Mode vorpruefung  nur pruefen, ob dieser Rechner bereit ist (aendert nichts)
    labor.ps1 -Mode umgebung  Rechner, Hyper-V und VMs als JSON (steht auch in jedem Ergebnis)
    labor.ps1 -Mode sync      Repo-Stand (HEAD oder -Commit) in beide VMs bringen
    labor.ps1 -Mode up        Groessenwahl, VMs (vm-windows.ps1), llm-host, app-host, Pruefungen
                              -NurVorbereiten: alles anlegen, aber keine VM starten
    labor.ps1 -Mode groessen  nur Empfehlung und Groessenwahl anzeigen, nichts anlegen
    labor.ps1 -Mode pruefen   nur die Pruefungen (Runbook 10, 11, Negativtests), Bericht schreiben
    labor.ps1 -Mode kalibrierung  eine nicht gewertete Anfrage, Timeout nach Regel (ADR 1B-005)
    labor.ps1 -Mode lauf      gewerteter Lauf (-LabN, -LabTag, -LabTimeoutMs), Ergebnis nach messung\
                              -LabTag mit Praefix dev oder probe: kommt nicht ins Repo; ohne
                              -LabTimeoutMs gilt die juengste Kalibrierung von heute
    labor.ps1 -Mode status    VMs, Reserve, Docker, Repo-Stand
    labor.ps1 -Mode stop      beide VMs herunterfahren (RAM und CPU wieder frei, Disks bleiben)
    labor.ps1 -Mode start     beide VMs starten, auf die Dienste warten, pruefen
    labor.ps1 -Mode destroy   VMs, Disks, NAT und Switch entfernen (fragt nach)

  Aufruf in einer Admin-PowerShell:
    powershell -ExecutionPolicy Bypass -File .\labor.ps1 -Mode up

  Ohne Rueckfragen: -Ja. Eigene Groessen: -LlmCpus, -LlmRamGB, -LlmDiskGB, -AppCpus, -AppRamGB, -AppDiskGB (0 = Empfehlung).
  RAM-Reserve fuer Windows: -RamReserveGB (Standard 4, mindestens 2; kleiner nur auf Testrechnern).
  Hyper-V kann vCPUs nicht an Host-Threads binden; Ersatz: statischer Speicher, Reserve 100 %
  und doppeltes Gewicht fuer den llm-host (vm-windows.ps1). Das GGUF laedt die VM selbst.
  Bericht: $env:USERPROFILE\labor-1b\aufbau-<Zeit>.txt, ohne Tokens. Jeder Aufruf schreibt ein Log
  nach $env:USERPROFILE\labor-1b\log-<Modus>-<Zeit>.txt; bei Fehlern nennt das Skript den Pfad.

  Reines ASCII wegen Windows PowerShell 5.1 (siehe vm-windows.ps1).
#>
[CmdletBinding()]
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '',
  Justification = 'Interaktives Laborskript: Meldungen gehen bewusst nur an die Konsole.')]
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSReviewUnusedParameter', '',
  Justification = 'Fehlalarm: die Skriptparameter werden in den Funktionen unten gelesen.')]
param(
  [ValidateSet('up', 'vorpruefung', 'umgebung', 'sync', 'groessen', 'pruefen', 'kalibrierung', 'lauf', 'kontrolle', 'belege', 'status', 'stop', 'start', 'destroy')]
  [string]$Mode = 'groessen',
  [switch]$Ja,
  [ValidateRange(1, 10)][int]$LabN = 10,
  [ValidatePattern('^[a-z0-9-]*$')][string]$LabTag = '',
  [ValidateSet(0, 90000, 300000)][int]$LabTimeoutMs = 0,
  [switch]$LabRuntimeAus,   # nur -Mode lauf: Auftraege bei gestoppter Runtime (B0, Ausfall), wie LAB_RUNTIME_AUS=1
  [ValidateRange(0, 64)][int]$LlmCpus = 0,
  [ValidateRange(0, 512)][int]$LlmRamGB = 0,
  [ValidateRange(0, 64)][int]$AppCpus = 0,
  [ValidateRange(0, 512)][int]$AppRamGB = 0,
  [ValidateRange(0, 2048)][int]$LlmDiskGB = 0,
  [ValidateRange(0, 2048)][int]$AppDiskGB = 0,
  [ValidateRange(2, 64)][int]$RamReserveGB = 4,
  [string]$SshKey = (Join-Path $env:USERPROFILE '.ssh\arsnova-1b_ed25519.pub'),
  [string]$VmDir = '',   # leer = gemerkter Ort aus einstellungen.json, beim ersten up wird gefragt
  [switch]$EnableHyperV,
  [switch]$NurVorbereiten,
  [ValidatePattern('^([0-9a-f]{40})?$')][string]$Commit = '',   # leer = HEAD; labor-wsl.sh setzt hier den Arbeitsstand
  [switch]$NoSecureBoot,
  [string]$OutDir = (Join-Path $env:USERPROFILE 'labor-1b')
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'groessen.ps1')
. (Join-Path $PSScriptRoot 'vm\windows-lib.ps1')
$VmScript = Join-Path $PSScriptRoot 'vm\vm-windows.ps1'
$AppIp = '192.168.150.10'
$LlmIp = '192.168.150.20'
$Ev = 'docs/referat-thema-1/evidenz/1B'

function Get-LaborText([string]$Code) {
  switch ($Code) {
    'llm-unter-4' { 'llm-host unter 4 vCPU: Inferenz deutlich langsamer, Zahlen nicht mit dem Messrechner vergleichbar.' }
    'app-ram-4' { 'app-host nur 4 GB: der App-Build in der VM wird knapp und langsam.' }
    'llm-ram-10' { 'llm-host nur 10 GB: Container-Limit 8 GB bleibt, wenig Puffer fuer das System der VM.' }
    'host-ram-2' { 'Rechnerisch blieben Windows nur ~2 GB; Windows braucht selbst 3-5 GB, und der Start verlangt 4 GB Reserve auf den verfuegbaren RAM. So startet das Labor hier voraussichtlich nicht (siehe RAM-Vorschau unten).' }
    'ram-zu-klein' { 'Zu wenig RAM: die VMs brauchen mindestens 14 GB (llm 10 + app 4), dazu Windows selbst und 4 GB Reserve; realistisch ab 24 GB.' }
    'kerne-zu-wenig' { 'Zu wenige Kerne: der llm-host braucht mindestens 2 physische Kerne (ohne SMT 4).' }
    'llm-vcpu' { 'llm-host: 2 bis hoechstens min(8, physische Kerne) vCPU.' }
    'app-vcpu' { 'app-host: mindestens 1 vCPU.' }
    'vcpu-summe' { 'Zusammen mehr vCPU als Threads des Rechners.' }
    'llm-ram' { 'llm-host: mindestens 10 GB (Container-Limit 8 GB plus System).' }
    'app-ram' { 'app-host: mindestens 4 GB.' }
    'ram-summe' { 'Zusammen zu viel RAM: dem Rechner muessen 2 GB bleiben.' }
    'llm-disk' { 'llm-host: Platte mindestens 20 GB (Modell, Runtime-Image, System).' }
    'app-disk' { 'app-host: Platte mindestens 25 GB (der App-Build braucht kurz ~18 GB).' }
    default { $Code }
  }
}

function Read-Zahl([string]$Frage, [int]$Standard) {
  $a = Read-Host "$Frage [$Standard]"
  if ([string]::IsNullOrWhiteSpace($a)) { return $Standard }
  $n = 0
  if ([int]::TryParse($a, [ref]$n)) { return $n }
  return -1
}

function Test-Ja([string]$Frage, [bool]$Standard) {
  if ($Ja) { return $true }
  $a = Read-Host $Frage
  if ([string]::IsNullOrWhiteSpace($a)) { return $Standard }
  return $a -match '^(j|y)'
}

# Gibt @{ LlmCpus; LlmRamGB; LlmDiskGB; AppCpus; AppRamGB; AppDiskGB } zurueck oder wirft bei ungueltigen Werten.
function Select-LaborGroesse {
  $r = Get-LaborRechner
  Write-Host "Rechner: $($r.Kerne) Kerne, $($r.Threads) Threads, $($r.RamGib) GB RAM"
  $e = Get-LaborGroesse -Kerne $r.Kerne -Threads $r.Threads -RamGib $r.RamGib
  $w = @{ LlmCpus = 0; LlmRamGB = 0; AppCpus = 0; AppRamGB = 0; LlmDiskGB = $script:GroessenLlmDisk; AppDiskGB = $script:GroessenAppDisk }
  if ($e.abbruch) {
    Write-Host "Keine Empfehlung: $(Get-LaborText $e.abbruch)"
    if ($LlmCpus -eq 0) { throw 'Rechner zu klein fuer das Labor.' }
  }
  else {
    $w = @{ LlmCpus = $e.llm.vcpu; LlmRamGB = $e.llm.ramGib; AppCpus = $e.app.vcpu; AppRamGB = $e.app.ramGib
      LlmDiskGB = $e.llm.diskGib; AppDiskGB = $e.app.diskGib }
    Write-Host "Empfehlung:  llm-host $($w.LlmCpus) vCPU, $($w.LlmRamGB) GB RAM, Platte bis $($w.LlmDiskGB) GB (Reserve 100 %, Gewicht 200)"
    Write-Host "             app-host $($w.AppCpus) vCPU, $($w.AppRamGB) GB RAM, Platte bis $($w.AppDiskGB) GB"
    foreach ($c in @($e.warnungen)) { Write-Host "  Hinweis: $(Get-LaborText $c)" }
  }
  if ($LlmCpus -gt 0) { $w.LlmCpus = $LlmCpus }
  if ($LlmRamGB -gt 0) { $w.LlmRamGB = $LlmRamGB }
  if ($AppCpus -gt 0) { $w.AppCpus = $AppCpus }
  if ($AppRamGB -gt 0) { $w.AppRamGB = $AppRamGB }
  if ($LlmDiskGB -gt 0) { $w.LlmDiskGB = $LlmDiskGB }
  if ($AppDiskGB -gt 0) { $w.AppDiskGB = $AppDiskGB }
  if (-not (Test-Ja 'Uebernehmen? [J/n]' $true)) {
    while ($true) {
      $w.LlmCpus = Read-Zahl 'llm-host vCPU' $w.LlmCpus
      $w.LlmRamGB = Read-Zahl 'llm-host RAM GB' $w.LlmRamGB
      $w.AppCpus = Read-Zahl 'app-host vCPU' $w.AppCpus
      $w.AppRamGB = Read-Zahl 'app-host RAM GB' $w.AppRamGB
      $w.LlmDiskGB = Read-Zahl 'llm-host Platte GB' $w.LlmDiskGB
      $w.AppDiskGB = Read-Zahl 'app-host Platte GB' $w.AppDiskGB
      $f = Test-LaborGroesse -Kerne $r.Kerne -Threads $r.Threads -RamGib $r.RamGib `
        -LlmVcpu $w.LlmCpus -LlmRamGib $w.LlmRamGB -AppVcpu $w.AppCpus -AppRamGib $w.AppRamGB `
        -LlmDiskGib $w.LlmDiskGB -AppDiskGib $w.AppDiskGB
      if (-not $f) { break }
      Write-Host "  Ungueltig: $(Get-LaborText $f)"
    }
  }
  $f = Test-LaborGroesse -Kerne $r.Kerne -Threads $r.Threads -RamGib $r.RamGib `
    -LlmVcpu $w.LlmCpus -LlmRamGib $w.LlmRamGB -AppVcpu $w.AppCpus -AppRamGib $w.AppRamGB `
    -LlmDiskGib $w.LlmDiskGB -AppDiskGib $w.AppDiskGB
  if ($f) { throw "Ungueltige Groessen: $(Get-LaborText $f)" }
  Write-Host ("Gewaehlt: llm-host $($w.LlmCpus) vCPU, $($w.LlmRamGB) GB, Platte $($w.LlmDiskGB) GB; " +
    "app-host $($w.AppCpus) vCPU, $($w.AppRamGB) GB, Platte $($w.AppDiskGB) GB")
  Show-RamVorschau ($w.LlmRamGB + $w.AppRamGB)
  return $w
}

# RAM-Vorschau fuer den Start; reicht es nicht, die groessten Verbraucher mit Tipp (WSL, Docker Desktop).
function Show-RamVorschau([int]$PlanGib) {
  $script:RamVorschau = $null
  $frei = Get-VerfuegbarRamGib
  if ($null -eq $frei -or (Test-LaborVmsLaufen)) { return }
  $script:RamVorschau = Get-RamVorschau -VerfuegbarGib $frei -PlanGib $PlanGib -ReserveGib $RamReserveGB
  $farbe = if ($script:RamVorschau.Reicht) { 'Green' } else { 'Yellow' }
  Write-Host $script:RamVorschau.Text -ForegroundColor $farbe
  if (-not $script:RamVorschau.Reicht) {
    $p = @(Get-Process -ErrorAction SilentlyContinue | ForEach-Object { @{ Name = $_.ProcessName; Bytes = $_.WorkingSet64 } })
    $z = @(Format-RamFresser -Prozesse $p)
    if ($z.Count -gt 0) {
      Write-Host 'Groesste Speicherverbraucher gerade:' -ForegroundColor Yellow
      foreach ($l in $z) { Write-Host "  $l" -ForegroundColor Yellow }
    }
  }
}

# Verfuegbarer RAM wie im Task-Manager (frei plus Standby); $null ausserhalb von Windows (Tests).
function Get-VerfuegbarRamGib {
  try { return [int][Math]::Floor((Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory -ErrorAction Stop).AvailableMBytes / 1024) }
  catch { return $null }
}

function Test-LaborVmsLaufen {
  if (-not (Get-Command Get-VM -ErrorAction SilentlyContinue)) { return $false }
  return [bool]@(Get-VM -Name 'arsnova-1b-*' -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Running' }).Count
}

function Get-SshArg {
  $kh = (Join-Path $VmDir 'known_hosts') -replace '\\', '/'
  $o = @('-o', 'StrictHostKeyChecking=accept-new', '-o', "UserKnownHostsFile=$kh", '-o', 'ConnectTimeout=5',
    '-o', 'BatchMode=yes', '-o', 'LogLevel=ERROR')
  $priv = $SshKey -replace '\.pub$', ''
  if ($priv -ne $SshKey -and (Test-Path $priv)) { $o += @('-i', $priv) }
  return $o
}

function Invoke-Vm([string]$Ip, [string]$Command) {
  $o = Get-SshArg
  & ssh.exe @o "labor@$Ip" $Command | Out-Host
  return $LASTEXITCODE
}

function Invoke-VmScript([hashtable]$Groesse, [string]$VmMode) {
  $a = @{ Mode = $VmMode; SshKey = $SshKey; VmDir = $VmDir }
  if ($VmMode -eq 'up' -and -not $NurVorbereiten) { $a.GesamtSchritte = 11 }
  if ($Commit -and $VmMode -in @('up', 'sync')) { $a.Commit = $Commit }
  if ($EnableHyperV) { $a.EnableHyperV = $true }
  if ($NurVorbereiten -and $VmMode -eq 'up') { $a.NurVorbereiten = $true }
  $a.RamReserveGB = $RamReserveGB
  if ($NoSecureBoot) { $a.NoSecureBoot = $true }
  if ($Groesse) {
    $a.LlmCpus = $Groesse.LlmCpus; $a.LlmRamGB = $Groesse.LlmRamGB
    $a.AppCpus = $Groesse.AppCpus; $a.AppRamGB = $Groesse.AppRamGB
    $a.LlmDiskGB = $Groesse.LlmDiskGB; $a.AppDiskGB = $Groesse.AppDiskGB
  }
  # vm-windows.ps1 meldet Fehler nur per Exit-Code 1 (kein throw), daher hier pruefen.
  $global:LASTEXITCODE = 0
  & $VmScript @a
  if ($LASTEXITCODE -eq 3010) { throw [System.OperationCanceledException]::new('Neustart') }
  if ($LASTEXITCODE -ne 0) { throw "vm-windows.ps1 -Mode $VmMode fehlgeschlagen ($LASTEXITCODE)" }
}

# $true, wenn der Rechner den llm-host auf 8080 erreicht (soll nicht so sein).
function Test-LlmOffen {
  & curl.exe -s -o NUL --max-time 5 "http://${LlmIp}:8080/health"
  return $LASTEXITCODE -eq 0
}

# Negativtests vom Windows-Rechner; gibt die Zahl der Fehler zurueck.
function Test-LaborAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return (New-Object Security.Principal.WindowsPrincipal $id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-LaborNetz {
  $fehler = 0
  $sw = Get-VMSwitch -Name 'arsnova-1b' -ErrorAction SilentlyContinue
  if ($sw -and "$($sw.SwitchType)" -eq 'Internal') { Write-Host 'OK      Switch arsnova-1b ist intern (keine physische Netzkarte)' }
  else { Write-Host "FEHLER  Switch arsnova-1b: $(if ($sw) { $sw.SwitchType } else { 'fehlt' })"; $fehler++ }
  # Ohne Admin liefert Get-NetNatStaticMapping still nichts; dann kein OK behaupten.
  if (Test-LaborAdmin) {
    $map = @(Get-NetNatStaticMapping -NatName 'arsnova-1b' -ErrorAction SilentlyContinue)
    if ($map.Count -eq 0) { Write-Host 'OK      NAT ohne Portweiterleitung' }
    else { Write-Host "FEHLER  NAT hat $($map.Count) Portweiterleitung(en)"; $fehler++ }
  }
  else { Write-Host 'HINWEIS NAT-Portweiterleitung nicht geprueft (nur als Administrator abfragbar)' }
  if (-not (Test-LlmOffen)) { Write-Host 'OK      Rechner -> llm-host:8080 gesperrt: keine Antwort' }
  else { Write-Host 'FEHLER  Rechner -> llm-host:8080 erreichbar'; $fehler++ }
  return $fehler
}

function Invoke-Pruefen {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $bericht = Join-Path $OutDir ("aufbau-{0:yyyyMMddTHHmmss}.txt" -f (Get-Date))
  try { [IO.File]::WriteAllText(($bericht -replace '\.txt$', '-umgebung.json'), (Get-LaborUmgebung), (New-Object Text.UTF8Encoding $false)) }
  catch { Write-Host "HINWEIS: Umgebung nicht erfasst ($($_.Exception.Message))" -ForegroundColor Yellow }
  Start-Transcript -Path $bericht | Out-Null
  try {
    Write-Host "# 1B-Aufbaubericht (ohne Secrets) $(Get-Date -Format o)"
    $r = Get-LaborRechner
    Write-Host "Rechner: $((Get-CimInstance Win32_Processor | Select-Object -First 1).Name); $($r.Kerne) Kerne, $($r.Threads) Threads, $($r.RamGib) GB"
    Invoke-VmScript $null 'status'
    $f = 0
    if ((Invoke-Vm $LlmIp "bash arsnova.eu/$Ev/pruefen.sh llm") -ne 0) { $f++ }
    if ((Invoke-Vm $AppIp "bash arsnova.eu/$Ev/pruefen.sh app") -ne 0) { $f++ }
    Write-Host '== Negativtests vom Rechner'
    $f += Test-LaborNetz
    Write-Host "== Ergebnis: $(if ($f -eq 0) { 'alle Pruefungen OK' } else { 'FEHLER, siehe oben' })"
  }
  finally { Stop-Transcript | Out-Null }
  Write-Host "Bericht: $bericht"
  if ($f -ne 0) { throw 'Pruefungen fehlgeschlagen' }
}

# Speicherort der VM-Disks: gemerkt in einstellungen.json, damit stop/start/destroy ihn wiederfinden.
function Get-EinstellungenPfad { Join-Path $OutDir 'einstellungen.json' }

function Resolve-LaborVmDir([bool]$Waehlen) {
  if ($script:VmDir) { return }
  $p = Get-EinstellungenPfad
  if (Test-Path $p) {
    $e = Get-Content -Raw $p | ConvertFrom-Json
    if ($e.VmDir) { $script:VmDir = [string]$e.VmDir; return }
  }
  # Gibt es die VMs schon (aelterer Aufbau), liegt der Ordner dort.
  if (Get-Command Get-VM -ErrorAction SilentlyContinue) {
    $v = Get-VM -Name 'arsnova-1b-app' -ErrorAction SilentlyContinue
    if ($v) { $script:VmDir = [string]$v.Path; return }
  }
  if (-not $Waehlen) { $script:VmDir = 'C:\ProgramData\arsnova-1b'; return }
  $lw = @(Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter } | ForEach-Object {
      @{ Buchstabe = [string]$_.DriveLetter; FreiGib = [int][Math]::Floor($_.SizeRemaining / 1GB); Dateisystem = [string]$_.FileSystem; Typ = [string]$_.DriveType } })
  $e = Get-SpeicherortEmpfehlung -Laufwerke $lw
  Write-Host ''
  Write-Host 'Wohin sollen die VM-Disks? (bis etwa 45 GB, real rund 25 GB; Image und Zwischendateien ~8 GB)'
  foreach ($l in $e.Geeignet) { Write-Host ("  {0}:  {1,5} GB frei  ({2})" -f $l.Buchstabe, $l.FreiGib, $l.Dateisystem) }
  foreach ($l in @($e.Ungeeignet | Where-Object { $_.Typ -ne 'CD-ROM' })) { Write-Host ("  {0}:  {1,5} GB frei  ({2}, {3}) - ungeeignet fuer Hyper-V" -f $l.Buchstabe, $l.FreiGib, $l.Dateisystem, $l.Typ) }
  if (-not $e.Empfehlung) { throw 'Kein lokales NTFS- oder ReFS-Laufwerk gefunden; -VmDir angeben.' }
  $wahl = $e.Empfehlung
  if (-not $Ja) {
    $a = Read-Host "Ordner [$wahl]"
    if (-not [string]::IsNullOrWhiteSpace($a)) { $wahl = $a.Trim() }
  }
  $script:VmDir = $wahl
  Write-Host "VM-Ordner: $wahl (gemerkt in $p; aendern: -VmDir angeben)"
}

function Save-LaborVmDir {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  @{ VmDir = $script:VmDir } | ConvertTo-Json | Set-Content -Encoding ascii (Get-EinstellungenPfad)
}

function Write-LaborSchritt([int]$Nr, [string]$Text, [string]$Dauer) {
  # Schritte 9-11 nach vm-windows.ps1 (1-8); seit Beginn zaehlt ab dem Start von vm-windows.ps1.
  $rest = Get-Restzeit -Plan (Get-LaborPlan) -Erledigt ($Nr - 1)
  Write-Host ''
  Write-Host (Format-SchrittZeile -Nr $Nr -Gesamt 11 -Text $Text -Dauer $Dauer -SeitBeginn ((Get-Date) - $script:LaborBeginn) -Rest $rest) -ForegroundColor Cyan
}

function Invoke-LaborUp {
  $g = Select-LaborGroesse
  if (-not $NurVorbereiten -and $script:RamVorschau -and -not $script:RamVorschau.Reicht) {
    throw ('Abbruch vor dem Aufbau: der RAM reicht nicht fuer den Start (siehe RAM-Vorschau oben). ' +
      'Erst Programme schliessen und erneut aufrufen; wer trotzdem schon alles vorbereiten will: -NurVorbereiten.')
  }
  Resolve-LaborVmDir $true
  Save-LaborVmDir
  $script:LaborBeginn = Get-Date
  Invoke-VmScript $g 'up'
  if ($NurVorbereiten) { return }
  Write-LaborSchritt 9 'llm-host einrichten: Runtime-Image bauen, Modell (2,4 GB) laden und pruefen, starten' '5-20 min'
  if ((Invoke-Vm $LlmIp "bash arsnova.eu/$Ev/llm-start.sh") -ne 0) {
    throw "llm-start.sh im llm-host fehlgeschlagen (Ausgabe oben). Erneut: labor.ps1 -Mode up (setzt fort)."
  }
  Write-LaborSchritt 10 'app-host einrichten: App-Image bauen, Datenbank, Start' '15-30 min'
  $o = Get-SshArg
  & ssh.exe @o "labor@$LlmIp" "sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' arsnova.eu/.env.llm" |
    & ssh.exe @o "labor@$AppIp" "bash arsnova.eu/$Ev/app-start.sh" | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'app-start.sh im app-host fehlgeschlagen (Ausgabe oben). Erneut: labor.ps1 -Mode up (setzt fort).' }
  Write-LaborSchritt 11 'alles pruefen' '1-3 min'
  Invoke-Pruefen
  Write-Host ''
  Write-Host 'Fertig. Zwischen den Sitzungen: labor.ps1 -Mode stop; danach -Mode start.' -ForegroundColor Green
}

# Nach dem Start: auf SSH und die Container warten (restart: always), dann pruefen.
function Invoke-LaborStart {
  Invoke-VmScript $null 'start'
  $o = Get-SshArg
  # PowerShell 5.1: umgeleitetes stderr nativer Programme waere unter 'Stop' ein Abbruch.
  $alt = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    foreach ($ip in $LlmIp, $AppIp) {
      for ($i = 0; $i -lt 60; $i++) {
        & ssh.exe @o "labor@$ip" 'true' 2>$null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 5
      }
    }
  }
  finally { $ErrorActionPreference = $alt }
  Write-Host 'VMs laufen; warte 90 s auf die Container.'
  Start-Sleep -Seconds 90
  for ($v = 1; $v -le 3; $v++) {
    try { Invoke-Pruefen; return }
    catch { if ($v -eq 3) { throw } ; Write-Host 'Noch nicht bereit, neuer Versuch in 60 s.'; Start-Sleep -Seconds 60 }
  }
}

# Umgebung eines Laufs als JSON (Schema 1b-umgebung-1, gleich wie umgebung.sh unter Linux):
# Rechner, Windows-Version, Energieschema, Netzteil, Speicherort mit Plattentyp, Hyper-V-Version und je VM
# Groesse, Reserve/Gewicht (kein Pinning), Konfigurationsversion, Secure Boot, Platte und das Innere (vm-info.sh).
function Get-LaborUmgebung {
  $cpu = @(Get-CimInstance Win32_Processor)
  $os = Get-CimInstance Win32_OperatingSystem
  $cs = Get-CimInstance Win32_ComputerSystem
  $plan = ((& powercfg.exe /getactivescheme) -join ' ') -replace '[^A-Za-z0-9 ()._:-]', ''
  $bat = @(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue)
  $netzteil = if ($bat.Count -gt 0) { -not [bool]($bat | Where-Object { $_.BatteryStatus -eq 1 }) } else { $null }
  $ort = [ordered]@{ pfad = $VmDir; dateisystem = $null; medium = $null }
  if ($VmDir -match '^([A-Za-z]):') {
    $l = $Matches[1]
    try {
      $ort.dateisystem = [string](Get-Volume -DriveLetter $l -ErrorAction Stop).FileSystem
      $nr = (Get-Partition -DriveLetter $l -ErrorAction Stop).DiskNumber
      $pd = Get-PhysicalDisk -ErrorAction Stop | Where-Object { "$($_.DeviceId)" -eq "$nr" } | Select-Object -First 1
      if ($pd) { $ort.medium = "$($pd.MediaType) $($pd.BusType)".Trim() }
    }
    catch { $null = $_ }
  }
  $hvVersion = $null
  $vmms = Join-Path $env:SystemRoot 'System32\vmms.exe'
  if (Test-Path $vmms) { $hvVersion = (Get-Item $vmms).VersionInfo.ProductVersion }
  $vms = @()
  if (Get-Command Get-VM -ErrorAction SilentlyContinue) {
    foreach ($v in @(Get-VM -Name 'arsnova-1b-*' -ErrorAction SilentlyContinue | Sort-Object Name)) {
      $p = Get-VMProcessor -VMName $v.Name
      $platte = $null
      $hd = Get-VMHardDiskDrive -VMName $v.Name | Select-Object -First 1
      if ($hd) { try { $platte = [int][Math]::Round((Get-VHD -Path $hd.Path).Size / 1GB) } catch { $null = $_ } }
      $ip = if ($v.Name -eq 'arsnova-1b-app') { $AppIp } else { $LlmIp }
      $gast = $null
      if ($v.State -eq 'Running') {
        $o = Get-SshArg
        $alt = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try { $t = (& ssh.exe @o "labor@$ip" "bash arsnova.eu/$Ev/vm-info.sh" 2>$null) -join "`n"; if ($LASTEXITCODE -eq 0) { $gast = $t | ConvertFrom-Json } }
        catch { $gast = $null }
        finally { $ErrorActionPreference = $alt }
      }
      $vms += [ordered]@{
        name = $v.Name; ip = $ip; zustand = [string]$v.State; vcpu = $p.Count; ramGib = [Math]::Round($v.MemoryStartup / 1GB, 1)
        cpuset = $null; cpuReserveProzent = $p.Reserve; cpuGewicht = $p.RelativeWeight
        generation = $v.Generation; konfigurationsversion = [string]$v.Version
        secureBoot = [string](Get-VMFirmware -VMName $v.Name).SecureBoot; plattenMaxGib = $platte; gast = $gast
      }
    }
  }
  $stand = try { (Get-RepoStand -Start $PSScriptRoot).Commit } catch { $null }
  $u = [ordered]@{
    schema = '1b-umgebung-1'; erfasstAm = (Get-Date).ToString('o')
    rechner = [ordered]@{
      plattform = 'windows'; cpu = [string]$cpu[0].Name.Trim()
      kerne = [int](($cpu | Measure-Object -Property NumberOfCores -Sum).Sum)
      threads = [int](($cpu | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum)
      maxMHz = [int]$cpu[0].MaxClockSpeed; ramGib = [Math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
      os = [string]$os.Caption; kernel = "$($os.Version) (Build $($os.BuildNumber))"
      energieprofil = $plan; cpuGovernor = $null; cpufreqTreiber = $null; netzteil = $netzteil; speicherort = $ort
    }
    hypervisor = [ordered]@{ name = 'Hyper-V'; version = $hvVersion; libvirt = $null; nested = $null; pinning = $false }
    vms = $vms
    laborStand = [ordered]@{ commit = $stand }
  }
  return ($u | ConvertTo-Json -Depth 8)
}

function Add-LaborUmgebung([string]$Datei) {
  # Bettet die Umgebung in eine Ergebnisdatei ein; ein Fehler hier darf den Lauf nicht entwerten.
  try {
    $neu = Add-JsonFeld -Json ([IO.File]::ReadAllText($Datei)) -Name 'umgebung' -Wert (Get-LaborUmgebung)
    [IO.File]::WriteAllText($Datei, $neu, (New-Object Text.UTF8Encoding $false))
  }
  catch { Write-Host "HINWEIS: Umgebung nicht erfasst ($($_.Exception.Message))" -ForegroundColor Yellow }
}

function Get-LaufEnv {
  # Umgebung fuer lauf.sh im app-host, wie im_app_host in labor.sh.
  param([int]$N, [string]$Tag, [int]$TimeoutMs, [string]$Profil, [string]$Rechner, [bool]$RuntimeAus)
  $aus = if ($RuntimeAus) { '1' } else { "''" }
  return "LAB_N=$N LAB_TAG='$Tag' LAB_TIMEOUT_MS=$TimeoutMs LAB_PROFIL_IST='$Profil' LAB_RECHNER='$Rechner' LAB_RUNTIME_AUS=$aus"
}

function Get-MessungZiel {
  # Zielname in messung/ ohne Ueberschreiben: <Basis><Endung>, sonst <Basis>-2<Endung>, -3 ... (wie labor.sh lauf).
  param([string]$Ordner, [string]$Basis, [string]$Endung)
  $ziel = Join-Path $Ordner "$Basis$Endung"
  $i = 2
  while (Test-Path $ziel) { $ziel = Join-Path $Ordner "$Basis-$i$Endung"; $i++ }
  return $ziel
}

function Invoke-ImAppHost([string]$LaufMode) {
  # PowerShell 5.1 gibt eingebettete " ungeschuetzt an ssh.exe weiter; daher -N '' (im String '''').
  Invoke-VmScript $null 'sync'
  $o = Get-SshArg
  $pub = (& ssh.exe @o "labor@$AppIp" 'test -f ~/.ssh/labor-llm || ssh-keygen -q -t ed25519 -N '''' -C labor-app-zu-llm -f ~/.ssh/labor-llm; cat ~/.ssh/labor-llm.pub' | Select-Object -Last 1)
  if ("$pub" -notmatch '^ssh-ed25519 [A-Za-z0-9+/=]+ labor-app-zu-llm$') { throw 'unerwarteter Schluessel im app-host' }
  & ssh.exe @o "labor@$LlmIp" "grep -qxF '$pub' ~/.ssh/authorized_keys || echo '$pub' >> ~/.ssh/authorized_keys" | Out-Host
  # Windows aendert das Energieprofil nicht; das aktive Schema wird nur festgehalten.
  $profil = ((& powercfg.exe /getactivescheme) -join ' ') -replace '[^A-Za-z0-9 ()._:-]', ''
  $r = Get-LaborRechner
  $rechner = "$((Get-CimInstance Win32_Processor | Select-Object -First 1).Name), $($r.Threads) Threads, $($r.RamGib) GB" -replace "'", ''
  $timeout = $LabTimeoutMs
  if ($LaufMode -eq 'lauf' -and $timeout -eq 0) {
    # Timeout aus der juengsten Kalibrierung von heute mit gleichem Energieschema (ADR 1B-005).
    $kal = Get-ChildItem -Path $OutDir -Filter ('kalibrierung-{0:yyyyMMdd}T*.json' -f (Get-Date)) -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $kal) { throw "Keine Kalibrierung von heute in ${OutDir}: zuerst -Mode kalibrierung (oder -LabTimeoutMs setzen)." }
    $k = Get-Content -Raw $kal.FullName | ConvertFrom-Json
    if ($k.energieprofil -ne $profil) { throw "Kalibrierung lief mit '$($k.energieprofil)', dieser Lauf mit '$profil': neu kalibrieren." }
    $timeout = [int]$k.timeoutMs
    Write-Host "Timeout $timeout ms aus $($kal.Name)"
  }
  $envText = Get-LaufEnv -N $LabN -Tag $LabTag -TimeoutMs $timeout -Profil $profil -Rechner $rechner -RuntimeAus ($LaufMode -eq 'lauf' -and $LabRuntimeAus.IsPresent)
  $ausgabe = @(& ssh.exe @o "labor@$AppIp" "$envText bash arsnova.eu/$Ev/lauf.sh $LaufMode")
  $ausgabe | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "lauf.sh $LaufMode fehlgeschlagen ($LASTEXITCODE)" }
  if ($LaufMode -eq 'kalibrierung') {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    Push-Location $OutDir
    $datei = "$($ausgabe[-1])".Trim()
    try { & scp.exe -q @o "labor@${AppIp}:$datei" '.'; if ($LASTEXITCODE -ne 0) { throw 'scp der Kalibrierung fehlgeschlagen' } }
    finally { Pop-Location }
    $lokal = Join-Path $OutDir (Split-Path $datei -Leaf)
    Add-LaborUmgebung $lokal
    Write-Host "Kalibrierung: $lokal"
  }
  if ($LaufMode -eq 'lauf') {
    $dir = "$($ausgabe[-1])".Trim()
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    Push-Location $OutDir
    try { & scp.exe -q -r @o "labor@${AppIp}:$dir" '.'; if ($LASTEXITCODE -ne 0) { throw 'scp der Ergebnisse fehlgeschlagen' } }
    finally { Pop-Location }
    $lokal = Join-Path $OutDir (Split-Path $dir -Leaf)
    Write-Host "Rohdaten (nie einchecken, Mitschnitte enthalten den Token): $lokal"
    Add-LaborUmgebung (Join-Path $lokal 'ergebnis.json')
    if (-not ($LabTag.StartsWith('dev') -or $LabTag.StartsWith('probe'))) {
      $basis = '{0:yyyy-MM-dd}-lauf{1}' -f (Get-Date), $(if ($LabTag) { "-$LabTag" } else { '' })
      $ziel = Get-MessungZiel -Ordner (Join-Path $PSScriptRoot 'messung') -Basis $basis -Endung '.json'
      Copy-Item (Join-Path $lokal 'ergebnis.json') $ziel
      Write-Host "Ergebnis: $ziel"
    }
  }
  if ($LaufMode -eq 'kontrolle' -or $LaufMode -eq 'belege') {
    # Wie labor.sh: C0 (Nachtrag M2) bzw. Netz- und Konfigurationsbelege ohne Secrets (M1) nach messung/.
    $dir = "$($ausgabe[-1])".Trim()
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    Push-Location $OutDir
    try { & scp.exe -q -r @o "labor@${AppIp}:$dir" '.'; if ($LASTEXITCODE -ne 0) { throw 'scp der Ergebnisse fehlgeschlagen' } }
    finally { Pop-Location }
    $lokal = Join-Path $OutDir (Split-Path $dir -Leaf)
    $messung = Join-Path $PSScriptRoot 'messung'
    if ($LaufMode -eq 'kontrolle') {
      Add-LaborUmgebung (Join-Path $lokal 'ergebnis.json')
      $ziel = Get-MessungZiel -Ordner $messung -Basis ('{0:yyyy-MM-dd}-kontrolle-c0' -f (Get-Date)) -Endung '.json'
      Copy-Item (Join-Path $lokal 'ergebnis.json') $ziel
      Write-Host "Ergebnis: $ziel"
    }
    else {
      # Belege sind ohne Secrets (env-ohne-secrets.sh, Token-Gegenprobe in lauf.sh) und kommen ins Repo.
      $ziel = Get-MessungZiel -Ordner $messung -Basis ('{0:yyyy-MM-dd}-belege' -f (Get-Date)) -Endung ''
      New-Item -ItemType Directory -Force -Path $ziel | Out-Null
      $utf8 = New-Object Text.UTF8Encoding $false
      foreach ($f in @(Get-ChildItem -Path $lokal -File | Where-Object { $_.Extension -eq '.txt' -or $_.Name -eq 'manifest.json' })) {
        # Zeilenenden auf LF, Leerzeichen am Zeilenende weg (git diff --check)
        $text = ([IO.File]::ReadAllText($f.FullName) -replace "`r", '') -replace '(?m)[ \t]+$', ''
        [IO.File]::WriteAllText((Join-Path $ziel $f.Name), $text, $utf8)
      }
      [IO.File]::WriteAllText((Join-Path $ziel 'umgebung.json'), (Get-LaborUmgebung) + "`n", $utf8)
      Write-Host "Belege: $ziel"
    }
  }
}

# Hauptteil nur bei direktem Aufruf, nicht beim Dot-Sourcing (Tests).
if ($MyInvocation.InvocationName -ne '.') {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $log = Join-Path $OutDir ("log-$Mode-{0:yyyyMMddTHHmmss}.txt" -f (Get-Date))
  $mitLog = $Mode -notin @('pruefen')   # pruefen schreibt seinen eigenen Bericht
  if ($mitLog) { Start-Transcript -Path $log | Out-Null }
  $code = 0
  try {
  # Vor vorpruefung und up den Speicherort waehlen (Empfehlung: Laufwerk mit dem meisten Platz) und merken.
  Resolve-LaborVmDir ($Mode -in @('up', 'vorpruefung'))
  if ($Mode -eq 'vorpruefung') { Save-LaborVmDir }
  # Kein Ruhezustand, solange Aufbau oder Messung laeuft (endet mit diesem Fenster).
  if ($Mode -in @('up', 'start', 'kalibrierung', 'lauf', 'kontrolle', 'belege')) { try { Set-WachHalten $true } catch { Write-Host "HINWEIS: Ruhezustand nicht gesperrt ($($_.Exception.Message))" } }
  switch ($Mode) {
    'vorpruefung' {
      Invoke-VmScript $null 'pruefen'
      $r = Get-LaborRechner
      $e = Get-LaborGroesse -Kerne $r.Kerne -Threads $r.Threads -RamGib $r.RamGib
      if (-not $e.abbruch) { Show-RamVorschau ($e.llm.ramGib + $e.app.ramGib) }
    }
    'umgebung' { Get-LaborUmgebung }
    'sync' { Invoke-VmScript $null 'sync' }
    'up' { Invoke-LaborUp }
    'groessen' { Select-LaborGroesse | Out-Null }
    'pruefen' { Invoke-Pruefen }
    'kalibrierung' { Invoke-ImAppHost 'kalibrierung' }
    'lauf' { Invoke-ImAppHost 'lauf' }
    'kontrolle' { Invoke-ImAppHost 'kontrolle' }
    'belege' { Invoke-ImAppHost 'belege' }
    'status' { Invoke-VmScript $null 'status' }
    'stop' { Invoke-VmScript $null 'stop' }
    'start' { Invoke-LaborStart }
    'destroy' {
      if (Test-Ja 'Beide Labor-VMs mit Disks, NAT und Switch loeschen? [j/N]' $false) { Invoke-VmScript $null 'destroy' }
    }
  }
  }
  catch [System.OperationCanceledException] {
    Write-Host 'Nach dem Neustart denselben Befehl erneut aufrufen.' -ForegroundColor Green
  }
  catch {
    $code = 1
    Write-Host ''
    Write-Host "FEHLER: $($_.Exception.Message)" -ForegroundColor Red
  }
  finally {
    if ($mitLog) {
      Stop-Transcript | Out-Null
      if ($code -ne 0) { Write-Host "Log mit den Meldungen des Skripts: $log (bei Fragen mitschicken; enthaelt keine Tokens). Meldungen von curl/tar stehen nur im Fenster." }
    }
  }
  exit $code
}
