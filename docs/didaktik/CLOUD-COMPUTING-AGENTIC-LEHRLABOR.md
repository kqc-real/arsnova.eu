<!-- markdownlint-disable MD013 MD060 -->

# Agentic Cloud Engineering: Lehrlabor und Arbeitsmodell

**Modul:** `DSCC0127` / `DSCC012701` · **Zweck:** Verbindliches agent-first-Arbeitsmodell für Lehrende und Studierende · **Lehrkonzept:** [Cloud Computing 36 UE](./BACHELOR-VORLESUNG-CLOUD-COMPUTING-36-UE-PRAKTIKUM.md) · **Prüfung:** [Referatsumsetzung](./CLOUD-COMPUTING-REFERAT-PRUEFUNG.md) · **Stand:** 2026-07-29

## 1. Grundentscheidung: ausschließlich agent-first

Alle substanziellen Praxis-, Analyse- und Bewertungsaufgaben des Kurses werden mit **KI-Agenten im Sinne des Agentic Software Engineering** bearbeitet. Das gilt symmetrisch für Lehrende und Studierende. Der Kurs enthält keine manuell nachzuklickenden Cloud-Tutorials und keine konventionellen Laboraufgaben, deren eigentliche Bearbeitung außerhalb des Agentenprozesses stattfindet.

Ein KI-Agent ist hier kein reiner Chatbot. Er erhält einen prüfbaren Auftrag, liest freigegebene Quellen und Systemzustände, erstellt einen Plan, verwendet kontrollierte Werkzeuge, verändert eine isolierte Umgebung, prüft das Ergebnis und legt Evidenz vor. Jede Aktivität folgt demselben Zyklus:

> Auftrag → Plan → Risiko- und Kostenprüfung → menschliche Freigabe → Agentenausführung → technische Verifikation → Evidenz → fachliche Bewertung

`Agent-first` bedeutet nicht `human-out-of-the-loop`:

- Menschen definieren Ziel, Akzeptanzkriterien, Berechtigungen und Budget.
- Menschen genehmigen privilegierte, destruktive, externe oder kostenwirksame Schritte.
- Menschen prüfen Quellen, Resultate, Nebenwirkungen und Zielerreichung.
- Die prüfende Person trägt die Prüfungs- und Notenverantwortung; Agenten dürfen Feedback vorbereiten, aber nicht autonom benoten.
- Manuelle Eingriffe sind nur als Sicherheits-, Wiederherstellungs- oder Barrierefreiheitsfallback zulässig und werden im Agentenprotokoll begründet.

## 2. Kompetenzziel

Studierende sollen Cloud Computing nicht nur **mit** KI-Unterstützung kennenlernen, sondern die sichere, nachvollziehbare Steuerung agentischer Arbeit als Querschnittskompetenz erwerben. Nach dem Kurs können sie:

1. einen Cloud-Auftrag in maschinenprüfbare Ziele, Grenzen und Akzeptanzkriterien zerlegen;
2. Agenten mit minimalen Rechten, begrenztem Kontext und definiertem Kostenrahmen einsetzen;
3. Server agentisch bereitstellen, konfigurieren, härten, testen und reproduzierbar dokumentieren;
4. Agentenergebnisse zu Cloud-Sicherheit, Datenschutz, Performance und Wirtschaftlichkeit kritisch verifizieren;
5. technische und wirtschaftliche Evidenz zu einer verantwortbaren Cloud-Entscheidung verbinden;
6. Fehler, Halluzinationen, Scheingenauigkeit und unbelegte Agentenbehauptungen erkennen;
7. die eigene Entscheidung auch dann fachlich vertreten, wenn der Agent den Entwurf oder die Ausführung übernommen hat.

## 3. Lehrlabor-Architektur

Jede Arbeitsgruppe erhält eine isolierte, rücksetzbare Nichtproduktionsumgebung. Der Agent steuert den Zielserver vorzugsweise von einer getrennten Kontrollumgebung aus. Ein direkt auf dem Zielserver installierter Runner ist nur zulässig, wenn er technisch erforderlich, explizit freigegeben und zusätzlich eingeschränkt ist.

| Baustein                | Mindestanforderung                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Fallbasis               | festgelegter Commit von `arsnova.eu`, dokumentierte Aufgaben- und Evidenzquellen                                  |
| Agentenkontrollumgebung | freigegebener CLI-/IDE-Agent mit festgelegtem Modell, Version, Systemauftrag und Werkzeugprofil                   |
| Zielserver              | isolierte VM oder gleichwertige Sandbox ohne Produktionsdaten und Produktionszugänge                              |
| Berechtigungsweg        | eigener unprivilegierter Account; privilegierte Schritte nur zeitlich und sachlich begrenzt nach Freigabe         |
| Automatisierung         | versionierte Infrastructure-/Configuration-as-Code-Artefakte statt undokumentierter Einzelschritte                |
| Werkzeuge               | Shell, Git, Paketverwaltung, IaC, Scanner, Test- und Messwerkzeuge nur über die freigegebene Agentenschnittstelle |
| Geheimnisse             | Secret Store oder kurzlebige Credentials; keine Secrets in Prompts, Chatprotokollen, Repository oder Abgabe       |
| Netzwerk                | Default-Deny beziehungsweise minimaler Ingress; ausgehende Ziele und Modellzugriff dokumentiert und begrenzt      |
| Ressourcen              | Quotas, Laufzeit- und Kostenlimits sowie automatischer Stopp-/Cleanup-Pfad                                        |
| Nachvollziehbarkeit     | Auftrags-, Plan-, Freigabe-, Änderungs-, Prüf- und Kostenprotokoll mit Zeitstempel                                |
| Wiederherstellung       | Snapshot oder reproduzierbarer Neuaufbau; getesteter Rollback-/Destroy-Pfad                                       |

Die Trennung von Agentenkontrollumgebung und Zielserver ist eine Sicherheitsentscheidung: Ein universeller Agent mit Modellzugriff und weitreichenden Werkzeugen vergrößert auf dem Zielsystem die Angriffsfläche. Der Kurs bewertet daher nicht, ob „ein Agent auf dem Server läuft“, sondern ob ein Agent den Server kontrolliert, reproduzierbar und mit minimalen Rechten installieren und härten kann.

## 4. Verbindlicher Agentenvertrag

Vor jeder Ausführung wird ein kurzer Agentenvertrag versioniert:

| Feld               | Inhalt                                                                     |
| ------------------ | -------------------------------------------------------------------------- |
| Ziel               | beobachtbares Ergebnis und fachlicher Zweck                                |
| Ausgangszustand    | Server-/Repo-Version, Region, Architektur und bekannte Einschränkungen     |
| erlaubte Werkzeuge | konkrete Kommandos, APIs, Dateien und Datenquellen                         |
| verbotene Bereiche | Produktion, Echtdaten, fremde Konten, nicht freigegebene Netze und Secrets |
| Rechte             | Identität, Rollen, Eskalationsweg und Ablaufzeit der Credentials           |
| Budget             | maximale Laufzeit, Ressourcen, Token-/Modellkosten und Cloudkosten         |
| Akzeptanzkriterien | Tests, Messwerte, Scans, Dokumentation und Cleanup                         |
| Freigabegates      | Schritte, die eine explizite menschliche Bestätigung benötigen             |
| Abbruchkriterien   | Sicherheits-, Datenschutz-, Kosten- und Stabilitätsgrenzen                 |
| Evidenz            | erwartete Diffs, Logs, Reports, Quellen und Entscheidungsnotiz             |

Agenten dürfen fehlende Angaben nicht stillschweigend erfinden. Sie müssen Unsicherheit markieren, vor risikoreichen Schritten anhalten und die stärkste verworfene Alternative mit dokumentieren.

## 5. Agentische Pflicht-Workstreams

### 5.1 Serverbereitstellung und Härtung

Ein Provisioning-/Operations-Agent:

- erzeugt einen reproduzierbaren Bereitstellungsplan;
- installiert ein minimales, gepatchtes Serversystem und benötigte Laufzeitkomponenten;
- richtet unprivilegierte Dienstkonten, schlüsselbasierte Administration, Firewall, minimale Ports und sichere Dateirechte ein;
- schützt Secrets, begrenzt Dienste und Container, aktiviert Protokollierung und dokumentiert Abhängigkeiten;
- installiert `arsnova.eu` oder einen klar begrenzten Kurs-Slice;
- führt Konfigurations-, Funktions- und Härtungsprüfungen aus;
- erzeugt Rollback-, Restore- und Destroy-Nachweise.

Pflichtartefakte sind IaC/Configuration as Code, Änderungsdiff, Systeminventar, Härtungsbericht, Scanergebnis, Restabweichungen und Wiederherstellungsweg.

### 5.2 Cloud-Sicherheit

Security-Agenten arbeiten in einer kontrollierten Blue-/Red-/Review-Rollenverteilung:

- Bedrohungen, Angriffsflächen, Identitäten, Netzwerk- und Vertrauensgrenzen modellieren;
- Fehlkonfigurationen, Abhängigkeiten, Container/IaC und exponierte Dienste prüfen;
- Maßnahmen priorisieren, implementieren und mit Negativtests verifizieren;
- Residualrisiko, False Positives und nicht geprüfte Bereiche ausweisen;
- keine aktive Prüfung fremder oder produktiver Systeme durchführen.

Ein Scanbericht allein genügt nicht. Akzeptiert wird nur die Kette `Befund → Risiko → Maßnahme → Verifikation → Restrisiko`.

### 5.3 Cloud-Datenschutz

Ein Privacy-Agent:

- erstellt Dateninventar, Datenfluss und Zweck-/Rollenmatrix;
- prüft Datenminimierung, Aufbewahrung, Löschung, Zugriff, Region, Unterauftragnehmer und Modell-/Tool-Datenabfluss;
- trennt personenbezogene, pseudonymisierte, aggregierte und technische Betriebsdaten;
- bewertet Alternativen nach Privacy by Design und dokumentiert offene Rechtsfragen;
- verwendet im Labor ausschließlich synthetische oder ausdrücklich freigegebene Daten.

Der Agent liefert eine technische Datenschutzanalyse, keine autonome Rechtsfreigabe. Rechtsgrundlage, institutionelle Freigabe und abschließende Bewertung bleiben bei den zuständigen Menschen.

### 5.4 Cloud-Performance und Resilienz

Ein Performance-Agent:

- formuliert Workload, Hypothese, SLI/SLO, Messumgebung und Abbruchkriterium;
- erzeugt und prüft reproduzierbare Last- und Fehlertests;
- trennt p50/p95/p99, Durchsatz, Fehlerrate und Sättigung;
- vergleicht Baseline und Variante, identifiziert Engpässe und prüft Gegenmaßnahmen;
- verbindet Performance mit Verfügbarkeit, Ressourcenverbrauch und Kosten;
- darf nur die isolierte, budgetierte Zielumgebung belasten.

Keine Skalierungs- oder Kapazitätsaussage gilt ohne Umgebungsbeschreibung, Rohdaten beziehungsweise Report, Wiederholbarkeit und klar benannte Gültigkeitsgrenze.

### 5.5 Wirtschaftlichkeit und FinOps

Ein Economics-/FinOps-Agent verbindet die technischen Messwerte mit wirtschaftlichen Entscheidungen. Er:

- vergleicht Self-managed IaaS, Managed Data und Managed Application Platform auf gleicher Leistungsbasis;
- modelliert Infrastruktur, Personal, Support, Observability, Backup, Security, Compliance, Egress, Migration und Exit;
- berechnet Unit Economics, etwa Kosten pro Session, 1.000 Teilnehmende oder definierter SLO-Einheit;
- erstellt Best-/Base-/Worst-Case und Sensitivitätsanalyse statt einer einzelnen Scheingenauigkeitszahl;
- bewertet Build/Buy, 6R-Option, Lock-in, Opportunitätskosten, Risiko und Restwert des Wissens;
- versieht volatile Preise mit Region, Währung, Steuerbasis, Abrufdatum und Primärquelle.

Studierende der Informatik und Wirtschaftsinformatik arbeiten in gemischten Rollen. Technische Entscheidungen ohne Kosten-/Risikofolge und Wirtschaftlichkeitsrechnungen ohne Architektur-/Messbasis gelten gleichermaßen als unvollständig.

## 6. Rollen auf beiden Seiten

### Lehrendenseite

Lehrende nutzen Agenten für:

- Bereitstellung und Rücksetzung der Laborumgebungen;
- Generierung kohortengerechter Aufträge aus dem festgelegten Repo-Stand;
- Vorprüfung von IaC, Härtung, Datenschutz, Lasttests und Kostenmodellen;
- Erzeugung absichtlich fehlerhafter, aber sicher isolierter Ausgangszustände;
- Vergleich von Studierendenevidenz mit Akzeptanzkriterien;
- formative Feedbackvorschläge und Erkennung fehlender Nachweise;
- Erzeugung und Vorprüfung von jeweils 30 MC-Test-Fragen nach dem festgeschriebenen vierstufigen [Generatorvertrag](./vorlesungen-cloud-computing-termine.md#verbindlicher-mc-test-generatorvertrag); Themen und Keywords steuern die Abdeckung, die freigegebene Materialbasis liefert das Fachwissen.

Lehrendenagenten erhalten keine autonome Notenhoheit und verändern keine studentischen Abgaben. Aufgabe, Agentenkonfiguration, verwendete Prüfroutinen und wesentliche Modellgrenzen werden transparent gemacht.

### Studierendenseite

Studierende steuern je nach Aufgabe einen oder mehrere klar getrennte Agenten, beispielsweise Provisioning, Security Review, Privacy Review, Performance und FinOps. Sie verantworten:

- präzisen Auftrag und erlaubten Handlungsspielraum;
- Prüfung und Freigabe des Agentenplans;
- Verifikation aller wesentlichen Behauptungen;
- Kennzeichnung von Agentenbeiträgen, Quellen und eigener Entscheidung;
- Erklärung von Fehlern, Alternativen und Restrisiken;
- vollständigen Cleanup der Laborressourcen.

In gemischten Gruppen können Rollen fachlich verteilt werden, aber jede Person muss die Schnittstellen zwischen Technik, Datenschutz, Sicherheit, Performance und Wirtschaftlichkeit erklären können.

## 7. Evidenzpflicht statt Promptbewertung

Bewertet und diskutiert wird nicht die Eleganz eines Prompts, sondern die nachweisbare Qualität des Ergebnisses. Jeder Workstream liefert mindestens:

1. Agentenauftrag und Akzeptanzkriterien;
2. Plan mit Risiko-, Datenschutz- und Kostenklassifikation;
3. Freigabeprotokoll für privilegierte oder kostenwirksame Schritte;
4. versionierten Änderungsdiff beziehungsweise Analysemodell;
5. maschinellen Prüfbericht und nachvollziehbare Roh-/Quelldaten;
6. menschliche Gegenprüfung mit mindestens einer verworfenen Alternative;
7. Restunsicherheit, Restrisiko und Gültigkeitsgrenze;
8. Ressourcen-, Modell- und Cloudkosten sowie Cleanup-Nachweis.

Der Agentenverlauf wird auf die für Nachvollziehbarkeit erforderlichen Teile reduziert. Secrets, personenbezogene Daten, irrelevante Gedankengänge oder vertrauliche Systeminformationen gehören nicht in Kursartefakte.

## 8. Gemeinsames Lernprodukt

Das formative Cloud-Readiness-Dossier wird zum **Agentic Cloud Engineering Dossier**. Es bündelt:

- System- und Agentenmanifest;
- reproduzierbare Serverbereitstellung;
- Härtungs-, Security- und Datenschutznachweis;
- Performance-/Resilienzbericht;
- TCO-/FinOps-Modell mit Sensitivität;
- Architektur- und Providerentscheidung;
- Agentenevidenz und individuelle kritische Reflexion.

Das Dossier ist die Arbeits- und Quellenbasis des Referats, aber kein zusätzlicher benoteter Prüfungsbestandteil. Für das Referat gelten ausschließlich die offiziellen Bestandteile und Gewichte.

## 9. Zuordnung zu den zwölf Terminen

| Termin | Führender Agentenauftrag                                       | Zentraler Nachweis                                |
| -----: | -------------------------------------------------------------- | ------------------------------------------------- |
|      1 | Cloud-Fall klassifizieren und Agentenvertrag erstellen         | Auftrag, Grenzen, Risiken und Kostenbudget        |
|      2 | Zielserver und technologische Basis als Code entwerfen         | Provisioning-Plan und IaC-Entwurf                 |
|      3 | Server bereitstellen, Anwendung installieren und härten        | reproduzierbarer Build, Scan und Rollback         |
|      4 | Serverless-Kandidaten analysieren und isoliert prototypisieren | Eignungs- und Gegenbeleg                          |
|      5 | GCP, AWS und Azure evidenzbasiert vergleichen                  | Capability-/Verantwortungs-/Kostenmatrix          |
|      6 | Daten-/ML-Pipeline mit Privacy-Gates bewerten                  | Datenfluss, Zweck, Region und Modellrisiko        |
|      7 | Backup, Restore und Fehlerfälle ausführen                      | agentisch geprüfter Recovery-Nachweis             |
|      8 | Performance- und Resilienzexperiment durchführen               | reproduzierbarer Lastreport mit Gültigkeitsgrenze |
|      9 | Security-, Privacy- und Observability-Befunde beheben          | Befund-Maßnahme-Verifikation-Restrisiko           |
|     10 | technische und wirtschaftliche Optionen entscheiden            | TCO, Unit Economics, Sensitivität und ADR         |
|     11 | Agentenevidenz in Einreichung und Vortrag überführen           | belegte Argumentations- und Visualisierungsskizze |
|     12 | Resultate gegen kritische Rückfragen verteidigen               | Probeprüfung mit Quellen- und Agentenoffenlegung  |

## 10. Präsenz und Zoom

Beide Kursläufe nutzen dieselbe remote erreichbare oder identisch reproduzierbare Laborplattform, dieselben Agentenkonfigurationen, Aufgaben, Berechtigungen, Budgets und Abnahmetests. Im Präsenzlauf arbeiten Teams am Tisch mit dem Agenten; im Zoom-Lauf steuern sie denselben Prozess in Breakouts mit geteilter Evidenzansicht. Lokale Rechner dienen nur als Zugang, nicht als unterschiedlich leistungsfähige Zielumgebungen.

Für die freiwillige Selbstüberprüfung wird nach jedem Termin in beiden Kursläufen derselbe Satz von 30 agentisch erzeugten MC-Test-Fragen bereitgestellt.

Bildschirmfreigabe oder Projektion zeigt bevorzugt Auftrag, Plan, Diff, Test und Entscheidung – nicht lange unkommentierte Agentenläufe. Asynchrone Agentenausführung muss einen definierten Rückkehrpunkt, Statuskanal und Abbruchweg besitzen.

## 11. Prüfungs- und Integritätsregel

Der Kurs setzt Agenten durchgängig ein. Ob und in welchem Umfang KI-Agenten bei der Erstellung der formalen Referatsunterlagen als Hilfsmittel zulässig sind, muss dennoch im Prüfungsauftrag beziehungsweise in myCampus ausdrücklich bestätigt werden. Bis zur formalen Bestätigung ist Agentennutzung im Lernprozess nicht automatisch eine Freigabe für die Prüfungsabgabe.

Bei erlaubter Agentennutzung gilt:

- verwendete Agenten, Modelle, wesentliche Aufträge und übernommene Beiträge werden transparent ausgewiesen;
- jede Literatur-, Preis-, Mess- und Systembehauptung wird gegen Primärquelle oder reproduzierbare Evidenz geprüft;
- halluzinierte Quellen, nicht verstandene Ergebnisse und verschleierte Fremd-/Agentenleistung verletzen die akademische Integrität;
- die individuelle Befragung prüft ausdrücklich Verständnis, Entscheidungsverantwortung und Grenzen der Agentenergebnisse.

## 12. Freigabecheck

- [ ] institutionell zulässige Agenten-, Modell- und Datenverarbeitungskonfiguration festgelegt
- [ ] identische Agenten- und Laborzugänge für Präsenz- und Zoom-Lauf bereitgestellt
- [ ] isolierte, rücksetzbare Zielserver ohne Produktionsdaten und Produktionszugänge verfügbar
- [ ] Rollen, kurzlebige Credentials, Freigabegates und Notfallzugriff getestet
- [ ] Modell-, Cloud- und Ressourcenbudgets mit automatischem Stopp/Cleanup gesetzt
- [ ] Agentenvertrag und Evidenzvorlagen veröffentlicht
- [ ] Serverbereitstellung, Härtung, Security, Datenschutz, Performance und FinOps agentisch abgedeckt
- [ ] gemischte Informatik-/Wirtschaftsinformatikrollen und gemeinsame Ergebnisverantwortung erklärt
- [ ] Lehrendenagenten für Labor, Vorprüfung und formatives Feedback getestet
- [ ] festgeschriebener MC-Test-Commit, vierstufige Artefaktpipeline, Validator, Generierungsmanifest und menschliches Freigabegate für 30 Fragen je Termin getestet
- [ ] keine autonome Notengebung oder ungeprüfte Übernahme von Agentenaussagen vorgesehen
- [ ] erlaubter KI-Einsatz in der Referatsprüfung formal geklärt und veröffentlicht
