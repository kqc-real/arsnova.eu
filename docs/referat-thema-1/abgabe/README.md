# A1-Abgabeentwürfe und reproduzierbarer Dokumentbau

- [Handout als PDF](./1A-handout.pdf): vier DIN-A4-Seiten; der tatsächliche
  PDF-Wortumfang steht im [Manifest](./manifest.json) und wird auf 350–1.800 geprüft.
- [Folien als PDF](./1A-folien.pdf): neun Folien im Format 16:9.
- [Handout als HTML](./1A-handout.html) und [Folien als HTML](./1A-folien.html):
  portable Leseansichten mit eingebetteten Grafiken.
- [Handout-Vorlage](./vorlagen/handout.html) und
  [Folienvorlage](./vorlagen/folien.html): bearbeitbare Quellen; Zahlen werden
  beim Bau aus der maschinenlesbaren Auswertung eingesetzt.
- [Grafiken](./grafiken/): mit Chart.js aus den fünf Einzelwiederholungen
  gezeichnete PNG-Dateien für Live-p95, spaCy-Speicher und CPU-Drosselung.

## Voraussetzungen und Bau

Node aus `.nvmrc`, installierte Projektabhängigkeiten und ein lokal installiertes
Playwright-Chromium werden benötigt. Verwendet werden die im Projekt bereits
vorhandenen Pakete Playwright, Chart.js, pdf-parse und Prettier; es werden keine
externen Webseiten oder KI-Bilder zum Dokumentbau geladen.

```bash
nvm use
npm run load:resource-isolation:documents
```

Der Befehl liest `evidenz/1A/reihe-main-a19ca70f-20261115-122547/auswertung/auswertung.json`, ersetzt belegte Werte
in den Vorlagen, baut Grafiken, HTML und PDFs und aktualisiert `manifest.json`.
Die erzeugten Dateien dieses Ordners werden dabei bewusst erneuert; die
Rohmessungen bleiben unverändert. Fehlende Belege, Seitenüberläufe, falsche
Seitenzahlen oder ein Handout außerhalb des Wortumfangs führen zum Fehler.
Für die Vorlagen gelten genau die dokumentierten Befunde dieser Reihe;
abweichende Hypothesen- oder Transportergebnisse erfordern eine inhaltliche
Überarbeitung statt automatischer Wiederverwendung der Schlussfolgerungen.

Falls Chromium lokal fehlt, steht im Projekt `npm run playwright:install` zur
Verfügung; der Download gehört zur Vorbereitung, nicht zur Lastmessung.

## Prüfung und Herkunft

Das Manifest enthält Prüfsummen für Auswertungsdatei, Renderer, Vorlagen,
Grafiken, HTML und PDFs sowie die tatsächlich gelesenen PDF-Seitenzahlen und
Wortanzahlen. PDF-Metadaten wie Erstellungszeit können bei erneutem Bau andere
Dateibytes erzeugen; eine unveränderte fachliche Auswertung garantiert daher
keine byteidentischen PDF-Dateien.

Die Quellenangaben im Handout verweisen auf Prüfungsspezifikation, eingefrorenen
Versuchsvertrag, ADR-0035 und eigene Messnachweise. Die
[Betriebsentscheidung](../1A-auswertung.md) erläutert alle Befunde und Grenzen;
der [Eigenanteilsnachweis](../1A-eigenanteil.md) grenzt menschlichen Auftrag,
gemeinsame Artefakte und agentengestützte Ausführung ab.

## Aktuelle Evidenz und persönliche Prüfliste

Die Vorlagen und erzeugten Dateien verwenden ausschließlich die Messung vom
15.11.2026. Sie berücksichtigen die absoluten Verletzungen in V3/Block 5 und
zeitgenössische Compose-Aufnahmen. Das Diagramm zeigt sämtliche Quiz-p95-Werte,
einschließlich des erhöhten V3-Werts, ohne Abschneiden bei der früheren Skala.
Die [Abschluss-/Übergabeunterlage](../1A-abschluss-und-uebergabe.md) trennt
persönliche Freigabe und gemeinsame Abstimmung von technischen Nachweisen.

## Vor persönlicher Abgabe

Die Dateien sind **Entwürfe**, keine Erklärung einer bereits erfolgten
persönlichen Gegenprüfung oder institutionellen Freigabe. Niklas muss die
Rechnung und Entscheidung fachlich vertreten, Eigenanteil und KI-Kennzeichnung
prüfen sowie die aktuellen Zitierregeln und den erlaubten KI-Umfang anhand
des Prüfungsauftrags beziehungsweise myCampus bestätigen. Empfänger,
Dateibenennung und Abgabetermin richten sich nach dem tatsächlichen
Prüfungsauftrag; diese Angaben werden hier nicht erfunden.
