# Lastvergleich auf dem Zielhost am 20. November 2026

**Betriebsentscheidung.** Zwei Apps mit je 30 PostgreSQL-Verbindungen sind
der reguläre Aufbau. Die dritte App bleibt über `prod-replicas.sh
enable-third` mit dann je 20 Verbindungen zuschaltbar. Im direkten Vergleich
verbesserte sie die 30 × 30-Vote-Wellen und erhöhte den CPU-Bedarf. Der
500er-Join blieb in beiden Aufbauten über 1 s p95. Zwei Apps hielten die
500er-Votes in allen drei Vergleichsläufen unter 1 s p95, drei Apps in zwei
Läufen. Bei regelmäßig überlappenden Abstimmungen vieler Klassen kann der
Drei-App-Modus separat abgenommen werden.
[Produktions-Runbook](PRODUCTION-REPLICAS.md).

## Messbedingungen

Die Messreihen liefen im isolierten Staging auf dem Hetzner-Zielhost mit
8 vCPUs und 15,2 GiB RAM. Staging und Lastgenerator teilten CPUs 0–5. Das
Staging verwendete eigene Testdaten in PostgreSQL 16, Redis 7.4 mit AOF
und Pub/Sub, Nginx, einen dedizierten Yjs-Relay sowie PDF- und spaCy-Dienste.
Das Produktionsrouting blieb auf zwei gesunden Apps. Ausgangsimage war
der Produktionsstand `b5146b596ff29ddfe9ec4287c8acd5ea765c3a70`.

Pro Aufbau und Profil gab es einen Warmlauf und drei gewertete Läufe. Jede
500er-Welle startete alle Joins gleichzeitig. Teilnehmende öffneten ihre
WebSockets nach ihrer jeweiligen Join-Antwort. Das 30 × 30-Profil führte
bis zu 96 Joins gleichzeitig aus und hielt 960 WebSockets offen.
Die Vote-Wellen starteten entweder gemeinsam oder um 25 ms je Klasse
versetzt. Die Tabellen zeigen den Median der drei Lauf-p95. Die Host-Zeit
reicht vom Wellenstart der Klasse bis zum vollständigen Stimmenstand am
Host-WebSocket.

Die erste Vergleichsreihe lief mit RSA-TLS. Die ECDSA-Messreihen nutzten
ein eigenes P-256-Zertifikat wie am Live-Endpunkt und reproduzierten die
Lastprofile ohne Profiling-Instrumentierung. Der Kurzvergleich umfasst
weder die 30-minütige Dauerlast noch einen parallelen PDF-Export oder einen
App-Ausfall. Diese Szenarien bleiben Teil der Betriebsabnahme.

## Ausgangsmessung mit einer und zwei Apps

In der RSA-Reihe blieb der DB-Gesamtpool bei 60 Verbindungen. Beide
Topologien lieferten je 4.200 Joins und 13.800 Votes fehlerfrei.

| Lastprofil und Messgröße         | 1 App · 1 × 60 | 2 Apps · 2 × 30 |
| -------------------------------- | -------------: | --------------: |
| 1 × 500 · Join-p95               |       2.163 ms |        1.832 ms |
| 1 × 500 · Vote-p95               |       3.747 ms |        2.184 ms |
| 1 × 500 · Host-p95               |       4.050 ms |        2.418 ms |
| 30 × 30 · Join-p95               |         848 ms |          608 ms |
| 30 × 30 · Vote-p95, gleichzeitig |       6.642 ms |        3.941 ms |
| 30 × 30 · Host-p95, gleichzeitig |       7.040 ms |        4.077 ms |
| 30 × 30 · Vote-p95, versetzt     |       5.691 ms |        2.925 ms |
| 30 × 30 · Host-p95, versetzt     |       6.110 ms |        3.058 ms |

## Wirkung der Join- und Vote-Optimierungen

Der ECDSA-Vergleich stellt zwei Apps mit je 30 DB-Verbindungen vor und
nach dem Fix gegenüber. Der Kandidat nutzt eine größere Join-Schreibgruppe,
gebündelte Teilnahme-Lesezugriffe und Choice-Vote-Schreibvorgänge sowie
HTTP-Keepalive zu den Apps im isolierten Nginx. Der Proxy hält inaktive
Upstream-Verbindungen 20 Sekunden, Node 25 Sekunden. Das Profil misst
die Kombination dieser Änderungen.

| Profil und Pfad              | Baseline p95 |  Fix-p95 | Fix unter 1 s |
| ---------------------------- | -----------: | -------: | ------------: |
| 1 × 500 · Join               |     1.715 ms | 1.696 ms |           0/3 |
| 1 × 500 · Vote               |     2.121 ms |   949 ms |           2/3 |
| 30 × 30 · Join               |       592 ms |   636 ms |           3/3 |
| 30 × 30 · Vote, gleichzeitig |     3.939 ms | 1.922 ms |           0/3 |
| 30 × 30 · Vote, versetzt     |     2.872 ms |   885 ms |           3/3 |

Im separaten Profiling des Fixes nutzten alle 500 Join-Requests
bereits offene HTTP-Upstreams zu den beiden Apps. Vor dem Node-Handler
lagen 106 ms p95. Im Handler lagen 1.071 ms p95, der Abschnitt bis zur
Bestätigung aus der Join-Schreibgruppe lag bei 1.005 ms p95 und enthält
Batch-Wartezeit und DB-Transaktion. Die Abschnitte sind separat berechnet.

Bei 900 gleichzeitigen Votes lagen vom Fetch-Start im Lastgenerator bis
zum Nginx-Eingang 1.280 ms p95. Der Abschnitt enthält Client-Pool,
Scheduling und TLS. Im Node-Handler lagen 765 ms p95. Der größte
gemessene Teilschritt war die Vote-Schreibgruppe mit 516 ms p95.

## Zwei oder drei Apps mit dem Fix

In einer weiteren gepaarten ECDSA-Messung verwendeten beide Aufbauten
denselben getesteten Kandidaten. Für die dritte App sank der DB-Pool je
App von 30 auf 20. Nginx verteilte HTTP und WebSockets über alle aktiven
Replikate. Je Aufbau bestätigte PostgreSQL inklusive Warmläufen 5.600
Teilnahmen und je 15.200 Votes, Antwortzuordnungen und Outbox-Ereignisse.
In den gewerteten Läufen gab es je Aufbau 4.200 Joins und 13.800 Votes
ohne Fehler.

| Lastprofil und Messgröße                        | 2 Apps · 2 × 30 | 3 Apps · 3 × 20 |
| ----------------------------------------------- | --------------: | --------------: |
| 1 × 500 · Join-p95                              |        1.677 ms |        1.710 ms |
| 1 × 500 · Vote-p95                              |          904 ms |          980 ms |
| 1 × 500 · Host-p95                              |          922 ms |        1.000 ms |
| 30 × 30 · Join-p95                              |          521 ms |          641 ms |
| 30 × 30 · Vote-p95, gleichzeitig                |        1.975 ms |        1.561 ms |
| 30 × 30 · Host-p95, gleichzeitig                |        2.065 ms |        1.724 ms |
| 30 × 30 · Vote-p95, versetzt                    |          891 ms |          788 ms |
| 30 × 30 · Host-p95, versetzt                    |        1.056 ms |          880 ms |
| 30 × 30 · mittlere CPU bei gleichzeitigen Votes |      3,12 vCPUs |      3,85 vCPUs |
| 30 × 30 · CPU-Spitze                            |      4,95 vCPUs |      5,31 vCPUs |
| 30 × 30 · RAM-Spitze                            |        1,68 GiB |        2,01 GiB |

CPU und RAM beziehen sich auf die Staging-Dienste ohne Lastgenerator.
Die CPU-Spitzen stammen aus 500-ms-Stichproben. Die dritte App senkte den
Vote-p95 der gleichzeitigen 30 × 30-Wellen um 21 % bei 23 % mehr mittlerer
CPU während der Welle. Für den 500er-Join und die gleichzeitigen 30 ×
30-Votes bleibt das Ziel unter 1 s p95 in beiden Topologien offen.

## Nachmessung des PR-Stands mit zwei Apps

Für die Nachmessung kamen der aktualisierte Join-Onboarding-Abgleich,
die sortierte Schreibreihenfolge im Vote-Batch und der korrigierte
HTTP-Kompressionsfilter zum Einsatz. Der Aufbau nutzte das versionierte
Staging-Nginx mit ECDSA und zwei Apps mit je 30 DB-Verbindungen.

| Lastprofil und Messgröße     | Median der Lauf-p95 | Läufe unter 1 s |
| ---------------------------- | ------------------: | --------------: |
| 1 × 500 · Join               |            1.548 ms |             0/3 |
| 1 × 500 · Vote               |              942 ms |             3/3 |
| 1 × 500 · Host               |              973 ms |             2/3 |
| 30 × 30 · Join               |              645 ms |             3/3 |
| 30 × 30 · Vote, gleichzeitig |            1.923 ms |             0/3 |
| 30 × 30 · Host, gleichzeitig |            1.986 ms |             0/3 |
| 30 × 30 · Vote, versetzt     |              964 ms |             2/3 |
| 30 × 30 · Host, versetzt     |            1.128 ms |             0/3 |

Die 500er-Join-p95 der drei Läufe lagen bei 1.548, 1.548 und 1.562 ms.
Für die 500er-Votes waren es 967, 942 und 836 ms. Die Staging-Dienste
erreichten in den gewerteten Profilen CPU-Spitzen von 4,12 bzw. 4,72 vCPUs
und RAM-Spitzen von 1,64 bzw. 1,71 GiB. Der WebSocket-Reconnect lag bei
536 ms p95 für 500 Teilnehmende und bei 340 ms p95 für die 300
geprüften Teilnehmenden des 30 × 30-Profils.

Alle 4.200 Joins und 13.800 Votes der gewerteten Läufe waren erfolgreich.
PostgreSQL bestätigte inklusive Warmläufen 5.600 Teilnahmen sowie je
15.200 Votes, Antwortzuordnungen und Outbox-Ereignisse. Alle 38
Readiness-Proben der Produktion waren erfolgreich.
