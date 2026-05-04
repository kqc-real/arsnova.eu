# PR-Review-Checkliste: Story 0.4a "Tagesrekord-Verlauf"

**Zweck:** Diese Checkliste hilft dabei, einen Pull Request zur Story **0.4a** fachlich, architektonisch und technisch zu reviewen.

## 1. Produktvertrag

- [ ] Der PR verweist explizit auf **Story 0.4a** in [Backlog.md](../../Backlog.md).
- [ ] Die Umsetzung deckt die Akzeptanzkriterien vollstaendig ab und fuehrt kein anderes Feature unter derselben Story mit.
- [ ] Das kompakte Footer-Widget bleibt unveraendert; der Verlauf erscheint nur im Hilfe-Dialog.

## 2. Architektur & ADRs

- [ ] Der PR verweist auf [ADR-0024](../architecture/decisions/0024-daily-session-records-in-server-status-help-dialog.md).
- [ ] Die API-Erweiterung bleibt tRPC- und shared-types-konform im Sinne von [ADR-0003](../architecture/decisions/0003-use-trpc-for-api.md).
- [ ] Die Trennung zwischen kompaktem Status-Widget und Detaildialog bleibt konsistent zu [ADR-0021](../architecture/decisions/0021-separate-service-status-from-load-status-with-live-slo-telemetry.md).
- [ ] Neue UI-Texte und Labels folgen [ADR-0008](../architecture/decisions/0008-i18n-internationalization.md).

## 3. Datenmodell & Backend

- [ ] Das Prisma-Modell `DailyStatistic` hat genau einen Datensatz pro UTC-Tag.
- [ ] Die Tagesrekord-Aktualisierung erfolgt atomar und nur bei hoeherem Wert.
- [ ] `count` meint die **maximale gleichzeitige Teilnehmendenzahl in der groessten einzelnen Session des UTC-Tages**, nicht die Summe aller Tagesnutzer.
- [ ] Der Join-Flow bleibt Fire-and-Forget und fuehrt keine neue blockierende Wartezeit ein.
- [ ] `health.stats` liefert `dailyHighscores` fuer 30 Tage in chronologischer Reihenfolge.
- [ ] Fehlende Tage werden serverseitig sinnvoll aufgefuellt statt dem Frontend zu ueberlassen.

## 4. Frontend & Performance

- [ ] Das Diagramm wird nur im `ServerStatusHelpDialogComponent` gerendert.
- [ ] `chart.js` wird lazy geladen.
- [ ] Es wird kein schwerer Angular-Wrapper eingefuehrt.
- [ ] Die Darstellung funktioniert auch mit leerer oder teilweiser Historie.
- [ ] Das Diagramm verschlechtert nicht sichtbar die Startseiten-Performance.

## 5. i18n & A11y

- [ ] Neue sichtbare Texte sind in den gepflegten App-Sprachen nachgezogen.
- [ ] Diagramm-Ueberschrift, Hilfetexte und relevante ARIA-Hinweise sind vorhanden.
- [ ] Der Dialog bleibt per Tastatur bedienbar und der Chart-Bereich erzeugt keine offensichtliche Accessibility-Regression.

## 6. Tests & Validierung

- [ ] Backend-Tests pruefen mindestens den API-Vertrag fuer `dailyHighscores`.
- [ ] Frontend-Tests pruefen mindestens Darstellung mit und ohne Verlaufsdaten.
- [ ] Die im PR genannten Checks wurden wirklich ausgefuehrt und sind nachvollziehbar.
- [ ] Diff und Testnamen passen inhaltlich zur Story, nicht zu einem groesseren Seiteneffekt.

## 7. Git & PR-Hygiene

- [ ] Branch-Name ist sprechend und storynah.
- [ ] Der PR-Titel benennt Scope und Aenderungsart klar.
- [ ] Die PR-Beschreibung nennt Story, ADR, Validierung und Risiken.
- [ ] Der PR enthaelt keine themenfremden Dateien oder Altlasten.

## 8. Review-Fragen

Wenn bei einem Punkt Unsicherheit besteht, sollten diese Fragen vor dem Merge geklaert sein:

- Sollte die Null-Auffuellung der 30-Tage-Achse im Backend oder im Frontend liegen?
- Reicht Polling fuer diese Kennzahl weiterhin aus, oder wurde versehentlich ein staerkeres Echtzeitmodell eingebaut?
- Sind die Chart-Optionen robust genug fuer mobile und kleine Dialogbreiten?
- Sind Namensgebung und Story/ADR-Verweise so klar, dass spaetere Teams die Entscheidung nachvollziehen koennen?

_Stand: 2026-05-04_
