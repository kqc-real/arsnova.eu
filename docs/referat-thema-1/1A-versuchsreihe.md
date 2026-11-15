# A1 – Aktuelle Versuchsreihe und Laboraufbau

Stand: 15.11.2026. Die einzige aktuelle Reihe ist
[reihe-main-a19ca70f-20261115-122547](./evidenz/1A/reihe-main-a19ca70f-20261115-122547/). Die
[Auswertung](./1A-auswertung.md) enthält Befunde, Laborgrenzen und Betriebsentscheidung;
die [Ausführungsanleitung](./1A-neue-messreihe.md) enthält die vollständige Befehlsfolge.

## Baseline und Versuchsvertrag

Die Anwendung wurde unverändert aus Fork-main `a19ca70ff37dcb5510a77ab2745c06b70ccc3565` gebaut.
Der [Vorabvertrag](./1A-experiment-contract.md) bestimmt Hypothesen und Schwellen;
der [datierte Nachtrag](./specs/2026-11-14-1a-messreihe-main-a19ca70f.md)
legt die aktuelle Baseline und das übernommene PDF-Worker-Limit von 256 PIDs fest.
Die [Reihendefinition](./specs/2026-11-14-1a-messreihe-main-a19ca70f.json)
bindet diese Quellen. Vertrag und Nachtrag werden nach der Messung nicht umgeschrieben.

## Aufbau und konstante Bedingungen

App, PostgreSQL, Redis und PDF-Worker laufen im eigenen Compose-Projekt `arsnova-1a`.
V2–V4 starten zusätzlich spaCy. Ports binden nur an Loopback; geheime Laborwerte
bleiben außerhalb des Repositories. NLP-Klassifikation, Encoder, Summary und LLM sind aus.
Generator und Dienste teilen denselben WSL2-Rechner; tatsächliche Hardware und Images
stehen in jedem Laufmanifest. CPU-Limits sind Obergrenzen, keine Reservierungen.

| Variante | Analyse                                                              |
| -------- | -------------------------------------------------------------------- |
| V0       | Keine Analyse, spaCy aus                                             |
| V1       | Lexikalische Analyse, spaCy aus                                      |
| V2       | LEMMA; spaCy 1 CPU, 1 GiB, 64 PIDs                                   |
| V3       | Wie V2, spaCy 0,25 CPU                                               |
| V4       | Wie V2, 6000 ms Weiterleitungsverzögerung bei 5000 ms Client-Timeout |

Fünf gepaarte randomisierte Blöcke mit Seed `438314513` ergeben 25 Läufe.
Je Lauf: 60 Sekunden Aufwärmung und 300 Sekunden Messfenster mit 500 geplanten
Beitritten, 500 Quiz-, 100 Q&A- und 500 Tempostimmen. Fünf getrennte Analysesessions
liefern insgesamt 150 geplante Analysen je Messfenster. Live-Fragen verändern den
statischen Analysekorpus nicht. V5 war optional und wurde nicht ausgeführt.

## Erfassung und Rückweg

Der Runner speichert vor jeder Phase eine bereinigte tatsächliche Compose-Auflösung
und gleicht sie gegen den wirksamen Dienstzustand ab. Beide Phasen erhalten eigene
Dateien und Hashreferenzen. Ressourcen werden alle zwei Sekunden erfasst.
Fehlende Daten, Containerwechsel und zurückgesetzte Zähler werden nicht als Nullwerte ausgelegt.
Nach jeder Variante werden NLP-deaktivierte Baseline, direkter Socket, Limits,
lexikalische Analyse und Live-Beitritt geprüft. Der passende vollständige Vorlauf
ist vor der Hauptreihe verpflichtend; Änderungen an Werkzeugen oder Images benötigen einen neuen Vorlauf.

Der [Evidenzindex](./evidenz/1A/README.md) erklärt Dateien und Integrität.
Alte und abgebrochene Reihen sowie die frühere Compose-Rekonstruktion wurden beim
Clean-up entfernt. Die aktuelle Reihe benötigt keine nachträgliche Rekonstruktion.
