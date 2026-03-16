<!-- markdownlint-disable MD013 -->

# ADR-0010: Blitzlicht als Kernmodus mit konsistenter UX in Startseite und Live-Session

**Status:** Accepted  
**Datum:** 2026-03-16  
**Entscheider:** Projektteam  

## Kontext

Im Verlauf der Produktarbeit hat sich gezeigt, dass `Blitzlicht` in arsnova.eu kein kleines Nebenfeature ist, sondern ein haeufig genutzter didaktischer Kernfall.

Fuer Lehrende ist besonders attraktiv, dass ein Blitzlicht ohne grossen Vorlauf und ohne Quiz-Setup gestartet werden kann. Gleichzeitig muss derselbe Modus auch innerhalb einer laufenden Veranstaltung verfuegbar sein. Genau daraus sind mehrere Spannungen entstanden:

- `Blitzlicht` wurde sprachlich und visuell teils wie ein Unterfall von `Diskussion` oder `Blitz-Feedback` behandelt
- es gab zwei Einstiegspfade mit unterschiedlicher UX:
  - direkter Start auf der Startseite
  - Nutzung innerhalb einer laufenden Veranstaltung ueber den Kanalumschalter
- wichtige Aktionen wie `Session beenden` waren nicht in beiden Pfaden gleich verfuegbar
- Formatwechsel konnten den Session-Code wechseln und damit Teilnehmende verlieren
- die Startseite priorisierte den Blitzlicht-Einstieg noch nicht klar genug als eigenstaendigen Mehrwert

Fuer die Produktlogik und die Wahrnehmung der App ist das problematisch. Aus Nutzersicht darf `Blitzlicht` weder wie ein technischer Sonderfall noch wie eine verkappte Peer-Instruction-Runde erscheinen.

## Entscheidung

### 1. Blitzlicht ist ein eigener didaktischer Kernmodus

`Blitzlicht` wird fachlich und sprachlich als eigenstaendiger Live-Modus behandelt.

- In der UI wird der Begriff `Blitzlicht` verwendet, nicht `Blitz-Feedback`.
- Formulierungen muessen kurz, neutral und vergleichsorientiert sein.
- Begriffe wie `Diskussionsphase` oder andere Peer-Instruction-Frames werden fuer Blitzlicht nur dann verwendet, wenn sie fachlich wirklich passen. Standard fuer die zweite Runde ist `Vergleichsrunde`.

### 2. Zwei Einstiegspfade, eine konsistente Erwartung

Es gibt dauerhaft zwei legitime Einstiegspfade:

1. **Direktes Blitzlicht** ueber die Startseite
2. **Blitzlicht innerhalb einer Veranstaltung** ueber die Session-Kanaele

Beide Einstiegspfade muessen aus Nutzersicht dieselbe Grundfunktionalitaet und dieselben zentralen Aktionen anbieten, soweit der jeweilige Kontext das fachlich zulaesst.

Konkret bedeutet das:

- dieselben Blitzlicht-Formate
- dieselbe visuelle Sprache fuer Chips, Icons und Ergebnisdarstellung
- dieselbe Erwartung an Start, Reset, Vergleichsrunde und Beenden

### 3. Standalone-Blitzlicht ist ein Produkt-Shortcut, kein Technik-Sonderfall

Der Startseiten-Einstieg fuer Blitzlicht ist kein Demo- oder Schnelltest-Modus, sondern ein vollwertiger Produktpfad.

- Er bekommt eine eigene Karte auf der Startseite.
- Die Karte bietet vorkonfigurierte Formate als sofort startbare Chips.
- Ein Klick startet direkt eine nutzbare Blitzlicht-Runde.
- Standalone-Blitzlicht braucht dieselben robusten Abschluss- und Synchronisationsmechanismen wie der Session-Kanal.

### 4. Session-Code-Stabilitaet hat Vorrang

Innerhalb einer laufenden Veranstaltung darf ein Formatwechsel im Blitzlicht den bestehenden Session-Code nicht aendern.

- Ein Wechsel des Blitzlicht-Typs innerhalb derselben Session erfolgt im bestehenden Code-Kontext.
- Stimmen und Vergleichsrunden-Daten duerfen bei einem fachlich kritischen Wechsel nicht stillschweigend erhalten oder unklar ueberschrieben werden.
- Wenn ein Wechsel vorhandene Stimmen ungueltig macht, braucht es einen klaren Hinweis.

### 5. Vergleichsrunden bleiben formatgebunden

Eine zweite Blitzlicht-Runde ist fachlich eine **Vergleichsrunde**. Sie darf nur im selben Format weitergefuehrt werden.

- Bei vorhandenen Stimmen oder laufendem Vorher/Nachher-Kontext ist ein Formatwechsel zu blockieren oder klar als destruktiver Reset zu kommunizieren.
- Die UI soll Lehrenden deutlich signalisieren, wenn der naechste sinnvolle Schritt `Zweite Abstimmung` ist.

### 6. Startseite priorisiert Nutzbarkeit statt Flaechenverbrauch

Die Startseite wird fuer Blitzlicht mobile-first und desktop-tauglich gestaltet.

- Die drei Einstiegskarten duerfen auf Desktop nicht als ueberspannte, extrem breite Flaechen erscheinen.
- Blitzlicht-Chips muessen kompakt, schnell lesbar und klickbar sein.
- Kartentitel und CTAs sollen auf Desktop moeglichst ruhig und ohne stoerende Umbrueche erscheinen.

### 7. Kritische Aktionen muessen sichtbar, aber konsistent sein

Aktionen wie `Session beenden` muessen in beiden Blitzlicht-Pfaden vorhanden sein.

- In Session-Kontexten beendet die Aktion die Veranstaltung.
- Im Standalone-Kontext beendet sie die Blitzlicht-Runde.
- Die Aktion erhaelt dieselbe semantische Sichtbarkeit, aber keine Link-Optik, die sie gegenueber den restlichen Aktionen aus dem System herausfallen laesst.

## Konsequenzen

### Positiv

- `Blitzlicht` wird produktseitig klar als staerkender USP positioniert.
- Lehrende bekommen einen sehr schnellen Direktzugang ohne Medienbruch.
- Die UX wird konsistenter zwischen Startseite und Live-Session.
- Session-Code-Stabilitaet verhindert Teilnehmendenverlust bei Formatwechseln.
- Die Sprache in Host-, Vote- und Presenter-Ansichten passt besser zum didaktischen Zweck.

### Negativ / Risiken

- Zwei Einstiegspfade muessen kuenftig bewusst parallel gepflegt werden.
- Kleine Abweichungen in Terminologie oder Aktionsangebot fallen sofort negativ auf.
- Die Startseite bekommt mehr Verantwortung als Produkt-Einstieg und muss daher staerker kuratiert werden.
- Standalone-Blitzlicht braucht eigene technische Abschlusslogik und darf nicht implizit von Session-Verhalten abhaengen.

## Alternativen (geprueft)

- **Blitzlicht nur innerhalb einer Veranstaltung anbieten:** Verworfen, weil damit der schnelle Direktnutzen fuer Lehrende verloren geht.
- **Standalone-Blitzlicht als abgespeckten Sondermodus behandeln:** Verworfen, weil das zu inkonsistenter UX und fehlenden Kernaktionen fuehrt.
- **Blitzlicht sprachlich als Diskussions- oder Feedback-Unterfall belassen:** Verworfen, weil das didaktisch unscharf und fuer Nutzende missverstaendlich ist.
- **Formatwechsel mit neuem Session-Code erlauben:** Verworfen, weil Teilnehmende dadurch aus dem laufenden Kontext fallen.

## Umsetzungsleitplanken

- `Blitzlicht` ist in Wording, Navigation und Design ein eigener Begriff.
- Startseiten-Shortcut und Session-Kanal muessen auf Sicht denselben Funktionskern bedienen.
- Kritische Aktionen und Vergleichsrunden-Logik muessen in beiden Pfaden konsistent sein.
- UX-Entscheidungen fuer Blitzlicht werden kuenftig gegen die Frage geprueft: `Hilft das Lehrenden, in wenigen Sekunden sicher eine kurze Live-Abfrage zu starten und auszuwerten?`
