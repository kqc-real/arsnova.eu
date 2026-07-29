# Cloud-Computing-Einordnung: akademische Fassung

**Zweck:** Wissenschaftlich anschlussfähiger Bezugsrahmen für Seminar-, Projekt- und Portfolioarbeiten · **Stand:** 2026-07-28 · **Empirischer Status:** [betriebliche Einordnung](./CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md)

## 1. Untersuchungsgegenstand

Untersucht wird die Transformation der Live-Webanwendung `arsnova.eu` von einem containerisierten Single-Host-Betrieb zu einer potenziell verteilten Cloud-Architektur. Zwei kontrastierende Lehrszenarien bilden den Analysefall:

1. 100 parallele Sessions mit je 50 Teilnehmenden und mehreren Live-Kanälen;
2. eine einzelne Session mit 5.000 Teilnehmenden.

Die Szenarien sind **analytische Zielprofile**, keine empirisch bestätigten Kapazitäten. Der historische Produktionsnachweis umfasst 500 gleichzeitige Joins, jedoch keine vollständige Live-Session unter dieser Last; umfassendere 500er-Regressionen liegen lokal vor. Die formale Zielhost-Gesamtabnahme ist offen.

## 2. Cloud-theoretischer Bezug

Terminologische Grundlage ist [NIST SP 800-145](https://csrc.nist.gov/pubs/sp/800/145/final) mit fünf wesentlichen Cloud-Merkmalen, drei Service- und vier Deployment-Modellen. Für die Operationalisierung von Zuverlässigkeit dient das frei verfügbare Kapitel [Implementing SLOs](https://sre.google/workbook/implementing-slos/) aus dem Google-SRE-Workbook als Praxisreferenz. Beide Quellen ergänzen die im bereitgestellten Modulhandbuch ausgewiesene Pflichtliteratur; Quellenstatus und Aktualisierungsregel stehen in den [IU-Formalia](../didaktik/CLOUD-COMPUTING-IU-FORMALIA.md#8-pflichtliteratur-und-aktualisierung).

Die Fragestellung berührt zentrale Konstrukte des Cloud Computing:

- **On-demand Provisioning und Measured Service:** Ressourcen werden bedarfsgerecht bereitgestellt und ihre Nutzung messbar gemacht.
- **Resource Pooling und Multi-Tenancy:** Viele unabhängige Sessions teilen Infrastruktur, ohne Isolation und Fairness zu verlieren.
- **Scalability und Elasticity:** Das System muss wachsende Last tragen; Elastizität ergänzt die zeitnahe Anpassung an wechselnde Last.
- **Service Decomposition:** Compute, Persistenz, flüchtiger Zustand, Ereignisverteilung und Hintergrundarbeit erhalten explizite Betriebsgrenzen.
- **Resilience:** Fehler einzelner Instanzen oder Dienste dürfen nicht unkontrolliert zum Ausfall des Live-Betriebs führen.
- **Observability:** SLIs, SLOs, Logs, Metriken und kontrollierte Experimente machen Systemverhalten bewertbar.
- **Shared Responsibility:** Sicherheits-, Datenschutz- und Betriebsaufgaben verschieben sich mit dem gewählten Service-Modell.

Damit ist der Fall nicht deshalb „Cloud“, weil er auf gemieteter Infrastruktur läuft, sondern weil bedarfsgerechte Bereitstellung, geteilte Ressourcen, Skalierung, Messbarkeit und Verantwortungsverschiebung systematisch entworfen und bewertet werden.

## 3. Geeignete Forschungsfragen

- Welche Architekturgrenzen verhindern derzeit horizontale Skalierung des Live-Pfads?
- Wie unterscheiden sich Engpässe vieler kleiner Sessions von einem einzelnen Fan-out-Hotspot?
- Welche SLIs und Testdesigns erlauben eine belastbare Aussage zur Kapazität und Recovery?
- Welche 6R-Kombination reduziert technische und betriebliche Risiken schrittweise?
- Unter welchen Annahmen ist Self-managed IaaS gegenüber Managed Services wirtschaftlicher?
- Wie verändern Provider- und Service-Modell Datenschutz, Lock-in und Betriebsverantwortung?

## 4. Operationalisierung

| Konstrukt          | Mögliche Indikatoren                                                            |
| ------------------ | ------------------------------------------------------------------------------- |
| Skalierbarkeit     | Durchsatz und Latenz bei steigender Client-, Session- und Kanalzahl             |
| Elastizität        | Bereitstellungszeit, Scale-out-/Scale-in-Zeit, Stabilität während der Anpassung |
| Resilienz          | Fehlerauswirkung, Reconnect-Quote, Recovery-Zeit, Datenverlust                  |
| Multi-Tenancy      | Isolation, Fairness, Noisy-Neighbour-Effekt, Session-Kardinalität               |
| Observability      | Abdeckung kritischer SLIs, Alarmgüte, Diagnosezeit                              |
| Wirtschaftlichkeit | Infrastruktur-, Betriebs-, Migrations-, Egress- und Lock-in-Kosten              |

Eine seriöse Arbeit definiert für jedes Zielprofil Workload, Messgröße, Akzeptanzkriterium, Testumgebung und Gültigkeitsgrenze.

## 5. Evidenz- und Validitätsregeln

- Ein lokaler Lasttest belegt Reproduzierbarkeit im Testaufbau, nicht automatisch Produktionskapazität.
- Ein erfolgreicher Join-Lauf belegt weder Vote-Verarbeitung noch WebSocket-Fan-out oder Recovery.
- Konfigurierte Connection-Caps sind Schutzgrenzen, keine gemessene Leistungsfähigkeit.
- Eine Stückliste oder Kostenrechnung ist eine Planungshypothese, kein Lastnachweis.
- Providerprodukte dürfen nur bei vergleichbarer Region, Verfügbarkeit, Service-Tiefe und Kostenbasis gegenübergestellt werden.
- Aussagen müssen den untersuchten Commit, die Topologie, Laufparameter und Unsicherheiten nennen.

## 6. Mögliche Methodik

Eine geeignete Fallstudie kombiniert:

1. dokumenten- und codebasierte Architekturanalyse;
2. explizite Modellierung beider Workloads;
3. kontrollierte Last-, Fehler- und Recovery-Experimente;
4. quantitative SLI/SLO-Auswertung;
5. qualitative Architektur- und 6R-Bewertung;
6. transparente Kosten- und Risikoanalyse.

## 7. Akademische Schlussfolgerung

Die Untersuchung ist dem Cloud Computing zuzuordnen, weil sie die messbare, skalierbare und resiliente Bereitstellung einer internetbasierten Multi-Tenant-Live-Anwendung analysiert. Wissenschaftlich besonders ergiebig ist die Diskrepanz zwischen einem funktionierenden Single-Host-Ist-System, begrenzter Lasttestevidenz und wesentlich größeren, noch unbestätigten Lehrzielbildern. Sie zwingt dazu, Architekturentscheidungen als überprüfbare Hypothesen statt als Produktversprechen zu formulieren.
