# Pester 5: Groessenwahl und Negativtests von labor.ps1 ohne Hyper-V (Cmdlets gemockt).
# Aufruf: Invoke-Pester docs/referat-thema-1/evidenz/1B/labor.Tests.ps1
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSReviewUnusedParameter', '',
  Justification = 'Platzhalter-Cmdlets fuer Mock; Parameter nur fuer die Signatur.')]
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseDeclaredVarsMoreThanAssignments', '',
  Justification = 'Ja, LlmCpus und VmScript liest labor.ps1 per dynamischem Scope.')]
param()
BeforeAll {
  if (-not $env:USERPROFILE) { $env:USERPROFILE = [IO.Path]::GetTempPath() }
  # Platzhalter fuer Windows-Cmdlets, die es im Linux-Container nicht gibt; Mock ersetzt sie.
  function Get-VMSwitch { param($Name, $ErrorAction) }
  function Get-NetNatStaticMapping { param($NatName, $ErrorAction) }
  . (Join-Path $PSScriptRoot 'labor.ps1')
  Mock Write-Host {}
  Mock Get-LaborRechner { [pscustomobject]@{ Kerne = 4; Threads = 8; RamGib = 31 } }
}

Describe 'Select-LaborGroesse' {
  It 'uebernimmt die Empfehlung am Messrechner' {
    Mock Read-Host { '' }
    $g = Select-LaborGroesse
    "$($g.LlmCpus)/$($g.LlmRamGB)/$($g.AppCpus)/$($g.AppRamGB)/$($g.LlmDiskGB)/$($g.AppDiskGB)" | Should -Be '4/12/2/6/20/25'
  }

  It 'fragt nach ungueltigen eigenen Werten erneut' {
    $script:antworten = [Collections.Queue]@('n', '3', '9', '2', '6', '', '', '3', '10', '2', '4', '', '')
    Mock Read-Host { $script:antworten.Dequeue() }
    $g = Select-LaborGroesse
    "$($g.LlmCpus)/$($g.LlmRamGB)/$($g.AppCpus)/$($g.AppRamGB)/$($g.LlmDiskGB)/$($g.AppDiskGB)" | Should -Be '3/10/2/4/20/25'
    $script:antworten.Count | Should -Be 0
    Should -Invoke Write-Host -ParameterFilter { "$Object" -like '*Ungueltig*mindestens 10 GB*' } -Times 1
  }

  It 'nimmt eine groessere Platte an und lehnt eine zu kleine ab' {
    $script:antworten = [Collections.Queue]@('n', '4', '12', '2', '6', '16', '25', '4', '12', '2', '6', '40', '30')
    Mock Read-Host { $script:antworten.Dequeue() }
    $g = Select-LaborGroesse
    "$($g.LlmDiskGB)/$($g.AppDiskGB)" | Should -Be '40/30'
    Should -Invoke Write-Host -ParameterFilter { "$Object" -like '*Ungueltig*Platte mindestens 20 GB*' } -Times 1
  }

  It 'lehnt ungueltige Parameter ohne Rueckfrage ab' {
    $Ja = $true
    $LlmCpus = 6
    { Select-LaborGroesse } | Should -Throw '*Ungueltige Groessen*'
  }

  It 'bricht auf einem zu kleinen Rechner ab' {
    Mock Get-LaborRechner { [pscustomobject]@{ Kerne = 2; Threads = 4; RamGib = 8 } }
    { Select-LaborGroesse } | Should -Throw '*zu klein*'
  }
}

Describe 'Test-LaborNetz' {
  It 'meldet keinen Fehler bei internem Switch, ohne Weiterleitung, llm-host gesperrt' {
    Mock Test-LaborAdmin { $true }
    Mock Get-VMSwitch { [pscustomobject]@{ Name = 'arsnova-1b'; SwitchType = 'Internal' } }
    Mock Get-NetNatStaticMapping { }
    Mock Test-LlmOffen { $false }
    Test-LaborNetz | Should -Be 0
  }

  It 'behauptet ohne Admin-Rechte kein OK fuer das NAT' {
    Mock Get-VMSwitch { [pscustomobject]@{ Name = 'arsnova-1b'; SwitchType = 'Internal' } }
    Mock Get-NetNatStaticMapping { }
    Mock Test-LlmOffen { $false }
    Mock Test-LaborAdmin { $false }
    Test-LaborNetz | Should -Be 0
    Should -Invoke Write-Host -ParameterFilter { "$Object" -like '*NAT ohne Portweiterleitung*' } -Times 0
    Should -Invoke Write-Host -ParameterFilter { "$Object" -like 'HINWEIS*NAT*nicht geprueft*' } -Times 1
  }

  It 'zaehlt externen Switch, Portweiterleitung und offenen Port' {
    Mock Test-LaborAdmin { $true }
    Mock Get-VMSwitch { [pscustomobject]@{ Name = 'arsnova-1b'; SwitchType = 'External' } }
    Mock Get-NetNatStaticMapping { [pscustomobject]@{ ExternalPort = 8080 } }
    Mock Test-LlmOffen { $true }
    Test-LaborNetz | Should -Be 3
  }
}

Describe 'Invoke-VmScript' {
  BeforeAll {
    $script:fake = Join-Path ([IO.Path]::GetTempPath()) "vm-fake-$PID.ps1"
  }
  AfterAll { Remove-Item -Force -ErrorAction SilentlyContinue $script:fake }

  It 'wirft, wenn vm-windows.ps1 mit Fehler endet (up macht dann nicht weiter)' {
    Set-Content -Path $script:fake -Value 'param($Mode, $SshKey, $VmDir) exit 1'
    $VmScript = $script:fake
    { Invoke-VmScript $null 'up' } | Should -Throw '*vm-windows.ps1 -Mode up*'
  }

  It 'wirft nicht bei Erfolg, auch wenn ein frueherer Befehl einen Fehlercode hinterliess' {
    Set-Content -Path $script:fake -Value 'param($Mode, $SshKey, $VmDir) exit 0'
    $VmScript = $script:fake
    $global:LASTEXITCODE = 255
    { Invoke-VmScript $null 'status' } | Should -Not -Throw
  }
}

Describe 'Get-LaufEnv' {
  It 'gibt B0 an lauf.sh weiter, wenn -LabRuntimeAus gesetzt ist (Runtime gestoppt, Nachtrag M3)' {
    $e = Get-LaufEnv -N 10 -Tag 'b0' -TimeoutMs 300000 -Profil 'Ausbalanciert' -Rechner 'i7, 16 Threads, 32 GB' -RuntimeAus $true
    $e | Should -Match "(^| )LAB_RUNTIME_AUS=1( |$)"
    $e | Should -Match "LAB_N=10 LAB_TAG='b0' LAB_TIMEOUT_MS=300000"
  }
  It 'laesst B0 aus, wenn der Schalter fehlt' {
    $e = Get-LaufEnv -N 1 -Tag '' -TimeoutMs 90000 -Profil 'x' -Rechner 'y' -RuntimeAus $false
    $e | Should -Not -Match 'LAB_RUNTIME_AUS=1'
  }
}

Describe 'Get-MessungZiel' {
  It 'haengt -2, -3 an, statt ein vorhandenes Ergebnis zu ueberschreiben (wie labor.sh lauf)' {
    $d = Join-Path $TestDrive 'messung'
    New-Item -ItemType Directory -Force $d | Out-Null
    Get-MessungZiel -Ordner $d -Basis '2026-11-13-kontrolle-c0' -Endung '.json' | Should -Be (Join-Path $d '2026-11-13-kontrolle-c0.json')
    Set-Content (Join-Path $d '2026-11-13-kontrolle-c0.json') '{}'
    Get-MessungZiel -Ordner $d -Basis '2026-11-13-kontrolle-c0' -Endung '.json' | Should -Be (Join-Path $d '2026-11-13-kontrolle-c0-2.json')
    New-Item -ItemType Directory -Force (Join-Path $d '2026-11-13-belege') | Out-Null
    Get-MessungZiel -Ordner $d -Basis '2026-11-13-belege' -Endung '' | Should -Be (Join-Path $d '2026-11-13-belege-2')
  }
}
