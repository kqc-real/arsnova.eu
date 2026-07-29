# Cloud-Computing-Einordnung: betriebliche Fassung

**Zweck:** Aktuellen Betriebsstand, belastbare Evidenz und Cloud-Transformationsbedarf von `arsnova.eu` trennen · **Stand:** 2026-07-28 · **Kurskontext:** [Cloud-Computing-Kurslandkarte](../didaktik/CLOUD-COMPUTING-KURSREADME.md)

## 1. Ist-System

Der vorgesehene Produktionspfad ist derzeit ein **Single-Host-Deployment**:

- Nginx terminiert TLS und leitet HTTP, tRPC-WebSockets und Yjs weiter.
- Ein App-Container liefert Frontend und Backend einschließlich der WebSocket-Dienste aus.
- PostgreSQL 16 und Redis 7.4 laufen als eigene Container auf demselben Host.
- Die PDF-Erzeugung läuft in einem separaten, gehärteten Worker-Container.

Das ist ein containerisierter IaaS-/Self-managed-Betrieb, aber noch keine elastische Multi-Instanz-Architektur. Die maßgeblichen Quellen sind [Produktions-Compose](../../docker-compose.prod.yml), [Deployment-Anleitung](../deployment-debian-root-server.md) und [Architektur-Handbuch](../architecture/handbook.md).

## 2. Evidenzlage

| Evidenzstufe            | Stand                                                                                     | Betriebliche Aussage                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Produktion, 2026-05-09  | 500 gleichzeitige Joins, 0 HTTP-Fehler, `p95 = 3,57 s`                                    | Join funktional erfolgreich, damaliges Ziel `p95 < 3 s` verfehlt; aktive Frage und Vote-Spike nicht auf Produktion geprüft |
| Lokal, 2026-07-12       | versionierte 500er-Regressionen für Live-Session, Reconnect, Vote, Yjs und Soak-Bausteine | Entwicklungs- und Regressionsbaseline, kein Produktions-SLO                                                                |
| Formale Zielhostabnahme | §6.5-Lauf noch nicht ausgeführt                                                           | Keine vollständige Freigabe für 500 Teilnehmende im produktionsnahen Live-Betrieb                                          |

Quellen: [Produktionslauf](./LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md), [lokale Baseline](./LOCAL-BASELINE-FREIGABE-2026-07-12.md), [§6.5-Abnahme](./S6.5-SECURITY-LOAD-ACCEPTANCE.md).

Die Kurzform „500 abgenommen“ ist deshalb zu ungenau. Korrekt ist: **500 Produktions-Joins wurden historisch funktional beobachtet; umfassendere 500er-Pfade sind lokal verifiziert; die formale produktionsnahe Gesamtfreigabe ist offen.**

## 3. Lehr- und Architekturzielbilder

Für den Cloud-Computing-Kurs werden zwei ungetestete Szenarien verglichen:

| Profil                                                         | Charakteristische Belastung                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| **100 Sessions × 50 Teilnehmende** in Quiz, Q&A und Blitzlicht | Multi-Tenancy, viele Sessionzustände, Kanalparallelität und Isolation |
| **1 Session × 5.000 Teilnehmende**                             | Hotspot, WebSocket-Fan-out, Burst-Last und gemeinsamer Live-Zustand   |

Beide Profile ergeben in Summe 5.000 Clients, sind architektonisch aber nicht austauschbar. Sie sind keine Produktzusage und kein bereits beschlossenes Infrastrukturziel.

## 4. Cloud-relevante Betriebsfragen

- **Provisioning und Elastizität:** Welche Ressourcen werden für welches Lastprofil wann bereitgestellt und wieder abgebaut?
- **Horizontale Skalierung:** Wie werden HTTP, tRPC-WebSockets und Yjs über App-Replikate verteilt?
- **Geteilter Zustand:** Wie verlassen Session-Signale und globale Schutzlimits den heute teilweise prozesslokalen Geltungsbereich?
- **Daten und Resilienz:** Welche RPO/RTO gelten für PostgreSQL, Redis-Hilfsdaten, Konfiguration und Exporte?
- **Observability:** Welche SLIs belegen Join, Vote, Fan-out, Reconnect, Sättigung und Recovery?
- **Security und Isolation:** Wie werden Secrets, Mandanten-/Sessiongrenzen, Rate-Limits und PDF-Ressourcen instanzübergreifend geschützt?
- **Wirtschaftlichkeit:** Welche Kombination aus Self-managed- und Managed-Diensten senkt Gesamtkosten und Betriebsrisiko?

## 5. Bekannte Multi-Instanz-Lücken

Vor einem glaubwürdigen Scale-out sind mindestens diese Punkte zu entscheiden:

1. Sessionstatus-, Teilnehmer-, Frage- und Vote-Signale verwenden im Backend prozesslokale `EventEmitter`; mehrere App-Prozesse benötigen einen geteilten Ereignispfad oder eine nachgewiesene Routingstrategie.
2. WebSocket- und Yjs-Verbindungen benötigen definierte Affinität, Reconnect- und Failover-Semantik.
3. PDF-Limitierung und mehrere Yjs-/Abuse-Budgets sind pro Prozess ausgelegt und müssen bei mehreren Instanzen global bewertet werden.
4. Datenbank- und Redis-Kapazität dürfen nicht aus Clientzahlen allein geschätzt werden; Query-, Schreib-, Fan-out- und Recovery-Messungen sind erforderlich.
5. Das aktuelle Compose-Deployment beschreibt genau einen App-Container und ist kein Nachweis für horizontale Skalierbarkeit.

## 6. Betrieblicher Transformationspfad

| Schritt                    | Ziel                                                                         | Nachweis vor dem nächsten Schritt                                 |
| -------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0. Ist stabilisieren       | Single Host, Monitoring, Backup/Restore und formale 500er-Zielhostabnahme    | SLO-Review und dokumentierter Freigabevermerk                     |
| 1. Replatform              | App, PostgreSQL und Redis betrieblich trennen; reproduzierbares Provisioning | Restore-, Failure- und Lasttests auf der neuen Topologie          |
| 2. Scale-out vorbereiten   | geteilte Events/Limits, Routing und instanzübergreifende Telemetrie          | Zwei-Instanz-Test einschließlich Failover und Reconnect           |
| 3. Zielprofile testen      | zunächst Stufen, dann `100 × 50` und `1 × 5.000` separat                     | je Profil vollständige SLI/SLO-, Ressourcen- und Recovery-Evidenz |
| 4. Elastizität entscheiden | manuelles oder automatisches Scale-out nach realer Lastkurve                 | Kosten-, Stabilitäts- und Betriebsvergleich                       |

## 7. Schlussfolgerung

`arsnova.eu` ist ein geeigneter Cloud-Computing-Fall, weil der Übergang von einem funktionierenden Single-Host-System zu einem verteilten, messbaren und resilienten Betrieb untersucht wird. Die nächste belastbare Entscheidung ist nicht „welcher Provider trägt 5.000 Clients?“, sondern: **Welche Architekturhypothese wird mit welchem isolierten Zielhost, welchen SLIs und welchen Abbruchkriterien geprüft?**
