<!-- markdownlint-disable MD013 MD060 -->

# Hetzner-Stückliste: Topologie- und Sizing-Hypothesen

**Zweck:** Reproduzierbare Beispieltopologien für Lehre, Testplanung und TCO-Rechnung · **Status:** Architekturhypothese, weder Beschaffungsfreigabe noch Kapazitätsnachweis · **Stand:** 2026-07-28 · **Kosten:** [separates Rechenblatt](./CLOUD-COMPUTING-HETZNER-KOSTENVORSCHLAG.md)

## 1. Leseregel

Die Zahl der Server kann derzeit **nicht** belastbar aus der Zahl der Clients abgeleitet werden. Die vorhandene [Kapazitätsschätzung](../capacity-estimate-16gb-16cores.md) ist konservative Planung für einen anderen Ressourcenmix und bezeichnet ihre Werte selbst als Schätzung. Konfigurierte WebSocket-Caps sind Schutzgrenzen, keine gemessene Kapazität.

Darum beschreibt dieses Dokument:

- **Stufe 0:** implementierter Ist-Pfad;
- **Stufe 1:** Kandidat für eine getrennte Testtopologie;
- **Stufe 2:** Multi-Instanz-Experiment;
- **Stufe 3:** erst nach Messung dimensionierbarer Zielbetrieb.

Die Lehrprofile `100 × 50` und `1 × 5.000` sind ungetestete Szenarien. Keine Tabellenzeile verspricht, dass eine bestimmte SKU sie trägt.

## 2. Preis- und Produktbasis

Die SKU-Beispiele dienen nur der Kostenrechnung für Region Deutschland/Finnland. Die Nettozahlen im Rechenblatt stammen aus der englischen Hetzner-Preisliste nach der Preisanpassung vom 15.06.2026; die deutsche Fassung weist parallel die Bruttopreise inklusive 19 % MwSt. aus. Vor Verwendung sind SKU, Architektur, Verfügbarkeit und Preis erneut zu prüfen.

| Rolle                    | Beispielklasse                           | Warum nur ein Beispiel?                                  |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| kostengünstiger ARM-Host | CAX31, 8 vCPU / 16 GB                    | Architekturkompatibilität und Shared-CPU-Streuung testen |
| x86-App-Host             | CPX32, 8 vCPU / 16 GB                    | einfacher Vergleich zu ARM und bestehendem App-Profil    |
| dedizierter Compute      | CCX23/33/43                              | planbarere CPU, aber wesentlich höhere Kosten            |
| Persistenz               | Volume + Object Storage                  | Performance, Restore und Retention separat nachweisen    |
| Eingang                  | Hetzner Load Balancer oder eigener Proxy | tRPC-/Yjs-Routing und Affinität explizit testen          |

Primärquellen: Hetzner-Preisanpassung 15.06.2026 in der [deutschen Bruttofassung](https://docs.hetzner.com/de/general/infrastructure-and-availability/price-adjustment/) und der [englischen Nettofassung](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/).

## 3. Stufe 0: implementierter Ist-Pfad

| Ressource            | Anzahl | Rolle                                          |
| -------------------- | -----: | ---------------------------------------------- |
| Host 8 vCPU / 16 GB  |      1 | Nginx/TLS und Docker Compose                   |
| App-Container        |      1 | Frontend, HTTP/tRPC, tRPC-WebSocket und Yjs    |
| PostgreSQL-Container |      1 | persistente Anwendungsdaten                    |
| Redis-Container      |      1 | flüchtiger Zustand, Limits und Live-Hilfsdaten |
| PDF-Worker-Container |      1 | isolierte, ressourcenbegrenzte PDF-Erzeugung   |
| Offsite-Backupziel   |      1 | verschlüsselte externe Sicherung               |

**Evidenz:** 500 Produktions-Joins historisch funktional, umfassendere 500er-Baseline lokal; formale produktionsnahe Gesamtfreigabe offen. Siehe [betriebliche Einordnung](./CLOUD-COMPUTING-EINORDNUNG-BETRIEBLICH.md).

## 4. Stufe 1: getrennte Testtopologie

Ziel ist eine erste Replatform-Topologie, nicht mehr Clientkapazität als Behauptung.

| Ressource                | Minimaler Testkandidat                                     | Zu prüfende Eigenschaft                             |
| ------------------------ | ---------------------------------------------------------- | --------------------------------------------------- |
| App-VM                   | 1 × CPX32 oder CAX31                                       | Image-/ARM-Kompatibilität, App- und WS-Ressourcen   |
| PostgreSQL-VM            | 1 × dedizierte oder ausreichend reservierte Compute-Klasse | Querylatenz, Connections, Backup/Restore, Patchpfad |
| Redis-VM                 | 1 × kleine Compute-Klasse                                  | Latenz, Persistenz, Limits, Ausfallverhalten        |
| privates Netz + Firewall | 1                                                          | Segmentierung und minimale Freigaben                |
| DB-Volume                | 1                                                          | IOPS, Snapshot- und Restore-Verhalten               |
| Object Storage           | 1 Bucket                                                   | verschlüsseltes Offsite-Backup und Retention        |
| öffentlicher Eingang     | Nginx oder kleiner LB                                      | TLS, Health und WebSocket-Upgrades                  |

**Pflichtnachweise:** gleiche Funktionssmokes wie Stufe 0, Restore auf isoliertes Ziel, Redis-/DB-Ausfall, Lastbaseline, Monitoring und TCO.

## 5. Stufe 2: Multi-Instanz-Experiment

Stufe 2 ergänzt **genau eine zweite App-Instanz**, um Architekturgrenzen sichtbar zu machen.

| Ressource              | Testkandidat                     | Gate                                                                             |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| App-VMs                | 2 gleich konfigurierte Instanzen | identischer Commit/Image-Digest und reproduzierbares Provisioning                |
| Eingang                | LB oder eigener Proxy            | dokumentierter Algorithmus und WebSocket-/Yjs-Affinität                          |
| geteilter Ereignispfad | zu entwerfen                     | Status-, Teilnehmer-, Frage- und Vote-Signale erreichen Clients beider Instanzen |
| globale Limits         | zu entwerfen                     | PDF-, Yjs- und Abuse-Grenzen gelten unabhängig von Instanzzahl korrekt           |
| Observability          | instanz- und gesamtbezogen       | SLI kann Ursache und betroffene Instanz unterscheiden                            |

**Pflichtszenarien:** HTTP-Verteilung, WebSocket-Fan-out über zwei Instanzen, Reconnect nach Instanzausfall, Host-/Teilnehmertrennung, Yjs-Reconnect, PDF unter Vote-Last und kontrollierter Rollback.

Ohne bestandene Stufe 2 ist jede Stückzahl oberhalb von zwei App-Instanzen Spekulation.

## 6. Stufe 3: Zielprofil dimensionieren

Erst die Messwerte aus Stufe 2 erlauben eine Node-Zahl. Pro Zielprofil werden getrennt bestimmt:

```text
erforderliche App-Instanzen =
  Spitzenlast / gemessene nachhaltige Last pro Instanz
  × Reservefaktor
```

Dabei ist „Last“ kein einzelner Clientzähler. Mindestens zu berücksichtigen sind:

- gleichzeitige WebSocket-Verbindungen und Subscriptions;
- Join-, Vote-, Q&A-, Blitzlicht- und Status-Bursts;
- Fan-out-Latenz und Reconnect-Wellen;
- DB-Queries, Schreibdurchsatz und Connection-Pool;
- Redis-Latenz, Speicher, Persistenz und Failover;
- CPU, RAM, Netzwerk und Event-Loop-Lag;
- N+1-Reserve sowie Wartungs-/Ausfallszenario.

### Profil A: 100 × 50

Zusätzliche Prüfpunkte:

- 100 unabhängige Sessionzustände und Hostverbindungen;
- faire Ressourcennutzung und Noisy-Neighbour-Verhalten;
- gleichzeitige Aktivität in Quiz, Q&A und Blitzlicht;
- Session-Isolation in Metriken, Limits und Fehlerfällen.

### Profil B: 1 × 5.000

Zusätzliche Prüfpunkte:

- ein gemeinsamer Hotspot und Fan-out an 5.000 Verbindungen;
- Hostaktionen, Vote-Burst und Reconnect als synchronisierte Welle;
- Backpressure, Admission Control und Degradationsmodus;
- kein Sticky-Routing aller Clients auf eine einzige App-Instanz als Scheinlösung.

## 7. Nicht automatisch gelöst

- Kubernetes skaliert Pods, repariert aber weder prozesslokale Events noch Datenbankhotspots.
- Zwei Redis-Server sind ohne definiertes Replikations-/Cluster-/Failover-Modell keine Hochverfügbarkeit.
- Ein größeres PostgreSQL-System ersetzt keine Query- und Connection-Messung.
- Ein Load Balancer erzeugt keine korrekte globale PDF-/Yjs-/Abuse-Limitierung.
- Object Storage ist kein Backupkonzept ohne Verschlüsselung, Retention und Restore-Test.

## 8. Beschaffungs- und Stop-Regeln

Vor realer Bestellung sind erforderlich:

1. Ziel und Laufzeit der Umgebung;
2. Architekturdiagramm und Datenfluss;
3. Preisprüfung mit Steuerbasis und Region;
4. Datenschutz-/AVV- und Zugriffsfreigabe;
5. Budgetlimit, Owner und Löschdatum;
6. Testplan, Abbruchkriterien und Cleanup;
7. Entscheidung, welche Erkenntnis die Umgebung liefern soll.

Eine weitere Ausbaustufe wird nicht beschafft, wenn die vorherige Stufe die Architektur- oder SLO-Gates verfehlt. Zuerst wird die Ursache bewertet.

## 9. Bezug

- [Kostenrechenblatt](./CLOUD-COMPUTING-HETZNER-KOSTENVORSCHLAG.md)
- [Providervergleich](./CLOUD-PROVIDER-VERGLEICH-ARSNOVA-EU.md)
- [6R-Einordnung](./CLOUD-COMPUTING-6R-EINORDNUNG.md)
- [OpenStack/Kubernetes](./CLOUD-COMPUTING-OPENSTACK-UND-ALTERNATIVEN.md)
- [formale §6.5-Abnahme](./S6.5-SECURITY-LOAD-ACCEPTANCE.md)
