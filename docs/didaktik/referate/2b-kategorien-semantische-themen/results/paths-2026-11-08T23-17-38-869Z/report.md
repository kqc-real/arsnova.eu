# Referat 2B – Laufzeitpfade Kategorie (8.9b) und Encoder-Thema (1.14c)

Commit `74091b0a6468` (v1.3.0-364-g74091b0a-dirty), Referenzset 2.2.0 (SHA-256 `717bdb17dc2e94d5…`), 2026-11-08T23:17:38.869Z
Intel(R) Core(TM) i7-7700K CPU @ 4.20GHz × 8, Node v24.22.2. Testadapter: In-Memory-Writer statt Prisma (A1–A5); verzögerter Processor (A4); CPU-blockierender Processor (A5); TCP-Server ohne Antwort (B3); docker stop/start (B2).

## A. 8.9b – Klassifikation nach `qa.submit`

Sitzung: 201 deutsche Statistik-Fragen (inkl. mehrdeutiger und Rausch-Items); A1/A2 je Einreichung ein eigener Makrotask wie getrennte Requests, A3 alle im selben Event-Loop-Tick. Releasewerte: Timeout 2000 ms, Queue-Limit 100, Parallelität 1.

| Variante                              |   n | enqueue-Ergebnis       | Dauer je enqueue-Aufruf p50 / max | gespeicherte Status                   | Zeit bis Ergebnis p50 / p95 / max | Event-Loop-Lücke p99 / max |
| ------------------------------------- | --: | ---------------------- | --------------------------------- | ------------------------------------- | --------------------------------- | -------------------------- |
| A1 normal, Einreichungen nacheinander | 201 | queued 201             | 0.819 / 2.083 ms                  | classified 163, uncertain 38          | 1.5 / 2.4 / 6 ms                  | 14.7 / 15.8 ms             |
| A2 Kill-Switch aus                    |  20 | disabled 20            | 0.409 / 0.588 ms                  | –                                     | –                                 | 16 / 16 ms                 |
| A3 150 Fragen im selben Tick          | 150 | queued 100, skipped 50 | 0.799 / 1.019 ms                  | classified 95, failed 50, uncertain 5 | 115.4 / 143 / 146.1 ms            | 15 / 106.4 ms              |
| A4 Processor 3 s verzögert (async)    |   3 | queued 3               | 0.793 / 0.856 ms                  | failed 3                              | 4024.1 / 6031.6 / 6031.6 ms       | 16.1 / 16.3 ms             |
| A5 Processor 2,5 s CPU-blockierend    |   1 | queued 1               | 0.854 / 0.854 ms                  | classified 1                          | 2501.5 / 2501.5 / 2501.5 ms       | 2502.1 / 2502.1 ms         |

Reine Klassifikationszeit je Frage (synchron, Haupt-Thread): p50 0.11599999999999999 ms, p95 3.955 ms, max 8.673 ms.
Netzaufrufe während A1 (http/https/fetch/Socket): 0/0/0/0 – kein Encoder-, Sidecar- oder llama-Aufruf.

**Sichtbarkeit im Moderationskompass (A1-Ergebnis):**

- Status gesamt: 163 classified, 38 uncertain → Kompass-Analysemodus `classified`.
- In die Kategorie-Quellen des Kompasses gehen nur `classified`-Fragen ein; die 38 unsicheren erscheinen dort nicht.
- Von den classified-Fragen tragen 34 eine falsche Kategorie, 12 waren mehrdeutige oder Rausch-Items.
- Modus-Szenarien (Releasefunktion `resolveModerationCompassAnalysisMode`): alle uncertain → `uncertain`; eine classified, Rest uncertain → `classified`; eine failed → `failed`; eine pending → `pending`.

## B. 1.14c – Encoder-Thema nach Host-`wordCloud.analyze`

Snapshot: 80 deutsche Fragen. Releasewerte: Encoder-Timeout 8000 ms, Circuit-Breaker nach 3 Fehlern für 30 s.

| Variante                   |     Dauer | Status | Fallback | Modellversion                                          | Einträge |
| -------------------------- | --------: | ------ | :------: | ------------------------------------------------------ | -------: |
| B1 Encoder läuft           | 1197.2 ms | ready  |    –     | intfloat/multilingual-e5-small@sha256:f80102d3f2a1229f |       12 |
| B2 Encoder gestoppt        |    9.5 ms | failed |    ✓     | –                                                      |       29 |
| B3 Encoder antwortet nicht | 8016.6 ms | failed |    ✓     | –                                                      |       29 |

Circuit-Breaker (Encoder antwortet nicht, fünf Analysen hintereinander): #1 8006.2 ms failed · #2 8018.1 ms failed · #3 8007.2 ms failed · #4 2.6 ms failed · #5 2.7 ms failed. Neustart des Encoders bis gesund: 1657.8 ms.

## C. Kategorie und Thema derselben Sitzung

Aus B1: 12 Themen mit ≥ 2 Fragen; 6 davon enthalten Fragen mit unterschiedlicher 8.9b-Kategorie.

| Thema (Label)                                                                          | Konfidenz | Fragen | Gold-Familien        | 8.9b-Kategorien der Mitglieder               |
| -------------------------------------------------------------------------------------- | --------: | -----: | -------------------- | -------------------------------------------- |
| Findet nächsten Donnerstag überhaupt Vorlesung statt?                                  |     0.900 |      8 | O-CANC, O-ATT, O-REC | uncertain(organization) 2, organization 6    |
| Noch ein Regressionsbeispiel?                                                          |     0.905 |      5 | C-REG                | content 5                                    |
| Ist die Frist für Übungsblatt 2 diesen Freitag?                                        |     0.902 |      5 | O-DEAD               | organization 5                               |
| Ich hab den Satz von Bayes noch nicht verstanden, gibt es ein Beispiel aus dem Alltag? |     0.924 |      4 | C-BAYES              | content 3, uncertain(content) 1              |
| Können Sie nochmal erklären, was der p-Wert eigentlich aussagt?                        |     0.922 |      4 | C-PVAL               | content 3, technical 1                       |
| Ich komme mit dem Sitzungscode nicht in die Umfrage rein.                              |     0.900 |      4 | T-VOTE               | technical 4                                  |
| Woher kommt auf Folie 17 plötzlich das Quadrat?                                        |     0.903 |      3 | C-DERIV              | content 3                                    |
| Wo findet die Nachklausur statt, wieder im Audimax?                                    |     0.899 |      3 | O-ROOM               | organization 3                               |
| Wie erkenne ich Overfitting in der Praxis?                                             |     0.895 |      3 | C-OVF                | technical 1, content 2                       |
| Die Projektion ist so blass, dass man die Formeln nicht lesen kann.                    |     0.892 |      3 | T-BEAM               | technical 2, content 1                       |
| Das Mikrofon rauscht und man versteht nichts.                                          |     0.889 |      3 | T-AUDIO              | uncertain(content) 1, content 1, technical 1 |
| Gibt es eine Anwesenheitsliste in der Vorlesung?                                       |     0.940 |      2 | O-ATT                | organization 2                               |

## Gültigkeitsgrenzen

- In-Process gemessen, ohne HTTP, Datenbank und echte Parallelnutzer; Latenzen sind Untergrenzen.
- Der In-Memory-Writer ersetzt das Prisma-Update; Persistenzzeit und DB-Fehler sind nicht gemessen.
- B3 simuliert einen hängenden Encoder per TCP-Server ohne Antwort, nicht einen überlasteten Container.
