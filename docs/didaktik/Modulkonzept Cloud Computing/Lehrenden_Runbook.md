# Lehrenden-Runbook Cloud Computing

**Stand:** 13.09.2026 · **Status:** operative Kursfassung

Dieses Runbook setzt den Kurs mit zwölf Wochen und 36 betreuten Unterrichtseinheiten um. Die fachliche Füllung, der verbindliche Wochenwortschatz und die Lernprodukte stehen im [Wochenlehrplan](./Wochenlehrplan_Cloud_Computing_12_Wochen.md). Das Runbook ist nur zusammen mit diesem Lehrplan und dem [Datenmanagement- und Datenschutzplan](./Datenmanagement_Datenschutz.md) freigegeben. Offene institutionelle, datenschutzrechtliche oder prüfungsorganisatorische Gates werden nicht durch Annahmen ersetzt.

## 1. Begriffe, Evidenzstufen und Rollen

### 1.1 Begriffe und Zeitnotation

- **Unterrichtseinheit (UE):** 45 Minuten.
- **Lerneinheit (LE):** die ersten zwei UE einer Woche als zusammenhängender 90-Minuten-Block.
- **W01–W12:** Kurswochen 1 bis 12.
- **L01–L10:** die zehn ARSnova-Livefragen einer Woche in der Reihenfolge der Importdatei.
- **Multiple Choice (MC):** Aufgaben mit vorgegebenen Antwortoptionen; **MC-Test** bezeichnet hier die formative Lernanwendung.
- **Fragen und Antworten (Q&A):** der moderierte ARSnova-Fragenkanal.
- **Agentic Cloud Engineering Dossier (Dossier):** formative Arbeits- und Quellenbasis mit Aufträgen, Änderungen, Prüfungen, Messungen und Entscheidungen.
- **Barrierefreiheit (Accessibility, A11y):** zugängliche Bedienung und gleichwertige Wahrnehmungs- und Antwortwege.
- **Infrastructure as Code (IaC):** versioniert und reproduzierbar beschriebene Infrastruktur.
- **Architecture Decision Record (ADR):** nachvollziehbare Dokumentation einer Architekturentscheidung.
- **Google Cloud Platform (GCP), Amazon Web Services (AWS) und Microsoft Azure:** die drei verbindlich verglichenen Cloud-Plattformen.
- **Identity and Access Management (IAM):** Identitäts- und Berechtigungsverwaltung.
- **Site Reliability Engineering (SRE):** mess- und automatisierungsorientierter Ansatz für zuverlässigen Betrieb.
- **Financial Operations (FinOps):** Verbindung technischer Nutzung mit Kostenverantwortung.
- **Total Cost of Ownership (TCO):** Gesamtkosten über die betrachtete Nutzungsdauer.
- **Recovery Point Objective (RPO):** tolerierter Datenverlustzeitraum; **Recovery Time Objective (RTO):** angestrebte Wiederherstellungszeit.
- **Service Level Indicator (SLI):** Messgröße für Dienstqualität; **Service Level Objective (SLO):** zugehöriger Zielwert.
- **Portable Document Format (PDF):** Dokumentformat, unter anderem für Ergebnisberichte.
- **Comma-Separated Values (CSV):** textuelles Tabellenformat für Exporte.
- **Identifier (ID):** technische Kennung; sie ist kein Kompetenzmaß.
- **6R:** Rehost, Replatform, Repurchase, Refactor, Retire und Retain.
- **LIVE:** Daten aus dem konkreten Kurslauf; **REPO:** versionierte Repository-Nachweise; **LEHRDATEN:** synthetische Übungsdaten.
- **OFFLINE:** Herkunftszusatz für ohne Plattform erhobene Kursdaten; `LIVE/OFFLINE` bleibt LIVE und unterliegt demselben Datenschutzplan.
- **D:** Kalendertag des Wochentermins. `D+2` und `D+14` bedeuten zwei beziehungsweise vierzehn Kalendertage danach, jeweils zur selben lokalen Uhrzeit wie der Terminbeginn.
- **H-0:30:** dreißig Minuten vor Beginn des Wochentermins.
- **T0:** dokumentiertes Ende eines Daten- oder Bearbeitungsfensters.

Evidenzstufen werden im gesamten Kurs wörtlich so verwendet:

- **Implementiert:** in aktuellem Code oder aktueller Konfiguration vorhanden; keine Aussage über einen laufenden Produktivstand.
- **Lokal verifiziert:** durch einen dokumentierten lokalen Lauf belegt; kein Produktions-SLO.
- **Produktiv beobachtet:** in einem datierten Produktionslauf beobachtet; nur für dessen Szenario und Messgrenzen gültig.
- **Zielbild:** Entwurf, Gate oder geplante Funktion; weder implementiert noch freigegeben.

### 1.2 Rollen

| Kürzel | Rolle                                         | Verbindliche Verantwortung                                                      |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------- |
| **MV** | Modulverantwortung                            | curricularer Rahmen, institutionelle Gates, Prüfung und Abweichungsentscheidung |
| **LD** | Lehrdurchführung und ARSnova-Session-Host     | Wochen-Preflight, Moderation, Export und Wochenprotokoll                        |
| **TU** | Tutor:in                                      | Durchführung der Tutoriumswochen nach demselben Ablauf                          |
| **IR** | Item-Redaktion                                | Livefragen, MC-Items, Lösungen, Erklärungen und Quellenprüfung                  |
| **LB** | Lehrlaborbetrieb                              | isolierte Zielserver, Agentenzugänge, Quotas, Abbruch und Cleanup               |
| **QE** | Qualitätsverantwortung                        | Vier-Augen-Prüfung, aggregierte Lehrbefunde und Nachsteuerung                   |
| **DS** | Datenschutz- und Informationssicherheitsrolle | Zweck, Zugriff, Löschfristen, Incidents und Abwesenheitsnachweise               |
| **AP** | ARSnova-Plattformbetrieb                      | technische Plattformprüfung sowie angeordnete Löschung                          |
| **MP** | MC-Test-Plattformbetrieb                      | Laufzeitkonfiguration, Fenster und technische Löschung                          |
| **ZH** | Zoom-Co-Host                                  | Fortführung, Breakout-Rechte und Ersatzkanal bei Hostausfall                    |

Eine Person darf mehrere Bedienrollen übernehmen. Inhaltliche Freigabe und Löschkontrolle bleiben als dokumentiertes Vier-Augen-Prinzip bei zwei Rollen.

## 2. Harte Betriebsregeln

1. Der Kurs umfasst exakt zwölf Wochen mit je drei UE. UE 1 und UE 2 bilden eine 90-minütige LE; UE 3 umfasst ausschließlich drei Minuten Übergang, 32 Minuten MC-Test und zehn Minuten aggregierte Ergebnis- und Lösungsbesprechung.
2. Frühere Lernprodukte aus UE 3 werden in die 90-minütige LE und das Selbststudium integriert. Sie erzeugen keine vierte UE und keine zusätzliche Prüfungsleistung.
3. W01, W02, W04, W05, W06 und W09 sind Präsenz beziehungsweise synchron; W03, W07, W08, W10, W11 und W12 sind Tutorien.
4. Jede Woche nutzt genau zehn ARSnova-Fragen, jeden der zehn freigegebenen Fragetypen genau einmal und ausschließlich `MEDIUM` oder `HARD`. Die Typen sind `MULTIPLE_CHOICE`, `SINGLE_CHOICE`, `FREETEXT`, `SHORT_TEXT`, `SURVEY`, `RATING`, `NUMERIC_ESTIMATE`, `MATCHING`, `ORDERING` und `CATEGORIZATION`.
5. Das ARSnova-Profil bleibt unverändert: automatisch vergebene Kindergarten-Pseudonyme, keine eigenen Nicknames, Rangliste, vier automatisch gebildete Teams `Apfel :apple:`, `Birne :pear:`, `Banane :banana:` und `Apfelsine :orange:`, drei Boni, Sound-, Belohnungs-, Motivations- und Emoji-Effekte, Standardtimer 60 Sekunden, Schwierigkeitsskalierung, persönliche Zeitunterstützung und Lesephase. Hintergrundmusik bleibt `null`.
6. Rang, Punkte, Geschwindigkeit, Teamstand, Boni, Reaktionen und persönliche Zeitwahl sind ausschließlich Spiel- und Zugangselemente. Sie sind kein Kompetenzmaß.
7. Während einer bewertbaren ARSnova-Frage werden Lösung, Referenzwert und Richtig-Markierung nicht an Teilnehmende offengelegt. Die Auflösung beginnt erst nach dem Schließen der Frage. Umfragen und Ratings werden ausdrücklich als unbewertet bezeichnet.
8. Der MC-Test enthält genau 30 Items, läuft im Modus `practice`, gibt Sofortfeedback, besitzt keinen technischen Countdown und wird mit `show_top5_public=false` betrieben.
9. Toolteilnahme ist freiwillig und ohne Notennachteil. Jede zeitgebundene Aktivität besitzt denselben Inhalt als untimierte, barrierearme Alternative.
10. Fachinformation wird nie ausschließlich durch Farbe, Ton, Animation, Emoji, räumliche Position oder Zeitdruck vermittelt.
11. Live-, MC-Test- und sonstige Toolergebnisse dienen ausschließlich der Lehre und internen Qualitätssicherung. Ausgeschlossen sind individuelle Leistungsbewertung, Anwesenheitskontrolle, Forschung, Publikation und personenbezogene Leistungsprofile.
12. Repository- und Laborarbeit erfolgt nur auf einem festgelegten Commit in isolierten Nichtproduktionsumgebungen. Produktionszugänge, Echtdaten, unbudgetierte Ressourcen und Produktivlasttests sind ausgeschlossen.
13. Eine Agentenausgabe ist kein Nachweis. Jede wesentliche Aussage benötigt Quelle oder Messartefakt, Evidenzstufe und Gültigkeitsgrenze.

## 3. Semester-Preflight

### 3.1 Vier Wochen vor W01

MV eröffnet den Kurs erst, wenn alle folgenden Gates dokumentiert grün sind:

- Prüfungsform, zulässiger Agenteneinsatz und Offenlegungspflichten sind für den konkreten Kurslauf institutionell bestätigt.
- Verantwortlichkeit, Plattformrollen, Rechtsgrundlage, Transparenzinformation, Speicherorte, Löschwege und gegebenenfalls erforderliche Verträge sind durch die zuständigen institutionellen Stellen geklärt. Dieses Runbook setzt keine Rechtsgrundlage.
- Präsenz- und Zoom-Lauf verwenden dieselben Lernziele, Nettozeiten, Dateien, Quellenstände, Laborprofile, Rechte, Budgets und Prüfungsinformationen.
- Der verwendete Repository-Commit sowie der festgeschriebene MC-Test-Stand `b6b159555e8a228dad73dd75fd66c154a1088e28` sind im Kursmanifest eingetragen.
- Für jede Gruppe steht ein rücksetzbarer Zielserver oder eine gleichwertige Sandbox ohne Produktionsdaten und Produktionszugänge bereit.
- Agentenmodell, Systemauftrag, Werkzeugprofil, erlaubte Ziele, Rechte, Laufzeit, Token-/Cloudkosten, Akzeptanz- und Abbruchkriterien sind versioniert.
- ARSnova- und MC-Test-Plattformbetrieb haben Export, Löschung und Abwesenheitsprüfung zugesagt.
- Ein institutionell verwalteter, verschlüsselter Arbeitsbereich mit rollenbasiertem Zugriff ist eingerichtet.
- Raum, Projektion, Audio, Strom, Netz und Ersatzgeräte beziehungsweise Zoom, Co-Host, Breakouts, Bildschirmfreigabe und Ersatzkanal sind gebucht.

Ist ein Gate rot, sammelt der Kurs keine LIVE-Daten und startet keine externen Laborressourcen. Die betroffene Aktivität wird mit REPO-Material oder LEHRDATEN offline durchgeführt.

### 3.2 Zwei Wochen vor W01

IR, LD, QE, LB, AP und MP führen einen vollständigen Probelauf aus:

1. Alle zwölf ARSnova-Dateien und alle zwölf MC-Test-Dateien liegen im Materialordner vor.
2. Die geteilten Schemas sind gebaut und der lokale Paketvalidator läuft ohne Fehler:

   ```bash
   npm run build -w @arsnova/shared-types
   node "docs/didaktik/Modulkonzept Cloud Computing/validate_module.mjs"
   ```

3. Jede ARSnova-Datei wird in eine Nichtproduktionssession importiert und mit getrenntem Host- und Teilnehmerprofil durchgespielt.
4. In der Lesephase sind Frage und zugänglicher Antwortweg verständlich; in `ACTIVE` fehlen Richtig-Markierungen; erst `RESULTS` zeigt die Lösung.
5. `Standard`, `10× Zeit` und `Ohne Frist` werden in der Teilnehmeransicht praktisch geprüft. Ein Host-Override wird nicht als normaler Ablauf eingeplant.
6. Jede MC-Datei wird mit dem festgeschriebenen Validator geprüft, danach im tatsächlichen Deployment importiert.
7. Ein frisches, nicht administratives Browserprofil bestätigt `practice`, Sofortfeedback, fehlenden technischen Countdown und fehlende öffentliche Top-Fünf.
8. Für jede Woche liegen eine zugängliche Offline-Fragenfassung, anonyme Antwortkarten beziehungsweise ein strukturierter Antwortbogen sowie eine getrennte Lösungsfassung vor.
9. Das Labor wird aus dem festgelegten Ausgangszustand erstellt, geprüft, abgebrochen, zurückgesetzt und vollständig zerstört.
10. Präsenz- und Zoom-Probelauf verwenden dieselben Eingaben und erzeugen dieselben erwarteten Lernartefakte.

### 3.3 Sieben Tage vor jeder Woche

IR übergibt LD und QE:

- freigegebene Live- und MC-Datei;
- lesbare Fragen- und Lösungsansicht;
- Material- und Quellenmanifest mit Repository-Commit und Abrufdatum volatiler Provider- oder Preisquellen;
- ein maximal einseitiges LE-Arbeitsblatt für Repository-, Konfigurations- oder Laborarbeit;
- die untimierte Alternative in zugänglichem Digitalformat und druckbarer Fassung;
- Erwartungshorizont, häufige Fehlvorstellungen und zulässige Aussagegrenzen;
- das in LE und Selbststudium integrierte Dossierartefakt.

LD prüft zusätzlich:

- zehn Livefragen, zehn unterschiedliche Typen, korrekte Reihenfolge und ausschließlich mittlere oder schwere Schwierigkeit;
- exakte ARSnova-Konfiguration einschließlich Zeitunterstützung, Effekten, Teams und Lesephase;
- keine Namen, Secrets, Tokens, Sessioncodes oder Produktionsdaten in Folien, Screenshots, Agentenprompts oder Dossier-Vorlagen;
- 30 MC-Items, vier eindeutige Optionen, 12 Items mit Gewicht 2 und 18 mit Gewicht 3, eigenständige Erklärungen und zwei bis vier Glossareinträge;
- Lösungen und Distraktoren durch IR und QE fachlich geprüft;
- Offline-Dateien lokal verfügbar, ohne Online-Link oder Cloudzugriff öffnen zu müssen;
- die anwendbaren A11y-Prüfpunkte: Tastatur, sichtbarer Fokus, 200-Prozent-Zoom, Reflow, Kontrast, Alternativtexte, verständliche Linknamen, Untertitelweg und reduzierte Bewegung;
- Löschdatum und Verantwortliche für jedes erwartete Laufzeitartefakt.

### 3.4 Ein Tag vor der Woche

LD gibt die Woche nur frei, wenn jede Antwort „ja“ lautet:

- Öffnen Host-, Teilnehmer- und Projektionsansicht in getrennten Browserprofilen?
- Ist die Wochen-Datei unverändert gegenüber dem freigegebenen Prüfsummenstand?
- Bleibt die Lösung in Lese- und Aktivphase geheim?
- Funktionieren Pseudonyme, Teams, Rangliste, Boni, Effekte, Lesephase und persönliche Zeit?
- Ist die untimierte Alternative ohne Login- oder Gerätezwang vollständig nutzbar?
- Zeigt der MC-Test Lernmodus, Sofortfeedback, keinen Countdown und keine öffentliche Top-Fünf?
- Sind 3 + 32 + 10 Minuten in UE 3 reserviert?
- Sind Repository-Commit, Quellenstand, Laborziel, Rechte, Kostenlimit, Abbruch und Cleanup eindeutig?
- Sind geschützter Exportordner, Datenregister und Löschhandoff vorbereitet?
- Sind Offline-, Netz-, Geräte-, Projektions-, Agenten-, Zielserver- und Zoom-Fallback verfügbar?

Bei einem „nein“ wird die betroffene Onlinefunktion nicht eingesetzt. Abschnitt 9 bestimmt den Ersatzweg.

### 3.5 H-0:30

1. LD beziehungsweise TU öffnet nur die freigegebenen Originaldateien; spontane Änderungen am Quiz sind verboten.
2. Eine nicht curriculare ARSnova-Probesession bestätigt Host-, Teilnehmer- und Projektionsweg und wird danach beendet.
3. Das ARSnova-Profil wird ein letztes Mal vollständig geprüft.
4. Der MC-Test wird in einem frischen Teilnehmerprofil geprüft.
5. LB bestätigt Zielserverstatus, Kosten-/Zeitlimit, Abbruchkanal und automatischen Cleanup.
6. Offline-Fragen, Antwortmaterial, Repository-Ausschnitte und vorab erzeugte Referenzausgaben werden lokal geöffnet.
7. Die Startfolie zeigt Freiwilligkeit, fehlende Notenwirkung, Pseudonymität ohne Anonymitätsversprechen, untimierte Alternative und das Verbot von Personen- oder Geheimdaten in Freitext.
8. Im Zoom-Lauf bestätigt ZH Co-Host-Rechte, Breakouts, schriftliche Aufträge und institutionellen Ersatzkanal. Unterricht wird standardmäßig nicht aufgezeichnet.

## 4. Zwölf-Wochen-Betriebsplan

Die folgende Tabelle ist der operative Kurzüberblick. Leitfragen, Inhalte, Fachbegriffe, Quellenanker und die genaue inhaltliche Füllung der UE stehen im [kanonischen Wochenlehrplan](./Wochenlehrplan_Cloud_Computing_12_Wochen.md).

| Woche | Typ              | Thema der 90-minütigen LE                     | In LE und Selbststudium integrierter Dossierertrag                                           |
| ----- | ---------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| W01   | Präsenz/synchron | Grundlagen, Modelle und Shared Responsibility | belegte Cloud-Einordnung mit Verantwortung, Nutzen, Risiko und offener Annahme               |
| W02   | Präsenz/synchron | Container, IaC und Netzwerk                   | Technologiematrix und reproduzierbarer Provisioning-Entwurf                                  |
| W03   | Tutorium         | Deployment, Härtung und Zustand               | Ist-Diagramm, Härtungsnachweis sowie persistenter, flüchtiger und lokaler Zustand            |
| W04   | Präsenz/synchron | Serverless                                    | Eignungsmatrix für geeigneten und ungeeigneten Kandidaten mit Gegenprobe                     |
| W05   | Präsenz/synchron | GCP, AWS und Microsoft Azure                  | normalisierter Plattformvergleich mit Region, Verantwortung, Kostenannahme und Exit          |
| W06   | Präsenz/synchron | Daten und maschinelles Lernen                 | Datenfluss und Optionenvergleich mit Qualitäts-, Datenschutz-, Betriebs- und Kostenkriterien |
| W07   | Tutorium         | Storage, Datenbanken und Recovery             | Zustands- und Recovery-Matrix mit RPO, RTO, Integrität und ausgeführter Wiederherstellung    |
| W08   | Tutorium         | Skalierung, Performance und Distribution      | reproduzierbarer Last- oder Fehlerplan mit SLI, SLO, Abbruch und Evidenzgrenze               |
| W09   | Präsenz/synchron | Security, Observability, SRE und Resilienz    | Befund, Risiko, Maßnahme, Verifikation und Restrisiko                                        |
| W10   | Tutorium         | FinOps, Nachhaltigkeit und 6R                 | TCO-/Sensitivitätsmodell und ADR mit stärkster Alternative und Exit                          |
| W11   | Tutorium         | ADR und Referat                               | referatsfähige These, Quellen- und Visualisierungsskizze sowie Gegenalternative              |
| W12   | Tutorium         | Synthese und Verteidigung                     | 15-minütige Probe, persönliche Korrekturliste und begrenzte Schlussaussage                   |

UE 3 jeder Woche bleibt vollständig dem formativen MC-Test vorbehalten.

## 5. Wiederkehrende Wochenschleife

| Zeitpunkt              | Verantwortlich                    | Pflichtaktion                                                                                    |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| D−7 bis D−3            | IR, LD, QE, LB                    | Material-, Import-, Quellen-, Labor- und A11y-Prüfung abschließen                                |
| D−1                    | LD, DS                            | Freigabe-Preflight, Datenregister und Löschtermine bestätigen                                    |
| H-0:30                 | LD oder TU, LB, gegebenenfalls ZH | technischen Kurzcheck ausführen                                                                  |
| D, Minute 0–90         | LD oder TU                        | LE nach Abschnitt 6 durchführen                                                                  |
| D, Minute 90–135       | LD oder TU                        | MC-Test nach Abschnitt 7 durchführen                                                             |
| D, binnen zwei Stunden | LD                                | erforderliche Exporte registrieren, neutral umbenennen und temporäre Downloads entfernen         |
| D+1                    | QE, LD                            | nur freigegebene Aggregate prüfen und höchstens zwei Nachsteuerungen festlegen                   |
| D+2                    | MP, LD                            | denselben 30er-Satz zur selben lokalen Uhrzeit für 24 Stunden zum zweiten Abruf freischalten     |
| D+14                   | MP, LD                            | denselben 30er-Satz zur selben lokalen Uhrzeit für 24 Stunden zum verzögerten Abruf freischalten |
| nach jedem T0          | DS, AP, MP                        | Löschung und Abwesenheitsprüfung nach dem Datenplan ausführen                                    |

Die allgemeinen Wiederholungsankündigungen werden an den gesamten Kurs gesendet. Es gibt keine personenbezogenen Erinnerungen, Abschlusslisten oder Sanktionen.

## 6. Minutengenauer Ablauf der 90-minütigen LE

| Minute | Auftrag                                                                                         | ARSnova- und Lehrfunktion                          |
| -----: | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
|    0–4 | Lernziel, Wochenfrage, Datenhinweis, Evidenzstufe und untimierten Weg sichtbar machen           | keine Datenerhebung                                |
|    4–8 | L01 individuell beantworten und knapp auflösen                                                  | Vorwissen aktivieren                               |
|   8–12 | L02 beantworten; stärksten Distraktor kontrastieren                                             | ältere Kernidee abrufen                            |
|  12–22 | kompaktes Begriffsmodell mit einer Primär- oder Repositoryquelle aufbauen                       | Fachinput, keine neue Livefrage                    |
|  22–29 | L03: erst Einzelbegründung, dann 90 Sekunden Austausch, danach gegebenenfalls zweite Abstimmung | Fehlvorstellung und Peer-Erklärung                 |
|  29–34 | L04: Grenzfall, Schätzung oder Entscheidung mit Gültigkeitsgrenze                               | Diagnose von Scheingenauigkeit                     |
|  34–44 | auf dem Laptop den ersten Repository-, Konfigurations- oder Quellenanker nachvollziehen         | belegten Ist-Zustand von Zielbild trennen          |
|  44–45 | Quelle, Commit und offene Annahme sichern                                                       | Übergang zwischen den beiden UE                    |
|  45–48 | Rollen, Agentenvertrag, Laborziel, Budget und Abbruchkriterium bestätigen                       | keine risikoreiche Ausführung ohne Gate            |
|  48–52 | L05 als Vorhersage vor der Ausführung beantworten                                               | Hypothese explizit machen                          |
|  52–64 | Agenten-, Repository-, Konfigurations- oder isolierte Laborarbeit auf dem Laptop ausführen      | Plan, Freigabe, Ausführung und Verifikation        |
|  64–69 | L06 mit beobachteter Evidenz beantworten                                                        | Prozess- oder Reihenfolgefehler prüfen             |
|  69–74 | L07 beantworten und stärkste falsche Modellannahme benennen                                     | Klassifikation und Transfer                        |
|  74–79 | L08 als offene, aber begrenzte Schlussaussage bearbeiten                                        | Begründung ohne automatische semantische Bewertung |
|  79–84 | L09 als unbewertete Kurs- oder Methodenrückmeldung bearbeiten                                   | Zugänglichkeit und Verständnis aggregiert prüfen   |
|  84–88 | L10 als unbewertete Selbsteinschätzung bearbeiten                                               | Exit und nächste Lernhandlung                      |
|  88–90 | Dossierertrag, offene Annahme, Cleanup und Selbststudiumsauftrag sichern                        | keine Rang- oder Einzelwertinterpretation          |

Die Summe beträgt genau 90 Minuten. Lange Agenten- oder Laborläufe laufen nur weiter, wenn Statuskanal, Endzeit und automatischer Abbruch feststehen; die LE wartet nicht auf unkontrollierte Prozesse.

### 6.1 Protokoll jeder ARSnova-Frage

1. LD nennt in höchstens 30 Sekunden die Funktion „Aktivierung“, „Diagnose“, „Anwendung“, „Transfer“ oder „Rückmeldung“.
2. Frage und Antwortweg werden sichtbar und zusätzlich verbal beziehungsweise strukturell zugänglich gemacht. In der Lesephase wird keine Lösung angedeutet.
3. Erst nach der Lesephase beginnt die Antwortphase. Der 60-Sekunden-Standardtimer wird nach Schwierigkeit skaliert; persönliche Zeitunterstützung bleibt aktiv.
4. Wer nicht zeitgebunden teilnehmen kann oder möchte, bearbeitet dieselbe Frage im untimierten Begleitmaterial. Eine fehlende Liveantwort hat keine negative Folge und wird nicht nachgetragen.
5. Solange eine bewertbare Frage aktiv ist, zeigt und nennt LD weder Lösung noch richtige Optionsmenge. Chat, Foliennotizen und Bildschirmfreigabe dürfen sie ebenfalls nicht verraten.
6. Nach dem Schließen werden nur Aggregat, fachlich relevante Distraktoren und Begründungen besprochen. Eine zweite Runde bleibt von der ersten getrennt.
7. Eine aggregierte Quote unter ungefähr zwei Dritteln oder ein zulässiges, mindestens fünf Antworten umfassendes Fehlvorstellungssignal markiert das Konzept für eine neue Erklärung. Es ist keine Bestehensgrenze und kein individuelles Urteil.
8. Bei weniger als fünf Antworten wird kein LIVE-Detail berichtet. LD erklärt den Sachverhalt anhand von LEHRDATEN oder des Erwartungshorizonts.
9. Bei Multiple Choice kann die Summe der Optionsanteile über 100 Prozent liegen. Für „vollständig korrekt“ zählt die ganze Abgabe, nicht die Summe richtiger Klicks.
10. Anzahl Anwesender, verbundener Geräte und abgegebener Antworten werden nie gleichgesetzt.

### 6.2 Lösungsoffenlegung

- Die Importdatei mit Lösungsschlüsseln bleibt ausschließlich bei IR, LD und QE im geschützten Materialbereich.
- Host- und Teilnehmeransicht werden vor jeder Woche getrennt geprüft. Der implementierte Teilnehmerpfad liefert in `ACTIVE` keine `isCorrect`-Felder; diese Codeeigenschaft ersetzt den praktischen Importtest nicht.
- Eine versehentlich sichtbare Lösung macht das Item für diese Erhebung ungültig. LD schließt es, erklärt den Fehler und nimmt es aus jeder Quote.
- Freitext, Umfrage und Rating erhalten keine erfundene Richtig-Falsch-Auswertung.
- Untimed Teilnehmende erhalten die Lösung erst nach eigener Abgabe oder bewusster Beendigung. Falls die synchrone Gruppe bereits bespricht, steht dieselbe zehnminütige Besprechung als zugängliche schriftliche Fassung bereit.

### 6.3 Laptop- und Tablet-Rollen

- Tablet oder Laptop genügen für ARSnova und MC-Test.
- Tiefes Lesen von Code, Diffs, Compose-Dateien, Logs, Messreports und Providerquellen erfolgt am Laptop. Pro Gruppe muss mindestens ein zugänglicher Laptop bereitstehen; ein persönliches Gerät ist keine Teilnahmevoraussetzung.
- Partnerarbeit teilt nicht automatisch eine Antwort oder Identität. Liveantworten können weiterhin einzeln über Papier oder den untimierten Weg gegeben werden.
- Lokale Rechner sind Zugangspunkte. Rechenleistung und Betriebsevidenz stammen aus derselben isolierten Laborumgebung.
- Auf dem Laptop wird standardmäßig nur gelesen. Änderungen erfolgen ausschließlich im freigegebenen Arbeitsbereich und nie auf Produktion.

## 7. UE 3: MC-Test und Spaced Repetition

### 7.1 Exakter Ablauf

|  Minute |   Dauer | Handlung                                                                                                                            |
| ------: | ------: | ----------------------------------------------------------------------------------------------------------------------------------- |
|   90–93 |  3 Min. | Wechsel, Link und untimierte Fassung öffnen; `practice`, fehlenden Countdown und Freiwilligkeit nennen                              |
|  93–125 | 32 Min. | genau 30 Items bearbeiten; Sofortfeedback und Glossar nutzen                                                                        |
| 125–135 | 10 Min. | aggregierte Ergebnisse, Lösungen und häufige Distraktoren besprechen; mindestens zwei fachlich ergiebige Items vollständig erklären |

Die 32 Minuten sind Organisationszeit, keine technische Sperre. Wer mehr Zeit benötigt, arbeitet ohne Countdown weiter und erhält die gleichwertige Besprechung anschließend schriftlich beziehungsweise in einem separaten zugänglichen Rückmeldeweg. Niemand muss die eigene Arbeit für eine öffentliche Ergebnisanzeige beenden.

### 7.2 Laufzeitkonfiguration

Vor jeder Freischaltung bestätigt MP:

- genau die freigegebene Wochen-Datei mit 30 Items;
- Modus `practice`;
- Sofortfeedback einschließlich Erklärung und Mini-Glossar;
- kein Countdown, keine automatische Beendigung nach 32 Minuten;
- `show_top5_public=false`;
- keine öffentliche Rangliste und keine Übernahme in eine Note;
- zufällige Optionsreihenfolge nur, wenn Erklärung und Lösung positionsunabhängig bleiben;
- kursisolierter Datenbestand oder ein nachweisbar kursgefilterter Löschweg.

### 7.3 Wiederabruf

1. **Erster Abruf:** in UE 3.
2. **Zweiter Abruf:** D+2 zur selben lokalen Uhrzeit; 24 Stunden offen.
3. **Verzögerter Abruf:** D+14 zur selben lokalen Uhrzeit; 24 Stunden offen.
4. Der gesamte Kurs erhält dieselbe allgemeine Nachricht mit höchstens zwei Kernkonzepten und dem Hinweis auf Erklärungen und Glossar.
5. Weitere freiwillige Abrufe dürfen technisch möglich sein, werden aber weder verfolgt noch als individueller Fortschritt ausgewertet.
6. Jedes Fenster erhält ein eigenes T0 und einen eigenen Löschhandoff. Pseudonyme werden nicht über Fenster oder Werkzeuge hinweg verbunden.

## 8. Präsenz- und Zoom-Äquivalenz

| Lehrfunktion      | Präsenzlauf                                        | Zoom-Lauf                                                   |
| ----------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Aktivierung       | individuelle Browser- oder Papierantwort           | Browserantwort oder private Notiz                           |
| Peer-Austausch    | feste Zweier- oder Tischgruppe                     | Breakout mit schriftlichem Auftrag und Rückkehrzeit         |
| Repositoryarbeit  | ein Laptop je Gruppe, relevante Ansicht projiziert | derselbe Commit und dieselbe Ansicht per Bildschirmfreigabe |
| Agentenlauf       | Auftrag, Plan, Gate, Status und Ergebnis sichtbar  | identischer Remote-Agent mit Statuskanal                    |
| Coaching          | LD oder TU besucht Gruppen                         | LD oder TU besucht Breakouts                                |
| Ergebnissicherung | gemeinsames digitales Dossier                      | dasselbe digitale Dossier                                   |
| Fallback          | lokale Dateien, Karten, Ersatzgerät                | heruntergeladene Dateien, Hauptraum, Ersatzkanal            |

Beide Läufe haben identische 135 Netto-Minuten. Es handelt sich um getrennte Kursläufe, nicht um hybriden Simultanunterricht. Im normalen Zoom-Unterricht sind Kamera und Mikrofon nicht der einzige Beteiligungsweg; es gibt mindestens einen schriftlichen Weg. Aufzeichnung ist standardmäßig aus. Untertitel oder Transkription werden nur nach institutioneller Freigabe eingesetzt.

## 9. Offline-, Netz- und Gerätefallback

LD schaltet nach genau einem kontrollierten Neuversuch auf den festgelegten Fallback um. Weitere Fehlersuche findet nach dem Termin statt.

| Störung                                                       | Sofortweg                                                                                                         | Aussagegrenze                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ARSnova nicht erreichbar oder Beitritt fehlerhaft             | alle zehn Fragen aus der lokalen Fassung; anonyme Karten oder strukturierter Antwortbogen; Runden getrennt zählen | als `LIVE/OFFLINE` kennzeichnen, nie später stellvertretend in ARSnova eingeben |
| Pseudonyme, Lösungsschutz oder Zeitunterstützung nicht sicher | Online-Session nicht öffnen beziehungsweise stoppen; untimierte Offlinefassung verwenden                          | keine Daten des Fehlmodus auswerten                                             |
| MC-Test nicht erreichbar oder falscher Modus                  | vollständige 30-Item-Alternativfassung mit getrenntem Lösungsblatt; 32 + 10 Minuten beibehalten                   | kein Plattformexport und keine erfundene Abschlussquote                         |
| Campusnetz ausgefallen                                        | heruntergeladene Folien, Repository-Ausschnitte, Referenzreports und Offlineantworten                             | keine Behauptung über einen aktuell laufenden Produktivzustand                  |
| einzelnes Gerät fehlt                                         | Ersatzgerät, Partnerzugang oder private Papierantwort                                                             | Personen-, Geräte- und Antwortzahl getrennt halten                              |
| Projektion oder Sound fällt aus                               | zugängliche lokale Unterlagen und verbale plus schriftliche Moderation                                            | Spielwirkung entfällt; Fachinhalt bleibt gleich                                 |
| Agent oder Modell fällt aus                                   | freigegebene Ersatzkonfiguration; sonst geprüften REPO-Referenzlauf analysieren                                   | Referenzlauf nicht als aktuelle Ausführung ausgeben                             |
| Zielserver fällt aus                                          | vorbereitete isolierte Ersatzinstanz; sonst Read-only-Evidenzreview                                               | fehlende Messung nicht erfinden                                                 |
| Zoom-Breakouts fallen aus                                     | feste Gruppen in getrennten Bereichen des gemeinsamen Dokuments im Hauptraum                                      | gleiche Aufgabe und Nettozeit                                                   |
| Zoom-Host fällt aus                                           | ZH führt Plan und Zeit fort; bei Gesamtausfall institutionellen Ersatzkanal nutzen                                | keine ad-hoc geänderte Fachaufgabe                                              |

## 10. Export- und Löschhandoff

### 10.1 Vor dem ARSnova-Abschluss

1. LD prüft geöffnete, abgeschlossene, ausgelassene und ungültige Fragen.
2. Ausgelassene oder ungültige Fragen werden mit Grund notiert, nicht als falsch gezählt.
3. Offene Q&A-Beiträge werden moderiert; personenbezogene oder vertrauliche Texte werden nicht in Lehrmaterial übernommen.
4. Nur ein im Datenregister vorab begründeter Export wird erzeugt. Ohne Lehr- oder Qualitätssicherungsfrage gibt es keinen Routineexport.
5. Die kanonische Quizdefinition bleibt unverändert; Sessioncode und Host-Token werden nicht in Dateinamen oder Dossier übernommen.

### 10.2 Direkt nach dem Abschluss

1. Falls erforderlich, lädt LD Ergebnis-PDF und Session-CSV in den geschützten Eingang.
2. Ein fehlgeschlagener Server-PDF-Job wird nicht parallel wiederholt. Für denselben Bericht wird der dokumentierte Browser-Druckfallback verwendet.
3. Downloads werden binnen zwei Stunden neutral benannt, registriert und aus Download-, Freigabe- und Zwischenablageorten entfernt.
4. Übernommen werden nur minimale Itemaggregate, tatsächlich verwendete Runde, Nenner, Modus und Evidenzstufe.
5. Pseudonyme, Rang, Team, Bonus, Antwortzeit, Reaktionen, IDs, Codes, Tokens und Originalfreitexte werden nicht in Lernanalytik oder Dossier übernommen.
6. ARSnova-, MC-Test- und Dossierdaten werden nicht miteinander verknüpft.

### 10.3 Handoff

LD übergibt DS sowie AP oder MP:

- Woche, System und Ereigniskennung ohne Personenbezug;
- Öffnungszeit, T0 und verbindliches Löschdatum;
- betroffene Plattforminstanz;
- Kategorien der erzeugten Roh- und Arbeitsartefakte;
- freigegebenes Aggregat oder Bestätigung, dass keines benötigt wird;
- erforderlichen Löschweg und erwartete Abwesenheitsprüfung.

ARSnova-Code sieht eine reguläre Purge-Fälligkeit 24 Stunden nach `endedAt` mit stündlichem Cleanup vor. Bonus- oder Feedbackdaten und ein aktiver Legal Hold können diesen Pfad verzögern. Deshalb gilt die automatische Fälligkeit nicht als Löschbeleg: AP bestätigt den tatsächlichen Kurslöschvollzug nach dem Datenplan. Dasselbe gilt für persistente MC-Test-Summaries; das Freigeben eines Pseudonyms genügt nicht.

## 11. Incident- und Abbruchwege

| Auslöser                                                          | Unmittelbare Maßnahme                                                                               | Fortsetzung                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Name, Kontakt-, Gesundheits-, Prüfungs- oder Geheimdatum sichtbar | Projektion, Freigabe und Analyse stoppen; Link sperren; DS informieren; keine Inhaltskopie erzeugen | nur nach Freigabe mit bereinigter Session oder Offlinefassung |
| Lösung während aktiver Frage sichtbar                             | Item schließen, als ungültig markieren, Ursache sichern                                             | nächstes freigegebenes Item; ungültiges Item nicht auswerten  |
| eigene Nicknames oder Klarnamen möglich                           | Session vor Beitritt stoppen                                                                        | korrektes Profil neu importieren oder Offlinefallback         |
| öffentliche MC-Top-Fünf oder falscher Modus                       | Instanz sperren, MP informieren, Daten des Fehlmodus nicht verwenden                                | erst nach Neustart und Gegenprüfung                           |
| Secret oder Produktionszugang im Prompt, Log oder Bildschirm      | Agent und Freigabe stoppen, Credential widerrufen, LB und DS informieren                            | neue kurzlebige Identität in isolierter Umgebung              |
| Agent verlässt Ziel, Rechte oder Budget                           | Prozess und ausgehenden Zugriff beenden; Ressource sperren                                          | nur nach neuem Vertrag und menschlichem Gate                  |
| Kosten-, Ressourcen-, SLO- oder Stabilitätsgrenze erreicht        | Last beziehungsweise Labor sofort abbrechen; Zustand und minimale Evidenz sichern                   | Ursache prüfen; Schwelle nicht ad hoc lockern                 |
| Barriere verhindert gleichwertige Teilnahme                       | zeitgebundenen Weg stoppen und untimierte Alternative aktivieren                                    | Fachinhalt ohne individuelle Sanktion fortsetzen              |
| Export oder Löschung nicht nachweisbar                            | weitere Erhebung auf der Instanz sperren; an DS und MV eskalieren                                   | erst nach bestandenem Abwesenheitsnachweis                    |

Der Incident-Ablauf lautet immer: stoppen, eindämmen, institutionell informieren, minimal dokumentieren, kontrolliert löschen oder übergeben, Gegenmaßnahme prüfen. Ob eine rechtliche Meldung erforderlich ist, entscheidet ausschließlich die zuständige institutionelle Stelle.

## 12. Wochen- und Semesterabschluss

### 12.1 Bis D+1

LD und QE dokumentieren ausschließlich:

- tatsächlich durchgeführte Livefragen und Modus;
- technische Störungen und verlorene Lehrzeit;
- höchstens zwei aggregierte Fehlvorstellungen mit mindestens fünf Antworten;
- konkrete Nachsteuerung: neues Beispiel, Peer-Erklärung, Quellenkontrast oder Gegenprobe;
- Dossierertrag und offene Annahme;
- Exportstatus, T0, Löschfrist und verantwortliche Rollen;
- Evidenzstufe jeder verwendeten Systemaussage.

Personen, Pseudonyme, individuelle Verläufe, Geschwindigkeit, Rang und Teamstand erscheinen nicht.

### 12.2 Nach W12

1. W12 wird mit demselben 90 + 45-Minuten-Raster abgeschlossen.
2. Die D+14-Fenster von W11 und W12 bleiben als freiwilliger Abruf bestehen; danach folgen deren reguläre Löschhandoffs.
3. Alle Laborinstanzen, Volumes, Snapshots, externen Freigabelinks und kurzlebigen Credentials werden inventarisiert und entfernt beziehungsweise widerrufen.
4. DS prüft Löschprotokoll und Abwesenheitsnachweise für ARSnova, alle MC-Fenster, geschützte Arbeitskopien und Incidents.
5. Nur ein anonymes, kleinzellengeprüftes internes Lehrfazit darf bis zum Abschluss der nächsten Kursplanung aufbewahrt werden, sofern das institutionelle Gate dies ausdrücklich freigibt. Andernfalls wird es mit den Arbeitskopien gelöscht.
6. Der Abschlussbericht beschränkt sich auf Durchführung, curriculare Passung, Materialfehler, aggregierte Lernhürden, technische Störungen und Änderungen für den nächsten Lauf.
7. Es werden keine Wirksamkeits-, Kausal-, Forschungs-, Publikations- oder individuellen Leistungsbehauptungen aus Tooldaten abgeleitet.
8. Aussagen über `arsnova.eu` bleiben exakt begrenzt: implementierter Single-Host-Pfad, lokal verifizierte Tests, historisch produktiv beobachtete 500 Joins und offene Zielbilder sind vier verschiedene Evidenzstufen.

## 13. Verbindliche Grundlagen

- [Modulkonzept Cloud Computing](./Modulkonzept_Cloud_Computing.md)
- [Lernziel- und Alignment-Matrix](./Lernziel_Alignment_Matrix.md)
- [Wochenlehrplan](./Wochenlehrplan_Cloud_Computing_12_Wochen.md)
- [ARSnova-Blueprint](./ARSnova_Blueprint_12_Wochen.md)
- [MC-Test-Blueprint](./MC-Test_Blueprint_12_Wochen.md)
- [Referatsthemenkatalog](./Referatsthemen_Cloud_Computing_ARSnova.md)
- [Datenmanagement und Datenschutz](./Datenmanagement_Datenschutz.md)
- [Technische Quellen zu ARSnova.eu](./Technische_Quellen_ARSnova.md)

Bis zur vollständigen Migration ihrer einzigartigen Detailregeln ergänzen die [IU-Formalia](../CLOUD-COMPUTING-IU-FORMALIA.md), die [Referatsumsetzung](../CLOUD-COMPUTING-REFERAT-PRUEFUNG.md), das [Präsenz-/Zoom-Konzept](../CLOUD-COMPUTING-DURCHFUEHRUNG-PRAESENZ-ZOOM.md) und das [Agentic-Lehrlabor](../CLOUD-COMPUTING-AGENTIC-LEHRLABOR.md) das neue Paket. Bei einem Widerspruch gelten das aktuelle Modulkonzept, der veröffentlichte Prüfungsauftrag beziehungsweise myCampus und dieses Runbook; überholte UE-3-, MC-Generator- oder ausschließlich-agent-first-Regeln gelten nicht.
