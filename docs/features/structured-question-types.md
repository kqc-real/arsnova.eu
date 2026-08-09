# Strukturierte Fragentypen

arsnova.eu unterstützt die bewertbaren Fragentypen `MATCHING` (Zuordnung), `ORDERING`
(Reihenfolge) und `CATEGORIZATION` (Kategorisierung) durchgängig in Editor, Live-Abstimmung,
Host-Auswertung und Session-Bericht.

## Editor und Import

- Matching enthält 2–6 eindeutige Paare. Die rechte Seite kann pro teilnehmender Person gemischt
  werden.
- Ordering enthält 3–8 Elemente. Die Reihenfolge im Editor ist die Musterlösung; Lehrende können
  Elemente per Anfang/hoch/runter/Ende neu anordnen. Die Startreihenfolge der Abstimmung wird
  immer gemischt.
- Categorization enthält 2–4 Kategorien und 4–12 Elemente. Die Elemente können pro teilnehmender
  Person gemischt werden.
- Element- und Zuordnungs-IDs sind opak und stabil. Sie bleiben bei Umordnung und Textänderungen
  erhalten. Alte lokale Quizdaten und native JSON-Importe ohne IDs werden einmalig migriert.
- Texte werden wie andere Fragen als Markdown und KaTeX gerendert. Export und Import erhalten
  IDs, Musterlösung und Shuffle-Konfiguration.

## Abstimmung

Matching und Categorization verwenden eine gemeinsame, tastatur- und touchbedienbare Auswahlzeile.
Ordering bietet für jedes Element Anfang/hoch/runter/Ende-Aktionen mit individuellem Accessible
Name und Live-Ansage. Unvollständige Antworten lassen sich nicht absenden. Strukturierte Entwürfe
werden lokal pro Session, Person, Frage und Runde gespeichert und nach einem Reload wiederhergestellt.

Während `ACTIVE` enthalten Teilnehmer-DTOs nur opake IDs und sichtbare Texte. Paarbildung,
Soll-Reihenfolge, Zielkategorien und Live-Verteilungen werden nicht ausgeliefert. Das serverseitige
Scoring prüft die vollständige Antwort gegen die kanonischen IDs; aktuell gibt es keine Teilpunkte.

## Ergebnisse und Bericht

Nach Freigabe sehen Teilnehmende ihre Antwort mit explizitem Richtig/Falsch-Status und gegebenenfalls
der korrekten Position, Zuordnung oder Kategorie. Die Host-Ansicht zeigt die Musterlösung, den Anteil
vollständig korrekter Antworten, typische Fehler und eine vollständige Verteilungsmatrix:

- Ordering: Element × abgegebene Position
- Matching: linker Begriff × gewählter rechter Begriff
- Categorization: Element × gewählte Kategorie

Nullzellen bleiben sichtbar; die Musterlösung wird zusätzlich zu Farbe durch Rahmen und Text
gekennzeichnet. Dieselben Matrizen werden mit Tabellenüberschriften und Zeilen-/Spaltenköpfen in den
lokalisierten Session-Ergebnisbericht übernommen.

## Relevante Prüfungen

- Shared Contracts und Statistik: `libs/shared-types/src/schemas.test.ts`
- Data-Stripping: `apps/backend/src/__tests__/dto-security.test.ts`
- Editor und Abstimmung: die benachbarten Angular-Komponententests
- Vollständige Matrizen: `PresenterDistributionMatrixComponent` und
  `session-results-report-structured-matrix.util.test.ts`
- Browser-Smoke: `npm run smoke:structured-question-types -w @arsnova/frontend`
