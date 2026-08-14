<!-- markdownlint-disable MD013 MD060 -->

# Lehrkonzept: Cloud Computing im Bachelor Informatik (36 UE)

**Modul:** `DSCC0127` · **Kurs:** `DSCC012701` · **Studienformat:** Duales Studium · **Formalia:** [IU-Formalia](./CLOUD-COMPUTING-IU-FORMALIA.md), [Referatsprüfung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md) · **Arbeitsmodell:** [Agentic-Lehrlabor](./CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md) · **Projektstatus:** [Kurslandkarte](./CLOUD-COMPUTING-KURSREADME.md) · **Durchführung:** [12 Terminpläne](./vorlesungen-cloud-computing-termine.md), [Präsenz-/Zoom-Konzept](./CLOUD-COMPUTING-DURCHFUEHRUNG-PRAESENZ-ZOOM.md) · **Stand:** 2026-07-29

## 1. Verbindlicher Rahmen

| Merkmal                         | Vorgabe beziehungsweise Umsetzung                                                 |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Niveau                          | Bachelor                                                                          |
| Umfang                          | 5 CP, 150 Stunden, 2,16 SWS                                                       |
| Sprache                         | Deutsch                                                                           |
| Voraussetzungen                 | keine formalen Zugangsvoraussetzungen                                             |
| Curriculare Bezüge              | IT-Architekturmanagement; Betriebssysteme, Rechnernetze und verteilte Systeme     |
| Kursart                         | Integrierte Vorlesung                                                             |
| Teilnehmende                    | Informatik und Wirtschaftsinformatik; gemischte technische/wirtschaftliche Rollen |
| Kursläufe                       | einmal Präsenz, einmal synchron online in Zoom; fachlich und formal äquivalent    |
| Präsenz/synchron                | 13,5 Stunden = 18 UE = sechs Termine à 3 UE                                       |
| Tutorium                        | 13,5 Stunden = 18 UE = sechs Termine à 3 UE                                       |
| Selbststudium                   | 123 Stunden                                                                       |
| Praxisanteil laut Modulhandbuch | 0 Stunden; Anwendungsaufgaben bleiben Lehrmethode                                 |
| Prüfungsbasis                   | Referat, 15 Minuten je Prüfling; Einreichung, Vortrag und Diskussion              |
| Didaktisches Arbeitsmodell      | ausschließlich agent-first auf Lehrenden- und Studierendenseite                   |
| Formative Selbstüberprüfung     | nach jedem Termin 30 durch einen KI-Agenten erzeugte MC-Test-Fragen               |

Die 36 UE sind nicht frei zusätzlich zum Tutorium verfügbar. Sie bilden zusammen exakt die 27 betreuten Stunden aus Präsenz/synchroner Lehre und Tutorieller Betreuung ab.

## 2. Qualifikationsziele und Pflichtinhalte

Das Lehrkonzept deckt die fünf Qualifikationsziele des Modulhandbuchs vollständig ab. Nach erfolgreichem Abschluss können die Studierenden:

1. Grundlagen des Cloud Computing und Cloud-Service-Modelle erklären;
2. technologische Voraussetzungen aktueller Cloud-Angebote erkennen und einordnen;
3. Prinzipien, Vorteile und Einschränkungen des Serverless Computing darlegen;
4. Merkmale etablierter Cloud-Angebote analysieren;
5. Cloud-Optionen für Datenwissenschaft und maschinelles Lernen beschreiben.

Verbindliche Inhaltsblöcke:

1. Einführung: Grundlagen, Service-Modelle, Nutzen und Risiken;
2. technologische Voraussetzungen: Virtualisierung/Containerisierung, Speicher, Netzwerke und RESTful-Dienste;
3. Serverless Computing: Einführung, Vorteile und Einschränkungen;
4. etablierte Plattformen: Google Cloud, Amazon Web Services und Microsoft Azure;
5. Datenwissenschaft in der Cloud: Datenwissenschafts- und ML-Angebote dieser drei Plattformen.

`arsnova.eu`, Skalierung, Observability, Security, 6R und FinOps konkretisieren diese Inhalte als Fallstudie. Sie ersetzen keinen der fünf Pflichtblöcke.

Als querschnittliche Methodenkompetenz werden sämtliche Pflichtinhalte durch KI-Agenten im Sinne des Agentic Software Engineering erschlossen, umgesetzt und überprüft. Das Agentenarbeitsmodell ergänzt die offiziellen Cloud-Ziele, ohne sie durch allgemeine KI-Schulung zu verdrängen.

## 3. Leitidee und Fallauftrag

Die Studierenden lernen Cloud Computing als Zusammenspiel von Dienstmodell, technologischer Grundlage, Plattformangebot, Betrieb, Skalierung, Sicherheit und Wirtschaftlichkeit. `arsnova.eu` liefert einen realen Gegenstand mit:

- Angular-Frontend, Node.js/tRPC-Backend, REST-/WebSocket-Kommunikation und Yjs;
- PostgreSQL für persistente Daten und Redis für flüchtigen Zustand und Schutzmechanismen;
- Docker-Compose-Produktionspfad hinter Nginx/TLS;
- einem gehärteten PDF-Worker als Kandidaten für die Serverless-/Hintergrundjob-Diskussion;
- Last-, Monitoring-, Backup-, Security- und Abnahmedokumenten mit unterschiedlichen Evidenzstufen.

Fallauftrag:

> Steuert KI-Agenten so, dass sie einen isolierten Cloud-Server für `arsnova.eu` reproduzierbar bereitstellen, härten und hinsichtlich Sicherheit, Datenschutz, Performance, Resilienz und Wirtschaftlichkeit prüfen. Verbindet technische Evidenz mit TCO, FinOps, Unit Economics, Risiko und Exit zu einer verantworteten Entscheidung und bereitet sie für Einreichung, Vortrag und Diskussion des 15-minütigen Referats auf.

Zwei ungetestete Lehrprofile strukturieren die Architekturarbeit:

1. 100 parallele Classrooms mit je 50 Teilnehmenden;
2. eine Konferenz-Session mit 5.000 Teilnehmenden.

Sie sind keine zugesagten Produktkapazitäten. Die Evidenzlage steht in der [Kurslandkarte](./CLOUD-COMPUTING-KURSREADME.md#32-evidenz-statt-kapazitätsversprechen).

## 4. Operationalisierte Lernergebnisse

Zusätzlich zur Formulierung des Modulhandbuchs werden die Ziele beobachtbar gemacht:

| Code | Studierende können …                                                                            | Modulbezug              |
| ---- | ----------------------------------------------------------------------------------------------- | ----------------------- |
| K1   | einen Dienst anhand der Cloud-Merkmale sowie Service- und Deployment-Modellen einordnen         | Ziel 1                  |
| K2   | Compute-, Container-, Speicher-, Netzwerk- und REST-Voraussetzungen eines Systems analysieren   | Ziel 2                  |
| K3   | eine Funktion hinsichtlich Serverless-Eignung, Nutzen und Grenzen bewerten                      | Ziel 3                  |
| K4   | GCP, AWS und Azure anhand gleicher Fähigkeiten, Verantwortungen und Risiken vergleichen         | Ziel 4                  |
| K5   | geeignete Datenwissenschafts-/ML-Dienste der drei Plattformen beschreiben und abgrenzen         | Ziel 5                  |
| K6   | eine Cloud-Entscheidung für `arsnova.eu` evidenzbasiert begründen und verständlich präsentieren | Ziele 1–5, Falltransfer |
| K7   | einen KI-Agenten mit Auftrag, Rechten, Budget, Freigabegates und Akzeptanztests steuern         | Querschnittsmethode     |
| K8   | einen isolierten Server agentisch installieren, härten, messen, prüfen und zurückbauen          | Ziele 1–4, Falltransfer |
| K9   | technische Messwerte mit TCO, Unit Economics, Risiko, Build/Buy und Exit verbinden              | Ziele 1–5, WI-Transfer  |

## 5. Constructive Alignment

| Lernergebnis | Agentische Lehr-/Lernaktivität                                | Formatives Artefakt                          | Möglicher Referatsbezug                     |
| ------------ | ------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| K1           | Klassifikationsagent plus menschliche Gegenprüfung            | belegte Cloud-Einordnung                     | begründete Abgrenzung von Hosting und Cloud |
| K2/K8        | Provisioning-/Operations-Agent auf isoliertem Zielserver      | IaC, Systeminventar und Härtungsnachweis     | technologische Voraussetzungen des Falls    |
| K3           | Serverless-Analyseagent mit Gegenbeispiel                     | Eignungsmatrix und isolierter Prototyp       | Funktion, Nutzen und Grenze von Serverless  |
| K4           | Provider-Agent mit identischem Capability-/Quellenraster      | GCP-/AWS-/Azure-Matrix                       | Analyse etablierter Cloud-Angebote          |
| K5           | Daten-/ML- und Privacy-Agent                                  | Datenfluss, Zweck-/Rollen- und Optionenblatt | passende Cloud-Option für einen Datenfall   |
| K6/K7        | Security-, Performance- und Review-Agenten mit Evidenzgates   | Befund-, Mess- und Verifikationsberichte     | verteidigbare technische Fallentscheidung   |
| K9           | Economics-/FinOps-Agent auf Basis derselben technischen Daten | TCO, Unit Economics, Sensitivität und ADR    | verantwortbare Gesamtentscheidung           |

Das gemeinsame **Agentic Cloud Engineering Dossier** unterstützt die Lernprogression und Referatsvorbereitung. Es ist keine zusätzliche benotete Prüfungsleistung, solange IU beziehungsweise myCampus dies nicht ausdrücklich vorgeben.

## 6. Didaktische Prinzipien

### Modulhandbuch vor Vertiefung

Die Pflichtinhalte werden zuerst sichtbar abgedeckt. Fallstudienvertiefungen werden jeweils an ein offizielles Ziel zurückgebunden.

### Fähigkeiten vor Produktkatalog

GCP, AWS und Azure werden nach gleichen Fähigkeiten verglichen: Compute, Storage, Netzwerk/API, Serverless, Daten/ML, Security, Observability und Verantwortungsgrenze. Produktnamen sind Beispiele, keine Lernziele.

### Agent-first statt Chatbot-Unterstützung

Lehrende und Studierende verwenden ausschließlich werkzeugnutzende KI-Agenten für die substanziellen Labor-, Analyse- und Bewertungsaufgaben. Jeder Agent arbeitet mit versioniertem Auftrag, begrenzten Rechten und Kosten, Freigabegates, maschineller Verifikation und menschlicher Entscheidung. Reine Chatantworten ohne überprüfbare Aktion oder Evidenz erfüllen den Arbeitsauftrag nicht.

### Kontrollierte Serverarbeit statt Produktionszugriff

Agenten stellen isolierte, rücksetzbare Zielserver als Code bereit, installieren einen festgelegten `arsnova.eu`-Slice, härten ihn und prüfen Security, Datenschutz, Performance und Recovery. Produktion, Echtdaten, Produktionscredentials und unbudgetierte Providerressourcen bleiben ausgeschlossen.

### Technik und Wirtschaft gemeinsam

Gemischte Informatik-/Wirtschaftsinformatikteams verbinden Architektur, Messung und Restrisiko mit TCO, Unit Economics, Personal-/Complianceaufwand, Sensitivität, Build/Buy und Exit. Keine Seite darf Annahmen der anderen ungeprüft übernehmen.

### Evidenz vor Kapazitätszahl

Ein erfolgreicher Join-Test belegt weder Vote-SLOs noch vollständigen Live-Betrieb. Ein lokaler Lauf ist keine Produktionsfreigabe.

### Formatives Agentic-Dossier vor Prüfungsersatz

Die Agentenaufträge, Diffs, Tests, Scans, Messungen und Wirtschaftsmodelle liefern Material für ein präzises Referat. Umfangreiche Gruppenportfolios oder zusätzliche Verteidigungen werden nicht als Prüfungsbestandteil erfunden.

### Sicheres Agentenlabor

Pflichtaufgaben funktionieren mit Repository und isolierten Zielservern. Privilegierte, destruktive, externe oder kostenwirksame Agentenschritte benötigen menschliche Freigabe. Produktivlasttests, Echtdaten und kostenpflichtige Cloud-Ressourcen sind ohne ausdrückliche Freigabe ausgeschlossen.

### Modalitätsäquivalenz statt identischer Methode

Präsenz- und Zoom-Lauf haben identische Lernziele, Inhalte, Nettozeiten, Agenten-/Modellkonfigurationen, Zielserver, Berechtigungen, Budgets, Lernprodukte und Prüfungsinformationen. Gruppenarbeit, Coaching und Review werden mediengerecht umgesetzt. Maßgeblich sind das [Agentic-Lehrlabor](./CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md) und das [Präsenz-/Zoom-Konzept](./CLOUD-COMPUTING-DURCHFUEHRUNG-PRAESENZ-ZOOM.md).

## 7. Semesterstruktur und Workload-Typ

Die Detailzeiten stehen in den [Terminplänen](./vorlesungen-cloud-computing-termine.md). `Präsenz/synchron` ist eine Workload-Kategorie: Im Präsenzlauf findet der Termin im Raum, im Onlinelauf synchron in Zoom statt. Die Tutorien werden ebenfalls im jeweiligen Kursmodus durchgeführt.

| Termin | Typ              | Agentischer Schwerpunkt                              | Zentrales Lernprodukt                       |
| -----: | ---------------- | ---------------------------------------------------- | ------------------------------------------- |
|      1 | Präsenz/synchron | Cloud-Grundlagen und Agentenvertrag                  | Cloud-Einordnung mit Auftrag/Grenzen        |
|      2 | Präsenz/synchron | Zielserver und technologische Basis als Code         | IaC-/Provisioning-Plan                      |
|      3 | Tutorium         | Serverinstallation, `arsnova.eu`-Slice und Härtung   | reproduzierbarer Build und Härtungsnachweis |
|      4 | Präsenz/synchron | Serverless-Agent und isolierter Prototyp             | Serverless-Eignungsmatrix                   |
|      5 | Präsenz/synchron | Provider-Agent für Google Cloud, AWS und Azure       | Capability-/Verantwortungs-/Kostenvergleich |
|      6 | Präsenz/synchron | Daten-/ML- und Privacy-Agent                         | Datenfluss und DS-/ML-Service-Mapping       |
|      7 | Tutorium         | Recovery-Agent für Backup, Restore und Fehlerfälle   | ausgeführter Recovery-Nachweis              |
|      8 | Tutorium         | Performance-Agent für Last, SLI/SLO und Resilienz    | reproduzierbarer Last-/Messbericht          |
|      9 | Präsenz/synchron | Security-/Privacy-Agent und Observability            | Befund-Maßnahme-Verifikation-Restrisiko     |
|     10 | Tutorium         | Economics-/FinOps-Agent, Providerentscheidung und 6R | TCO, Unit Economics, Sensitivität und ADR   |
|     11 | Tutorium         | Agentenevidenz in Referatsbestandteile überführen    | Einreichungs- und Vortragsskizze            |
|     12 | Tutorium         | Probeprüfung und Verteidigung der Agentenergebnisse  | Vortrag plus Diskussion                     |

Bilanz: sechs Präsenz-/synchrone Termine = 18 UE = 13,5 Stunden; sechs Tutorien = 18 UE = 13,5 Stunden.

## 8. Strukturierung der 123 Stunden Selbststudium

Die konkrete Aufgabenmenge ist semesterbezogen zu kalibrieren. Ein belastbares Planungsbudget ist:

| Aktivität                                     | Richtwert |
| --------------------------------------------- | --------: |
| Vor- und Nachbereitung der zwölf Termine      |      24 h |
| Pflichtlektüre und technische Vertiefung      |      30 h |
| Agentic Cloud Engineering Dossier             |      30 h |
| Plattform-, Privacy- und Wirtschaftsvergleich |      15 h |
| Referatsrecherche, Visualisierung und Probe   |      18 h |
| individuelle Agentenkritik und Revision       |       6 h |
| **Gesamt**                                    | **123 h** |

Die Positionen sind Planungswerte, keine zusätzlichen Prüfungsbestandteile. Überschneidungen müssen bei der konkreten Aufgabenstellung vermieden werden.

## 9. Prüfungsanbindung

### Planungsbasis: Referat

Das Modulhandbuch und der Bewertungsbogen bestimmen **15 Minuten mündliche Prüfung je Prüfling**. Die Prüfungsleistung umfasst eine schriftliche Einreichung (30 %), einen visuell unterstützten Vortrag (30 %) und die anschließende Befragung/Diskussion (40 %). Bewertet werden Themenverständnis, Sachkompetenz, Argumentation, Methodik, Eigenständigkeit, Kommunikation und formale Anforderungen mit den Gewichten des offiziellen Bogens.

Ob Einzel- oder Gruppenreferat und ob Präsentation mit Handout oder Posterpräsentation gilt, legt die prüfende Person fest. Auch bei Gruppenarbeit bleiben Beiträge, Prüfungszeit und Note individuell. Die vollständigen Format-, Frist-, Abgabe-, Bewertungs- und Modalitätsregeln stehen in der [Referatsumsetzung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md).

Die Themen werden aus dem [kanonischen Katalog zur arsnova.eu-Fallstudie](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md#41-kanonischer-themenkatalog-für-die-fallstudie-arsnovaeu) ausgewählt. Er bildet den aktuellen Entwicklungspfad von der produktiven Begriffswolke über spaCy-Glättung und getrennten semantischen Inferenzserver bis zum deterministischen beziehungsweise optional KI-gestützten Moderationskompass ab. Jedes vergebene Thema übernimmt den im Katalog ausgewiesenen offiziellen Qualifikationsbezug und wird auf eine individuelle, überprüfbare These mit technischem Evidenzauftrag, ernsthafter Gegenalternative und begründeter Entscheidungsfolge zugeschnitten; eine bloße Story- oder Produktzusammenfassung erfüllt das Prüfungsziel nicht.

Da KI-Agenten das verbindliche Arbeitsmittel des Kurses sind, muss ihr zulässiger Einsatz für die formalen Referatsunterlagen ausdrücklich im Prüfungsauftrag beziehungsweise in myCampus bestätigt werden. Bei Freigabe werden Agent, Modell, wesentliche Aufträge und übernommene Beiträge offengelegt; jede Person bleibt für Quellen, Aussagen und Verständnis verantwortlich.

Für formative Rückmeldung werden deshalb dieselben offiziellen Aspekte verwendet:

- fachlich korrekte Nutzung der Cloud-Begriffe;
- erkennbare Abdeckung eines offiziellen Qualifikationsziels;
- nachvollziehbare Quellen- und Evidenzbasis;
- ausgewogene Analyse von Nutzen, Risiken und Verantwortungen;
- verständliche Visualisierung und Argumentationslinie;
- klare Kennzeichnung offener Annahmen.

Diese Kurzliste ersetzt weder den offiziellen IU-Bewertungsbogen noch dessen 30/30/40-Gewichtung.

### Nur bei bestätigter Abweichung: Workbook

Falls myCampus Workbook ausweist, gelten Einzelarbeit, zentrale Aufgabenstruktur, ein aus Word erzeugtes PDF, myCampus/Turnitin-Abgabe und die weiteren bindenden Regeln aus den [IU-Formalia](./CLOUD-COMPUTING-IU-FORMALIA.md#7-alternativpfad-workbook-nur-nach-bestätigung). Der vorliegende Referatsentwurf wird dann erst nach formaler Klärung auf die zentralen Workbookaufgaben abgebildet.

## 10. Verbindliche Repo-Grundlagen

### System und Betrieb

- [Root-README](../../README.md)
- [Architektur-Handbuch](../architecture/handbook.md)
- [Produktions-Compose](../../docker-compose.prod.yml)
- [Deployment auf Debian](../deployment-debian-root-server.md)
- [Monitoring-Runbook](../operations/MONITORING-RUNBOOK.md)
- [Backup-/Restore-Runbook](../operations/BACKUP-RESTORE-RUNBOOK.md)

### Evidenz und Transformation

- [historischer Produktions-Join 500](../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md)
- [lokale Baseline-Freigabe](../implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md)
- [formale §6.5-Abnahme](../implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md)
- [betriebliche Cloud-Einordnung](../implementation/CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md)
- [Provider-Vergleich](../implementation/CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md)
- [6R-Einordnung](../implementation/CLOUD-COMPUTING-6R-EINORDNUNG.md)

## 11. Kurzfassung für die Modulplanung

Die integrierte Vorlesung vermittelt Grundlagen, technologische Voraussetzungen, Serverless Computing, etablierte Cloud-Plattformen und Datenwissenschaft/ML in der Cloud. Lehrende und Studierende steuern dafür ausschließlich KI-Agenten: Sie stellen isolierte Server bereit, installieren und härten `arsnova.eu`, prüfen Security, Datenschutz, Performance und Resilienz und verbinden die Evidenz mit TCO, FinOps, Unit Economics, Risiko und Exit. Informatik und Wirtschaftsinformatik arbeiten in gemischten Rollen. Sechs Präsenz-/synchrone Termine und sechs Tutorien bilden die 36 UE; 123 Stunden Selbststudium dienen Agentic-Dossier, Lektüre und Referatsvorbereitung. Nach jedem Termin stehen 30 agentisch erzeugte MC-Test-Fragen zur freiwilligen Selbstüberprüfung bereit. Präsenz- und Zoom-Lauf nutzen denselben Agenten- und Laborplan. Formale Prüfungsbasis ist ein 15-minütiges Referat je Prüfling aus Einreichung, Vortrag und Diskussion.

## 12. Freigabecheck

- [ ] Prüfungsform des konkreten Kurslaufs in myCampus geprüft
- [ ] Abweichung zwischen Referat und Workbook gegebenenfalls schriftlich geklärt
- [ ] Einzel-/Gruppenformat, Handout/Poster, mindestens vier Wochen Bearbeitungszeit und PDF-Abgabeweg veröffentlicht
- [ ] offizieller Bewertungsbogen mit 30/30/40-Gewichtung, Hilfsmittel und Terminierung veröffentlicht
- [ ] 18 UE Präsenz/synchron und 18 UE Tutorium im Stundenplan ausgewiesen
- [ ] identische Lernziele, Materialien, Lernprodukte und Prüfungsinformationen für Präsenz und Zoom bereitgestellt
- [ ] identische Agenten, Modelle, Zielserver, Rechte, Budgets und Abnahmetests für Präsenz und Zoom bereitgestellt
- [ ] Agentenvertrag, Freigabegates, Evidenzschema und Cleanup für Lehrende und Studierende getestet
- [ ] für jeden Termin Themen/Keywords zur Abdeckungssteuerung und eine versionierte autoritative Materialbasis für 30 agentisch erzeugte MC-Test-Fragen gepflegt
- [ ] festgeschriebener MC-Test-Commit, vierstufige Artefaktpipeline, Validator, Generierungsmanifest und menschliches Freigabegate getestet
- [ ] Serverinstallation/Härtung sowie Security-, Privacy-, Performance- und FinOps-Agentenlabor lauffähig
- [ ] gemischte Informatik-/Wirtschaftsinformatikrollen und gemeinsame Ergebnisverantwortung festgelegt
- [ ] zulässige Agentennutzung und Offenlegung für die Referatsprüfung formal geklärt
- [ ] Raum-/Netz-Fallback für Präsenz sowie Host-/Breakout-/Verbindungs-Fallback für Zoom getestet
- [ ] alle fünf offiziellen Inhalte und Ziele im Kursraum sichtbar zugeordnet
- [ ] 123 Stunden Selbststudium auf realistische Aufgaben verteilt
- [ ] GCP-, AWS-, Azure- und Datenwissenschaftsquellen aktualisiert
- [ ] Laborzugänge, Datenschutz, Kostenrahmen und Produktionssperre dokumentiert
- [ ] Projektstatus und Links über die Kurslandkarte aktualisiert
