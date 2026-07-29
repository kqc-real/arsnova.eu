# 6R-Einordnung der Cloud-Transformation von arsnova.eu

**Zweck:** Migrationsoptionen für Lehre und Architekturarbeit strukturiert vergleichen · **Stand:** 2026-07-28 · **Empirische Grundlage:** [betriebliche Cloud-Einordnung](./CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md)

## 1. Taxonomie und Geltungsbereich

Dieses Dokument verwendet die sechs Strategien **Rehost, Replatform, Repurchase, Refactor, Retire und Retain**. Literatur und Provider verwenden teils abweichende 6R-/7R-Bezeichnungen, insbesondere `Rearchitect` statt oder neben `Refactor` sowie zusätzlich `Relocate`. In Arbeiten ist deshalb die verwendete Taxonomie zu definieren, nicht nur „6R“ zu schreiben.

Analysiert werden zwei ungetestete **Lehrzielbilder**:

- 100 parallele Classrooms mit je 50 Teilnehmenden und mehreren Live-Kanälen;
- eine einzelne Konferenz-Session mit 5.000 Teilnehmenden.

Der aktuelle Produktionspfad bleibt ein Single-Host-Compose-Deployment. Historisch belegt sind 500 Produktions-Joins, nicht der vollständige Live-Betrieb mit 500; umfangreichere 500er-Pfade sind lokal verifiziert. Die formale Zielhostabnahme ist offen.

## 2. Bewertungskriterien

Jede R-Option wird nach denselben Fragen bewertet:

1. Welches Problem des Ist-Systems löst sie?
2. Welche Code-, Daten- und Betriebsänderungen sind nötig?
3. Welche neuen Abhängigkeiten oder Risiken entstehen?
4. Welcher Nachweis entscheidet über Erfolg oder Abbruch?
5. Für welches der beiden Lastprofile ist die Maßnahme relevant?

## 3. Rehost

**Bedeutung:** Anwendung weitgehend unverändert auf andere oder stärkere Infrastruktur verschieben.

Mögliche Anwendung:

- bestehenden Compose-Stack auf eine andere VM oder einen stärkeren Host übertragen;
- Infrastruktur reproduzierbar provisionieren, ohne die Anwendungsarchitektur zu ändern.

Nutzen:

- schnellster Weg zu mehr vertikaler Reserve oder erneuerter Infrastruktur;
- guter Ausgangspunkt für einen isolierten Zielhosttest.

Grenze:

- beseitigt Single Point of Failure und prozesslokale Live-Signale nicht;
- beweist weder Elastizität noch horizontale Skalierbarkeit.

**Gate:** vollständige §6.5-Last-/Security-Abnahme, Restore-Test und Ressourcenmessung auf dem neuen Zielhost.

## 4. Replatform

**Bedeutung:** Betriebsplattform ändern, ohne das Produkt grundlegend neu zu entwickeln.

Mögliche Anwendung:

- App, PostgreSQL und Redis auf getrennte Ressourcen verschieben;
- Managed PostgreSQL oder Managed Redis/Valkey einsetzen;
- Load Balancer, private Netze, IaC und standardisierte Observability ergänzen;
- App-Image unverändert oder nur gering angepasst betreiben.

Nutzen:

- klare Fehler-, Security- und Skalierungsgrenzen;
- weniger Eigenbetrieb möglich, abhängig vom Provider.

Grenze:

- ein Load Balancer macht prozesslokale `EventEmitter`, WebSocket/Yjs-Zuordnung und globale Limits nicht automatisch multi-instanzfähig.

**Gate:** Zwei-Instanz-Test mit Status-/Vote-Fan-out, Reconnect, Failover, globalen Limits und Recovery.

## 5. Repurchase

**Bedeutung:** Eigenbetrieb durch ein Produkt oder einen SaaS-Dienst ersetzen.

Für den Kern von `arsnova.eu` ist das strategisch kaum passend, weil die Anwendung selbst das Produkt und Lehrvehikel ist. Für Randfähigkeiten kann Repurchase sinnvoll sein:

- externes Uptime-/Heartbeat-Monitoring;
- Log-/Metrikplattform;
- Object Storage, CDN/WAF oder E-Mail-/Webhook-Dienst;
- Managed Datenbank und Cache, sofern die Taxonomie dies als Repurchase statt Replatform klassifiziert.

**Gate:** Datenschutz-/AVV-Prüfung, Export-/Exit-Test, Kosten- und Ausfallfolgenvergleich.

## 6. Refactor / Rearchitect

**Bedeutung:** Code und Architektur gezielt für neue Qualitätsziele verändern.

Für horizontale Skalierung besonders relevant:

- prozesslokale Session-Signale durch einen geteilten Ereignispfad oder eine nachgewiesene Routingstrategie ersetzen;
- instanzübergreifende Limits und Semaphore für PDF, Yjs und Abuse-Schutz entwerfen;
- DB-intensive Live-Pfade messen und gegebenenfalls entkoppeln oder cachen;
- WebSocket-/Yjs-Failover, Idempotenz und Reconnect-Semantik definieren;
- je Lastprofil Backpressure, Admission Control und Degradation vorsehen.

Nutzen:

- adressiert die eigentlichen Multi-Instanz- und Fan-out-Grenzen.

Grenze:

- höchster Entwicklungs- und Validierungsaufwand; ohne Messung droht ein teurer Umbau am falschen Engpass.

**Gate:** schrittweise Architekturtests erst mit zwei Instanzen, dann mit gestuften Workloads; keine direkte Behauptung von 5.000 Clients.

## 7. Retire

**Bedeutung:** nicht mehr benötigte Komponenten oder Betriebsvarianten entfernen.

Mögliche Anwendung:

- veraltete Polling-Fallbacks nach nachgewiesener Push-/Reconnect-Stabilität abbauen;
- ungenutzte Betriebswege, Images oder doppelte Telemetrie entfernen;
- besonders teure optionale Funktionen in einem klar definierten Degradationsmodus deaktivieren.

Retire darf keine versteckte Funktionskürzung sein. Produktwirkung, Barrierefreiheit und Betriebskommunikation müssen geprüft werden.

**Gate:** Nutzungs-/Abhängigkeitsnachweis, Regressionstests und dokumentierter Rollback.

## 8. Retain

**Bedeutung:** Teile bewusst unverändert lassen.

Sinnvolle Kandidaten:

- Angular-Frontend und lokale Quiz-Sammlung, solange sie kein gemessener Engpass sind;
- Prisma/PostgreSQL-Domänenmodell, wenn die Skalierungsmaßnahme auf Betriebs- und Live-Pfade begrenzt bleibt;
- Single-Host-Betrieb für kleine institutionelle Installationen als unterstützte, kostengünstige Variante.

Retain ist eine begründete Scope-Entscheidung, kein Aufschieben ohne Kriterium.

**Gate:** dokumentierte Annahme, Monitoring und Termin oder Schwelle für Neubewertung.

## 9. Empfohlene Kombination

| Zeithorizont | Kombination              | Begründung                                                                                                 |
| ------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| zuerst       | **Retain + Rehost**      | Ist-Pfad stabilisieren und formalen Zielhostnachweis schaffen, ohne Architekturbehauptungen vorwegzunehmen |
| danach       | **Replatform**           | Dienste und Verantwortungen trennen; reproduzierbare Zieltopologie aufbauen                                |
| gezielt      | **Refactor/Rearchitect** | nur gemessene Multi-Instanz-, Fan-out- und State-Grenzen umbauen                                           |
| selektiv     | **Repurchase + Retire**  | Randdienste einkaufen beziehungsweise überholte Pfade entfernen, wenn Exit und Nutzen belegt sind          |

Die Reihenfolge ist eine Hypothese, kein Beschluss. Ein sehr guter Zwei-Instanz-Nachweis kann Refactor begrenzen; ein früher Engpass kann ihn vorziehen.

## 10. Roadmap-Artefakt für den Kurs

Eine belastbare 6R-Abgabe enthält:

- Ist-Komponente und belegte Grenze;
- gewähltes R mit Taxonomiedefinition;
- erwartete Wirkung auf beide Lastprofile;
- notwendige Code-/Betriebsänderung;
- Risiko, Kostenart und Exit-Strategie;
- Messung, Gate und Abbruchkriterium;
- bewusst beibehaltene Komponenten.

## 11. Kurzfassung

Für `arsnova.eu` ist keine einzelne R-Strategie ausreichend. Plausibel ist ein evidenzgetriebener Pfad aus **Retain/Rehost** für die stabilen Teile und den Zielhostnachweis, **Replatform** für klare Dienstgrenzen sowie gezieltem **Refactor/Rearchitect** für prozesslokale Live-Signale, globale Limits und Multi-Instanz-Failover. Repurchase und Retire sind vor allem bei Randdiensten beziehungsweise nachweislich überholten Pfaden sinnvoll.
