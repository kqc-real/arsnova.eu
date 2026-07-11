# Arbeitsanweisung 05 - SQM (Last-Pilot)

## Auftrag

Führe bis zur nächsten Sitzung einen **reproduzierbaren Last-Piloten** gegen deine lokale Entwicklungsumgebung durch und dokumentiere das Ergebnis in **einem Messprotokoll** (ca. 1 Seite).

Du musst **keine** neue Lasttest-Infrastruktur bauen und **keine** Produktionsumgebung belasten. Ziel ist: verstehen, **wie** wir Last prüfen, und **was** die Messwerte bedeuten.

## Voraussetzungen

- Projekt läuft lokal ([Arbeitsanweisung 01](./01-repo-lokal-starten.md) abgeschlossen).
- Docker läuft (für k6 per Container, falls kein lokales `k6` installiert ist).
- Kurz gelesen: [`HANDOUT-LAST-UND-PERFORMANCE-TESTS.md`](../HANDOUT-LAST-UND-PERFORMANCE-TESTS.md).

## Stufenplan (ca. 2–3 Stunden)

Führe die Stufen **der Reihe nach** aus. Notiere nach jeder Stufe die wichtigsten Zahlen.

### Stufe 1 — Sanity (Node, read-only)

```bash
npm run dev:backend
npm run load:simulate:50
```

**Frage:** Wie viele Requests, Fehlerrate, p95-Latenz?

### Stufe 2 — Host-Vote-Smoke (Realtime + Votes)

```bash
# Backend muss weiterlaufen
PARTICIPANTS=30 npm run load:smoke:host-vote-progress
```

**Frage:** Wurden alle Votes gezählt? Gab es Subscription-Fehler?

### Stufe 3 — k6-Health (protokollnaher Standard)

```bash
npm run load:k6:health
```

**Hinweis:** Der Befehl nutzt lokales `k6` oder automatisch Docker. Dauer ca. 30 Sekunden.

**Frage:** Sind die k6-Thresholds erfüllt (`http_req_failed`, `p(95)`)?

### Optional — Stufe 4 (nur bei Zeit und Absprache)

```bash
# Session im UI anlegen, Code notieren (6 Zeichen)
SESSION_CODE=XXXXXX npm run load:k6:session
```

## Dokumentation

Trage deine Ergebnisse in [`VORLAGE-MESSPROTOKOLL-LAST.md`](../VORLAGE-MESSPROTOKOLL-LAST.md) ein (Kopie als Markdown oder PDF nach Absprache).

Mindestens **eine** Stufe muss vollständig dokumentiert sein; **empfohlen:** Stufen 1–3.

## Ergebnis für die nächste Sitzung

- Messprotokoll liegt vor (Datum, Skripte, Parameter, Metriken, kurze Interpretation).
- Du kannst erklären, **welches Tool** wofür zuständig ist (k6 vs. Node-Smokes vs. Lighthouse).
- Du kannst **eine** Auffälligkeit oder **eine** offene Lücke aus Story 0.7
  benennen, z. B. den noch ausstehenden 30-/60-Minuten-Staging-Langlauf oder die
  fehlende freigegebene Produktionsbaseline.
- Du hast **keine** Last gegen Produktion gefahren.

## Relevante Unterlagen

- [HANDOUT-LAST-UND-PERFORMANCE-TESTS.md](../HANDOUT-LAST-UND-PERFORMANCE-TESTS.md)
- [VORLAGE-MESSPROTOKOLL-LAST.md](../VORLAGE-MESSPROTOKOLL-LAST.md)
- [TESTING.md](../../TESTING.md)
- [LASTTEST-500-ERGEBNIS-2026-05-09.md](../../implementation/LASTTEST-500-ERGEBNIS-2026-05-09.md) (Beispiel für ausführlichere Berichte)
- [LOCAL-TESTRUN-2026-07-10.md](../../implementation/LOCAL-TESTRUN-2026-07-10.md)
  (historischer lokaler Gesamt-Testlauf mit bestandenen und fehlgeschlagenen Gates)
- [LOCAL-QA-RECHECK-2026-07-11.md](../../implementation/LOCAL-QA-RECHECK-2026-07-11.md)
  (grüner Nachlauf der damals fehlgeschlagenen Gates)
