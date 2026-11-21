# S1-Same-Host-Vergleich Summary, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Gewertete Reihe mit drei Summary-Aufträgen auf Commit
`4b135fe8468e07cff06be986f28d4d75dedf236b`, ohne `--arbeitsstand`.

- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne physisches CPU-Pinning.
  Energieschema Ausbalanciert (`381b4222-f694-41f0-9685-ff5bb260df2e`).
- App, Runtime, Treiber und Collector auf llm-host: 8 vCPU/10 GiB,
  im Gast 10 426 224 640 Bytes sichtbar. App-Dienste auf virtuellen CPUs 0–1;
  Encoder deaktiviert. Ursprüngliche App-VM mit 2 vCPU/4 GiB bleibt erhalten.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T210422-s1-summary`, lokal etwa 22:04–22:24 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-s1-summary.json.gz), bytegleich mit
  lokalem Ergebnis. Ergänzende Rohdaten unter
  `%USERPROFILE%\labor-1b\20261116T210422-s1-summary\`.
- [Zwei-Host-Normalreferenz](2026-11-15-lauf-normal-summary.md): zehn Aufträge
  auf demselben Rechner, Commit `5e758d0a870bc38441b60c541a6ff6f3d0662ee2`;
  [Referenz-JSON](messung/2026-11-15-lauf-normal-summary.json.gz).

Alle Zahlen gelten für diesen Rechner und die jeweils genannten Commits.
`buildS1Result` reproduziert den gespeicherten Ergebniskern aus den lokalen
Quellen; Windows-Umgebung und Prüfung der ursprünglichen App werden separat
angefügt. Quell-/Ziel-Image-IDs von App, PDF-Worker, PostgreSQL und Redis
stimmen überein. App-Image und Runtime entsprechen den Digest-Angaben der
Zwei-Host-Referenz:
App `sha256:978dd4633244d9f3a8ff71a86410000d352b6b03a0ef8f2c5b375d146dda142f`,
Runtime `sha256:3eee870ad9f016e3c0dc90dcbe93f31781758179f717a98b28735eb5587491a0`,
Modell-SHA-256 `3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597`.

## Design und Konfiguration

Vorab festgelegt im [S1-Plan](../../1B/archiv/1B-3u4-Planung.md#s1-label-2026-11-16-ausgewertet):
keine zusätzlichen Live-Fehler, p95 je Aktion höchstens 110 % der
Zwei-Host-Normalreferenz; Ressourcen und Modell-/Fallback-Ergebnis erfassen.
Nur beschreibender Konsolidierungsvergleich bei abweichenden Ressourcen.

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh s1 \
  -Commit 4b135fe8468e07cff06be986f28d4d75dedf236b \
  -LabN 3 -LabTag s1-summary -LabAuftrag summary \
  -LabTimeoutMs 300000 -LabLive
```

Fixture-ID `summary-reference-v1`. Queue- und Summary-Client-Budget
300 000 ms, Label-Budget 30 000 ms, NLP und QA-NLP aus. Semantische Wortwolke
und Encoder wie in der Summary-Referenz deaktiviert. Erfasstes Encoder-Budget
hier 120 000 ms, Referenz 8 000 ms; der deaktivierte Pfad wird nicht belastet.
Die ältere Referenz enthält weder `fixtureId` noch `runtimeVersions` als
Manifestfelder; keine nachträglich erfundene Manifestgleichheit.
Der damalige Node-Stand ist im S1-Ergebnis nicht belegt.

## Ergebnisse und Qualitätsgrenze

Alle drei Aufträge `ready`, versuchter Modus `full-context`, wirksamer Modus
`extractive`, `fallbackReason=invalid_response`, manuelle Wiederholung
vorgesehen, jeweils drei Aussagen. Damit keine erfolgreich akzeptierte
Modellzusammenfassung. Dasselbe Qualitätsproblem liegt in allen zehn
Aufträgen der Zwei-Host-Normalreferenz vor; kein neuer S1-spezifischer
Qualitätsfehler daraus ableitbar.

| Auftrag | Client-Wartezeit ms | Host-Rückkehr ms | RSS-Proben | App max. RSS Bytes | App max. CPU % einer CPU |
| ------- | ------------------: | ---------------: | ---------: | -----------------: | -----------------------: |
| 1       |             119 961 |              106 |        166 |        586 096 640 |                    68,27 |
| 2       |              83 682 |               61 |        166 |        570 748 928 |                    54,31 |
| 3       |              85 710 |               65 |        166 |        567 668 736 |                    44,39 |

Erster Auftrag nach frischem Runtime-Start. Client-Wartezeiten liegen unter
dem Budget, enthalten aber Abfrage-/Transportanteile; keine internen
Job-Zeiten daraus machen. Kein zusätzlicher Nachweis interner Fallback-
Zeitgrenzen oder Transport-/Inferenzzerlegung aus diesem S1-JSON.
RSS als summierte Prozess-RSS kann gemeinsame Seiten mehrfach enthalten.
Alle Ressourcenmessungen vollständig, keine übersprungenen Proben.

Je Fenster bestehendes Live-Profil: 500 Ankünfte mit 90-s-Rampe, Reveal
bei 270 s, Messdauer 330 s; keine konstant 500 gleichzeitigen Clients.
Alle 4 800 Aktionen ohne Fehler, alle drei Fenster vollständig.

| Aktion     | S1 Anzahl | Zwei-Host p95 ms | S1 p95 ms | Änderung | 10-%-Schwelle |
| ---------- | --------: | ---------------: | --------: | -------: | ------------- |
| Beitritt   |     1 500 |            30,42 |     23,93 | −21,33 % | eingehalten   |
| Quizstimme |     1 500 |            25,99 |     20,15 | −22,45 % | eingehalten   |
| QA-Beitrag |       300 |            18,15 |     18,56 |  +2,25 % | eingehalten   |
| Blitzlicht |     1 500 |            13,73 |     11,97 | −12,84 % | eingehalten   |

Reproduziert mit `evaluateLiveComparison(referenz.experiment.live,
s1.treiber.live)` aus `experiment.mjs`, gepoolte Einzelzeiten statt Mittel
von Fenster-p95. Fehler- und Latenzkriterium für diese Reihe erfüllt;
strikten Manifestvergleich nicht gelockert.

## Eingriff und Wiederherstellung

Journalzeilen dieses Laufs: Freigabe und Kernelbestätigung
`verified-s1-firewall` um 21:04:28 UTC, Rücknahme um 21:22:53 UTC.
Frühere Journalzeilen gehören zu den vorherigen S1-Läufen.

```bash
sudo ufw insert 1 allow in on br-1b-s1 proto tcp from 172.31.150.0/24 to 192.168.150.20 port 8080 comment arsnova-1b-s1
sudo ufw --force delete allow in on br-1b-s1 proto tcp from 172.31.150.0/24 to 192.168.150.20 port 8080 comment arsnova-1b-s1
```

App und Runtime vor/nach Messung gesund, keine Neustarts und keine OOM-Kills.
S1-Stack und eigene Firewallregel zurückgenommen, normale Runtime frisch
gestartet und geprüft, ursprüngliche App separat geprüft. Ergebnis:
`restored=true`, `checksPassed=true`, `originalAppChecksPassed=true`.
Private temporäre env-Datei und Lease entfernt; eigene S1-Volumes bleiben.

## Einordnung

Zusammen mit [S1-Label](2026-11-16-lauf-s1-label.md) ist der vereinbarte
S1-Messumfang abgeschlossen. Summary hält die Live-Schwellen ein, Label
überschreitet zwei Latenzschwellen. Keine einheitliche Leistungsüberlegenheit
und kein allgemeiner Isolationsnachweis aus diesen Reihen.

S1 nutzt 8 vCPU/10 GiB statt Zwei-Host mit 2+8 vCPU/4+10 GiB.
App-CPU-Affinität und Treiber-/Collector-Platzierung unterscheiden sich;
HTTP bleibt erhalten. Drei gegenüber zehn Summary-Aufträgen, sequenzielle
Erhebung auf gemeinsamem physischen Host, unvollständige Versionsmetadaten
der älteren Referenz. Keine statistisch abgesicherte oder kapazitätsgleiche
Kausalbehauptung und keine neue Bewertung der Summary-Qualität.

Keine weitere optionale Messreihe vorgesehen. Es folgen die Bewertung von
Deployment, Updates, Monitoring, Token-Rotation und TLS sowie die begründete
Betriebsentscheidung; Autorenprüfung und formaler Abschluss bleiben offen.
