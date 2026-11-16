# S1-Entwicklungsprobe Label, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Entwicklungsprobe des Same-Host-Pfads für Schritt 4, ein Label-Auftrag mit
Live-Last. Keine gewertete Vergleichsreihe.

- Ausführungsstand `facf688bd216134051104a9b30d82e500c69376a`,
  Arbeitsstand-Snapshot mit `--arbeitsstand`; regulärer lokaler HEAD
  `aa0e90c792b56737f597459d29bbd40cbdb33ceb`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne physisches CPU-Pinning.
- Energieschema: Ausbalanciert, GUID `381b4222-f694-41f0-9685-ff5bb260df2e`;
  CPU-Governor nicht erfasst.
- llm-host: 8 vCPU/10 GiB, im Gast 10 426 224 640 Bytes RAM sichtbar;
  temporärer App-Stack, Runtime und Treiber auf dieser VM.
  App-Dienste auf virtuellen CPUs 0–1, Encoder mit zwei CPUs.
- Ursprüngliche App-VM: 2 vCPU/4 GiB, bleibt erhalten.
- Node auf beiden VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T201921-dev-s1-label`.
- Lokale Rohdaten unter
  `%USERPROFILE%\labor-1b\20261116T201921-dev-s1-label\`:
  `ergebnis.json`, `treiber.json`, `evidence.json`, `config.json`,
  Image-Manifeste, Containerzustände, Journal und Wiederherstellungsprüfungen.
  Entwicklungsdaten werden nicht nach `messung/` übernommen.

Alle Zahlen beziehen sich auf diesen Rechner und Ausführungsstand.
`buildS1Result` aus `s1.mjs` reproduziert den gespeicherten Ergebniskern;
Windows-Umgebungsmanifest und nachträgliche Prüfung der ursprünglichen App
werden separat ergänzt. Quell- und tatsächlich verwendete Image-IDs stimmen
für App, PDF-Worker, PostgreSQL, Redis und Encoder überein.
Runtime-Image `sha256:3eee870ad9f016e3c0dc90dcbe93f31781758179f717a98b28735eb5587491a0`,
Modell-SHA-256 `3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597`.

## Aufruf und Konfiguration

Vom Menschen ausgeführt:

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh s1 \
  -LabN 1 -LabTag dev-s1-label -LabAuftrag label \
  -LabTimeoutMs 300000 -LabLive --arbeitsstand
```

Fixture `label-identical-pair-v1`; Queue- und Summary-Client-Budget
300 000 ms, Label-Client-Budget 30 000 ms, Encoder-Budget 120 000 ms.
Summary und Open-Weight-LLM aktiviert, semantische Wortwolke aktiviert,
NLP und QA-NLP deaktiviert. Settings aus der tatsächlichen App-Container-
Umgebung erfasst. Authentifizierte Slot-Prüfung aus dem S1-App-Container:
HTTP 200.

## Beobachtungen

Der einzelne Auftrag nach frischem Runtime-Start ist `ready`, versuchter
und wirksamer Modus `SEMANTIC`, `labelSettlement=complete`,
`labelModelAccepted=true`, zwei Einträge. Client-Wartezeit 7 585 ms.
Keine internen Label-Job-/Inferenzzeiten aus der API verfügbar; kein
Warm-Median aus einem einzelnen Auftrag und kein PCAP-Nachweis in dieser Probe.

Das bestehende Live-Profil erzeugt 500 Ankünfte mit 90-s-Rampe und Reveal
bei 270 s innerhalb des 330-s-Fensters; keine Aussage über konstant
500 gleichzeitige Clients. Alle 1 600 Aktionen ohne Fehler abgeschlossen.

| Live-Aktion | Anzahl | p95 ms |
| ----------- | -----: | -----: |
| Beitritt    |    500 |  46,20 |
| Quizstimme  |    500 |  37,64 |
| QA-Beitrag  |    100 |  14,92 |
| Blitzlicht  |    500 |  10,31 |

App-Ressourcenmessung vollständig: 166 RSS-Stichproben,
maximal summierte Prozess-RSS 558 292 992 Bytes, maximaler App-CPU-Wert
52,32 % einer CPU. Summierte RSS kann gemeinsam genutzte Seiten mehrfach
enthalten. App und Runtime vor/nach dem Messfenster gesund, keine Neustarts
und keine OOM-Kills; Runtime-Image unverändert.

## Eingriff und Rücknahme

Journal auf llm-host: temporäre Freigabe um 20:19:30 UTC:

```bash
sudo ufw insert 1 allow in on br-1b-s1 proto tcp from 172.31.150.0/24 to 192.168.150.20 port 8080 comment arsnova-1b-s1
```

Kernelregel unmittelbar bestätigt (`verified-s1-firewall`). Rücknahme
um 20:25:57 UTC:

```bash
sudo ufw --force delete allow in on br-1b-s1 proto tcp from 172.31.150.0/24 to 192.168.150.20 port 8080 comment arsnova-1b-s1
```

Wiederherstellungslog bestätigt Löschung der Regel und des temporären
S1-Stacks sowie normalen Runtime-Neustart mit bestandenen Prüfungen.
Ursprüngliche App separat geprüft, ebenfalls bestanden.
`restored=true`, `checksPassed=true`, `originalAppChecksPassed=true`.
Das Budget der ursprünglichen App bleibt bei 90 000 ms; der S1-Stack
verwendet seine eigene Konfiguration. Erfolgreiche Rücknahme entfernt
private temporäre env-Datei und Lease, behält die eigenen S1-Volumes.

## Einordnung und nächster Schritt

Die Probe bestätigt den neuen Laborpfad einschließlich echter Label-Antwort,
Live-Messfenster und Wiederherstellung. Sie zählt wegen Entwicklungsstand
und Einzelauftrag nicht zum gewerteten S1-Vergleich und beantwortet H2 nicht.

Vor den gewerteten Reihen S1-Werkzeuge und Dokumentation regulär committen.
Danach je drei Label- und Summary-Aufträge, getrennt freigeben und ohne
`--arbeitsstand` auf diesen Commit pinnen. Keine weitere Entwicklungsprobe
bei unverändertem Pfad erforderlich.

Vergleichsgrenzen bleiben: S1 bündelt App und Runtime in 8 vCPU/10 GiB,
Zwei-Host verwendet 2+8 vCPU/4+10 GiB. Auch Treiberplatzierung und teils
Versionen/Settings unterscheiden sich. HTTP bleibt auf der privaten IP
desselben Hosts; kein Unix-Socket-Vergleich. Daraus folgt ein beschreibender
Konsolidierungsvergleich, kein ressourcengleicher kausaler Topologienachweis.
