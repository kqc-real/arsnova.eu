# Abgebrochene Label-Normalprobe, 2026-11-16

Prüfung durch den Autor: offen.

## Umgebung und Quellen

Niklas hat die freigegebene Label-Entwicklungsprobe mit einem Auftrag und
Live-Last auf `2b39b9dfc13aefd763fa4e0d8440a0536fa847f7` ausgeführt.
Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
Die VMs waren nach einem Rechnerneustart wieder gestartet und geprüft worden.
VM-Node meldet v22.23.5; die Abweichung von Node 24 aus Issue #9 bleibt offen.

Lauf-ID `20261116T093430-dev-normal-label`, lokal etwa 10:34–10:37 Uhr MEZ.
Die Probe bricht ab und ist kein gewerteter Nachweis, auch kein vollständiges
Live-Fenster. Kein Ergebnis-JSON wurde erzeugt oder ins Repo übernommen.

Quellen bleiben lokal:

- Windows: `%USERPROFILE%\labor-1b\log-lauf-20261116T103416.txt`.
- app-host: `~/labor-1b/20261116T093430-dev-normal-label/`, insbesondere
  `treiber.log`, `label-setup.log`, `effective-settings.json`,
  `wiederherstellung.json` und beide `pruefen-*.txt`.
- Wordcloud-Telemetrie im App-Container zwischen 09:36:50 und 09:37:03 UTC.
  PCAPs und Tokens bleiben außerhalb des Repos.

## Gesicherte Beobachtungen

Der Encoder wurde gebaut und als gesund gestartet; Image-ID
`sha256:95385bb591cbaefa544b199b16099aa3acc4433e448ead4a920b8cf9d43d969c`.
Die App wurde danach neu erstellt und gesund gemeldet. SEMANTIC bleibt aktiv,
der Encoder bleibt gestartet. Eine erneute Rücknahme auf die frühere
Summary-Konfiguration wurde nicht durchgeführt.

Der Treiber legt das Szenario an und beginnt um 09:37:00 UTC den Auftrag.
`labelOperation` bricht ab, weil `labelSettlement` fehlt oder `disabled` ist.
Die alte Fehlermeldung nennt pauschal „Label-Pfad nicht aktiv“, speichert aber
den zurückgegebenen Analysestatus nicht. Der sichtbare Exitcode 1 allein
erklärt die zugrunde liegende Semantic-Antwort nicht.

Die vorhandene App-Telemetrie zeigt: `mode=SEMANTIC`, drei Korpuselemente,
9 ms Dauer, `encoderCalled=false`, `labelSettlement=null`,
`labelModelCalled=false`, `labelModelAccepted=false`.
Der Label-Aufruf wurde damit nicht als ausgeführte LLM-Phase bestätigt.
`encoderCalled=false` ist ein Telemetriefeld, kein Transportmitschnitt des
Unix-Sockets; ein fehlgeschlagener Encoder-Versuch ist damit nicht ausgeschlossen.

`wiederherstellung.json` bestätigt `restored=true, checksPassed=true`.
Beide VM-Nachprüfungen bestehen. Diese Wiederherstellung bedeutet hier gesunde
Dienste nach dem Abbruch, nicht Deaktivierung des bereits eingerichteten Encoders.

## Lesende Diagnose nach dem Abbruch

Alle VM-Zugriffe liefen über `labor-wsl.sh vm app`, ohne erneuten Messlauf.

- App und Encoder gesund, beide Prozesse mit UID/GID 1000; gemeinsamer Socket
  vorhanden und für diesen Benutzer zugänglich.
- App-Laufzeit meldet `WORD_CLOUD_SEMANTIC_ENABLED=true`,
  `OPEN_WEIGHT_LLM_ENABLED=true`, Encoder-Socket am erwarteten Pfad.
- Tatsächlicher Encoder-Timeout im App-Container 120 000 ms durch Compose.
  Die aus `.env.production` erfassten Settings nennen dagegen 8 000 ms.
  Diese Abweichung muss vor gewerteten Label-Messungen im Manifest geklärt
  werden; erfasste Dateiwerte allein belegen hier nicht die Laufzeitkonfiguration.
- Lesender GET `/health` über den Unix-Socket aus der App liefert HTTP 204.
  Das bestätigt aktuelle Erreichbarkeit, keinen erfolgreichen Embed-Auftrag
  und keine Erklärung des vorangegangenen Fallbacks.
- Aus diesen Beobachtungen folgt keine bewiesene Fehlerursache. Insbesondere
  ist „Encoder nicht installiert“ durch das Setup-Log widerlegt.

## Diagnoselücke im Labortreiber und nächster Versuch

Der Labortreiber gibt vor seinem Abbruch künftig ausschließlich Statusfelder
aus: Analysestatus, angeforderter/effektiver Modus, Fallback-Flag,
Label-Settlement, Vorhandensein einer Encoder-Modellversion sowie Zählwerte.
Keine Einträge, Quelltexte, IDs, Antwortobjekte oder Tokens im Fehlerprotokoll.
Die Abbruchbedingung bleibt bestehen; ein fehlender Label-Nachweis wird nicht
in einen Erfolg umgedeutet. Produktionscode bleibt unverändert.

Der Regressionstest für diese Diagnoselücke war vor der Änderung rot.
Danach bestehen die acht ausgewählten Auftrags-/Auswertungstests mit
`node --test --test-isolation=none` unter lokalem Node 24.18.0.
Das behebt die Fehlermeldung, nicht die weiterhin offene Semantic-Ursache.

Vorgeschlagen ist eine erneute, separat freizugebende Entwicklungsprobe mit
`dev-normal-label-diagnose` und `--arbeitsstand`, damit die zusätzliche Diagnose
tatsächlich in die VM gelangt. Keine neue Probe wurde gestartet.
