# Aufgabe 1A - Ressourcenisolation auf dem Anwendungshost

## Übersicht

Aufgabe 1A untersucht, wie sich die optionale spaCy-Analyse auf die Ressourcen und Live-Aktionen des Anwendungshosts auswirkt.
Im Mittelpunkt stehen Beitritt, Quizstimme, Q&A-Einreichung und Tempostimme beziehungsweise Blitzlicht.
Dafür vergleichen wir dieselbe Live-Last ohne Analyse, mit lexikalischer Analyse sowie mit normalem, CPU-gedrosseltem und gezielt verzögertem spaCy-Pfad.
Wir ergänzen reproduzierbare Testdaten und Messwerkzeuge und untersuchen damit einen festgehaltenen, unveränderten Anwendungsstand.
Hypothesen, Lastprofil, Wiederholungen und Grenzwerte werden vor den Messungen festgelegt.
Aus den Messungen soll anschließend eine begründete Betriebsentscheidung entstehen: spaCy unter den untersuchten Bedingungen zulassen oder mit `NLP_ENABLED=false` bei der lexikalischen Wortwolke bleiben.

**Stand: 15.11.2026 — Schritte 1–7 technisch umgesetzt; persönliche Abgabefreigabe und PR-Merge noch offen.**
**Grundlage:** [Umsetzungsplan](./1A-umsetzungsplan.md), [Versuchsvertrag](./1A-experiment-contract.md) und [aktueller Nachtrag](./specs/2026-11-14-1a-messreihe-main-a19ca70f.md).
**Dateiangaben:** »Neu« und »bearbeitet« beziehen sich auf den jeweiligen Umsetzungsschritt, nicht auf den aktuellen Git-Status.

Alle folgenden Befehle gelten für das Repository-Wurzelverzeichnis mit installierten Projektabhängigkeiten; vor CLI-Aufrufen die Node-Version auswählen und Shared-Types bauen:

```bash
nvm use
npm run build -w @arsnova/shared-types
```

---

## 1 Versuchsvertrag festhalten

### 1.1 Übersicht

Vor der Implementierung wurden Fragestellung, Hypothesen, Gegenalternative und Entscheidungsregeln dokumentiert.
Der Vertrag legt fünf Pflichtvarianten, fünf Wiederholungen je Variante und ein gemeinsames Lastprofil fest.
Zu den Regeln gehören je Live-Aktion höchstens 10 % und zugleich höchstens 50 ms p95-Anstieg gegenüber V1 sowie eine Fehlergrenze von 0,5 %.
Die zunächst offene Labor- und Baseline-Auswahl wurde vor den Messungen in Schritt 6 auf den eigenen Rechner und einen konkreten Fork-`main`-Commit festgelegt, ohne die Schwellen zu ändern.

### 1.2 Änderungen am Projekt

- [docs/referat-thema-1/1A-experiment-contract.md](./1A-experiment-contract.md) — **neu, später in Schritt 6 bearbeitet:** Verbindlicher Versuchsvertrag mit Hypothesen, Daten, Lastprofil, Grenzwerten, Nachweisanforderungen und Rückweg zur Baseline.
- [docs/referat-thema-1/1A-umsetzungsplan.md](./1A-umsetzungsplan.md) — **neu:** Hält die sieben Umsetzungsschritte und den aktuellen technischen Abschlussumfang fest.
- [docs/referat-thema-1/README.md](./README.md) — **bearbeitet:** Verlinkt den Versuchsvertrag im Themenordner.

### 1.3 Durchführung

```bash
npx prettier --check docs/referat-thema-1/1A-experiment-contract.md
```

Prüft die Formatierung des Vertrags; die fachlichen Regeln müssen zusätzlich mit Auftrag und späteren Laufmanifesten abgeglichen werden.
Dieser Dokumentationsschritt führt noch keine Lastmessung durch.

---

## 2 Gemeinsame Fixture reproduzierbar bereitstellen

### 2.1 Übersicht

Die sechs bestehenden Referenzfragen aus [libs/shared-types/src/moderation-prompt-context-fixtures.ts](../../libs/shared-types/src/moderation-prompt-context-fixtures.ts) wurden wiederverwendet und um Gegenfälle sowie deterministische Füllfragen ergänzt.
Die A1-Projektion enthält 500 analysierbare Fragen und drei zusätzliche Ausschlusskontrollen mit den Status `PENDING`, `ARCHIVED` und `DELETED`.
Die Teilnehmerbezugsgröße der Analysefixture beträgt 200 und ist von den 500 geplanten Live-Beitritten unabhängig.
Seed und SHA-256-Hash machen die Eingaben vergleichbar; die ursprüngliche Referenzfixture für die anderen Teilaufgaben bleibt erhalten.
Die Fixture-Erzeugung arbeitet offline, während der Import in getrennte Laborsessions erst in Schritt 6 erfolgt.

### 2.2 Änderungen am Projekt

- [scripts/load/lib/resource-isolation-fixture.mjs](../../scripts/load/lib/resource-isolation-fixture.mjs) — **neu:** Erzeugt die gemeinsame Fixture und ihre A1-Projektion und berechnet deren kanonischen Inhaltshash.
- [scripts/load/resource-isolation-fixture.mjs](../../scripts/load/resource-isolation-fixture.mjs) — **neu:** CLI zum Validieren und Ausgeben der Fixture ohne Datenbank oder Netzwerk.
- [scripts/load/fixtures/resource-isolation-v1.manifest.json](../../scripts/load/fixtures/resource-isolation-v1.manifest.json) — **neu:** Speichert Version, Standardseed und erwarteten Hash als Referenz für Regressionstests.
- [scripts/load/lib/resource-isolation-fixture.test.mjs](../../scripts/load/lib/resource-isolation-fixture.test.mjs) und [scripts/load/resource-isolation-fixture.test.mjs](../../scripts/load/resource-isolation-fixture.test.mjs) — **jeweils neu:** Prüfen Referenzdaten, Gegenfälle, Projektion, Schema-Verträglichkeit, Reproduzierbarkeit und tatsächliche CLI-Ausgaben.
- [docs/referat-thema-1/1A-fixture.md](./1A-fixture.md) — **neu:** Beschreibt Inhalt, Grenzen, Hashbildung und Nutzung der gemeinsamen Testdaten.
- [package.json](../../package.json) — **bearbeitet:** Ergänzt Fixture- und Testbefehle und bindet die Tests in `npm test` und `test:coverage` ein.
- [docs/TESTING.md](../TESTING.md) und [docs/referat-thema-1/README.md](./README.md) — **jeweils bearbeitet:** Dokumentieren Testaufrufe und verlinken die Fixture-Anleitung.

### 2.3 Durchführung

```bash
npm run load:resource-isolation:fixture -- --validate
npm run load:resource-isolation:fixture:test
node scripts/load/resource-isolation-fixture.mjs --print > /tmp/arsnova-1a-fixture.json
```

Validiert die Standardidentität, führt die Fixture-Tests aus und schreibt bei Bedarf die vollständigen synthetischen Eingaben außerhalb des Repositories.
Dabei werden weder Sessions angelegt noch Lastversuche gestartet.

---

## 3 Live-Messungen in Artillery vervollständigen

### 3.1 Übersicht

Die vorhandenen Artillery-Aktionen wurden um Laufzeitstichproben und eine vollständige Ergebniszählung ergänzt.
Beitritt, Quizstimme, Q&A-Einreichung und Blitzlicht weisen erfolgreiche, fehlgeschlagene, übersprungene, offene und nicht gestartete Arbeit getrennt aus.
Erfolgs- und Fehlerlaufzeiten werden getrennt ausgewertet, einschließlich p50, p95 und p99.
Leere oder widersprüchliche Messungen können die ergänzten Prüfregeln nicht bestehen.
Das zugrunde liegende Profil bleibt eine Beitrittswelle und wird nicht als Nachweis für dauerhaft 500 gleichzeitig aktive Clients ausgegeben.

### 3.2 Änderungen am Projekt

- [scripts/load/artillery/processor.mjs](../../scripts/load/artillery/processor.mjs) — **bearbeitet:** Misst die Live-Aktionen im Lastgenerator und erfasst Ergebnisse sowie Fehlerklassen.
- [scripts/load/lib/artillery-live-messungen.mjs](../../scripts/load/lib/artillery-live-messungen.mjs) — **neu:** Berechnet Aktionszusammenfassungen, Perzentile, Abdeckung und Prüfregeln aus den Rohstichproben.
- [scripts/load/run-artillery-500.mjs](../../scripts/load/run-artillery-500.mjs) — **bearbeitet:** Übernimmt die neuen Messfelder in Report und Gates und beschreibt das tatsächliche Lastprofil.
- [scripts/load/run-artillery-reconnect-500.mjs](../../scripts/load/run-artillery-reconnect-500.mjs) — **bearbeitet:** Nutzt die ergänzte Beitrittsmessung auch im Reconnect-Pfad.
- [scripts/load/artillery/processor.test.mjs](../../scripts/load/artillery/processor.test.mjs) und [scripts/load/lib/artillery-live-messungen.test.mjs](../../scripts/load/lib/artillery-live-messungen.test.mjs) — **jeweils neu:** Prüfen echte Prozessoraufrufe gegen einen lokalen Testserver sowie Zählung, Fehlerfälle, Grenzwerte und Berichte.
- [docs/referat-thema-1/1A-live-messungen.md](./1A-live-messungen.md) — **neu:** Erklärt Messgrenze, Felder, Lastprofil und lokale Prüfung.
- [package.json](../../package.json) — **bearbeitet:** Registriert den Metriktestbefehl und nimmt ihn in die gemeinsamen Testabläufe auf.
- [docs/TESTING.md](../TESTING.md) und [docs/referat-thema-1/README.md](./README.md) — **jeweils bearbeitet:** Ergänzen die Befehle und die Verlinkung der Live-Messdokumentation.

### 3.3 Durchführung

```bash
npm run load:artillery:metrics:test
```

Prüft Messinstrumentierung und Fehlerbehandlung mit lokalen Testservern und synthetischen Stichproben.
Für den zeitlich festgelegten gemeinsamen A1-Lastversuch ist der Ablauf aus Schritt 6 maßgeblich, nicht allein der eigenständige Artillery-Runner.

---

## 4 Gezielte Analyse-Last hinzufügen

### 4.1 Übersicht

Ein eigener Lastgenerator ruft `wordCloud.analyzeQa` über den bestehenden tRPC-Client mit gültigen Host-Tokens auf.
Er verwendet fünf getrennte Analysesessions, damit die Sperre gegen parallele Analysen derselben Session den vorgesehenen Vergleich nicht verfälscht.
Über 300 Sekunden werden insgesamt 150 Termine mit `LEXICAL`, `LEMMA`, `refresh: true` und festem Korpus geplant.
Korpusinhalt und Revisionen werden vor und nach der Messung überprüft; Dauer, Normalisierung, Fallbackgrund und Fehler bleiben je Aufruf sichtbar.
Langsame oder ausgefallene Analysen werden nicht durch nachträgliche Aufrufserien ausgeglichen, sondern als offene, übersprungene oder fehlgeschlagene Arbeit erfasst.

### 4.2 Änderungen am Projekt

- [scripts/load/host-analyze-loop.mjs](../../scripts/load/host-analyze-loop.mjs) — **neu:** CLI und tRPC-Anbindung mit privater Sessionzuordnung, Host-Autorisierung, Korpusprüfung und bereinigtem Report.
- [scripts/load/lib/host-analyze-loop.mjs](../../scripts/load/lib/host-analyze-loop.mjs) — **neu:** Implementiert den festen Zeitplan, Ergebniszählung und begrenztes Auslaufen noch laufender Anfragen.
- [scripts/load/host-analyze-loop.test.mjs](../../scripts/load/host-analyze-loop.test.mjs) und [scripts/load/lib/host-analyze-loop.test.mjs](../../scripts/load/lib/host-analyze-loop.test.mjs) — **jeweils neu:** Prüfen unter anderem Autorisierung, Korpusänderungen, langsame Antworten, Fehler und Signalabbrüche.
- [docs/referat-thema-1/1A-analyse-last.md](./1A-analyse-last.md) — **neu:** Dokumentiert Sessionzuordnung, Zeitplan, Analyseparameter und Interpretation der Ausgaben.
- [package.json](../../package.json) — **bearbeitet:** Ergänzt Analyse- und Testbefehle sowie deren Einbindung in die gemeinsamen Testabläufe.
- [docs/TESTING.md](../TESTING.md) und [docs/referat-thema-1/README.md](./README.md) — **jeweils bearbeitet:** Beschreiben die neuen Prüfungen und verlinken die Anleitung.

### 4.3 Durchführung

```bash
npm run load:resource-isolation:analysis -- --validate
npm run load:resource-isolation:analysis:test
```

Zeigt Fixture und Standardzeitplan ohne Anwendungskontakt und prüft den Generator mit kontrollierter Uhr beziehungsweise lokalem tRPC-Testserver.
Für einen eigenständigen Laborlauf müssen zuvor fünf passende Sessions und eine private Zuordnungsdatei gemäß [Analyseanleitung](./1A-analyse-last.md) existieren:

```bash
REPORT_FILE=/tmp/arsnova-1a-analyse.json \
JUNIT_FILE=/tmp/arsnova-1a-analyse.xml \
npm run load:resource-isolation:analysis -- \
  --run --sessions-file /tmp/arsnova-1a-analysesessions.json
```

---

## 5 Container-Metriken und kontrollierte Störung ergänzen

### 5.1 Übersicht

Ein lesender Collector erfasst Docker-Statistiken, cgroup-v2-Zähler und ausgewählte Hostwerte als Zeitreihe.
Fehlende Daten, ausgelassene Abtastungen und Containerwechsel bleiben ausdrücklich erkennbar.
Docker-Speicheranzeige, cgroup-Speicher und Lebenszeit-Spitzenwerte werden getrennt behandelt.
Ein Laborproxy verzögert bei V4 die Weiterleitung von `/normalize` um 6000 ms und überschreitet damit das unveränderte Client-Timeout von 5000 ms.
Die Werkzeuge ändern keine Produktionskonfiguration; ihre gemeinsame Steuerung erfolgt in Schritt 6.

### 5.2 Änderungen am Projekt

- [scripts/load/lib/container-metrics.mjs](../../scripts/load/lib/container-metrics.mjs) — **neu:** Liest Docker API, cgroup v2 und Hostwerte und berechnet generationstreue Differenzen und Speicherzusammenfassungen.
- [scripts/load/container-metrics.mjs](../../scripts/load/container-metrics.mjs) — **neu:** CLI für eine konfigurierte Zeitreihe mit JSON-/JUnit-Ausgabe und Abbruchbehandlung.
- [scripts/load/lib/container-metrics.test.mjs](../../scripts/load/lib/container-metrics.test.mjs) — **neu:** Prüft unter anderem Metrikverfügbarkeit, Einheiten, Zählerdifferenzen, Containerwechsel und zeitliche Abtastung.
- [scripts/load/spacy-delay-proxy.mjs](../../scripts/load/spacy-delay-proxy.mjs) — **neu:** Implementiert die kontrollierte Weiterleitungsverzögerung über lokale Unix-Sockets und behandelt Clientabbrüche.
- [scripts/load/spacy-delay-proxy.test.mjs](../../scripts/load/spacy-delay-proxy.test.mjs) — **neu:** Prüft Transport, Timeout, Fehler und Beendigung des Proxys einschließlich des tatsächlichen 5000-/6000-ms-Vertrags.
- [docs/referat-thema-1/1A-container-metriken-und-proxy.md](./1A-container-metriken-und-proxy.md) — **neu:** Beschreibt Laborzugriff, Messgrößen, Einschränkungen und Bedienung beider Werkzeuge.
- [package.json](../../package.json) — **bearbeitet:** Registriert Collector, Proxy und Infrastrukturtests und bindet die Tests in die gemeinsamen Testabläufe ein.
- [docs/TESTING.md](../TESTING.md) und [docs/referat-thema-1/README.md](./README.md) — **jeweils bearbeitet:** Dokumentieren Prüfung und Verwendungszweck.

### 5.3 Durchführung

```bash
npm run load:resource-isolation:metrics -- --validate
npm run load:resource-isolation:delay-proxy -- --validate
npm run load:resource-isolation:infrastructure:test
```

Die Validierungen benötigen keine Container; die Tests verwenden synthetische Docker-/cgroup-Daten und lokale Unix-Sockets.
Für reale cgroup-Werte muss der Collector auf dem Linux-Dockerhost dessen `/proc`- und cgroup-v2-Dateisystem lesen können; einen vorbereiteten Laborlauf beschreibt die [Infrastrukturanleitung](./1A-container-metriken-und-proxy.md).

---

## 6 Aktuelle Versuchsreihe ausführen

### 6.1 Übersicht

Die Anwendung wurde unverändert aus main `a19ca70ff37dcb5510a77ab2745c06b70ccc3565` gebaut.
Ein passender neuer Vorlauf und fünf randomisierte V0–V4-Blöcke sind vollständig erfasst.
Der Runner speichert für jede Phase echte bereinigte Compose-Aufnahmen und Ressourcenzeitreihen.
[Labor und Varianten](./1A-versuchsreihe.md) beschreiben den Aufbau;
[Auswertung](./1A-auswertung.md) ist die maßgebliche Quelle für Rechner, Messzahlen und Ergebnis.

### 6.2 Änderungen am Projekt

- **Neu:** `scripts/load/run-resource-isolation.mjs` und `scripts/load/lib/resource-isolation-experiment.mjs`.
  Sie orchestrieren getrennte Sessions, Last, Varianten und überprüften Rückweg.
- **Neu:** `scripts/load/resource-isolation-live.mjs`. Führt Live-Last als steuerbaren Unterprozess aus.
- **Neu:** `scripts/load/lib/resource-isolation-series.mjs` und `resource-isolation-compose.mjs` im selben Ordner.
  Sie binden den Vorabnachtrag und bereinigen beziehungsweise prüfen Compose-Aufnahmen.
- **Neu:** `specs/2026-11-14-1a-messreihe-main-a19ca70f.json` und zugehöriger Markdown-Nachtrag.
  Sie legen die aktuelle Baseline einschließlich PDF-Worker mit 256 PIDs fest.
- **Neu:** `evidenz/1A/reihe-main-a19ca70f-20261115-122547/`. Enthält die einzige aktuelle vollständige Reihe samt eigenem Vorlauf.

### 6.3 Durchführung

```bash
npm run load:resource-isolation:experiment -- --validate
npm run load:resource-isolation:experiment:test
```

Für echte neue Messungen gilt die [vollständige Anleitung](./1A-neue-messreihe.md).
Vorlauf und Hauptmessung müssen dieselbe private Konfigurationsdatei verwenden.
Die Hauptreihe benötigt mindestens 150 Minuten zuzüglich Vorlauf und Aufbau-/Rückwegzeiten.

### 6.4 Ergebnisse finden

Der [Evidenzindex](./evidenz/1A/README.md) führt zu Laufplan, Abschluss, Rohzeiten,
Analysen, 50 Ressourcenartefakten und 50 Compose-Aufnahmen. Vorlauf und Aufwärmung
werden getrennt von den 25 Messfenstern ausgewertet. Ältere A1-Reihen und
abgebrochene Anläufe sind aus dem Arbeitsbaum entfernt; sie bleiben über Git nachvollziehbar.

## 7 Auswertung und Abgabeentwürfe aktualisieren

### 7.1 Übersicht

Alle Vergleiche wurden aus erfolgreichen Rohstichproben je Lauf nach den vorab
festgelegten Regeln berechnet. Grenzverletzungen werden nicht entfernt oder gemittelt.
Die [Betriebsentscheidung](./1A-auswertung.md) begründet die lexikalische Alternative
und grenzt die Aussage gegenüber Rendering, LLM-Tragfähigkeit und Produktionskapazität ab.
Handout, Folien und Grafiken werden ausschließlich aus der aktuellen Auswertung erzeugt.

### 7.2 Änderungen am Projekt

- **Neu/bearbeitet:** `scripts/load/evaluate-resource-isolation.mjs` und zugehörige Tests.
  Prüfen vollständige Nachweise, Integrität, aktuelle Reihendefinition und alle Leistungsregeln.
- **Neu/bearbeitet:** `scripts/load/render-resource-isolation-pdfs.mjs`, Tests und `abgabe/vorlagen/`.
  Bauen nachvollziehbare vierseitige Handout- und neunseitige Folienentwürfe aus aktuellen Werten.
- **Neu/bearbeitet:** `abgabe/` mit PDFs, HTML, Grafiken und Quellenmanifest.
  Enthält die aktuellen erzeugten Abgabeentwürfe.
- **Bearbeitet:** `1A-auswertung.md`, `1A-eigenanteil.md`, `1A-abschluss-und-uebergabe.md` und `1A-pr-beschreibung.md`.
  Trennen Messergebnis, agentengestützten Beitrag, persönliche Freigabe und tatsächlichen Merge.
- **Bearbeitet:** `.prettierignore`. Verhindert die Umformatierung hashgebundener Roh-JSON-Dateien.
- **Entfernt:** alte A1-Evidenzordner und `scripts/load/reconstruct-resource-isolation-compose.mjs`.
  Die aktuelle Reihe enthält Originalaufnahmen und benötigt keine historische Rekonstruktion.

### 7.3 Durchführung

```bash
npm run load:resource-isolation:evaluation:test
npm run load:resource-isolation:evaluate -- \
  --run \
  --evidence-root docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-20261115-122547 \
  --output-dir /tmp/arsnova-1a-abschluss-gegenpruefung
npm run load:resource-isolation:documents
```

Der Ausgabeordner muss neu sein. Die [Prüfunterlage](./1A-pruefstand.md) dokumentiert
aktuell ausgeführte Prüfungen sowie den bekannten ursprünglichen Frontend-Testfehler.
Produktivdateien und dieser sachfremde Test bleiben unverändert.
Persönliche Gegenprüfung, Abstimmung mit 1B/1C und tatsächlicher GitHub-Merge bleiben
getrennte Punkte der [Übergabe](./1A-abschluss-und-uebergabe.md).
