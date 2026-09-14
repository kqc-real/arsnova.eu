# Modulkonzept Cloud Computing

**Stand:** 14.09.2026

## 1. Lesehilfe

- **IU Internationale Hochschule (IU)** bezeichnet die Hochschule; `DSCC0127` ist der Modulcode und `DSCC012701` der Kurscode.
- **Credit Point (CP)** bezeichnet einen Leistungspunkt. Das Modul umfasst 5 CP.
- **Unterrichtseinheit (UE)** bezeichnet 45 Minuten. Eine **Lerneinheit (LE)** umfasst genau zwei aufeinanderfolgende UE und damit 90 Minuten.
- **TB01–TB12** bezeichnet zwölf stabile Themenblöcke. Die Kennungen legen weder Kalenderwochen noch Durchführungsform oder Belastungsverteilung fest.
- **Qualifikationsziel (QZ)** bezeichnet eines der fünf offiziellen Ziele. **Modulziel (MZ)** bezeichnet eines der neun operationalisierten Ziele. **Learning Indicator (LI)** bezeichnet einen beobachtbaren Lernindikator.
- **Multiple Choice (MC)** bezeichnet Aufgaben mit vorgegebenen Antwortmöglichkeiten. Der Ausdruck **MC-Test** bezeichnet die formative Lernanwendung.
- **Künstliche Intelligenz (KI)** und **maschinelles Lernen (ML)** werden nur dann abgekürzt, wenn die Langformen zuvor genannt sind.
- **Infrastructure as a Service (IaaS)**, **Platform as a Service (PaaS)** und **Software as a Service (SaaS)** bezeichnen Cloud-Dienstmodelle. **Infrastructure as Code (IaC)** bezeichnet reproduzierbar beschriebene Infrastruktur.
- **Google Cloud Platform (GCP)**, **Amazon Web Services (AWS)** und Microsoft Azure sind die drei verbindlich verglichenen Plattformen.
- **Identity and Access Management (IAM)** bezeichnet Identitäts- und Berechtigungsverwaltung. **Site Reliability Engineering (SRE)** bezeichnet den mess- und automatisierungsorientierten Ansatz für zuverlässigen Betrieb.
- **Financial Operations (FinOps)** verbindet technische Nutzung und Kostenverantwortung. **Total Cost of Ownership (TCO)** bezeichnet die Gesamtkosten über die betrachtete Nutzungsdauer.
- **Architecture Decision Record (ADR)** bezeichnet eine nachvollziehbare Architekturentscheidung. **6R** bezeichnet die sechs Migrationsoptionen Rehost, Replatform, Repurchase, Refactor, Retire und Retain.
- **Recovery Point Objective (RPO)** bezeichnet den tolerierten Datenverlustzeitraum; **Recovery Time Objective (RTO)** bezeichnet die angestrebte Wiederherstellungszeit.
- **Service Level Indicator (SLI)** bezeichnet eine Messgröße für Dienstqualität; **Service Level Objective (SLO)** bezeichnet den dazu gesetzten Zielwert.
- **Portable Document Format (PDF)** bezeichnet das vorgesehene Dateiformat für die formale Einreichung. Das **95. Perzentil (p95)** ist der Wert, unter oder auf dem 95 Prozent der beobachteten Messwerte liegen.

## 2. Verbindlicher Modulrahmen

| Merkmal                    | Festlegung                                                                  |
| -------------------------- | --------------------------------------------------------------------------- |
| Modul und Kurs             | Cloud Computing, `DSCC0127` / `DSCC012701`                                  |
| Niveau und Studienformat   | Bachelor, duales Studium                                                    |
| Zielgruppe                 | ausschließlich Bachelorstudierende der Informatik                           |
| Umfang                     | 5 CP, 150 Stunden                                                           |
| Betreute Zeit              | 36 UE à 45 Minuten = 27 Stunden                                             |
| Selbststudium              | 123 Stunden                                                                 |
| Themenblöcke               | 12 stabile Themenblöcke à 3 UE = 36 UE                                      |
| Prüfung als Planungsbasis  | Referat mit insgesamt 15 Minuten mündlicher Prüfung je Prüfling             |
| Online- und Live-Werkzeuge | freiwillig-formativ; keine Zulassung, keine Prüfungsleistung und keine Note |

Das Modulpaket ordnet die Themenblöcke weder Kalenderwochen noch einer Präsenz-, virtuellen oder Tutoriumsform zu. Für jede Durchführung gelten dieselben zwölf Themenblöcke, 36 UE, Inhalte, Lernprodukte und Prüfungsinformationen. Eine konkrete Terminierung ist nicht Bestandteil des curricularen Vertrags.

## 3. Offizielle Qualifikationsziele

Die fünf QZ folgen den für das Modul ausgewerteten IU-Unterlagen. Die rechte Spalte macht sichtbar, wie sie im Kurs beobachtbar werden, ohne ihren verbindlichen Sinn zu verändern.

| Ziel    | Offizielle Zielrichtung                                                  | Nachvollziehbare Umsetzung                                                                                                                   |
| ------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **QZ1** | Grundlagen des Cloud Computing und Cloud-Service-Modelle verstehen       | Cloud-Merkmale, Dienst- und Bereitstellungsmodelle sowie Shared Responsibility an neuen Fällen erklären und abgrenzen                        |
| **QZ2** | technologische Voraussetzungen aktueller Cloud-Angebote erkennen         | Compute, Virtualisierung, Container, IaC, Netzwerk, Zustandsgrenzen, Speicher und verteilten Betrieb an einer realen Architektur analysieren |
| **QZ3** | Prinzipien des Serverless Computing darlegen                             | Nutzen, Grenzen und Eignung von Funktionen und verwalteten Diensten anhand gleicher Kriterien begründen                                      |
| **QZ4** | Merkmale etablierter Cloud-Angebote analysieren                          | GCP, AWS und Microsoft Azure auf gleicher Systemgrenze nach Fähigkeiten, Verantwortung, Risiken und Kosten vergleichen                       |
| **QZ5** | Cloud-Optionen für Datenwissenschaft und maschinelles Lernen beschreiben | Daten- und ML-Pipelines, verwaltete Angebote, private Varianten, Datenschutz und Betriebsfolgen einordnen                                    |

Skalierung, Sicherheit, Observability, SRE, FinOps, Nachhaltigkeit und 6R vertiefen diese fünf QZ. Sie ersetzen keines der offiziellen Ziele.

## 4. Operationalisierte Modulziele

Nach erfolgreichem Abschluss können Studierende:

| Ziel                                                   | Beobachtbares Modulziel                                                                                                                                                  | Zugeordnete Indikatoren |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| **MZ1: Cloud einordnen und Verantwortung abgrenzen**   | Fälle anhand von Cloud-Merkmalen, Dienst- und Bereitstellungsmodellen klassifizieren sowie Shared Responsibility einschließlich Nutzen und Risiken begründen             | LI01–LI03               |
| **MZ2: technische Cloud-Architekturen analysieren**    | Virtualisierung, Container, IaC, Netzwerk-, Schnittstellen-, Vertrauens- und Zustandsgrenzen in einer reproduzierbaren Architektur erklären und belegen                  | LI04–LI06               |
| **MZ3: Serverless-Eignung beurteilen**                 | Serverless-Prinzipien erklären und einen Kandidaten samt Gegenbeispiel nach Zustand, Laufzeit, Skalierung, Beobachtbarkeit, Kosten und Bindungsrisiko bewerten           | LI07–LI08               |
| **MZ4: etablierte Plattformen vergleichen**            | GCP, AWS und Microsoft Azure nach einem identischen Fähigkeits-, Verantwortungs-, Regionen-, Risiko-, Kosten- und Exit-Raster analysieren                                | LI09–LI11               |
| **MZ5: Daten- und ML-Optionen entwerfen**              | Cloud-Daten- und ML-Pipelines beschreiben und Varianten nach Reproduzierbarkeit, Qualität, Datenschutz, Betrieb und Wirtschaftlichkeit abgrenzen                         | LI12–LI14               |
| **MZ6: Zustand und Recovery beherrschen**              | persistenten, flüchtigen und lokalen Zustand unterscheiden sowie Backup und Wiederherstellung mit RPO, RTO, Integrität und ausgeführter Evidenz beurteilen               | LI15–LI16               |
| **MZ7: Skalierung und verteilte Systeme messen**       | Elastizität, vertikale und horizontale Skalierung, Queueing, Backpressure und Verteilungsprobleme erklären sowie belastbare Performance- und Fehlerexperimente entwerfen | LI17–LI18               |
| **MZ8: sicheren und zuverlässigen Betrieb beurteilen** | IAM, Least Privilege, Security, Observability, SRE und Resilienz in überprüfbare Kontrollen, Messgrößen und Restrisiken übersetzen                                       | LI19–LI21               |
| **MZ9: evidenzbasiert entscheiden und verteidigen**    | technische Evidenz mit FinOps, Nachhaltigkeit, TCO, 6R, Alternativen und Exit zu einer ADR verbinden und die Entscheidung im Referat fachlich vertreten                  | LI22–LI24               |

Die genaue Formulierung aller 24 LI und ihr Constructive Alignment stehen in der [Lernziel- und Alignment-Matrix](./Lernziel_Alignment_Matrix.md).

## 5. Didaktische Leitidee

### 5.1 arsnova.eu in zwei Rollen

`arsnova.eu` hat zwei klar getrennte, aber verbundene Rollen:

1. **Synchrones Lernwerkzeug:** Livefragen aktivieren Vorwissen, lenken Aufmerksamkeit, machen Fehlvorstellungen sichtbar, eröffnen Peer-Diskussion und ermöglichen unmittelbare Rückmeldung.
2. **Authentisches Studienobjekt:** Repository, Architektur, Konfigurationen, Betriebsdokumente und Messberichte bilden einen realen Cloud-Fall. Jede Aussage wird jedoch nach Evidenzstufe, Messumgebung und Gültigkeitsgrenze geprüft.

Die Live-Teilnahme funktioniert auf Tablet oder Laptop im Browser. Für vertiefte Repository-, Architektur-, Konfigurations- und Laborarbeit ist ein Laptop erforderlich. Fehlt ein geeignetes Gerät oder ist eine Interaktion unter Zeitdruck nicht möglich, steht ein fachlich gleichwertiger untimierter Weg mit denselben Inhalten zur Verfügung.

### 5.2 Quellenkritik vor Produktbehauptung

Die Fallstudie folgt immer derselben Kette:

> Behauptung → Repository- oder Primärquelle → überprüfbare Evidenz → Gültigkeitsgrenze → Alternative → verantwortete Entscheidung

Produktnamen sind keine Lernziele. Ein lokaler Test ist keine Produktionsbeobachtung, ein erfolgreicher Join ist kein Nachweis des vollständigen Live-Betriebs und ein Zielbild ist keine implementierte Eigenschaft.

### 5.3 Lernen mit agentischen Werkzeugen

Das Agentic Cloud Engineering Dossier bündelt agentengestützte Aufträge, Pläne, Änderungen, Prüfungen, Messungen, Quellen und Entscheidungen. Menschen setzen Ziel, Rechte, Kosten- und Sicherheitsgrenzen, genehmigen riskante Schritte, verifizieren Ergebnisse und verantworten die Entscheidung. Produktion, Echtdaten, Produktionszugänge und unbudgetierte externe Ressourcen bleiben ausgeschlossen.

Agentenausgaben sind keine Fakten allein aufgrund ihrer Form. Eine attraktive Antwort ohne Quelle, Messung, Gegenprobe und Gültigkeitsgrenze erfüllt keinen fachlichen Nachweis.

## 6. Verbindlicher Themenblockaufbau

### 6.1 UE 1 und UE 2 als eine 90-minütige Lerneinheit

UE 1 und UE 2 bilden in jedem Themenblock genau eine LE. Das folgende Mikromuster ist ein Richtwert; die Summe bleibt 90 Minuten:

| Phase                                       |           Zeit | Funktion                                                       |
| ------------------------------------------- | -------------: | -------------------------------------------------------------- |
| Aktivierung und Wiederabruf mit arsnova.eu  |      8 Minuten | Vorwissen und ältere Kernideen abrufen                         |
| Leitproblem und Begriffsaufbau              |     15 Minuten | Leitfrage und fachliches Modell klären                         |
| Quellen- oder Repository-Analyse            |     22 Minuten | belegten Ist-Zustand und Aussagegrenzen erarbeiten             |
| Anwendung am Cloud-Fall                     |     25 Minuten | Entscheidung, Entwurf, Messung oder Gegenbeispiel bearbeiten   |
| Peer-Erklärung und Fehlvorstellungsdiagnose |     15 Minuten | Begründungen vergleichen und korrigieren                       |
| Sicherung für Dossier und Selbststudium     |      5 Minuten | Zwischenstand, offene Annahme und nächsten Nachweis festhalten |
| **Gesamt**                                  | **90 Minuten** |                                                                |

Die zehn ARSnova-Fragetypen jedes Themenblocks werden passend über diese Phasen verteilt. Sie bilden keine zusätzliche Zeit außerhalb der LE.

### 6.2 UE 3 als formativer MC-Test

UE 3 folgt in jedem Themenblock exakt demselben 45-Minuten-Ablauf:

| Phase                                              |           Zeit |
| -------------------------------------------------- | -------------: |
| Wechsel zum MC-Test und zugängliche Bereitstellung |      3 Minuten |
| Bearbeitung der 30 Items                           |     32 Minuten |
| gemeinsame Ergebnis- und Lösungsbesprechung        |     10 Minuten |
| **Gesamt**                                         | **45 Minuten** |

Die 32 Minuten sind ein organisatorischer Planwert. Der Lernmodus besitzt keinen technischen Countdown. Der frühere UE3-Umfang für Labor, Lernprodukt oder Präsentation wird in die 90-minütige LE und das Selbststudium integriert; er wird weder als vierte UE behandelt noch zusätzlich auf den Workload gerechnet.

## 7. Themenblockplan

| Themenblock | Schwerpunkt der 90-minütigen LE                                      | In LE und Selbststudium integriertes Lernprodukt                                                                | Zielbezug                   |
| ----------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **TB01**    | Grundlagen, Cloud- und Bereitstellungsmodelle, Shared Responsibility | belegte Cloud-Klassifikation mit Verantwortungsgrenze, Nutzen, Risiko und offener Annahme                       | MZ1, LI01–LI03              |
| **TB02**    | Virtualisierung, Container, IaC und Netzwerk                         | Technologiematrix und reproduzierbarer Provisioning-Entwurf mit Netzwerk- und Vertrauensgrenzen                 | MZ2, LI04–LI06              |
| **TB03**    | arsnova.eu-Deployment, Härtung und Zustand                           | belegtes Ist-Diagramm, Härtungsnachweis und Trennung von persistentem, flüchtigem und lokalem Zustand           | MZ2/MZ6, LI04–LI06 und LI15 |
| **TB04**    | Serverless Computing                                                 | Eignungsmatrix für einen geeigneten und einen ungeeigneten Kandidaten mit Gegenprobe                            | MZ3, LI07–LI08              |
| **TB05**    | GCP, AWS und Microsoft Azure                                         | normalisierter Plattformvergleich mit Primärquelle, Region, Verantwortung, Kostenannahme und Exit               | MZ4, LI09–LI11              |
| **TB06**    | Datenwissenschaft und maschinelles Lernen in der Cloud               | Datenfluss und Optionenvergleich mit Qualitäts-, Datenschutz-, Betriebs- und Kostenkriterien                    | MZ5, LI12–LI14              |
| **TB07**    | Storage, Datenbanken, Backup und Recovery                            | Zustands- und Recovery-Matrix mit RPO, RTO, Integrität, ausgeführter Wiederherstellung und Grenze               | MZ6, LI15–LI16              |
| **TB08**    | Elastizität, Skalierung, Performance und verteilte Systeme           | reproduzierbarer Last- oder Fehlerplan mit Messgrößen, Rohdatenbezug und Abbruchkriterium                       | MZ7, LI17–LI18              |
| **TB09**    | IAM, Security, Observability, SRE und Resilienz                      | Kette aus Befund, Risiko, Maßnahme, Verifikation und Restrisiko sowie SLI/SLO-Bezug                             | MZ8, LI19–LI21              |
| **TB10**    | FinOps, Nachhaltigkeit und 6R                                        | TCO- und Sensitivitätsmodell sowie ADR mit stärkster verworfener Alternative und Exit-Kriterium                 | MZ9, LI22–LI23              |
| **TB11**    | evidenzbasierte Architekturentscheidung und Referatswerkstatt        | referatsfähige These, Quellen- und Visualisierungsskizze, Gegenalternative und individuelle Argumentationslinie | MZ9, LI23–LI24              |
| **TB12**    | Synthese und Probeverteidigung                                       | 15-minütige Probe mit Vortrag und Befragung, persönlicher Korrekturliste und begrenzter Schlussaussage          | MZ9, LI24                   |

Die dritte UE jeder Zeile bleibt ausschließlich dem formativen MC-Test vorbehalten.

Der [kanonische Themenblockplan](./Themenblockplan_Cloud_Computing_12_Themenbloecke.md) konkretisiert für TB01–TB12 die Inhalte, die Füllung von UE 1 und UE 2, den Fachwortschatz, Quellenanker, Lernprodukte und Selbststudiumsaufträge. Das operative Minuten-, Import- und Störungsprotokoll bleibt im [Lehrenden-Runbook](./Lehrenden_Runbook.md).

## 8. Selbststudium

Das Planungsbudget übernimmt den vollständigen Workload aus dem Altmaterial und vermeidet Doppelzählungen:

| Aktivität                                     |   Stunden |
| --------------------------------------------- | --------: |
| Vor- und Nachbereitung der zwölf Themenblöcke |      24 h |
| Pflichtlektüre und technische Vertiefung      |      30 h |
| Agentic Cloud Engineering Dossier             |      30 h |
| Plattform-, Privacy- und Wirtschaftsvergleich |      15 h |
| Referatsrecherche, Visualisierung und Probe   |      18 h |
| individuelle Agentenkritik und Revision       |       6 h |
| **Selbststudium gesamt**                      | **123 h** |

Zusammen mit 27 betreuten Stunden ergibt dies den Gesamtworkload von 150 Stunden. Dossier, Toolwiederholungen und Referatsvorbereitung werden innerhalb dieser sechs Positionen geplant und nicht erneut addiert.

## 9. Formative Werkzeuge

### 9.1 arsnova.eu

Jeder Themenblock verwendet genau zehn anspruchsvolle Livefragen und jeden der zehn unterstützten Typen einmal:

1. Single Choice mit genau einer richtigen Option,
2. Multiple Choice mit mehreren richtigen Optionen,
3. Freitext,
4. bewertbare Kurzantwort,
5. unbewertete Umfrage,
6. unbewertetes Rating,
7. numerische Schätzung,
8. Zuordnung,
9. Reihenfolge,
10. Kategorisierung.

Alle Fragen sind ausschließlich `MEDIUM` oder `HARD`; leichte Fragen sind ausgeschlossen. Die Optionen bewertbarer Auswahlfragen sind grammatisch parallel, ähnlich lang und bilden plausible Fehlvorstellungen ab.

Das Gamification-Profil ist aktiv: automatisch vergebene Kindergarten-Pseudonyme, Rangliste, die vier automatisch gebildeten Teams `Apfel :apple:`, `Birne :pear:`, `Banane :banana:` und `Apfelsine :orange:`, drei Boni, motivierende Meldungen sowie Sound-, Belohnungs- und Emoji-Effekte. Der Standardtimer von 60 Sekunden wird nach Schwierigkeit skaliert. Vorher liegt eine Lesephase; persönliche Zeitunterstützung und eine gleichwertige untimierte Alternative haben Vorrang.

Fachinformation und notwendige Handlungen werden nie ausschließlich über Farbe, Bild, Animation, Sound oder ein anderes einzelnes Sinnesmerkmal vermittelt. Während eine bewertbare Livefrage aktiv ist, werden Lösung, Referenzwert und Lösungskennzeichnung nicht angezeigt. Erst nach dem Schließen der Frage folgt die fachliche Auflösung.

Quizpunkte, Rang, Teamstand, Boni, Geschwindigkeit und Emoji-Reaktionen dienen Motivation und Interaktion. Sie sind weder Kompetenzmaß noch Prüfungsleistung.

### 9.2 MC-Test

Jeder Themenblock umfasst genau 30 Items mit dem Schwierigkeitsprofil:

| leicht | mittel | schwer |
| -----: | -----: | -----: |
|      0 |     12 |     18 |

Verbindlich sind:

- Laufzeitmodus `practice`,
- Sofortfeedback nach jeder Antwort,
- kein technischer Countdown,
- Konfiguration `show_top5_public=false`,
- erster Durchlauf in UE 3 mit 32 Minuten Planzeit,
- weiterer vollständiger Wiederabruf ohne kalendarische Vorgabe,
- erneuter Abruf zentraler Konzepte in späteren Themenblöcken,
- vollständige untimierte Alternativfassung mit denselben Fragen, Lösungen und Erklärungen.

Der MC-Test dient Selbstdiagnose und wiederholtem Abruf. Das Modulpaket legt dafür keinen kalendarischen Abstand fest. Punkte, Bearbeitungszeiten und Einzelverläufe haben keine Prüfungs- oder Zulassungswirkung.

### 9.3 Agentic Cloud Engineering Dossier

Das Dossier sammelt je nach Thema:

- Auftrag, Rechte, Budget, Freigabe- und Abbruchkriterien des Agenten,
- Quellen- und Systemmanifest,
- reproduzierbaren Provisioning-, IaC- oder Konfigurationsstand,
- Härtungs-, Security- und Datenschutznachweise,
- Recovery-, Performance- und Resilienzevidenz,
- Plattform-, TCO-, FinOps-, Nachhaltigkeits- und 6R-Vergleich,
- ADR mit stärkster verworfener Alternative,
- individuelle Kritik an Agentenergebnissen und Gültigkeitsgrenzen.

Es ist eine formative Arbeits- und Quellenbasis für das Referat, aber kein zusätzlicher benoteter Prüfungsbestandteil.

## 10. Evidenzstufen der Fallstudie arsnova.eu

| Evidenzstufe             | Verifizierbare Repository-Aussage                                                                                                                                                                                         | Didaktische Grenze                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Implementiert**        | Der dokumentierte Produktionspfad ist ein Single-Host-Deployment: Nginx vor einem App-Container, PostgreSQL und Redis auf demselben Host sowie ein separater gehärteter PDF-Worker.                                       | Das ist keine horizontal skalierende Produktionsarchitektur.                          |
| **Lokal verifiziert**    | Die lokale Baseline vom 12. Juli 2026 dokumentiert unter anderem 500 vollständige Live-Session-Abläufe mit Join, Vote und WebSocket, 500 Reconnects, einen Yjs-Sync-Lauf mit 30 Clients und einen 30-minütigen Soak-Lauf. | Lokale Testevidenz ist kein Produktions-SLO.                                          |
| **Produktiv beobachtet** | Ein historischer Produktionslauf vom 9. Mai 2026 verarbeitete 500 gleichzeitige Joins ohne HTTP- oder Checkfehler; das p95 der Anfragedauer lag bei 3,57 Sekunden und verfehlte das damalige Ziel von unter 3 Sekunden.   | Der Lauf belegt Joins, nicht den vollständigen Live-, Vote-, Team- oder Dauerbetrieb. |
| **Zielbild**             | Instanzübergreifende Ereignisse, WebSocket- und Yjs-Zuständigkeiten, globale Schutzlimits, Recovery und messbare Betriebsziele können als verteilte Architektur entworfen und in isolierter Umgebung geprüft werden.      | Ein Entwurf oder Laborlauf ist weder Produktivbeobachtung noch Kapazitätszusage.      |

Maßgebliche Quellen sind die [betriebliche Cloud-Einordnung](../../implementation/CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md), die [lokale Baseline](../../implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md) und der [historische Produktions-Join](../../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md).

## 11. Prüfung und Constructive Alignment

Planungsbasis ist ein Referat mit insgesamt 15 Minuten mündlicher Prüfung je Prüfling. Nach den ausgewerteten Unterlagen umfasst es:

| Bestandteil                                      | Gewicht |
| ------------------------------------------------ | ------: |
| schriftliche Einreichung als Handout oder Poster |    30 % |
| visuell unterstützter Vortrag                    |    30 % |
| Befragung und Diskussion                         |    40 % |

Einzel- oder Gruppenformat, Handout oder Poster, Thema, Termin und zulässige Hilfsmittel legt die konkrete Prüfungsaufgabe fest. Auch bei einem Gruppenformat werden Zeit, Beitrag und Bewertung jeder Person individuell behandelt.

Das Constructive Alignment verbindet dieselbe beobachtbare Handlung über Lernaktivität, formative Evidenz und Prüfung: klassifizieren, analysieren, entwerfen, messen, vergleichen, begrenzen, entscheiden und verteidigen. Die vollständige Zuordnung steht in der [Lernziel- und Alignment-Matrix](./Lernziel_Alignment_Matrix.md).

Der [Referatsthemenkatalog](./Referatsthemen_Cloud_Computing_ARSnova.md) übersetzt dieses Alignment in zehn klar informatisch ausgerichtete Aufgaben zu Architektur, Schnittstellen, Daten und Zustand, Deployment, Security, Performance und Zuverlässigkeit am Fallbeispiel arsnova.eu. Gemeinsam decken sie alle fünf QZ, neun MZ und 24 LI ab; jeder einzelne Auftrag bleibt auf einen in 15 Minuten verteidigbaren Cloud-Schwerpunkt begrenzt.

ARSnova-Punkte, Ranglisten, MC-Test-Punkte, Agentenbewertungen, Dossierfortschritt und Bearbeitungszeiten sind ausdrücklich keine Prüfungsleistung, keine Zulassungsvoraussetzung und keine individuelle Note. Auswahl der Prüfungsfragen und Benotung bleiben bei der prüfenden Person. Ob und wie KI-Werkzeuge für die formale Einreichung zulässig sind, richtet sich ausschließlich nach der veröffentlichten Prüfungsaufgabe beziehungsweise myCampus.

## 12. Datenschutz, Zugänglichkeit und interne Qualitätssicherung

- Live- und MC-Teilnahme ist freiwillig und ohne Notennachteil.
- Toolergebnisse werden ausschließlich für Lehre und interne Qualitätssicherung verwendet.
- Es findet keine Nutzung für Forschung, Publikation, individuelle Leistungsbewertung oder personenbezogene Leistungsprofile statt.
- Für Lehre und Dossier werden vorrangig Aggregate, synthetische Daten, freigegebene Repository-Nachweise und isolierte Nichtproduktionsumgebungen genutzt.
- Pseudonyme sind keine Zusage vollständiger technischer Anonymität. Klarnamen, Secrets, Tokens, Produktionszugänge und nicht freigegebene personenbezogene Daten gehören nicht in Tool-, Agenten- oder Dossierartefakte.
- Jede zeitgebundene Aktivität besitzt eine fachlich gleichwertige untimierte Alternative; genehmigte individuelle Zeitunterstützung hat Vorrang.
- Fragen, Diagramme und Ergebnisse erhalten eine textliche beziehungsweise strukturelle Entsprechung. Farbe, Ton, Animation oder Raumposition tragen nie allein die Fachinformation.
- Aggregierte Fehlvorstellungen dürfen die nächste Erklärung oder ein neues Beispiel steuern. Sie begründen weder ein individuelles Urteil noch einen Wirksamkeits- oder Kausalnachweis.
