<!-- markdownlint-disable MD013 -->

# ADR-0025: Zukuenftige Erweiterungen standardmaessig als performance-kritisch behandeln

**Status:** Accepted  
**Datum:** 2026-05-08  
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-05-31

## Kontext

arsnova.eu ist keine klassische CRUD-Anwendung, sondern eine Live-Plattform mit mehreren potenziell lastkritischen Eigenschaften:

- viele gleichzeitige Teilnehmende in einer Session
- Host-, Presenter- und Teilnehmeransichten mit engem Echtzeitbezug
- tRPC- und WebSocket-/Subscription-Pfade
- Redis- und PostgreSQL-gestuetzte Live-Zustaende
- mobile-first Views mit haeufigen Statuswechseln
- moegliche neue KI- und Analysefunktionen

Die bisherigen Architekturentscheidungen zeigen bereits, dass neue Produktideen fachlich attraktiv sein koennen, aber technisch schnell in den kritischen Pfad geraten:

- kontinuierliche Live-Kanaele wie der **Tempo-Kanal**
- daten- und renderintensive Visualisierungen wie die **Begriffswolke / Word-Cloud**
- kuenftige **intelligente Begriffswolken** oder andere Auswertungen mit **selbstgehosteter LLM-Instanz**

Gerade solche Erweiterungen werden im Produktdiskurs oft zunaechst als UI- oder Feature-Frage beschrieben, koennen aber tatsaechlich:

- zusaetzliche Hotpath-Reads oder -Writes erzeugen
- Fan-out auf viele Clients ausloesen
- Rechenlast in den Request-Pfad ziehen
- Redis, PostgreSQL oder CPU/RAM unkontrolliert belasten
- bestehende SLOs verschlechtern
- den Single-Host-Betrieb oder eine kleine Zielarchitektur ueberfordern

Wir brauchen deshalb eine verbindliche Architekturregel, die kuenftige Erweiterungen **nicht pauschal ablehnt**, aber unter einen klaren technischen Vorbehalt stellt.

## Entscheidung

### 1. Neue Erweiterungen stehen unter Performance-Vorbehalt

Alle kuenftigen Erweiterungen von **arsnova.eu** werden ab sofort **grundsaetzlich unter Generalverdacht gestellt, performance-kritisch zu sein**, bis das Gegenteil plausibel gezeigt wurde.

Das gilt insbesondere fuer Erweiterungen, die mindestens eines der folgenden Merkmale aufweisen:

- kontinuierliche oder haeufig aktualisierte Live-Zustaende
- viele gleichzeitige Teilnehmenden-Interaktionen
- serverseitige Aggregation im Sekundentakt oder naeher
- zusaetzliche Polling-, Subscription- oder Reconnect-Last
- CPU-intensive Transformationen oder Render-Vorbereitung
- KI-/LLM-gestuetzte Auswertung, Klassifikation oder Zusammenfassung
- neue Infrastrukturkomponenten auf demselben Host
- Exporte, Rankings, Sortierungen oder Scorings auf grossen Datenmengen

Diese Einstufung ist **keine Ablehnung des Features**, sondern die verbindliche Startannahme fuer Design und Review.

### 2. Beweislast liegt bei der Erweiterung, nicht bei der Kritik

Wer eine neue Erweiterung einfuehrt, muss im Design oder in der Storybearbeitung explizit darlegen:

- welcher fachliche Mehrwert entsteht
- welche Lastpfade betroffen sind
- ob die Aenderung im Request-Pfad, im Live-Pfad oder asynchron laeuft
- welche Datenhaeufigkeit und welches Nutzungsprofil erwartet werden
- welche SLO-/Latenzfolgen denkbar sind
- wie Missbrauch, Spike-Last und Grossveranstaltungen bewertet werden

Damit gilt:

- **Nicht** die skeptische Rueckfrage muss zuerst beweisen, dass ein Feature problematisch ist.
- **Sondern** die Feature-Umsetzung muss zeigen, warum der Eingriff vertretbar ist.

### 3. Performance-Kritik wird als Architekturinput behandelt

Performance-Kritik an neuen Features wird nicht als Verzoegerungstaktik oder Grundsatzopposition behandelt, sondern als **regulaerer, konstruktiver Architekturinput**.

Verbindlich ist folgende Lesart:

- Eine kritische Rueckfrage ist zunaechst ein **Hinweis auf fehlende technische Klaerung**.
- Sie wird in **konkrete Fragen, Risiken, Messpunkte und Leitplanken** uebersetzt.
- Das Ziel ist **nicht**, Features reflexhaft zu stoppen, sondern sie belastbar zu entwerfen.

Zulaessige und erwartbare Kritikformen sind insbesondere:

- "Liegt das im Hotpath?"
- "Brauchen wir dafuer zusaetzliches Polling oder Fan-out?"
- "Kann das auf Redis/PostgreSQL/CPU kippen?"
- "Was passiert bei 500 Teilnehmenden?"
- "Wie verhaelt sich das im Fehlerfall oder bei Ressourcenknappheit?"
- "Welche Funktion bleibt erhalten, wenn die Zusatzkomponente ausfaellt?"

### 4. Jede relevante Erweiterung erhaelt einen kleinen Performance-Steckbrief

Fuer neue Stories, ADRs oder groessere PRs mit Lastpotenzial ist kuenftig ein kurzer Performance-Steckbrief erforderlich.

Er enthaelt mindestens:

- **Lastklasse:** unkritisch | beobachtungspflichtig | performance-kritisch
- **Pfadtyp:** Request-Pfad | Live-Pfad | Hintergrundjob | externer Dienst
- **Kostenprofil:** CPU | RAM | Redis | PostgreSQL | Netzwerk | Browser-Rendering
- **Skalierungsprofil:** pro Nutzer | pro Session | global
- **Worst Case:** z. B. 500 Teilnehmende in einer Session
- **Entlastungsstrategie:** Caching, Batching, Preaggregation, Sampling, Async-Verarbeitung, Feature-Flag, Kill-Switch
- **Messstrategie:** k6, Artillery, Telemetrie, Mikrobenchmark, UI-Profiling

Der Steckbrief darf kurz sein, aber er darf nicht fehlen, wenn die Erweiterung erkennbar Last erzeugen kann.

### 5. Kontinuierliche Live-Features gelten automatisch als performance-kritisch

Features mit kontinuierlicher Rueckmeldung oder dauerhafter Parallelaktivitaet werden standardmaessig als **performance-kritisch** klassifiziert.

Dazu gehoeren insbesondere:

- Tempo-Kanal
- kontinuierliche Signal- oder Feedbackkanaele
- laufende Aggregat- oder Trendberechnung
- alle Features mit dauerhaft sichtbarem Teilnehmer-Widget

Solche Features muessen besonders nachweisen:

- dass sie ohne relationale Hotpath-Schreiblast auskommen
- dass sie Aggregation statt Einzelereignis-Expose nutzen
- dass sie keine unbegrenzte Render- oder Polling-Schleife erzeugen
- dass sie bei Last oder Teilausfall sauber degradieren koennen

### 6. KI- und LLM-Funktionen gelten automatisch als performance-kritisch

Alle Erweiterungen mit KI-, Inferenz- oder LLM-Bezug gelten standardmaessig als **performance-kritisch**.

Das gilt ausdruecklich auch fuer:

- selbstgehostete LLM-Instanzen
- intelligente Begriffswolken
- semantische Clusterung von Freitext
- automatische Zusammenfassungen oder Klassifikationen
- Embedding-, Ranking- oder Reranking-Schritte

Fuer solche Funktionen gelten zusaetzliche Leitplanken:

1. **Keine implizite Inferenz im synchronen Live-Hotpath**, solange dies nicht gesondert belegt und getestet wurde.
2. **Bevorzugt asynchrone oder voraggregierte Verarbeitung** statt Inferenz pro Teilnehmeraktion.
3. **Klare Ressourcenisolation**, wenn moeglich getrennt von App, Redis und PostgreSQL.
4. **Saubere Fallbacks**, wenn die KI-Komponente ausfaellt, langsam ist oder deaktiviert werden muss.
5. **Explizite Kosten- und Betriebsbetrachtung**, insbesondere bei GPU-/CPU-Bedarf und Self-Hosting.

Die fachliche Attraktivitaet einer KI-Funktion ersetzt keine Architekturpruefung.

### 7. Konstruktive Aufnahme von Kritik folgt einem festen Ablauf

Wenn in Story, ADR, Review oder Diskussion Performance-Bedenken geaeussert werden, ist kuenftig folgender Ablauf verbindlich:

1. **Bedenken benennen**
   Die Sorge wird als konkrete technische Hypothese formuliert.

2. **Pfad identifizieren**
   Es wird geklaert, ob Request-Pfad, Live-Pfad, Hintergrundverarbeitung oder Infrastruktur betroffen sind.

3. **Mess- oder Designantwort festlegen**
   Die Antwort kann sein:
   - Design anpassen
   - Datenmodell aendern
   - Verarbeitung asynchron machen
   - Feature-Flag einfuehren
   - Lasttest oder Benchmark anlegen
   - SLO-Telemetrie erweitern

4. **Grenzen explizit machen**
   Es wird festgelegt, unter welchen Bedingungen das Feature freigegeben, begrenzt oder abgeschaltet wird.

5. **Ergebnis dokumentieren**
   Die Entscheidung landet in Story, ADR, PR-Beschreibung oder Betriebsdokumentation.

Damit wird Kritik in Architekturarbeit transformiert, statt im informellen Streit zu verbleiben.

### 8. Neue Features brauchen einen Degradations- und Abschaltmodus

Jede performance-kritische Erweiterung muss einen realistischen Umgang mit Ueberlast, Fehlern oder Teil-Ausfall vorsehen.

Mindestens eines der folgenden Muster ist zu pruefen:

- Feature-Flag
- Kill-Switch
- reduzierte Aktualisierungsfrequenz
- Sampling oder Begrenzung
- nur Host-seitige Sicht statt Teilnehmer-Fan-out
- asynchrone statt synchrone Berechnung
- Fallback auf einfache Darstellung statt intelligente Auswertung

Ein Feature ist architektonisch unvollstaendig, wenn es nur fuer den Idealzustand entworfen wurde.

### 9. Freigabe erfolgt stufenweise statt absolut

Performance-kritische Erweiterungen werden nicht mit einem abstrakten "wird schon gehen" freigegeben.

Stattdessen gilt:

- lokale oder kleine Funktionspruefung
- messbare Last- und Telemetriepruefung
- produktionsnahe Stufe
- erst dann allgemeine Freigabe

Fuer stark risikobehaftete Features ist eine Freigabe mit Randbedingungen ausdruecklich zulaessig, z. B.:

- nur deaktiviert per Default
- nur fuer kleine Sessions
- nur ohne KI-Zusatzlogik
- nur auf getrennter Infrastruktur

## Konsequenzen

### Positiv

- Performance-Risiken werden frueher sichtbar und nicht erst nach Produktivproblemen.
- Kritik an neuen Features wird entpersonalisiert und in einen klaren Architekturprozess ueberfuehrt.
- Live-, Rendering- und KI-Funktionen erhalten von Anfang an realistischere technische Leitplanken.
- Die Plattform bleibt anschlussfaehig fuer neue Ideen, ohne Last- und Betriebsfragen zu romantisieren.
- Features wie Tempo-Kanal oder intelligente Begriffswolken koennen gezielter und belastbarer umgesetzt werden.

### Negativ / Risiken

- Mehr Dokumentations- und Review-Aufwand bei neuen Features.
- Produktideen fuehlen sich anfangs langsamer an, weil technische Klaerung frueher eingefordert wird.
- Es besteht die Gefahr, dass "performance-kritisch" inflationaer verwendet wird, wenn Lastklassen nicht sauber differenziert werden.
- Teams muessen lernen, Kritik systematisch in Mess- und Designarbeit zu uebersetzen.

## Alternativen (geprueft)

- **Neue Features primaer als unkritisch behandeln:** verworfen, weil arsnova.eu mehrere Echtzeit- und Lastpfade hat, in denen kleine Designentscheidungen grosse Betriebsfolgen haben koennen.
- **Performance nur im Einzelfall spaet pruefen:** verworfen, weil Probleme dann typischerweise erst nach Implementierung oder im Produktivbetrieb sichtbar werden.
- **Pauschales Feature-Bremsen aus Vorsicht:** verworfen, weil das Innovation behindert und keine konstruktive Architekturarbeit ersetzt.
- **Nur fuer KI-Funktionen einen Sonderprozess einfuehren:** verworfen, weil auch nicht-KI-Features wie Tempo oder Live-Aggregate erhebliche Lastwirkungen haben koennen.

## Umsetzungsleitplanken

- Neue ADRs und groessere Stories mit Live-, Analyse- oder KI-Bezug benennen ihre Lastklasse explizit.
- PRs fuer performance-kritische Features beschreiben den Hotpath, Degradationsmodus und die Messstrategie.
- Wenn ein Feature den bestehenden Single-Host-Betrieb oder die Zielarchitektur plausibel gefaehrdet, ist Architektur- oder Infrastrukturentkopplung vor breiter Freigabe zu pruefen.
- Selbstgehostete LLM-Komponenten duerfen nicht stillschweigend auf denselben Ressourcen mitlaufen wie kritische Live-Pfade, ohne dass Isolation und Fallback dokumentiert sind.
- "Konstruktive Kritik" bedeutet im Projektkontext: Risiko benennen, Hypothese formulieren, Mess- oder Designantwort festlegen, Ergebnis dokumentieren.

## Repo-Abgleich 2026-05-31

Die Regel ist weiterhin aktiv und sichtbar in Folgeentscheidungen: ADR-0026 priorisiert konkrete Hotpaths, ADR-0027 fuehrt Join-Glattung ein, ADR-0028 haelt Scoring-Aggregation linear, und ADR-0029 behandelt Tempo trotz Blitzlicht-Wiederverwendung als performance-kritisches Feature. Story 8.8 ist im Code noch offen und muss vor Umsetzung den hier geforderten Performance-Steckbrief praktisch einloesen.

---

**Referenzen:** `Backlog.md` Story `0.7`, Story `8.8`, [ADR-0012: d3-cloud als Layout-Engine fuer Freitext-Word-Clouds](./0012-use-d3-cloud-for-freetext-word-clouds.md), [ADR-0013: k6 und Artillery als Standard-Stack fuer Last- und Performance-Tests](./0013-use-k6-and-artillery-for-load-and-performance-testing.md), [ADR-0021: Trennung von Betriebsstatus und Systemlast mit Live-Telemetrie](./0021-separate-service-status-from-load-status-with-live-slo-telemetry.md), [ADR-0029: Tempo als vordefiniertes Blitzlicht-Template statt eigenem Session-Kanal](./0029-tempo-as-predefined-blitzlicht-template.md), [docs/architecture/handbook.md](../handbook.md), [docs/implementation/LASTTEST-500-TEILNEHMENDE.md](../../implementation/LASTTEST-500-TEILNEHMENDE.md).
