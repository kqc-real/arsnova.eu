# Aufgabenblatt: Story 0.4a "Session-Tagesrekord-Verlauf im Server-Status-Hilfedialog"

**Zielgruppe:** Studierende im Informatikpraktikum (Software Engineering)  
**Kontext:** Vertikaler Durchstich mit KI-Agent von Story ueber ADR bis zum Draft-PR

## Auftrag

Bearbeite die Story **0.4a - Session-Tagesrekord-Verlauf im Server-Status-Hilfedialog** als vollstaendiges, reviewfaehiges Inkrement.

Du sollst dabei nicht nur Code erzeugen, sondern den kompletten Arbeitsfluss sichtbar machen:

- Story lesen und scharfstellen
- ADRs als Architekturleitplanken verwenden
- auf einem Feature-Branch arbeiten
- validieren
- einen nachvollziehbaren Pull Request vorbereiten

## Verbindlicher Rahmen

- Massgeblich sind **alle Akzeptanzkriterien** der Story in [Backlog.md](../../Backlog.md).
- Zusaetzlich gilt die allgemeine **Definition of Done** aus [Backlog.md](../../Backlog.md).
- Fuer dieses Feature sind mindestens diese Artefakte verpflichtend:
  - [HANDOUT-TAGESREKORD-KI-AGENT.md](./HANDOUT-TAGESREKORD-KI-AGENT.md)
  - [ADR-0003](../architecture/decisions/0003-use-trpc-for-api.md)
  - [ADR-0008](../architecture/decisions/0008-i18n-internationalization.md)
  - [ADR-0021](../architecture/decisions/0021-separate-service-status-from-load-status-with-live-slo-telemetry.md)
  - [ADR-0024](../architecture/decisions/0024-daily-session-records-in-server-status-help-dialog.md)
  - [server-status-widget.md](../features/server-status-widget.md)
- Arbeite nach den Regeln in [AGENT.md](../../AGENT.md) und [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Was am Ende vorliegen muss

- Ein nachvollziehbarer Umsetzungsstand fuer Story 0.4a.
- Ein Feature-Branch mit sprechendem Namen.
- Ein PR oder Draft-PR mit sauberer Beschreibung von Story, ADR, Scope, Validierung und Risiken.
- Nachweise fuer die eigenen Checks: Tests, Typecheck, UI-Pruefung, Diff-Review.
- Eine kurze Reflexion, an welchen Stellen der KI-Agent hilfreich war und wo du bewusst eingegriffen hast.

## Empfohlene Arbeitsreihenfolge

1. Lies zuerst Story 0.4a und markiere unklare Stellen.
2. Lies danach die vier relevanten ADRs und notiere daraus konkrete Leitplanken.
3. Lege einen Feature-Branch an, bevor du inhaltlich aenderst.
4. Lasse den Agenten gezielt die betroffenen Dateien und Kontrollpfade recherchieren.
5. Erstelle vor der Implementierung einen knappen Plan fuer Datenbank, Backend, shared-types und Frontend.
6. Implementiere in kleinen Schritten und validiere nach jedem sinnvollen Schnitt.
7. Lies den Diff selbst, bevor du einen PR erstellst.
8. Erstelle erst dann einen Draft-PR mit sauberer Beschreibung und offenen Risiken.

## Fachliche Leitfragen

- Wird der Session-Tagesrekord persistent und atomar gespeichert?
- Ist fachlich klar, dass `count` die **groesste einzelne Session des UTC-Tages** meint und **nicht** die Summe aller Nutzer dieses Tages?
- Bleibt der Join-Flow Fire-and-Forget statt synchron blockierend?
- Liefert `health.stats` wirklich 30 Tage in chronologischer Reihenfolge?
- Werden fehlende Tage serverseitig als `0` aufgefuellt?
- Bleibt das Footer-Widget kompakt, waehrend nur der Hilfe-Dialog den Verlauf zeigt?
- Wird das Diagramm lazy geladen und ohne Angular-Wrapper eingebunden?
- Sind neue Texte, Labels und ARIA-Hinweise i18n-konform umgesetzt?

## Mindestnachweise fuer die Abgabe

- Screenshot oder kurze Demo des Hilfe-Dialogs mit Verlauf.
- Liste der geaenderten Dateien mit einem Satz Zweck pro Datei.
- Ausgefuehrte Validierungsschritte mit Ergebnis.
- Link oder Text des PR-Beschreibungstemplates.
- Kurze Notiz: Welche Agentenprompts waren brauchbar, welche mussten korrigiert werden?

## Pull-Request-Mindestinhalt

Der PR-Text soll mindestens diese Punkte enthalten:

- Story: `0.4a`
- ADR: `0024`
- Scope: betroffene Schichten und Hauptdateien
- Validierung: Tests, Typecheck, manuelle Checks
- Risiken: z. B. Polling-Verhalten, Bundle-Groesse, A11y des Charts

## Relevante Unterlagen

- [Backlog.md](../../Backlog.md)
- [HANDOUT-TAGESREKORD-KI-AGENT.md](./HANDOUT-TAGESREKORD-KI-AGENT.md)
- [PR-REVIEW-CHECKLISTE-STORY-0.4A.md](./PR-REVIEW-CHECKLISTE-STORY-0.4A.md)
- [PRAKTIKUM.md](./PRAKTIKUM.md)
- [STUDENT-STORY-REIHENFOLGE.md](./STUDENT-STORY-REIHENFOLGE.md)
- [docs/TESTING.md](../TESTING.md)

_Stand: 2026-05-04_
