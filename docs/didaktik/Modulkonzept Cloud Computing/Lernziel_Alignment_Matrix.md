# Lernziel- und Alignment-Matrix Cloud Computing

## 1. Lesehilfe

- **IU Internationale Hochschule (IU)** bezeichnet die Hochschule. `DSCC0127` ist der Modulcode und `DSCC012701` der Kurscode.
- **Qualifikationsziel (QZ)** bezeichnet eines der fünf offiziellen Ziele, **Modulziel (MZ)** eines der neun operationalisierten Ziele und **Learning Indicator (LI)** einen beobachtbaren Lernindikator.
- **W01–W12** bezeichnet die Themenwochen 1 bis 12. Eine **Lerneinheit (LE)** umfasst zwei **Unterrichtseinheiten (UE)** à 45 Minuten und dauert 90 Minuten.
- **Multiple Choice (MC)** bezeichnet Aufgaben mit vorgegebenen Antwortmöglichkeiten. **MC-Test** bezeichnet die formative Lernanwendung.
- **Infrastructure as Code (IaC)** bezeichnet reproduzierbar beschriebene Infrastruktur. **Identity and Access Management (IAM)** bezeichnet Identitäts- und Berechtigungsverwaltung.
- **Site Reliability Engineering (SRE)** bezeichnet den mess- und automatisierungsorientierten Ansatz für zuverlässigen Betrieb. **Service Level Indicator (SLI)** bezeichnet eine Messgröße, **Service Level Objective (SLO)** ihren Zielwert.
- **Recovery Point Objective (RPO)** bezeichnet den tolerierten Datenverlustzeitraum; **Recovery Time Objective (RTO)** bezeichnet die angestrebte Wiederherstellungszeit.
- **Google Cloud Platform (GCP)**, **Amazon Web Services (AWS)** und Microsoft Azure sind die verbindlich verglichenen Plattformen.
- **Maschinelles Lernen (ML)** bezeichnet datenbasierte Modellverfahren. **Künstliche Intelligenz (KI)** ist der weitere Oberbegriff.
- **Financial Operations (FinOps)** verbindet technische Nutzung und Kostenverantwortung. **Total Cost of Ownership (TCO)** bezeichnet Gesamtkosten über die betrachtete Nutzungsdauer.
- **Architecture Decision Record (ADR)** bezeichnet eine nachvollziehbare Architekturentscheidung. **6R** bezeichnet Rehost, Replatform, Repurchase, Refactor, Retire und Retain.
- **p50**, **p95** und **p99** bezeichnen das 50., 95. und 99. Perzentil einer Messwertverteilung.
- **Portable Document Format (PDF)** bezeichnet ein plattformübergreifend darstellbares Dokumentformat.

## 2. Alignment-Regeln

Constructive Alignment bedeutet hier, dass Ziele, Lernaktivitäten, formative Rückmeldung und formale Prüfung dieselben Handlungen verlangen. Studierende klassifizieren, analysieren, entwerfen, messen, vergleichen, begrenzen, entscheiden und verteidigen.

Dabei gelten vier Grenzen:

1. arsnova.eu, MC-Test und Agentic Cloud Engineering Dossier liefern ausschließlich formative Evidenz.
2. Punkte, Rang, Geschwindigkeit, Teamstand, Boni, MC-Test-Ergebnisse, Dossierfortschritt und Agentenurteile sind keine Prüfungsleistung, keine Zulassungsvoraussetzung und keine Note.
3. Nicht jedes Referat prüft jeden LI einzeln. Das konkrete Thema bindet mindestens ein offizielles QZ ein und wählt dazu passende LI aus.
4. Formale Evidenz entsteht nur in der veröffentlichten Referatsprüfung aus schriftlicher Einreichung, Vortrag sowie Befragung und Diskussion.

## 3. Offizielle Qualifikationsziele und Modulbezug

| Ziel    | Offizielle Zielrichtung                                                  | Primäre Modulziele | Wochen            |
| ------- | ------------------------------------------------------------------------ | ------------------ | ----------------- |
| **QZ1** | Grundlagen des Cloud Computing und Cloud-Service-Modelle verstehen       | MZ1, ergänzend MZ9 | W01, W10–W12      |
| **QZ2** | technologische Voraussetzungen aktueller Cloud-Angebote erkennen         | MZ2, MZ6, MZ7, MZ8 | W02, W03, W07–W09 |
| **QZ3** | Prinzipien des Serverless Computing darlegen                             | MZ3                | W04               |
| **QZ4** | Merkmale etablierter Cloud-Angebote analysieren                          | MZ4, MZ9           | W05, W10–W12      |
| **QZ5** | Cloud-Optionen für Datenwissenschaft und maschinelles Lernen beschreiben | MZ5, ergänzend MZ9 | W06, W10–W12      |

FinOps, Nachhaltigkeit, 6R, Security, Observability, SRE und Resilienz sind querschnittliche Vertiefungen. Sie werden stets an mindestens eines der fünf offiziellen QZ zurückgebunden.

## 4. Neun operationalisierte Modulziele

| Ziel                                                   | Modulziel                                                                                                                                                                | Indikatoren |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| **MZ1: Cloud einordnen und Verantwortung abgrenzen**   | Fälle anhand von Cloud-Merkmalen, Dienst- und Bereitstellungsmodellen klassifizieren sowie Shared Responsibility einschließlich Nutzen und Risiken begründen             | LI01–LI03   |
| **MZ2: technische Cloud-Architekturen analysieren**    | Virtualisierung, Container, IaC, Netzwerk-, Schnittstellen-, Vertrauens- und Zustandsgrenzen in einer reproduzierbaren Architektur erklären und belegen                  | LI04–LI06   |
| **MZ3: Serverless-Eignung beurteilen**                 | Serverless-Prinzipien erklären und einen Kandidaten samt Gegenbeispiel nach Zustand, Laufzeit, Skalierung, Beobachtbarkeit, Kosten und Bindungsrisiko bewerten           | LI07–LI08   |
| **MZ4: etablierte Plattformen vergleichen**            | GCP, AWS und Microsoft Azure nach einem identischen Fähigkeits-, Verantwortungs-, Regionen-, Risiko-, Kosten- und Exit-Raster analysieren                                | LI09–LI11   |
| **MZ5: Daten- und ML-Optionen entwerfen**              | Cloud-Daten- und ML-Pipelines beschreiben und Varianten nach Reproduzierbarkeit, Qualität, Datenschutz, Betrieb und Wirtschaftlichkeit abgrenzen                         | LI12–LI14   |
| **MZ6: Zustand und Recovery beherrschen**              | persistenten, flüchtigen und lokalen Zustand unterscheiden sowie Backup und Wiederherstellung mit RPO, RTO, Integrität und ausgeführter Evidenz beurteilen               | LI15–LI16   |
| **MZ7: Skalierung und verteilte Systeme messen**       | Elastizität, vertikale und horizontale Skalierung, Queueing, Backpressure und Verteilungsprobleme erklären sowie belastbare Performance- und Fehlerexperimente entwerfen | LI17–LI18   |
| **MZ8: sicheren und zuverlässigen Betrieb beurteilen** | IAM, Least Privilege, Security, Observability, SRE und Resilienz in überprüfbare Kontrollen, Messgrößen und Restrisiken übersetzen                                       | LI19–LI21   |
| **MZ9: evidenzbasiert entscheiden und verteidigen**    | technische Evidenz mit FinOps, Nachhaltigkeit, TCO, 6R, Alternativen und Exit zu einer ADR verbinden und die Entscheidung im Referat fachlich vertreten                  | LI22–LI24   |

## 5. Genau 24 beobachtbare Learning Indicators

### MZ1: Cloud einordnen und Verantwortung abgrenzen

- **LI01:** Klassifiziert einen unbekannten Fall anhand belegter Cloud-Merkmale und grenzt ihn nachvollziehbar von Hosting, Outsourcing und bloßer Virtualisierung ab.
- **LI02:** Ordnet einen Fall einem Cloud-Dienstmodell und einem Bereitstellungsmodell zu und begründet die Zuordnung mit beobachtbaren Eigenschaften.
- **LI03:** Erstellt für einen konkreten Dienst eine Shared-Responsibility-Matrix und beurteilt mindestens einen Nutzen, ein Risiko und eine offene Verantwortungsfrage.

### MZ2: technische Cloud-Architekturen analysieren

- **LI04:** Zeichnet für arsnova.eu einen belegten Anfrage- und Zustandsweg über Reverse Proxy, App, PostgreSQL, Redis und den PDF-Worker nach und kennzeichnet implementierte sowie nicht implementierte Teile.
- **LI05:** Unterscheidet virtuelle Maschine, Image, Container, Compose, Orchestrierung und IaC und überführt die benötigten Fähigkeiten in einen reproduzierbaren Provisioning-Entwurf.
- **LI06:** Identifiziert Netzwerk-, Vertrauens-, Schnittstellen-, Realtime- und Zustandsgrenzen und leitet daraus mindestens eine Anforderung sowie eine Hürde für mehrere App-Instanzen ab.

### MZ3: Serverless-Eignung beurteilen

- **LI07:** Erklärt Function as a Service und Backend as a Service und grenzt Funktion, Container, Job, Queue-Worker und verwalteten Dienst anhand gleicher Kriterien ab.
- **LI08:** Bewertet einen geeigneten und einen ungeeigneten Serverless-Kandidaten nach Trigger, Zustand, Laufzeitgrenze, Cold Start, Skalierung, Observability, Kosten und Anbieterbindung und belegt die Entscheidung mit einer Gegenprobe.

### MZ4: etablierte Plattformen vergleichen

- **LI09:** Normalisiert Produktnamen von GCP, AWS und Microsoft Azure auf vergleichbare Fähigkeiten für Compute, Container, Serverless, Netzwerk, Storage, Datenbank und Observability.
- **LI10:** Vergleicht die drei Plattformen auf derselben Systemgrenze nach Verantwortung, Region, Datenresidenz, Sicherheitsoption, Leistungsannahme und Kostenbestandteil.
- **LI11:** Prüft volatile Anbieterangaben an datierten Primärquellen und verteidigt eine Plattformoption einschließlich Preisbasis, Egress, Bindungsrisiko und Exit.

### MZ5: Daten- und ML-Optionen entwerfen

- **LI12:** Modelliert eine Cloud-Daten- und ML-Pipeline von Aufnahme und Speicherung über Batch- oder Stream-Verarbeitung bis Bereitstellung, Monitoring und Fallback.
- **LI13:** Erstellt für den Datenfall ein Dateninventar und einen Datenfluss und beurteilt Minimierung, Zweck, Rollen, Zugriff, Region, Aufbewahrung, Löschung sowie Daten- und Modellexport.
- **LI14:** Vergleicht mindestens zwei ML-Betriebsoptionen anhand desselben freigegebenen Datenfalls nach Qualität, Reproduzierbarkeit, Latenz, Ressourcen, Datenschutz und Kosten und kennzeichnet ein Zielbild als nicht implementiert.

### MZ6: Zustand und Recovery beherrschen

- **LI15:** Klassifiziert den Zustand von arsnova.eu nachvollziehbar als persistent, flüchtig oder lokal und ordnet PostgreSQL, Redis, Yjs beziehungsweise IndexedDB, Konfiguration und Exporte einem Verantwortungs- und Sicherungsbedarf zu.
- **LI16:** Formuliert RPO, RTO, Integritäts- und Idempotenzkriterien und beurteilt eine tatsächlich ausgeführte Wiederherstellung anhand von Zeit, Datenverlust, Prüfergebnis, Kosten und Gültigkeitsgrenze.

### MZ7: Skalierung und verteilte Systeme messen

- **LI17:** Erklärt Elastizität, vertikale und horizontale Skalierung, Queueing, Backpressure, Affinität und verteilten Zustand und identifiziert konkrete Scale-out-Hürden der heutigen arsnova.eu-Architektur.
- **LI18:** Entwirft ein reproduzierbares Performance- oder Fehlerexperiment mit Hypothese, Workload, Umgebung, p50/p95/p99, Durchsatz, Fehlerrate, Sättigung, Abbruchkriterium, Rohdatenbezug und Wiederholung und trennt lokale Verifikation von Produktionsbeobachtung.

### MZ8: sicheren und zuverlässigen Betrieb beurteilen

- **LI19:** Entwirft für einen isolierten Cloud-Fall IAM-, Least-Privilege-, Secret-, Netzwerk- und Supply-Chain-Kontrollen und verifiziert mindestens eine Kontrolle mit einem Negativtest.
- **LI20:** Leitet aus Logs, Metriken und Traces geeignete SLI und SLO ab und verbindet sie mit Alarm, Runbook, Verantwortlichkeit und einer begründeten SRE-Maßnahme.
- **LI21:** Prüft einen Ausfall-, Überlastungs- oder Fehlkonfigurationsfall und dokumentiert die Kette Befund, Risiko, Maßnahme, Verifikation, Graceful Degradation, Recovery und Restrisiko.

### MZ9: evidenzbasiert entscheiden und verteidigen

- **LI22:** Erstellt ein TCO-, FinOps- und Nachhaltigkeitsmodell mit gleicher Systemgrenze, Infrastruktur, Personal, Betrieb, Security, Backup, Energie, Auslastung, Egress, Unit Costs und Best-, Base- sowie Worst-Case.
- **LI23:** Vergleicht die 6R-Optionen und dokumentiert eine ADR mit Evidenz, Annahmen, Sensitivität, stärkster verworfener Alternative, Nachhaltigkeitsfolge, Risiko und Exit-Kriterium.
- **LI24:** Verteidigt in einem 15-minütigen Referat eine abgegrenzte Cloud-These mit korrekten Quellen, verständlicher Visualisierung, technischer Evidenz, Status- und Gültigkeitsgrenzen, eigener Entscheidung sowie begründeten Antworten zu Alternativen und KI-Beiträgen.

## 6. Vollständiges Constructive Alignment

Die Spalte zur Referatsprüfung beschreibt mögliche formale Evidenz für ein passend zugeordnetes Thema. Sie erzeugt keine zusätzlichen Prüfungsbestandteile.

| LI       | Ziel        | Woche und LE | Lernaktivität                                                         | Formative arsnova.eu-Evidenz                                                 | Formative MC-Test-Evidenz                                                 | Formative Dossier-Evidenz                           | Mögliche formale Referatsevidenz                                                      |
| -------- | ----------- | ------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **LI01** | QZ1/MZ1     | W01, LE      | Fall mit Cloud-Merkmalen klassifizieren und Gegenfall prüfen          | Kategorisierung mit Begründung und anschließender Fehlvorstellungsdiskussion | Transferitems zur Abgrenzung; Wiederabruf nach zwei bis vier Wochen       | belegte Cloud-Klassifikation mit offener Annahme    | im Handout oder Vortrag Hosting und Cloud am Prüfungsthema abgrenzen                  |
| **LI02** | QZ1/MZ1     | W01, LE      | Dienst- und Bereitstellungsmodelle an Fällen zuordnen                 | Zuordnung oder Matching mit Peer-Erklärung                                   | Anwendungsitems zu Dienst- und Bereitstellungsmodellen                    | begründete Modellzuordnung                          | Modellwahl am eigenen Fall erklären und in der Diskussion verteidigen                 |
| **LI03** | QZ1/MZ1     | W01, LE      | Shared Responsibility aus Kunden- und Anbietersicht vergleichen       | Multiple-Choice-Kontrast zu typischen Verantwortungsfehlern                  | Fallitems zu Verantwortung, Nutzen und Risiko                             | Responsibility-Matrix                               | Zuständigkeit, Risiko und offene Annahme des Referatfalls begründen                   |
| **LI04** | QZ2/MZ2     | W02–W03, LE  | belegten Anfrage- und Zustandsweg im Repository nachvollziehen        | Reihenfolge der Komponenten mit Auflösung nach Frageschluss                  | Architekturitems mit implementiertem und geplantem Teil                   | belegtes Ist-Diagramm                               | Architekturabbildung mit Quellen und Statusgrenzen erläutern                          |
| **LI05** | QZ2/MZ2     | W02–W03, LE  | Abstraktionen vergleichen und Provisioning-Entwurf erstellen          | Zuordnung von Fähigkeit und Technik                                          | Anwendungsitems zu virtueller Maschine, Container, Orchestrierung und IaC | versionierter Provisioning-Entwurf                  | technologische Voraussetzung und Reproduzierbarkeit zeigen                            |
| **LI06** | QZ2/MZ2     | W02–W03, LE  | Netzwerk-, Vertrauens-, Realtime- und Zustandsgrenzen markieren       | Kategorisierung von Pfaden und Risiken                                       | Fallitems zu Netzwerk, Schnittstellen und verteiltem Zustand              | Grenz- und Hürdenanalyse                            | mindestens eine Architekturhürde und eine Lösungshypothese verteidigen                |
| **LI07** | QZ3/MZ3     | W04, LE      | Serverless-Modelle und Ausführungsformen vergleichen                  | Matching von Form, Eigenschaft und Grenze                                    | Begriffs- und Transferitems; späterer Wiederabruf                         | Kriterienraster                                     | Prinzip, Nutzen und Grenze fachlich korrekt darlegen                                  |
| **LI08** | QZ3/MZ3     | W04, LE      | Kandidat und Gegenbeispiel prüfen                                     | Rating einer vorläufigen Eignung mit anschließender Begründung               | Fallitems zu Zustand, Cold Start, Laufzeit, Kosten und Bindung            | Serverless-Eignungsmatrix mit Gegenprobe            | Entscheidung mit Mess- oder Testevidenz und Gegenargument vertreten                   |
| **LI09** | QZ4/MZ4     | W05, LE      | Anbieterprodukte auf Fähigkeiten normalisieren                        | Zuordnung gleicher Fähigkeiten über drei Plattformen                         | Vergleichsitems ohne Produktnamen-Hinweise                                | Capability-Matrix                                   | Plattformangebote anhand gleicher Fähigkeiten erklären                                |
| **LI10** | QZ4/MZ4     | W05, LE      | drei Plattformen auf gleicher Systemgrenze vergleichen                | Kategorisierung von Verantwortung, Region und Risiko                         | komplexe Vergleichsitems; Wiederabruf in W10                              | normalisierter Plattformvergleich                   | symmetrischen Vergleich in Einreichung und Vortrag nachweisen                         |
| **LI11** | QZ4/MZ4     | W05/W10, LE  | volatile Aussage an Primärquelle prüfen und Option auswählen          | Kurzantwort zu fehlender Quelleninformation                                  | Quellenkritik- und Entscheidungsszenarien                                 | Quellenblatt mit Datum, Region, Preisbasis und Exit | Quellenqualität, Kostenannahme und Anbieterbindung in der Befragung verteidigen       |
| **LI12** | QZ5/MZ5     | W06, LE      | Daten- und ML-Pipeline modellieren                                    | Reihenfolge von Aufnahme bis Fallback                                        | Pipeline- und Transferitems                                               | versionierter Daten- und Dienstfluss                | Daten- oder ML-Option mit Betriebsfolgen erklären                                     |
| **LI13** | QZ5/MZ5     | W06, LE      | Dateninventar und Privacy-Datenfluss prüfen                           | Kategorisierung zulässiger und unzulässiger Datenpfade                       | Fallitems zu Minimierung, Region, Löschung und Export                     | Dateninventar, Zweck- und Rollenmatrix              | Datenschutzentscheidung und Grenze am Thema begründen                                 |
| **LI14** | QZ5/MZ5     | W06, LE      | ML-Optionen auf gleicher Daten- und Messbasis vergleichen             | numerische Schätzung einer Ressourcengröße mit anschließender Quellenkritik  | Vergleichsitems zu Qualität, Latenz, Ressourcen und Kosten                | Optionenblatt mit Zielbildkennzeichnung             | Variantenvergleich samt nicht implementierter Option und Gegenalternative verteidigen |
| **LI15** | QZ2/MZ6     | W03/W07, LE  | Zustand klassifizieren und Sicherungsbedarf zuordnen                  | Matching von Zustand, Speicherort und Verantwortung                          | Anwendungsitems zu Persistenz, Cache und lokalem Zustand                  | Zustands- und Ownership-Matrix                      | Datenhaltung und Sicherungsgrenze des Referatfalls erklären                           |
| **LI16** | QZ2/MZ6     | W07, LE      | Recovery-Ziele festlegen und Restore-Nachweis prüfen                  | Reihenfolge eines Recovery-Ablaufs                                           | Fehlerfallitems zu RPO, RTO, Integrität und Idempotenz                    | ausgeführter Recovery-Bericht                       | Wiederherstellungsbehauptung durch Messung und Integritätsprüfung belegen             |
| **LI17** | QZ2/MZ7     | W08, LE      | Skalierungsvarianten und Verteilungsprobleme analysieren              | Kategorisierung von Scale-up, Scale-out, Queue und Backpressure              | Transferitems zu Elastizität und verteiltem Zustand                       | Scale-out-Hürdenkarte                               | keine Skalierbarkeit behaupten, sondern Architekturhypothese und Hürden begründen     |
| **LI18** | QZ2/MZ7     | W08, LE      | Performance- oder Fehlerexperiment entwerfen und Daten prüfen         | Schätzfrage zu einer Messgröße mit Auflösung und Grenzen                     | Messdesign- und Evidenzstufenitems                                        | reproduzierbarer Messplan und Bericht               | Messumgebung, Kennzahlen, Resultat und Gültigkeitsgrenze verteidigen                  |
| **LI19** | QZ2/MZ8     | W09, LE      | Rechte- und Kontrollmodell erstellen und negativ testen               | Zuordnung von Bedrohung und Kontrolle                                        | Security-Fallitems; späterer Wiederabruf                                  | IAM-, Netzwerk- und Supply-Chain-Nachweis           | Kontrolle und Negativtest einschließlich Restrisiko erläutern                         |
| **LI20** | QZ2/MZ8     | W09, LE      | SLI/SLO, Alarm und Runbook aus einem Betriebsziel ableiten            | Kurzantwort zu fehlender Beobachtbarkeit                                     | Observability- und SRE-Fallitems                                          | Telemetrie- und Alarmvertrag                        | messbares Betriebsziel und Reaktionsweg am Prüfungsthema begründen                    |
| **LI21** | QZ2/MZ8     | W09, LE      | Ausfall injizieren, Degradation und Recovery prüfen                   | Reihenfolge von Befund bis Restrisiko                                        | Resilienz- und Negativtestitems                                           | Befund-Maßnahme-Verifikation-Restrisiko-Kette       | Fehlerfall, Maßnahme, Gegenprobe und verbleibendes Risiko verteidigen                 |
| **LI22** | QZ4/QZ5/MZ9 | W10, LE      | technisches und wirtschaftliches Modell auf gleicher Grenze erstellen | Schätzfrage zu Unit Cost mit Annahmenbesprechung                             | FinOps-, Nachhaltigkeits- und Sensitivitätsitems                          | TCO-/FinOps-/Nachhaltigkeitsmodell                  | Kosten- und Nachhaltigkeitsannahmen mit technischer Evidenz verbinden                 |
| **LI23** | QZ1–QZ5/MZ9 | W10–W11, LE  | 6R-Optionen und stärkste Gegenalternative in ADR entscheiden          | Ranking von Alternativen mit anschließender Begründung                       | Entscheidungs- und Transferitems                                          | ADR mit Sensitivität, Risiko und Exit               | klare These, Alternative und Entscheidungsfolge in Einreichung und Vortrag darstellen |
| **LI24** | QZ1–QZ5/MZ9 | W11–W12, LE  | Probevortrag und fachliche Befragung mit Quellenkritik durchführen    | offene Rückfrage oder Exit Ticket ohne Punktewirkung                         | kumulativer Abruf und persönliche Fehlerliste                             | Referatsskizze, Quellen- und Evidenzregister        | 15-minütige individuelle Leistung aus Einreichung, Vortrag und Diskussion             |

## 7. Bezug zur formalen Referatsprüfung

Die Planungsbasis umfasst insgesamt 15 Minuten mündliche Prüfung je Prüfling. Schriftliche Einreichung, visuell unterstützter Vortrag sowie Befragung und Diskussion werden nach den offiziellen Gewichten 30 Prozent, 30 Prozent und 40 Prozent berücksichtigt. Die konkrete Prüfungsaufgabe legt Thema, Format, Hilfsmittel und Zuordnung fest.

Für ein alignedes Referat gilt:

1. Das Thema weist mindestens ein offizielles QZ aus.
2. Die These verlangt beobachtbare Handlungen aus den zugeordneten MZ und LI.
3. Ein technischer Nachweis wird mit Quelle, Umgebung und Gültigkeitsgrenze dargestellt.
4. Mindestens eine ernsthafte Alternative wird fair geprüft.
5. Die Entscheidung wird in Einreichung und Vortrag verständlich aufgebaut und in der Diskussion individuell vertreten.
6. Agenten- und Toolbeiträge werden nur im formal erlaubten Umfang genutzt und transparent gemacht; die fachliche Verantwortung bleibt beim Prüfling.

Die Alignment-Matrix ist kein Punkteschema für die formativen Werkzeuge und führt keine vierte Prüfungsleistung neben den drei offiziellen Referatsbestandteilen ein.
