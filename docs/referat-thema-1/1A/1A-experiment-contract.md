# 1A-Versuchsvertrag: Ressourcenisolation auf dem Anwendungshost

**Verantwortlich:** Niklas (Rolle X). **Vertragsversion:** 2.
**Festgehalten am:** 2026-11-07; vor den bestätigenden Läufen am 2026-11-11 aktualisiert.
**Status:** Schwellen unverändert; Baseline und Labor gemäß aktualisiertem Issue geklärt.
**Auftrag:** [Issue #6 im Fork](https://github.com/NiklasSkulll/arsnova.eu/issues/6).

Die Aktualisierung von [Issue #6 vom 2026-11-10](https://github.com/NiklasSkulll/arsnova.eu/issues/6)
bestätigt den eigenen Rechner als Labor und den aktuellen `main` als Baseline
(Prüfer-E-Mail, im Issue auf 2026-11-04 datiert). Für Schritt 6 wurde am
2026-11-11 der Commit `8f91e0417bc5aace461c3644a0b6b26c9284035b` abgerufen.
Das ersetzt die nachfolgenden historischen Angaben zur noch offenen Freigabe.
Der Stand ist Version 1.4.0; die ursprüngliche Releasebezeichnung 1.3 bezeichnet
den Aufgabenkontext, nicht das tatsächlich gemessene Image.

Dieses Dokument legt die vorgesehenen Vergleiche und Entscheidungsregeln vor den
bestätigenden Messläufen fest. Es setzt Schritt 1 des vereinbarten siebenteiligen
A1-Umsetzungsplans um. Fixture, Lastinstrumentierung, Ressourcenerfassung,
Störungsinjektion und Versuchsskript sind Ergebnisse späterer Schritte. Das hier
beschriebene Verhalten ist eine Anforderung und keine Aussage darüber, dass diese
Werkzeuge bereits vorhanden sind.

## Fragestellung, Hypothesen und Gegenalternative

**Individueller Titel:** Live-Signale für die Moderation vor Rückwirkungen der
optionalen spaCy-Analyse auf dem Anwendungshost von Release 1.3 schützen.

**Leitfrage:** Kann der Anwendungshost unter dem festgelegten Lastprofil die
optionale Wortwolken-Glättung ausführen, ohne die unten genannten Grenzen für
Live-Aktionen zu überschreiten?

- **H1:** Der normale spaCy-Betrieb (V2) hält gegenüber der Analyse ohne spaCy
  (V1) sowohl die relative als auch die absolute p95-Regressionsgrenze und die
  Fehlergrenze für Live-Aktionen ein.
- **H2:** Auch bei CPU-Drosselung (V3) und verzögerten Antworten (V4) bleiben die
  Live-Grenzen gegenüber V1 eingehalten. Analysedauer und Fallbackhäufigkeit
  dürfen steigen; Isolation der Live-Aktionen und Analyseverfügbarkeit werden
  getrennt bewertet.
- **Gegenalternative:** `NLP_ENABLED=false` beibehalten und die bestehende
  lexikalische Wortwolke verwenden. Deren geringeren Betriebsaufwand und
  Ressourcenbedarf gegen den begrenzten Nutzen der Zusammenführung von
  Flexionsformen abwägen.

V0 gegenüber V1 misst den zusätzlichen Analysepfad ohne spaCy. V1 gegenüber V2
misst den zusätzlichen spaCy-Pfad einschließlich Transport, Parsing und
Aggregation im Backend. Containermetriken helfen, Ressourcenkonkurrenz
zuzuordnen. Diese Vergleiche allein können eine Verzögerung jedoch keinem
bestimmten Prozess oder einer bestimmten Funktion zuschreiben.

## Maßgebliche Quellen und Auswahl der Baseline

Die [Prüfungsspezifikation](../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md),
Abschnitte 4.1.1, 4.1.3 und 4.3, sowie
[ADR-0035](../architecture/decisions/0035-self-hosted-llm-runtime-llama-cpp-over-ollama.md)
legen Umfang und Systemgrenzen fest. Das
[Recherchedossier](./1A-ressourcenisolation-app-host.md), Abschnitt 10, enthält
Versuchsvorschläge. Dieser Vertrag wählt daraus ausdrückliche Regeln aus. Dabei
handelt es sich um Versuchsentscheidungen und nicht um bereits nachgewiesene
Leistungseigenschaften. Implementierungsdetails müssen erneut gegen die
gewählte Baseline geprüft werden.

| Punkt                          | Festgehaltener Stand oder Anforderung                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Lokaler Vorbereitungsbranch    | `feature-1A-resource-isolation`                                                                                                    |
| Geprüfter Quellcode-Commit     | `93bcf2e9288f66efafe809b617a93e70ba14de27`                                                                                         |
| Ziel des lokalen Tags `v1.3.0` | `87c39334619fbcb0c5782b061da1ba0df0ba3142`                                                                                         |
| Freigegebene Messbaseline      | Aktueller Fork-`main`, für diese Reihe auf `8f91e0417bc5aace461c3644a0b6b26c9284035b` festgehalten; Freigabe gemäß Issue #6        |
| Laborbereitstellung            | Eigener Rechner gemäß Issue #6; für A1 besteht keine Abhängigkeit mehr von Issue #8                                                |
| Vorgesehener Anwendungshost    | 8 vCPU / 16 GB RAM gemäß ADR-0035; tatsächliche Hardware muss erfasst werden                                                       |
| Laufzeit für die Vorbereitung  | Node 24.18.0 gemäß `.nvmrc`; tatsächliche Laufzeiten von Lastgenerator und Anwendung getrennt erfassen                             |
| Kosten                         | Dieser Vertrag autorisiert keine neuen kostenpflichtigen Ressourcen; zusätzliche Kosten vor einer Bereitstellung bestätigen lassen |

Vor dem ersten bestätigenden Messlauf den freigegebenen Anwendungscommit,
Release-Tag, Image-Identitäten, Umgebung, Fixture-Hash und Vertragsrevision
festhalten. Über alle Varianten dieselben Anwendungs- und Sidecar-Images
verwenden. Der Releasecode der Anwendung bleibt unverändert; Commits der
Messwerkzeuge getrennt kennzeichnen. Lokale Vorläufe dürfen die Werkzeuge
vorbereiten, ersetzen aber keinen Lauf auf der freigegebenen Baseline.

## Konstante Umgebung und Daten

- Ausschließlich in einem isolierten Labor mit synthetischen Daten arbeiten.
  Das Ziel als Laboralias festhalten; Verbindungsdetails und Zugangsdaten
  außerhalb der eingecheckten Nachweise aufbewahren.
- Getrennte Containernamen, Netzwerke, Volumes und Ports verwenden. Ein anderer
  Compose-Projektname allein reicht bei ausdrücklich gesetztem `container_name`
  nicht aus.
- `app`, PostgreSQL, Redis und PDF-Worker beibehalten. Während einer Messung
  keine PDF-Exporte, Backups, Builds oder anderen Lasttests ausführen.
- `QA_NLP_ENABLED=false`, `WORD_CLOUD_SEMANTIC_ENABLED=false`,
  `QA_SUMMARY_ENABLED=false` und `OPEN_WEIGHT_LLM_ENABLED=false` konstant halten.
  Encoder- und LLM-Profile nicht starten. Die Aussagekraft bleibt auf diese
  Schalterkonfiguration begrenzt.
- `NLP_TIMEOUT_MS=5000` und `NLP_CACHE_TTL_SECONDS=1800` konstant halten. Die
  tatsächlich aufgelösten Compose-Werte erfassen, nicht nur Werte aus einer
  Beispiel-Umgebungsdatei.
- Gültige Host-Tokens und Teilnehmer-Capabilities über bestehende
  tRPC-Prozeduren verwenden. Session-Codes autorisieren keine Anfragen. Für
  jeden Lauf neue Zugangsdaten beziehen und aus Berichten und Befehlsausgaben
  heraushalten.
- Die sechs Referenztexte und Bewertungen aus
  [`moderation-prompt-context-fixtures.ts`](../../libs/shared-types/src/moderation-prompt-context-fixtures.ts)
  wiederverwenden. Die ursprüngliche Referenzfixture für 1C erhalten. Die
  Themenpaare A/B, C/D und E/F sind deterministische Fixture-Gruppierungen,
  keine erwartete Ausgabe eines realen Modells.
- Für A1 fünf getrennte Analysesessions mit identischen synthetischen Inhalten,
  jeweils 500 zulässigen Fragen, festem Seed und dokumentiertem Inhaltshash
  vorbereiten. Referenztexte, Gegenfälle und deterministische Füllfragen
  aufnehmen. Die A1-Projektion auf `ACTIVE`/`PINNED` dokumentieren; `analyzeQa`
  schließt `PENDING`-Fragen aus. Raumbezugsgröße und Referenzbewertungen
  getrennt von der Größe der Live-Session erfassen.
- Eine getrennte Live-Session verwenden, damit `qa.submit` den Analysekorpus
  nicht verändert. Identische Korpusinhalte und Analysezulässigkeit vor und
  nach jedem Lauf prüfen. Erzeugte Datenbank-IDs dürfen abweichen; die
  kanonischen Fixture-Inhalte hashen und ihre Zuordnung zu Laufzeitdaten
  außerhalb von Übersichten ohne Identitätsdaten festhalten.
- Den Lastgenerator möglichst außerhalb des gemessenen Anwendungshosts
  betreiben. Andernfalls seine Ressourcenkonkurrenz dokumentieren und
  Aussagen über die Hardware entsprechend begrenzen.

Die geprüfte Produktions-Compose-Konfiguration gibt spaCy 1 CPU, 1 GiB RAM und
64 PIDs bei `network_mode: none`. App, PostgreSQL und Redis haben dort keine
entsprechenden ausdrücklichen Limits. Dies sind Konfigurationswerte, keine
gemessenen Speicherverbräuche oder garantierten Ressourcenreservierungen.
Für A1 keine Limits zu diesen Diensten hinzufügen.

## Lastprofil und Zeitablauf

Das primäre Live-Profil ist eine **Beitrittswelle mit 500 Teilnehmenden** auf
Basis von [`500-live-session.yml`](../../scripts/load/artillery/500-live-session.yml).
Es belegt keine 500 durchgehend verbundenen oder durchgehend aktiven Clients.

| Parameter                | Vorab festgelegter Wert                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Aufwärmphase             | 60 Sekunden, von Messstichproben ausgeschlossen; separate temporäre Sessions mit denselben Szenariotypen                                       |
| Messintervall            | 300 Sekunden; Erfassung und Analysezeitpläne haben denselben monotonen Startzeitpunkt                                                          |
| Live-Beitritte           | 500 geplante Teilnehmende über die ersten 90 Sekunden                                                                                          |
| Je teilnehmender Person  | Beitritt, WebSocket-Status-Subscription, Session-/Frageabrufe, eine Quizstimme, eine Tempostimme; jede fünfte Person reicht eine Q&A-Frage ein |
| Geplante Mutationszahlen | 500 Beitritte, 500 Quizstimmen, 100 Q&A-Einreichungen, 500 Tempostimmen                                                                        |
| Quizfrage                | Eine aktive Single-Choice-Frage ohne Zeitlimit während der gesamten Phase der Live-Mutationen                                                  |
| Ergebnisfreigabe         | Für Sekunde 270 geplant; keine vorzeitige Freigabe anhand der Zahl erfolgreicher Stimmen                                                       |
| Analyseclients           | Fünf unabhängige Host-Sessions; höchstens eine laufende Analyse je Session                                                                     |
| Analysezeitplan          | Ein Aufruf je Host alle 10 Sekunden, mit festen Versätzen von 0/2/4/6/8 Sekunden; keine nachgeholte Aufrufwelle                                |
| Analyseeingabe           | `mode: 'LEXICAL'`, `locale: 'de'`, `metric: 'TOP'`, `normalization: 'LEMMA'`, `limit: 500`, `refresh: true`                                    |
| Wiederholungen           | Fünf vollständige Blöcke; jeder enthält V0–V4 je einmal in einer über einen Seed randomisierten Reihenfolge                                    |
| Optionaler Ausfall       | V5 wird als Erweiterung getrennt ausgewertet und ersetzt keine Pflichtvariante                                                                 |

Damit ist eine kurzzeitige Lastspitze innerhalb eines fünfminütigen
Beobachtungsintervalls festgelegt. Die anschließende ruhige Phase ist kein
anhaltender Live-Verkehr. Tatsächliche gleichzeitige Verbindungen und
Zeitstempel erfassen, damit Beitritte, Mutationen, Ergebnisverteilung und
Leerlauf unterscheidbar sind. Das vorhandene Artillery-Skript muss später an
diesen Zeitvertrag angepasst werden; seine derzeit vom Bearbeitungsfortschritt
abhängige Ergebnisfreigabe setzt diesen Zeitplan nicht um.

Eine ausgelastete Analysesession überspringt ihren nächsten geplanten
Aufrufzeitpunkt und protokolliert dies. Sie reiht keine unsichtbare Arbeit ein
und verschiebt keine späteren Aufrufe. Geplante, gestartete, abgeschlossene,
abgelehnte, wegen Zeitüberschreitung gescheiterte und übersprungene Aufrufe
sowie Verspätungen des Zeitplans und am Ende noch laufende Arbeit erfassen.
Langsamere Varianten dürfen nicht allein deshalb isoliert erscheinen, weil die
angebotene Last unbemerkt sinkt. Nach Ende des Intervalls keine neue Arbeit
starten. Noch laufende Arbeit zum Stichtag als nicht abgeschlossen markieren
und höchstens 60 Sekunden zum Auslaufen gewähren. Danach verbleibende Arbeit
abbrechen und Lastgeneratoren bzw. Proxy des Laufs beenden. Die Bereinigung
getrennt ausweisen und diese Regel für jede Variante anwenden. Späte Abschlüsse
verbessern die Verfügbarkeitsquote des Messfensters nicht.

### Präzisierung der Ablaufsteuerung für Schritt 6

Die Ausführung verwendet die vorhandenen exportierten Artillery-Szenariofunktionen
in einem einzelnen Node-Lastprozess je Phase. Die installierte Artillery-Version
verteilt lokal standardmäßig auf mehrere Worker; die vorhandene gemeinsame
Zustandsdatei und lokale Teilnehmernummerierung wären dafür ungeeignet.
Szenarioaktionen, Denkzeiten, 500 Beitritte über 90 Sekunden und die Freigabe bei
Sekunde 270 bleiben erhalten. Verpasste Beitrittszeitfenster werden nicht nachgeholt
und bleiben in der geplanten Abdeckung sichtbar. Das ist im Manifest ausdrücklich
als eigene Ablaufsteuerung auf Basis des bestehenden Prozessors gekennzeichnet.

Die Aufwärmphase verwendet 30 Teilnehmende über fünf Sekunden mit denselben
Szenariotypen, fünf getrennten Analysesessions und 60 Sekunden Gesamtdauer.
Die Ergebnisfreigabe erfolgt bei Sekunde 56; Aufwärmdaten gehören nicht zu den
Messstichproben. Ein verkürzter Vorlauf mit 30 Teilnehmenden, zehn Sekunden
Aufwärmung und 30 Sekunden Messdauer prüft die Werkzeuge und ersetzt keinen
der 25 bestätigenden Läufe.

Der lokale Dockerhost hat 16 logische CPUs und etwa 16 GiB RAM. Der Lastgenerator
läuft auf demselben Rechner; diese Abweichungen von 8 vCPU und einem externen
Lastgenerator müssen in jeder späteren Kapazitätsaussage berücksichtigt werden.
Die Produktionslimits der Dienste bleiben bis auf V3 erhalten. Neu gestartete
Baseline-Prozesse verwenden laut Implementierung keinen persistenten Textcache;
die Messung prüft zusätzlich den tatsächlichen Anstieg von `sidecarCalls` in V2–V4.

## Varianten

| Variante     | `NLP_ENABLED` | spaCy-Zustand                                                     | Analyselast                             |
| ------------ | ------------- | ----------------------------------------------------------------- | --------------------------------------- |
| V0           | `false`       | Gestoppt                                                          | Keine                                   |
| V1           | `false`       | Gestoppt                                                          | Fester Zeitplan; lexikalischer Fallback |
| V2           | `true`        | 1 CPU / 1 GiB, echte Modelle betriebsbereit                       | Fester Zeitplan                         |
| V3           | `true`        | 0.25 CPU / 1 GiB, echte Modelle betriebsbereit                    | Fester Zeitplan                         |
| V4           | `true`        | 1 CPU / 1 GiB, echte Modelle hinter einem Labor-Verzögerungsproxy | Fester Zeitplan                         |
| V5, optional | `true`        | Nach der Vorbereitung gestoppt                                    | Fester Zeitplan                         |

V4 verzögert Antworten auf `/normalize` um 6000 ms, indem der Proxy die Anfrage
erst nach dieser Wartezeit weiterleitet. Damit wird das konfigurierte
Client-Timeout von 5000 ms überschritten. Anfrage- und Antwortverträge erhalten
und den Health-Endpunkt nicht verzögern. Proxy-Quellcode bzw. -Image,
Konfiguration und Socket-Zuordnung als ausdrückliche Variante erfassen. Die
Zeitüberschreitung mit einem Vertragstest prüfen. Ein Client-Timeout belegt
nicht, dass die nachgelagerte Berechnung beendet wurde.

Die relevanten Laborcontainer neu erzeugen und für jeden Lauf frische
Session-Daten vorbereiten. Auf Betriebsbereitschaft warten und vor jeder Messung
dieselbe Aufwärmphase verwenden. CPU-Limits, Socket-Zuordnung und Schalter
zwischen den Varianten zurücksetzen. Containeridentitäten und Ausgangswerte
der Zähler erfassen; keine p95-Werte oder Speicherspitzen aus der gesamten
Prozesslebensdauer voneinander subtrahieren.

## Messgrößen und Entscheidungsregeln

Für jede Live-Aktion Aufrufzahlen, Ergebnisse und Laufzeitstichproben
aufbewahren. p50/p95/p99 erfolgreicher Aufrufe mit der Nearest-Rank-Methode
angeben und Grenzen vor der Rundung für die Anzeige prüfen. Laufzeiten
fehlgeschlagener Aufrufe getrennt erfassen. Eine leere Stichprobe erfolgreicher
Aufrufe ist nicht verfügbar; sie bedeutet weder null Latenz noch eine bestandene
Prüfung.

Jeden fehlgeschlagenen versuchten Live-Aufruf mitzählen, einschließlich
429-Antworten, Transportfehlern und unerwarteten Ablehnungen aufgrund von
Autorisierung oder Session-Phase. Diese Klassen zusätzlich getrennt ausweisen.
Durch Abhängigkeiten blockierte oder nicht gesendete geplante Aktionen
ausdrücklich erfassen. Eine unvollständige Last darf nicht durch einen kleineren
Nenner bestehen. Nach einer vorzeitigen Ergebnisfreigabe übersprungene
Quizstimmen sind keine erfolgreichen Messungen. Gemessene Mutationen nicht
automatisch wiederholen; eine fehlgeschlagene logische Aktion muss sichtbar bleiben.

| Kriterium                             | Regel je Aktion und gepaarter Wiederholung                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| p95-Regression der Live-Aktionen      | V2, V3 und V4 jeweils gegen V1 desselben Blocks: `candidateP95 <= baselineP95 * 1.10` **und** `candidateP95 - baselineP95 <= 50 ms`                                                                                                               |
| Fehlergrenze der Live-Aktionen        | Fehlgeschlagene versuchte Aufrufe / versuchte Aufrufe `<= 0.005`; nicht leere Stichproben und vollständige Erfassung der geplanten Arbeit voraussetzen                                                                                            |
| Vollständigkeit der Live-Last         | Je Aktion gilt `(failed attempted calls + unsent scheduled calls) / scheduled calls <= 0.005`; durch Abhängigkeiten blockierte Aufrufe als nicht gesendet einordnen und jede logische Aktion einmal zählen                                        |
| Absolutes Ziel für Quizstimmen        | p95 erfolgreicher `vote.submit`-Aufrufe `<= 1000 ms`; für V0–V4 als Versuchsziel dieses Lastprofils ausweisen                                                                                                                                     |
| Analyseverfügbarkeit im Normalbetrieb | In V2: geplante Aufrufe mit Fallback, Fehler, Ablehnung, Überspringen oder ohne Abschluss / alle geplanten Aufrufe `<= 0.01`; jeden geplanten Aufruf einmal zählen und Ergebnisklassen sowie reine Fallbackquote der Antworten getrennt ausweisen |
| spaCy-Drosselung im Normalbetrieb     | V2: `delta(nr_throttled) / delta(nr_periods) <= 0.05`, nur bei zwei Messungen desselben Containers und positivem Nenner                                                                                                                           |
| spaCy-Speicher im Normalbetrieb       | V2: cgroup-Spitzenwert `<= 80%` des wirksamen Limits von 1 GiB; Spitzenwert des gesamten Containers einschließlich Aufwärmphase vom abgetasteten Maximum im Messfenster unterscheiden                                                             |
| OOM-Ereignisse                        | Kein Anstieg der erfassten `oom_kill`-Ereignisse bei gemessenen Diensten                                                                                                                                                                          |

Dieselben Live-Grenzen prüfen H2. Erhöhte Fallbackquoten oder übersprungene
Analyseaufrufe in V3/V4 sind zu erklärende Ergebnisse und kein Nachweis einer
weiterhin verfügbaren Analyse. Regressionen von V0 zu V1 mit denselben Grenzen
ausweisen, um den zusätzlichen Aufwand des Analysepfads zu erkennen. Verfehlt
bereits V1 das absolute Ziel für Quizstimmen, darf dieser bestehende Befund
nicht spaCy zugeschrieben werden. Eine Regel gilt nur dann als erfüllt, wenn
alle fünf vollständigen gepaarten Wiederholungen sie einhalten. Einzelne Läufe
und ihre Spannweite zeigen, statt Fehler im Mittelwert zu verbergen. Nachträgliches
Entfernen von Ausreißern ist nicht zulässig.

Dies sind A1-Abnahmeregeln. Die
[Kapazitätsdokumentation](../capacity-estimate-16gb-16cores.md), Abschnitt 7,
schlägt Latenz-SLOs für 50 aktive Teilnehmende und ein 15-minütiges Fehlerfenster
vor. Dieser fünfminütige Versuch mit 500 Beitritten kann diese Produktions-SLOs
nicht bestätigen.

Das vorhandene
[`compare-load-report.mjs`](../../scripts/load/compare-load-report.mjs) verwendet
die größere Toleranz, wenn relative und absolute Grenzen in derselben Regel
stehen. Die beiden p95-Bedingungen als getrennte Regeln ausdrücken oder eine
ausdrücklich getestete Auswertung verwenden, die beide verlangt. Die oben
angegebenen Grenzen einschließlich Gleichheit anwenden; nicht versehentlich
den ausschließenden Vergleich einer Hilfsfunktion übernehmen.

Container-CPU/RAM/PIDs alle zwei Sekunden erfassen, cgroup-CPU-Zähler vor und
nach dem Intervall, dazu Speicherspitzen und OOM-Ereignisse sowie Speicher,
Swap und Last des Hosts. Roheinheiten, tatsächliche Abtastrate, fehlende
Stichproben und Erfassungsfehler festhalten. Zeitgestempelte Zählerdifferenzen
verwenden. Dockers cachebereinigte Speicheranzeige von cgroup-Speicherwerten
unterscheiden. Ausgewählte Felder aus `health.stats` und dem authentifizierten
`health.securityStats` vor, während und nach dem Lauf erfassen. Bestehende
Serverhistogramme haben eigene Zeitfenster und Caches; sie ergänzen die
Clientmessungen, ersetzen sie aber nicht. Die vorhandene Event-Loop-Stichprobe
aus runtime-metrics beschreibt den Lastgenerator, nicht das Backend. Falls eine
Event-Loop-Instrumentierung des Backends erforderlich wird, ist sie als
getrennter Versuch zu kennzeichnen und einheitlich auf alle verglichenen Läufe
anzuwenden.

## Nachweise, ungültige Läufe und Rollback

Bereinigte Nachweise unter `evidenz/1A/<variant>/<run>/` speichern, einschließlich:

- Manifest mit Vertrags-, Werkzeug- und Anwendungsrevisionen, freigegebener
  Release-Identität, IDs bzw. Digests aller Dienst-Images, tatsächlichen
  Hardware-/OS-/Docker-/cgroup-Versionen, Ort des Lastgenerators,
  Fixture-Identität, wirksamen Schaltern und Limits, Zeitablauf, Blocknummer
  sowie Seed und Reihenfolge der Randomisierung.
- Ergebnis- und Laufzeitstichproben der Live-Aktionen, Analyseergebnissen und
  Erfassung des Aufrufzeitplans, Ressourcenzeitreihen und Zählerständen,
  ausgewählten Diagnosemetriken und der daraus abgeleiteten Grenzwertprüfung.
- Bereinigter, aufgelöster Compose-Konfiguration auf Basis einer ausdrücklichen
  Positivliste. Keine vollständige Umgebung, uneingeschränkte Ausgabe von
  `docker inspect`, rohen Anfrageheader oder ungefilterten Logs übernehmen.
  Tokens, Secrets, Zugangsdaten, IPs und zur Laufzeit verwendete
  Teilnehmeridentitäten aus eingecheckten Artefakten heraushalten.
  Laufbezogene pseudonyme Bezeichnungen verwenden.

Zunächst instrumentierte Werkzeuge mit deterministischen Vertragstests
verwenden. Anschließend einen kleinen lokalen Vorlauf durchführen, um Aufbau,
Analysezulässigkeit des Korpus, Zeitabläufe, tatsächliche spaCy-Aufrufe,
Fallbackpfade, Erfassungsaufwand und Bereinigung zu prüfen. Vorlaufdaten als
solche kennzeichnen und von bestätigenden Vergleichen ausschließen. Vor den
bestätigenden Messläufen jede notwendige Protokolländerung mit Begründung
versionieren. Nach Sichtung bestätigender Ergebnisse niemals stillschweigend
eine Grenze ändern oder ein günstigeres Lastprofil einsetzen.

Falsche Schalter oder Fixtures, verlorene Ergebnisdaten, ungeplante
Containerneustarts, fehlende erforderliche Ressourcenmetriken oder fremde Last
auf dem Host machen einen Lauf unvollständig oder ungültig. Den Lauf mit
Begründung aufbewahren und seinen Block unter den festgelegten Bedingungen
wiederholen. Erwartete Verschlechterungen in V3/V4 und Grenzwertverletzungen
sind gültige Ergebnisse und kein Grund, einen Lauf zu verwerfen. Bei riskanter
Ressourcenerschöpfung im Labor abbrechen und das abgebrochene Ergebnis
festhalten. Fehlgeschlagene Messungen niemals durch erfundene Werte ersetzen.

Der Rollback stellt die dokumentierte Baseline wieder her: Lastgeneratoren und
Verzögerungsproxy stoppen, ursprünglichen Socket-Pfad und spaCy-CPU-Limit
wiederherstellen, `NLP_ENABLED=false` setzen, die App zum Übernehmen der Umgebung
neu erzeugen und spaCy stoppen. Den Zustand von Anwendung, PostgreSQL und Redis
sowie eine lexikalische Analyse und einen kurzen Funktionstest einer Live-Aktion
prüfen. Ausschließlich Daten und Container der Laborressourcen dieses Versuchs
entfernen.

## Voraussetzungen und Abschlussgrenze

Vor bestätigenden Messläufen klären und festhalten:

- Freigabe von Baseline-Commit, Laborhardware und Referenzmanifest durch Prüfer
  bzw. Laborverantwortliche, einschließlich der Auftragsaufteilung, soweit
  erforderlich.
- Laborzugang, isolierte Ressourcen, Ort des Lastgenerators und verfügbare
  Ressourcenzähler sowie Laborbeschränkungen und gegebenenfalls Kostenfreigaben.
- Fixture-Seed und -Hash, genaue Raumbezugsgröße und Bewertungen, Identitäten
  von Versuchsskript und Images, tatsächlicher Zeitablauf und nachgewiesene
  Wiederherstellung der Baseline.
- Ergebnisse von Vorlauf und Werkzeugtests sowie die festgeschriebene Revision
  dieses Vertrags.

Schritt 1 ist abgeschlossen, wenn der Vertrag dokumentiert und geprüft ist.
Damit wird weder eine Release-Baseline freigegeben noch behauptet, dass die
späteren Werkzeuge vorhanden sind oder Kapazitäten gemessen wurden. Die daraus
abgeleitete Entscheidung muss benennen, ob die Glättung abgeschaltet bleibt,
unter den gemessenen Grenzen zugelassen wird oder einen weiteren Versuch
benötigt, jeweils mit Betriebsaufwand und Ressourcenfolge.

Niklas verantwortet den A1-Versuch und die gemeinsamen Fixture- und
Live-Messwerkzeuge für die Issues #9 und #10. Wiederverwendete Beiträge und Daten
ausdrücklich kennzeichnen. Die Laborbereitstellung durch Jonas ist gemeinsame
Infrastruktur und kein eigener Messnachweis von Niklas. Das spätere Handout und
die Folien müssen KI-Unterstützung offenlegen und den Eigenanteil ausweisen.
API-Laufzeiten und Statusverteilung geben Hinweise auf die Zustellung von
Signalen. Sie messen weder Browser-Rendering noch Lehrqualität oder die
Tragfähigkeit eines zusätzlichen LLMs auf dem Anwendungshost.
