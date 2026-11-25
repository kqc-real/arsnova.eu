# Pester 5: reine Hilfsfunktionen des Windows-Wegs (windows-lib.ps1), laufen auch unter Linux-pwsh.
# Aufruf: Invoke-Pester docs/referat-thema-1/evidenz/1B/vm/windows-lib.Tests.ps1
# Referenzgeometrien: qemu-img create -f vpc -o subformat=fixed (rechnet nach der VHD-Spezifikation),
# fuer Groessen, die genau auf CHS aufgehen (2026-11-13).
BeforeAll {
  . (Join-Path $PSScriptRoot 'windows-lib.ps1')

  function Read-Be([byte[]]$B, [int]$Off, [int]$Len) {
    [uint64]$v = 0
    for ($i = 0; $i -lt $Len; $i++) { $v = ($v -shl 8) -bor $B[$Off + $i] }
    return $v
  }
}

Describe 'Get-VhdGeometry' {
  It 'liefert <erwartet> fuer <bytes> Bytes wie qemu-img' -ForEach @(
    @{ bytes = 1972518912; erwartet = '3822/16/63' }
    @{ bytes = 26843701248; erwartet = '52013/16/63' }
    @{ bytes = 67125248; erwartet = '964/8/17' }
    @{ bytes = 136365219840; erwartet = '65279/16/255' }
  ) {
    $g = Get-VhdGeometry -Bytes $bytes
    "$($g.Zylinder)/$($g.Koepfe)/$($g.Sektoren)" | Should -Be $erwartet
  }
}

Describe 'Get-VhdFooter' {
  BeforeAll {
    $script:id = [byte[]](1..16)
    $script:f = Get-VhdFooter -Bytes 1972371456 -Zeitstempel 0x30A1B2C3 -UniqueId $script:id
  }

  It 'ist 512 Bytes lang und beginnt mit conectix' {
    $f.Length | Should -Be 512
    [Text.Encoding]::ASCII.GetString($f, 0, 8) | Should -Be 'conectix'
  }

  It 'beschreibt eine feste Platte der genauen Rohgroesse' {
    Read-Be $f 8 4 | Should -Be 2              # Features
    Read-Be $f 12 4 | Should -Be 0x00010000    # Formatversion
    Read-Be $f 16 8 | Should -Be ([uint64]::MaxValue) # Data Offset (fest)
    Read-Be $f 24 4 | Should -Be 0x30A1B2C3    # Zeitstempel
    [Text.Encoding]::ASCII.GetString($f, 28, 4) | Should -Be 'win '
    [Text.Encoding]::ASCII.GetString($f, 36, 4) | Should -Be 'Wi2k'
    Read-Be $f 40 8 | Should -Be 1972371456    # Original Size
    Read-Be $f 48 8 | Should -Be 1972371456    # Current Size
    Read-Be $f 60 4 | Should -Be 2             # Disk Type: fest
  }

  It 'traegt die Geometrie nach der Spezifikation (abgerundet) ein' {
    $g = Get-VhdGeometry -Bytes 1972371456
    Read-Be $f 56 2 | Should -Be $g.Zylinder
    $f[58] | Should -Be $g.Koepfe
    $f[59] | Should -Be $g.Sektoren
  }

  It 'hat eine gueltige Pruefsumme (Einerkomplement der Bytesumme ohne Pruefsummenfeld)' {
    $sum = [uint64]0
    for ($i = 0; $i -lt 512; $i++) { if ($i -lt 64 -or $i -gt 67) { $sum += $f[$i] } }
    Read-Be $f 64 4 | Should -Be ((-bnot [uint32]($sum -band 0xFFFFFFFF)) -band 0xFFFFFFFF)
  }

  It 'uebernimmt die eindeutige ID und laesst den Rest leer' {
    $f[68..83] | Should -Be $id
    $f[84] | Should -Be 0
    @($f[85..511] | Where-Object { $_ -ne 0 }).Count | Should -Be 0
  }

  It 'lehnt Groessen ab, die kein Vielfaches von 512 sind' {
    { Get-VhdFooter -Bytes 1000 -Zeitstempel 0 -UniqueId $id } | Should -Throw '*512*'
  }
}

Describe 'Add-VhdFooter' {
  It 'haengt 512 Bytes an eine Rohdatei an und laesst den Inhalt unveraendert' {
    $p = Join-Path ([IO.Path]::GetTempPath()) "raw-$PID.img"
    [IO.File]::WriteAllBytes($p, [byte[]](1..255 + 0 + 1..255 + 0) * 4)
    try {
      Add-VhdFooter -Path $p
      $b = [IO.File]::ReadAllBytes($p)
      $b.Length | Should -Be (2048 + 512)
      [Text.Encoding]::ASCII.GetString($b, 2048, 8) | Should -Be 'conectix'
      $b[0..2047] | Should -Be ([byte[]](1..255 + 0 + 1..255 + 0) * 4)
    }
    finally { Remove-Item -Force $p }
  }

  It 'haengt keinen zweiten Kopf an' {
    $p = Join-Path ([IO.Path]::GetTempPath()) "raw2-$PID.img"
    [IO.File]::WriteAllBytes($p, [byte[]]::new(1024))
    try {
      Add-VhdFooter -Path $p
      { Add-VhdFooter -Path $p } | Should -Throw '*schon*'
    }
    finally { Remove-Item -Force $p }
  }
}

Describe 'Get-RepoStand' {
  BeforeEach {
    $script:r = Join-Path ([IO.Path]::GetTempPath()) "repo-$PID-$(Get-Random)"
    New-Item -ItemType Directory -Path (Join-Path $r '.git/refs/heads') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $r 'docs/x') -Force | Out-Null
  }
  AfterEach { Remove-Item -Recurse -Force $r }

  It 'liest den Commit eines Zweigs aus einer losen Referenz, auch aus einem Unterordner' {
    [IO.File]::WriteAllText((Join-Path $r '.git/HEAD'), "ref: refs/heads/feature-1B`n")
    [IO.File]::WriteAllText((Join-Path $r '.git/refs/heads/feature-1B'), ("a" * 40 + "`n"))
    $s = Get-RepoStand -Start (Join-Path $r 'docs/x')
    $s.Wurzel | Should -Be ((Resolve-Path $r).Path)
    $s.Commit | Should -Be ("a" * 40)
  }

  It 'liefert einen reinen Dateipfad, auch wenn der Start mit Provider-Praefix kommt (UNC-Ordner)' {
    [IO.File]::WriteAllText((Join-Path $r '.git/HEAD'), (("d" * 40) + "`n"))
    $s = Get-RepoStand -Start "Microsoft.PowerShell.Core\FileSystem::$r"
    $s.Wurzel | Should -Not -BeLike '*::*'
    $s.Commit | Should -Be ("d" * 40)
  }

  It 'liest den Commit aus packed-refs' {
    [IO.File]::WriteAllText((Join-Path $r '.git/HEAD'), "ref: refs/heads/main`n")
    [IO.File]::WriteAllText((Join-Path $r '.git/packed-refs'), ("# pack-refs with: peeled fully-peeled sorted`n" + ("b" * 40) + " refs/heads/main`n"))
    (Get-RepoStand -Start $r).Commit | Should -Be ("b" * 40)
  }

  It 'liest einen losgeloesten HEAD' {
    [IO.File]::WriteAllText((Join-Path $r '.git/HEAD'), (("c" * 40) + "`n"))
    (Get-RepoStand -Start $r).Commit | Should -Be ("c" * 40)
  }

  It 'meldet verstaendlich, wenn kein Repo gefunden wird' {
    Remove-Item -Recurse -Force (Join-Path $r '.git')
    { Get-RepoStand -Start $r } | Should -Throw '*kein Git-Repo*'
  }

  It 'meldet einen Worktree (.git als Datei) verstaendlich' {
    Remove-Item -Recurse -Force (Join-Path $r '.git')
    [IO.File]::WriteAllText((Join-Path $r '.git'), 'gitdir: /anderswo/.git/worktrees/x')
    { Get-RepoStand -Start $r } | Should -Throw '*Worktree*'
  }
}

Describe 'Get-VorpruefungUrteil' {
  BeforeAll {
    function Fakten([hashtable]$Aenderung = @{}) {
      $f = @{
        Admin = $true; Edition = 'Professional'; HyperV = 'Enabled'; HypervisorLaeuft = $true
        VirtualisierungFirmware = $null; HyperVModul = $true; Ssh = $true; Tar = $true
        AndereNat = @(); Adresskonflikt = $null; PlatteFreiGib = 120; PlatteNoetigGib = 41
        Internet = @{ 'cloud-images.ubuntu.com' = $true; 'huggingface.co' = $true }; DnsExtern = $true
      }
      foreach ($k in $Aenderung.Keys) { $f[$k] = $Aenderung[$k] }
      return $f
    }
    function Fatal($e) { @($e | Where-Object { $_.Status -eq 'FEHLER' } | ForEach-Object { $_.Pruefung }) -join ',' }
  }

  It 'meldet bei einem passenden Rechner nur OK' {
    $e = Get-VorpruefungUrteil (Fakten)
    Fatal $e | Should -Be ''
    @($e | Where-Object { $_.Status -eq 'OK' }).Count | Should -BeGreaterThan 5
  }

  It 'nennt jeden Fehler mit Abhilfe: <name>' -ForEach @(
    @{ name = 'kein Admin'; aenderung = @{ Admin = $false }; pruefung = 'Admin'; abhilfe = '*Als Administrator*' }
    @{ name = 'Windows Home'; aenderung = @{ Edition = 'Core'; HyperV = 'Missing' }; pruefung = 'Edition'; abhilfe = '*Pro*' }
    @{ name = 'Hyper-V aus'; aenderung = @{ HyperV = 'Disabled'; HypervisorLaeuft = $false; VirtualisierungFirmware = $true }; pruefung = 'Hyper-V'; abhilfe = '*-EnableHyperV*' }
    @{ name = 'Virtualisierung im BIOS aus'; aenderung = @{ HyperV = 'Disabled'; HypervisorLaeuft = $false; VirtualisierungFirmware = $false }; pruefung = 'Virtualisierung'; abhilfe = '*BIOS*' }
    @{ name = 'Hyper-V an, Hypervisor startet nicht'; aenderung = @{ HypervisorLaeuft = $false; VirtualisierungFirmware = $false }; pruefung = 'Virtualisierung'; abhilfe = '*BIOS*' }
    @{ name = 'kein ssh'; aenderung = @{ Ssh = $false }; pruefung = 'OpenSSH'; abhilfe = '*OpenSSH.Client*' }
    @{ name = 'kein tar'; aenderung = @{ Tar = $false }; pruefung = 'tar'; abhilfe = '*Windows 10 1803*' }
    @{ name = 'Netz belegt'; aenderung = @{ Adresskonflikt = '192.168.150.7 auf WLAN' }; pruefung = 'Labornetz'; abhilfe = '*192.168.150.0/24*' }
    @{ name = 'NAT ueberlappt'; aenderung = @{ AndereNat = @(@{ Name = 'x'; Prefix = '192.168.0.0/16' }) }; pruefung = 'NAT'; abhilfe = '*Remove-NetNat*' }
    @{ name = 'Platte zu klein'; aenderung = @{ PlatteFreiGib = 30 }; pruefung = 'Platte'; abhilfe = '*41 GB*' }
    @{ name = 'externes DNS gesperrt'; aenderung = @{ DnsExtern = $false }; pruefung = 'DNS'; abhilfe = '*1.1.1.1*' }
    @{ name = 'Download gesperrt'; aenderung = @{ Internet = @{ 'cloud-images.ubuntu.com' = $true; 'huggingface.co' = $false } }; pruefung = 'Internet'; abhilfe = '*huggingface.co*' }
  ) {
    $e = Get-VorpruefungUrteil (Fakten $aenderung)
    Fatal $e | Should -BeLike "*$pruefung*"
    ($e | Where-Object { $_.Pruefung -eq $pruefung -and $_.Status -eq 'FEHLER' }).Abhilfe | Should -BeLike $abhilfe
  }

  It 'weist auf Akkubetrieb hin, ohne abzubrechen' {
    $e = Get-VorpruefungUrteil (Fakten @{ Akku = $true })
    Fatal $e | Should -Be ''
    ($e | Where-Object { $_.Pruefung -eq 'Strom' }).Status | Should -Be 'HINWEIS'
    ($e | Where-Object { $_.Pruefung -eq 'Strom' }).Abhilfe | Should -BeLike '*Netzteil*'
  }

  It 'warnt bei einem anderen, nicht ueberlappenden NAT nur' {
    $e = Get-VorpruefungUrteil (Fakten @{ AndereNat = @(@{ Name = 'docker'; Prefix = '172.20.0.0/16' }) })
    Fatal $e | Should -Be ''
    ($e | Where-Object { $_.Pruefung -eq 'NAT' }).Status | Should -Be 'HINWEIS'
  }
}

Describe 'Format-Dauer' {
  It 'zeigt <s> s als <text>' -ForEach @(
    @{ s = 5; text = '0:05' }
    @{ s = 125; text = '2:05' }
    @{ s = 3725; text = '1:02:05' }
  ) {
    Format-Dauer ([TimeSpan]::FromSeconds($s)) | Should -Be $text
  }
}

Describe 'ConvertFrom-Qcow2' {
  # Testdaten: 256 KiB (Muster, Nullen, Zufall, Text), mit qemu-img 8.x/11.x als qcow2 v3 erzeugt
  # (komprimiert und unkomprimiert, 4-KiB- und 64-KiB-Cluster wie die Ubuntu-Images). roh.sha256 ist
  # die SHA-256 der Rohdaten; qemu-img convert -O raw liefert dieselbe.
  BeforeAll {
    $script:td = Join-Path $PSScriptRoot 'testdaten'
    $script:soll = (Get-Content -Raw (Join-Path $td 'roh.sha256')).Trim()
  }

  It 'ergibt die Rohdaten bitgenau aus <datei>' -ForEach @(
    @{ datei = 'komprimiert-4k.qcow2' }
    @{ datei = 'unkomprimiert-4k.qcow2' }
    @{ datei = 'komprimiert-64k.qcow2' }
  ) {
    $ziel = Join-Path ([IO.Path]::GetTempPath()) "q-$PID-$datei.raw"
    try {
      ConvertFrom-Qcow2 -Pfad (Join-Path $td $datei) -Ziel $ziel
      (Get-Item $ziel).Length | Should -Be 262144
      (Get-FileHash -Algorithm SHA256 $ziel).Hash.ToLowerInvariant() | Should -Be $soll
    }
    finally { Remove-Item -Force -ErrorAction SilentlyContinue $ziel }
  }

  It 'lehnt eine Datei ab, die kein qcow2 ist' {
    $p = Join-Path ([IO.Path]::GetTempPath()) "kein-$PID.img"
    [IO.File]::WriteAllBytes($p, [byte[]]::new(4096))
    try { { ConvertFrom-Qcow2 -Pfad $p -Ziel "$p.raw" } | Should -Throw '*kein qcow2*' }
    finally { Remove-Item -Force $p, "$p.raw" -ErrorAction SilentlyContinue }
  }
}

Describe 'Get-SpeicherortEmpfehlung' {
  It 'empfiehlt das lokale NTFS-Laufwerk mit dem meisten Platz' {
    $l = @(
      @{ Buchstabe = 'C'; FreiGib = 20; Dateisystem = 'NTFS'; Typ = 'Fixed' }
      @{ Buchstabe = 'D'; FreiGib = 300; Dateisystem = 'NTFS'; Typ = 'Fixed' }
      @{ Buchstabe = 'E'; FreiGib = 900; Dateisystem = 'exFAT'; Typ = 'Removable' }
    )
    $e = Get-SpeicherortEmpfehlung -Laufwerke $l
    $e.Empfehlung | Should -Be 'D:\arsnova-1b'
    @($e.Geeignet | ForEach-Object { $_.Buchstabe }) -join ',' | Should -Be 'D,C'
    @($e.Ungeeignet | ForEach-Object { $_.Buchstabe }) -join ',' | Should -Be 'E'
  }

  It 'nimmt C mit ProgramData, wenn C das beste Laufwerk ist' {
    $e = Get-SpeicherortEmpfehlung -Laufwerke @(@{ Buchstabe = 'C'; FreiGib = 200; Dateisystem = 'NTFS'; Typ = 'Fixed' })
    $e.Empfehlung | Should -Be 'C:\ProgramData\arsnova-1b'
  }

  It 'akzeptiert ReFS und meldet, wenn kein Laufwerk taugt' {
    $e = Get-SpeicherortEmpfehlung -Laufwerke @(@{ Buchstabe = 'F'; FreiGib = 100; Dateisystem = 'ReFS'; Typ = 'Fixed' })
    $e.Empfehlung | Should -Be 'F:\arsnova-1b'
    (Get-SpeicherortEmpfehlung -Laufwerke @(@{ Buchstabe = 'G'; FreiGib = 100; Dateisystem = 'FAT32'; Typ = 'Fixed' })).Empfehlung | Should -BeNullOrEmpty
  }
}

Describe 'Get-VorpruefungUrteil Speicherort' {
  It 'lehnt <name> ab' -ForEach @(
    @{ name = 'Netzpfad'; ort = @{ Pfad = '\\server\share\vm'; Lokal = $false; Dateisystem = 'NTFS' }; abhilfe = '*lokales Laufwerk*' }
    @{ name = 'exFAT'; ort = @{ Pfad = 'E:\arsnova-1b'; Lokal = $true; Dateisystem = 'exFAT' }; abhilfe = '*NTFS*' }
  ) {
    $f = @{ Admin = $true; Edition = 'Professional'; HyperV = 'Enabled'; HypervisorLaeuft = $true; VirtualisierungFirmware = $null
      HyperVModul = $true; Ssh = $true; Tar = $true; AndereNat = @(); Adresskonflikt = $null; PlatteFreiGib = 120; PlatteNoetigGib = 41
      Internet = @{}; Speicherort = $ort }
    $e = Get-VorpruefungUrteil $f
    ($e | Where-Object { $_.Pruefung -eq 'Speicherort' }).Status | Should -Be 'FEHLER'
    ($e | Where-Object { $_.Pruefung -eq 'Speicherort' }).Abhilfe | Should -BeLike $abhilfe
  }
}

Describe 'Get-Restzeit' {
  It 'summiert die Schaetzungen der noch offenen Schritte' {
    $plan = @(60, 120, 600, 1200)
    Get-Restzeit -Plan $plan -Erledigt 0 | Should -Be ([TimeSpan]::FromSeconds(1980))
    Get-Restzeit -Plan $plan -Erledigt 2 | Should -Be ([TimeSpan]::FromSeconds(1800))
    Get-Restzeit -Plan $plan -Erledigt 4 | Should -Be ([TimeSpan]::Zero)
  }
}

Describe 'Format-SchrittZeile' {
  It 'zeigt Schritt, Dauer, Zeit seit Beginn, Restzeit und Ende wie labor.sh (fortschritt.sh)' {
    $jetzt = [datetime]'2026-11-13T17:10:00'
    $z = Format-SchrittZeile -Nr 3 -Gesamt 11 -Text 'Ubuntu-Image' -Dauer '2-10 min' -SeitBeginn ([TimeSpan]::FromMinutes(10)) -Rest ([TimeSpan]::FromSeconds(2910)) -Jetzt $jetzt
    $z | Should -Be '[3/11] Ubuntu-Image (dauert 2-10 min) - seit Beginn 10:00, noch etwa 48:30, fertig gegen 17:58'
  }
  It 'laesst die Dauer weg, wenn keine angegeben ist' {
    $z = Format-SchrittZeile -Nr 8 -Gesamt 11 -Text 'Stand der VMs' -Dauer '' -SeitBeginn ([TimeSpan]::FromSeconds(5)) -Rest ([TimeSpan]::FromHours(1)) -Jetzt ([datetime]'2026-11-13T23:30:00')
    $z | Should -Be '[8/11] Stand der VMs - seit Beginn 0:05, noch etwa 1:00:00, fertig gegen 00:30'
  }
}

Describe 'Add-JsonFeld' {
  It 'haengt ein Feld an, ohne den uebrigen Text zu veraendern' {
    $alt = "{`n  `"lauf`": `"x`",`n  `"wert`": 0.1234567890123`n}`n"
    $neu = Add-JsonFeld -Json $alt -Name 'umgebung' -Wert '{"schema":"1b-umgebung-1"}'
    $neu | Should -BeLike "*0.1234567890123*"
    $neu.StartsWith($alt.TrimEnd().TrimEnd('}').TrimEnd()) | Should -BeTrue
    ($neu | ConvertFrom-Json).umgebung.schema | Should -Be '1b-umgebung-1'
    ($neu | ConvertFrom-Json).lauf | Should -Be 'x'
  }

  It 'lehnt Text ab, der kein JSON-Objekt ist' {
    { Add-JsonFeld -Json '[1,2]' -Name 'u' -Wert '{}' } | Should -Throw '*JSON-Objekt*'
  }
}

Describe 'Get-WachFlag' {
  It 'liefert ES_CONTINUOUS | ES_SYSTEM_REQUIRED als UInt32' {
    $f = Get-WachFlag -An $true
    $f | Should -BeOfType [uint32]
    $f | Should -Be 2147483649
    Get-WachFlag -An $false | Should -Be 2147483648
  }
}

Describe 'Strict-Mode-Falle .Count' {
  # Gefunden im Windows-Test 2026-11-13: unter Set-StrictMode hat ein leeres Pipeline-Ergebnis kein .Count.
  It 'zaehlt Pipeline-Ergebnisse in <datei> nur in @(...)' -ForEach @(
    @{ datei = 'vm-windows.ps1' }, @{ datei = 'windows-lib.ps1' }, @{ datei = '../labor.ps1' }, @{ datei = '../groessen.ps1' }
  ) {
    $text = Get-Content -Raw (Join-Path $PSScriptRoot $datei)
    $treffer = [regex]::Matches($text, '(?<!@)\((?:(?!\r?\n).)*\|\s*Where-Object(?:(?!\r?\n).)*\)\.Count')
    @($treffer | ForEach-Object { $_.Value }) | Should -BeNullOrEmpty
  }
}

Describe 'Get-RamVorschau' {
  It 'meldet <name>' -ForEach @(
    @{ name = 'reicht bei 32 GB'; verf = 26; plan = 18; res = 4; reicht = $true; rest = 8 }
    @{ name = 'reicht knapp genau bei der Reserve'; verf = 22; plan = 18; res = 4; reicht = $true; rest = 4 }
    @{ name = 'reicht nicht bei 16 GB'; verf = 11; plan = 14; res = 4; reicht = $false; rest = -3 }
  ) {
    $v = Get-RamVorschau -VerfuegbarGib $verf -PlanGib $plan -ReserveGib $res
    $v.Reicht | Should -Be $reicht
    $v.RestGib | Should -Be $rest
    $v.Text | Should -BeLike "*$verf GB*"
    if (-not $reicht) { $v.Text | Should -BeLike '*startet das Labor nicht*' }
  }
}

Describe 'Format-RamFresser' {
  It 'nennt WSL und Docker mit konkretem Tipp und laesst Kleinkram weg' {
    $p = @(
      @{ Name = 'VmmemWSL'; Bytes = 15GB }
      @{ Name = 'com.docker.backend'; Bytes = 2GB }
      @{ Name = 'msedge'; Bytes = 900MB }
      @{ Name = 'msedge'; Bytes = 700MB }
      @{ Name = 'notepad'; Bytes = 20MB }
    )
    $z = @(Format-RamFresser -Prozesse $p)
    $z[0] | Should -BeLike '*WSL (VmmemWSL)*15*GB*.wslconfig*memory=6GB*'
    $z[1] | Should -BeLike '*Docker Desktop (com.docker.backend)*2*GB*beenden*'
    $z[2] | Should -BeLike '*msedge*1,6*GB*'
    ($z -join ' ') | Should -Not -BeLike '*notepad*'
  }

  It 'liefert nichts ohne grosse Verbraucher' {
    @(Format-RamFresser -Prozesse @(@{ Name = 'notepad'; Bytes = 20MB })).Count | Should -Be 0
  }
}
