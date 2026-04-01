# Kapazitätsschätzung: 16 Kerne, 16 GB RAM (konservativ)

**Stand:** 2026-04-01 — Codebase mit **tRPC-WebSocket-Subscriptions** für Session/Q&A/Vote/Health (Implementierung: **Polling** gegen PostgreSQL in den Subscriptions, kein Redis-Pub/Sub für jedes Live-Event). Zusätzlich: **MOTD**-Lesepfade (HTTP/tRPC), **Yjs**-Relay (Quiz-Sync), **Blitzlicht** in Redis.  
**Ziel:** Konservative Obergrenzen für **gleichzeitige Quizze** (verschiedene Dozenten) und **current participants** (wie in `health.stats`: Teilnehmer in nicht beendeten Sessions).

---

## 1. Laufende Prozesse auf dem Server

| Komponente         | Beschreibung                                 | Typisch RAM (konservativ)       | CPU                 |
| ------------------ | -------------------------------------------- | ------------------------------- | ------------------- |
| **Node (Backend)** | Express, tRPC, WS (3001), Yjs-Spawn          | 2–3 GB (V8 Heap + Verbindungen) | 1 Kern (Event-Loop) |
| **PostgreSQL**     | Prisma, Sessions, Participants, Votes        | 3–4 GB (shared_buffers etc.)    | Mehrkern            |
| **Redis**          | Rate-Limit, Blitzlicht-Keys, Sliding-Windows | 1–1,5 GB                        | 1 Kern              |
| **Yjs (Child)**    | y-websocket Relay (3002)                     | ~256 MB                         | wenig               |
| **OS + Puffer**    | Linux, Cache                                 | ~1,5–2 GB                       | —                   |
| **Summe**          |                                              | **~10–11 GB**                   | 16 Kerne            |

**Hinweis:** Kein Node-Cluster im aktuellen Stand – ein Prozess bedient HTTP, tRPC und WebSocket.

---

## 2. Engpässe (konservativ)

- **Node:** Single-Thread-Event-Loop; viele gleichzeitige WebSocket-Verbindungen und **mehrere tRPC-Subscriptions** pro Verbindung (Session, Q&A, …) erhöhen Speicher- und CPU-Last. Pro Verbindung grob **~1–2 MB** (Puffer, Subscription-State) gerechnet.
- **PostgreSQL:** Verbindungslimit (z. B. `max_connections` 100); Prisma nutzt einen Pool (Default je nach Version ~10–20 Verbindungen). Speicher für Sessions/Participants/Votes ist bei 10k–50k Zeilen unkritisch.
- **Redis:** Rate-Limit-Keys, Session-Code-/Quick-Feedback-Zustand; Speicher moderat. Session-Live-Updates laufen **nicht** zentral über Redis-Publish, sondern über **viele parallele Subscription-Loops** (DB-Polling) — das skaliert mit **gleichzeitigen WS-Clients** und **Datenbanklast**, nicht nur mit Redis-Speicher.
- **Teilnehmer = verbundene Clients:** Pro geöffnetem Frontend mit Live-Session: typisch **eine** WebSocket-Verbindung (Port 3001) mit mehreren tRPC-Subscriptions. Engpass bleibt **Node (ein Event-Loop)** + **PostgreSQL** (viele gleichzeitige Polls), nicht nur RAM.

---

## 3. Definitionen (wie im System)

- **Aktive Quizze / gleichzeitige Quizze:** Anzahl Sessions mit `status ≠ FINISHED` (eine Session = ein Dozent / ein Quiz-Live-Raum).
- **Current participants:** Summe aller `Participant`-Einträge in Sessions mit `status ≠ FINISHED` – entspricht `health.stats.totalParticipants`. Wenn alle Teilnehmer verbunden sind, entspricht das der Anzahl WebSocket-Client-Verbindungen von Studenten (+ Dozenten).

---

## 4. Konservative Obergrenzen (16 Kerne, 16 GB RAM)

### 4.1 Max. Anzahl gleichzeitige Quizze (verschiedene Dozenten)

- Begrenzend ist nicht die DB (Speicher für Sessions), sondern **Verbindungen und Node-Ressourcen**: Pro Quiz typisch **1 Dozent (1 WS)** + **N Studenten (N WS)**.
- Grobe Rechnung: Nutzbar für Verbindungen ~~**2–2,5 GB** Node-Heap für Client-State; bei \*\*~~2 MB pro verbundenem Client** → **~1.000–1.200\*\* gleichzeitige Verbindungen vertretbar.
- Mit **Ø 30 Teilnehmer pro Quiz** (1 Dozent + 29 Studenten) → **1.200 / 30 ≈ 40** Quizze.
- **Konservativ** (Reserve für Peaks, Yjs, Health, andere Requests):
  - **Max. gleichzeitige Quizze: 20–25** (bei durchschnittlich 30–40 Teilnehmern pro Quiz).

Wenn die durchschnittliche Teilnehmerzahl **höher** ist (z. B. 80 pro Quiz), sinkt die Quiz-Anzahl: 1.200 / 81 ≈ **~15** Quizze.

### 4.2 Max. current participants (total in aktiven Sessions)

- **Aus Sicht der Anzeige (health.stats):** `totalParticipants` ist eine reine DB-Zählung – theoretisch können sehr viele Einträge in `Participant` stehen (PostgreSQL handhabt 100k+ Zeilen problemlos).
- **Praktische Obergrenze:** Sobald alle Teilnehmer mit dem Frontend verbunden sind, limitiert die **Anzahl der WebSocket-Clients** (Node + ein Kern).
- Mit der gleichen Annahme **~1.000–1.200** vertretbare gleichzeitige Verbindungen (Dozenten + Studenten):
  - **Max. current participants (alle verbunden): ~1.000–1.200** (konservativ **~1.000**).

Wenn nicht alle Teilnehmer gleichzeitig verbunden sind (z. B. nur 70 % im Raum), kann die **im System geführte** Teilnehmerzahl höher sein (z. B. **~1.400** in der DB), während die Verbindungsgrenze bei **~1.000** bleibt.

---

## 5. Kurzfassung (konservativ)

| Kennzahl                      | Konservativer Wert (16 Kerne, 16 GB RAM) |
| ----------------------------- | ---------------------------------------- |
| **Max. gleichzeitige Quizze** | **20–25** (bei Ø 30–40 Teilnehmer/Quiz)  |
| **Max. current participants** | **~1.000** (wenn alle verbunden)         |

- **Gültigkeit:** Aktueller Architekturstand (ein Node-Prozess, ein WebSocket-Server, Redis, PostgreSQL, Yjs-Relay). Session-Subscriptions sind **umgesetzt** (Polling in den Generatoren); sie belasten **PostgreSQL** mit parallel laufenden Abfragen — die Tabelle bleibt eine **konservative** Größenordnung.
- **Optimierung später:** Push-basierte Events (z. B. Redis Pub/Sub, `LISTEN`/`NOTIFY`) statt reinem Polling könnten DB-Last und Latenz verbessern; bis dahin gelten die Werte eher als **vorsichtige** Planungsgröße.

---

## 6. Optionen zur Erhöhung der Kapazität

- **Node:** Cluster-Modus (z. B. ein Prozess pro Kern) oder mehrere Backend-Instanzen hinter Load-Balancer; WebSocket-Sticky-Sessions.
- **PostgreSQL:** `max_connections` und Prisma-Pool anpassen; Connection-Pooler (z. B. PgBouncer).
- **Redis:** Speicher und Verbindungslimits prüfen; bei künftigem Pub/Sub für Live-Events zusätzlich Durchsatz messen.
- **Monitoring:** `health.stats.serverStatus` (healthy < 50, busy < 200, overloaded ≥ 200 aktive Sessions) nutzen und bei „busy“/„overloaded“ Last reduzieren oder skalieren.
