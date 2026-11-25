# S1-Same-Host-Vergleich Label, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Gewertete S1-Reihe mit drei Label-Aufträgen auf regulärem Commit
`4b135fe8468e07cff06be986f28d4d75dedf236b`, ohne `--arbeitsstand`.
Die [Entwicklungsprobe](2026-11-16-lauf-dev-s1-label.md) bleibt separat und
wird nicht mitgewertet.

- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne physisches CPU-Pinning, Energieschema
  Ausbalanciert (`381b4222-f694-41f0-9685-ff5bb260df2e`).
- S1: App-Stack, Runtime, Treiber und Collector auf llm-host mit
  8 vCPU/10 GiB; im Gast 10 426 224 640 Bytes RAM sichtbar.
  App-Dienste auf virtuellen CPUs 0–1, Encoder mit zwei CPUs.
  Ursprüngliche App-VM mit 2 vCPU/4 GiB bleibt erhalten.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T203745-s1-label`, lokal etwa 21:37–21:57 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-s1-label.json.gz), bytegleich mit
  lokalem Ergebnis. Rohdaten unter
  `%USERPROFILE%\labor-1b\20261116T203745-s1-label\`.
- Zwei-Host-Normalreferenz auf demselben Rechner, Commit
  `7c64dd6a0352df1e51981ab16300532eb849f712`, insgesamt 30 Aufträge:
  [Teil 1](messung/2026-11-16-lauf-normal-label-01.json.gz),
  [Teil 2](messung/2026-11-16-lauf-normal-label-02.json.gz),
  [Teil 3](messung/2026-11-16-lauf-normal-label-03.json.gz).

Alle Zahlen gelten für diesen Rechner und die jeweils genannten Commits.
`buildS1Result` reproduziert den gespeicherten Ergebniskern aus lokalen
Quellen; Windows-Umgebung und Prüfung der ursprünglichen App werden danach
ergänzt. Quell- und tatsächliche Image-IDs aller fünf App-Dienste identisch.
App-/Worker-Image `sha256:978dd4633244d9f3a8ff71a86410000d352b6b03a0ef8f2c5b375d146dda142f`,
Runtime `sha256:3eee870ad9f016e3c0dc90dcbe93f31781758179f717a98b28735eb5587491a0`,
Modell-SHA-256 `3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597`.

## Design und Ausführung

Vorab [geplante S1-Reihe](../../1B/archiv/1B-3u4-Planung.md#nachtrag-2026-11-16-s1-vorbereitung-für-schritt-4):
keine zusätzlichen Live-Fehler, p95 je Aktion höchstens 110 % der
Zwei-Host-Normalreferenz. Ressourcen und Label-Ergebnisse mit erfassen;
wegen abweichender Kapazität nur beschreibender Konsolidierungsvergleich.

```bash
bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh s1 \
  -Commit 4b135fe8468e07cff06be986f28d4d75dedf236b \
  -LabN 3 -LabTag s1-label -LabAuftrag label \
  -LabTimeoutMs 300000 -LabLive
```

Fixture `label-identical-pair-v1`. Queue-/Summary-Client-Budget 300 000 ms,
Label-Client-Budget 30 000 ms, Encoder-Budget 120 000 ms. Summary,
Open-Weight-LLM und semantische Wortwolke aktiviert; NLP und QA-NLP aus.
Diese Settings und die erfassten Node-Versionen stimmen mit der Label-
Normalreferenz überein. Vorab authentifizierter Slot-Test aus dem S1-Container
bestanden. Kein neuer Produktionsbuild oder Modellwechsel.

## Ergebnisse

Alle drei Aufträge `ready`, versuchter und wirksamer Modus `SEMANTIC`,
`labelSettlement=complete`, `labelModelAccepted=true`, jeweils zwei Einträge.

| Auftrag | Client-Wartezeit ms | RSS-Stichproben | App max. RSS Bytes | App max. CPU % einer CPU |
| ------- | ------------------: | --------------: | -----------------: | -----------------------: |
| 1       |               7 638 |             166 |        588 939 264 |                    57,46 |
| 2       |               4 729 |             166 |        471 588 864 |                    47,38 |
| 3       |               4 820 |             166 |        453 566 464 |                    48,68 |

Erster Auftrag nach frischem Runtime-Start; Client-Zeit enthält den gesamten
beobachteten Aufrufpfad. Interne Label-Job-/Fallback-Zeiten nicht von der API
bereitgestellt. Keine Inferenz-/Transportzerlegung oder POST-Zählung aus S1
ableiten. RSS ist die Summe der Prozess-RSS und kann gemeinsame Seiten mehrfach
zählen. Ressourcenmessungen und alle drei Live-Fenster vollständig.

Live-Profil unverändert: pro Fenster 500 Ankünfte mit 90-s-Rampe,
Reveal bei 270 s, Fenster 330 s; keine konstant 500 gleichzeitigen Clients.
Alle 4 800 Aktionen ohne Fehler. p95 aus zusammengeführten Einzelzeiten,
keine Mittelung der Fenster-p95. Reproduziert mit `evaluateLiveComparison`
aus `experiment.mjs`: Referenzfenster aller drei Normalteile zusammengeführt,
Kandidat `s1.treiber.live`; strikten Manifestvergleich nicht gelockert.

| Aktion     | S1 Anzahl | Zwei-Host p95 ms | S1 p95 ms | Änderung | 10-%-Schwelle |
| ---------- | --------: | ---------------: | --------: | -------: | ------------- |
| Beitritt   |     1 500 |            38,64 |     47,60 | +23,20 % | überschritten |
| Quizstimme |     1 500 |            32,22 |     38,92 | +20,80 % | überschritten |
| QA-Beitrag |       300 |            15,79 |     14,54 |  −7,97 % | eingehalten   |
| Blitzlicht |     1 500 |            18,34 |     10,88 | −40,65 % | eingehalten   |

Fehlerkriterium erfüllt, gemeinsames Latenzkriterium nicht erfüllt.
Kein pauschaler Leistungsvorteil einer Topologie aus diesem gemischten Befund.

## Eingriff und Wiederherstellung

Für diesen Lauf relevante Journalzeilen: 20:37:52 UTC Freigabe und
Kernelbestätigung (`verified-s1-firewall`), 20:56:32 UTC Rücknahme.
Das kopierte Journal enthält zusätzlich frühere Zeilen der Entwicklungsprobe;
diese gehören nicht zur gewerteten Reihe.

```bash
sudo ufw insert 1 allow in on br-1b-s1 proto tcp from 172.31.150.0/24 to 192.168.150.20 port 8080 comment arsnova-1b-s1
sudo ufw --force delete allow in on br-1b-s1 proto tcp from 172.31.150.0/24 to 192.168.150.20 port 8080 comment arsnova-1b-s1
```

App und Runtime vor/nach Messung gesund, keine Neustarts und keine OOM-Kills.
Temporärer Stack und eigene Firewallregel zurückgenommen, normale Runtime
frisch gestartet und geprüft, ursprüngliche App separat erfolgreich geprüft.
`restored=true`, `checksPassed=true`, `originalAppChecksPassed=true`.
Private temporäre env-Datei und Lease entfernt, eigene S1-Volumes bleiben.

## Grenzen und Folge

S1 bündelt App/Runtime in 8 vCPU/10 GiB statt Zwei-Host mit
2+8 vCPU/4+10 GiB. App-CPU-Affinität, Treiber-/Collector-Platzierung und
Messumfang unterscheiden sich; physischer Host und seine Last sind geteilt.
Drei S1-Aufträge gegenüber 30 Referenzaufträgen, sequenzielle Erhebung,
keine kapazitätsgleiche oder statistisch abgesicherte Kausalbehauptung.
HTTP zur privaten IP auf derselben VM bleibt erhalten, kein Unix-Socket-Test.

S1-Label im vereinbarten Umfang ausgewertet. Als letzter geplanter
S1-Messlauf folgen drei Summary-Aufträge auf demselben regulären Commit,
mit deaktiviertem Encoder wie bei der Summary-Referenz, separat freizugeben.
Danach Betriebsaufwand und begründete Entscheidung für Schritt 4 ausarbeiten;
keine zusätzliche optionale Label-Reihe erforderlich.
