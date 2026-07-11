<!-- markdownlint-disable MD013 -->

# Messprotokoll — Last-Pilot (Vorlage)

**Studierende/r:** …  
**Datum:** …  
**Commit/Branch:** `git rev-parse --short HEAD` → …  
**Umgebung:** lokal · macOS / Linux / WSL · Node … · Docker ja/nein

---

## 1. Ziel des Laufs

In 2–3 Sätzen: Was sollte geprüft werden? (z. B. „Sanity unter parallelen Reads auf `health.stats`“)

---

## 2. Durchgeführte Stufen

| Stufe        | Skript / Befehl                          | Parameter                  | Dauer ca. |
| ------------ | ---------------------------------------- | -------------------------- | --------- |
| 1            | `npm run load:simulate:50`               | `DURATION_MS=…` (optional) | …         |
| 2            | `npm run load:smoke:host-vote-progress`  | `PARTICIPANTS=…`           | …         |
| 3            | `npm run load:k6:health`                 | Wrapper/Docker             | ~30 s     |
| 4 (optional) | `SESSION_CODE=… npm run load:k6:session` | …                          | …         |

Für einen erweiterten Lauf können zusätzliche Zeilen für Artillery,
Timer-Fairness, Yjs, Soak, Browser-Smokes und Lighthouse ergänzt werden.

---

## 3. Ergebnisse (Kernmetriken)

### Stufe 1 — Node Sanity

| Metrik          | Wert |
| --------------- | ---- |
| Requests        | …    |
| Fehler          | …    |
| p50 Latenz (ms) | …    |
| p95 Latenz (ms) | …    |

### Stufe 2 — Host-Vote-Smoke

| Metrik              | Wert  |
| ------------------- | ----- |
| Teilnehmende        | …     |
| Votes erfolgreich   | … / … |
| Subscription-Fehler | …     |
| Vote p95 (ms)       | …     |

### Stufe 3 — k6 Health

| Metrik                  | Wert                        |
| ----------------------- | --------------------------- |
| `http_req_failed`       | … %                         |
| `http_req_duration` p95 | … ms                        |
| k6-Thresholds           | bestanden / nicht bestanden |

### Erweiterte Szenarien (optional)

| Szenario                 | Ziel/Last | zentrale Metrik oder Gate        | Ergebnis |
| ------------------------ | --------- | -------------------------------- | -------- |
| Artillery Live/Reconnect | … TN      | Join-/Reconnect-Quote, WS-Fehler | …        |
| Timer-Fairness           | … TN      | Vote-p95, fachliche Karenz       | …        |
| Yjs                      | … Clients | Sync-/Reconnect-Zeit, Konvergenz | …        |
| Soak                     | … Minuten | HTTP-p95, Fehler, RSS-Wachstum   | …        |
| Browser-Flows            | …         | erwarteter UI-Endzustand         | …        |
| Lighthouse               | … URL     | Performance, LCP, CLS, TBT, A11y | …        |

Als ausgefülltes Beispiel für diese erweiterte Form dient der
[lokale Gesamt-Testlauf vom 2026-07-10](../implementation/LOCAL-TESTRUN-2026-07-10.md).

---

## 4. Bewertung (Ampel)

Pro Stufe kurz einordnen:

| Stufe | Ampel        | Kurzbegründung |
| ----- | ------------ | -------------- |
| 1     | 🟢 / 🟡 / 🔴 | …              |
| 2     | 🟢 / 🟡 / 🔴 | …              |
| 3     | 🟢 / 🟡 / 🔴 | …              |

**Orientierung (lokal, Pilot — keine Prod-Freigabe):**

- 🟢 **Grün:** 0 relevante Fehler, Latenz im erwartbaren Bereich, Smoke/k6-Checks bestanden.
- 🟡 **Gelb:** Lauf erfolgreich, aber hohe Latenz, knapp verfeilte Thresholds oder auffällige Streuung — weiter beobachten.
- 🔴 **Rot:** Fehler, abgebrochene Smokes, k6-Thresholds klar verfehlt — Ursache notieren (Setup? Skript? Backend?).

---

## 5. Interpretation (5–8 Sätze)

- Was sagt der Lauf über die **lokale** Belastbarkeit aus?
- Was ist **kein** Beweis für Produktions-Skalierung?
- Eine **offene Lücke** aus Story 0.7 oder ADR-0013, die du gesehen hast:

---

## 6. Limitationen

- [ ] Nur lokale Umgebung (kein Hetzner/Prod)
- [ ] Kleine Laststufen (Pilot, nicht 500er-Volltest)
- [ ] Keine Browser-E2E-Last
- [ ] Sonstiges: …

---

## 7. Nächster sinnvoller Schritt (optional)

Ein Vorschlag für Follow-up (z. B. Join-Welle mit `load:k6:hotpaths`, Messprotokoll-Vergleich, CI-Smoke-Konzept).

---

_Vorlage für SQM-Praktikum · siehe [Arbeitsanweisung 05](./Arbeitsanweisungen%20SQM/05-last-pilot-durchfuehren.md)_
