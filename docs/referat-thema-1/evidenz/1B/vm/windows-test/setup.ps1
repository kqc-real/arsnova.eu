# 1B-Windows-Test: einmal nach der ersten Anmeldung (autounattend.xml, FirstLogonCommands).
# OpenSSH-Server nur mit dem Schluessel aus authorized_keys, Hyper-V, Neustart.
# Ohne WSL: labor.ps1 braucht es nicht mehr, und WSL 2 (eine VM in der VM) haengt verschachtelt
# mit Host-Kernel 7.2 (Windows-Test 2026-11-13, Versuch 3).
# Reines ASCII wegen Windows PowerShell 5.1. Gruppen per SID, weil die Namen lokalisiert sind.
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '', Justification = 'Testskript.')]
param()
$ErrorActionPreference = 'Continue'
Start-Transcript -Path C:\1b-setup.log -Append | Out-Null

# Liegt das Win32-OpenSSH-MSI bei (win-test.sh, SHA-256 dort geprueft), dauert das Sekunden;
# die Windows-Capability kam am 2026-11-13 erst nach 1 h 40 min aus Windows Update.
$msi = Get-ChildItem -Path $PSScriptRoot -Filter 'OpenSSH-Win64-*.msi' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($msi) {
  Start-Process msiexec.exe -Wait -ArgumentList @('/i', "`"$($msi.FullName)`"", '/qn', 'ADDLOCAL=Server')
} else {
  Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null
}
Set-Service -Name sshd -StartupType Automatic
New-ItemProperty -Path HKLM:\SOFTWARE\OpenSSH -Name DefaultShell -PropertyType String -Force `
  -Value "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" | Out-Null
$ak = 'C:\ProgramData\ssh\administrators_authorized_keys'
New-Item -ItemType Directory -Force -Path C:\ProgramData\ssh | Out-Null
Copy-Item -Path (Join-Path $PSScriptRoot 'authorized_keys') -Destination $ak -Force
& icacls.exe $ak /inheritance:r /grant '*S-1-5-32-544:F' /grant '*S-1-5-18:F' | Out-Null
# Nur Schluessel, keine Passwoerter ueber SSH.
$cfg = 'C:\ProgramData\ssh\sshd_config'
Start-Service sshd
Stop-Service sshd
if (Test-Path $cfg) {
  (Get-Content $cfg) -replace '^#?PasswordAuthentication .*', 'PasswordAuthentication no' | Set-Content -Encoding ascii $cfg
}
Start-Service sshd
# Die Regel des OpenSSH-Pakets gilt nur im Profil Privat; das NAT-Netz der VM ist Oeffentlich.
if (Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue) {
  Set-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -Profile Any -Enabled True
} else {
  New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server' -Enabled True `
    -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -Profile Any | Out-Null
}

foreach ($f in 'Microsoft-Hyper-V') {
  Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart | Out-Null
}
New-Item -ItemType File -Force -Path C:\1b-setup.done | Out-Null
Stop-Transcript | Out-Null
Restart-Computer -Force
