<!-- markdownlint-disable MD013 -->

# Blitzlicht Guidelines

## Ziel

Diese Guideline definiert verbindliche Regeln fuer `Blitzlicht` in `arsnova.eu`.
Sie konkretisiert ADR `docs/architecture/decisions/0010-blitzlicht-as-core-live-mode.md` fuer Design, Wording und Interaktion in `apps/frontend`.

## Produktverstaendnis

- `Blitzlicht` ist ein eigener Live-Modus, kein Unterfall von Quiz, Chat oder Peer Instruction.
- Die Funktion muss fuer Lehrende in Sekunden startklar sein.
- Es gibt zwei gleichwertige Einstiegspfade:
  - direkt von der Startseite
  - innerhalb einer laufenden Veranstaltung ueber den Session-Kanal
- Beide Pfade muessen denselben Funktionskern vermitteln.

## Verbindliches Wording

- Verwende in der UI `Blitzlicht`, nicht `Blitz-Feedback`.
- Verwende `Q&A`, nicht `Fragen`, wenn der Kanalname gemeint ist.
- Fuer Tempo verwende als Host-CTA `Tempo-Feedback`, nicht `Tempo starten`. Auf der Startseite lautet der Chip `Tempo`.
- Fuer die Tempo-Spotlight-Ueberschrift verwende `Vortragstempo im Blick behalten`.
- Fuer die Tempo-Spotlight-Beschreibung ist die kanonische Aussage: `Mit vier Icons zeigt deine Gruppe, ob sie folgen kann.`
- Verwende beim Tempo-Host `Rueckmeldungen` statt `Signale` oder `Stimmen`.
- Verwende fuer die Host-Kennzahl aktiver Teilnehmender `Online`, nicht `Aktive Personen`.
- Verwende als gemischte Tempo-Tendenz `Die Rueckmeldungen sind gemischt.`, nicht `heterogen`.
- Fuer die zweite Runde im Blitzlicht-Kontext verwende `Vergleichsrunde`, nicht `Diskussionsrunde`.
- Gute Host-Formulierung fuer die zweite Runde:
  - `Jetzt zum Vergleich ein zweites Blitzlicht...`
- Vermeide didaktisch falsche oder zu enge Formulierungen wie:
  - `Diskutiert mit eurem Nachbarn!`
  - `Peer Instruction`
  - `Diskussionsphase`, wenn fachlich nur eine Vergleichsabstimmung gemeint ist

## Startseite

### Rolle der Blitzlicht-Karte

- Die Blitzlicht-Karte auf der Startseite ist ein Produkt-Shortcut fuer einen Kernanwendungsfall.
- Sie steht sichtbar zwischen `Dabeisein` und `Veranstaltung starten`.
- Die Karte muss auf Desktop kompakt und auf Mobile sofort lesbar bleiben.

### Desktop-Layout

- Drei Startkarten duerfen auf Desktop nicht als extrem breite, lange Flaechen nebeneinander aufgezogen werden.
- Inhalte auf der Startseite erhalten eine begrenzte Maximalbreite.
- Kartentitel sollen auf Desktop moeglichst nicht umbrechen.
- Kartenbreite wird bewusst lesefreundlich begrenzt, nicht nur technisch verteilt.

### Blitzlicht-Chips auf der Startseite

- Chips sind kompakt und eher flach, nicht kachelartig hoch.
- Label steht unter der Icon-Reihe.
- Label und Icon-Reihe sind horizontal mittig.
- `ABCD` erscheint ohne zusaetzliches Textlabel.
- `Sterne` nutzt im Format-Chip fuenf einzelne Stern-Icons.
- Der Abstand zwischen Icon und Label ist klein, aber konsistent.
- Der Abstand zwischen allen Icons und ihren Labels muss ueber alle Chips gleich wirken.
- Positive/negative Bedeutungen nutzen Theme-Tokens:
  - `check_circle` bzw. `Wahr/Richtig` in gruen
  - `cancel` bzw. `Falsch` in rot
  - neutrale Zeichen in on-surface-variant
- `Weiss nicht` wird im kompakten Chip-Kontext als `?` dargestellt.

### CTA-Logik

- Ein Klick auf einen Blitzlicht-Chip startet sofort eine neue Blitzlicht-Runde.
- Der Einstieg benoetigt kein zusaetzliches Konfigurationsmodal fuer Standardfaelle.
- Waehlt der Nutzer ein Format, landet er direkt in einer nutzbaren Host-Ansicht.

### Tempo auf der Startseite

- Tempo ist ein gleichrangiger Format-Chip in der Blitzlicht-Karte, keine eigene Spotlight-Kachel.
- Der Chip zeigt die vier Tempo-Icons und das Label `Tempo`.
- Spotlight-Kachel und CTA `Tempo-Feedback` bleiben der Blitzlicht-Host-Auswahl vorbehalten.

## Live-Ansicht: Host

### Aktionsreihe

- Die Aktionsreihe muss kompakt und einzeilig priorisiert sein, soweit die Breite das zulaesst.
- Buttons in derselben Reihe haben:
  - konsistente Icon-Label-Abstaende
  - vergleichbare Hoehe
  - keine zufaelligen Link-Sonderstile
- `Session beenden` ist eine echte Aktion, kein unterstrichener Textlink.
- `Session beenden` hat ein passendes Icon und bleibt in der visuellen Grammatik der restlichen Aktionsleiste.
- Kritische Aktionen duerfen rot markiert sein, aber nicht optisch aus dem System herausfallen.

### Sichtbarkeit kritischer Schritte

- Wenn der naechste sinnvolle Schritt `Zweite Abstimmung` ist, braucht der Host ein klares Signal.
- Erlaubte Mittel:
  - primaerer Button
  - Pulse
  - deutliche visuelle Hervorhebung
- Alle Animationen nur unter `@media (prefers-reduced-motion: no-preference)`.

### Abstaende und vertikale Hierarchie

- Der Bereich mit Start-/Format-Chips und die Ergebnisanzeige brauchen spuerbare visuelle Trennung.
- Zusaetzlicher Weissraum muss dort eingefuegt werden, wo Nutzende ihn wahrnehmen:
  - direkt zwischen Chip-Auswahl und Ergebnisanzeige
  - nicht nur ueber globale Viewport-Verschiebung
- QR-Code und Join-Bereich duerfen nicht an Toolbar oder Top-Chrome kleben.

### Tempo-Host-Panel

- Tempo wird in der Host-Auswahl als Spotlight-Kachel gezeigt, nicht als kleiner Zusatz-Chip.
- Das Host-Panel priorisiert die Lageeinschaetzung; Detailbalken duerfen vorhanden sein, aber nicht die Tendenz ueberfrachten.
- In Tablet- und Desktop-Ansichten braucht das Tempo-Panel sichtbar Luft zur App-Toolbar.
- Hintergrundflaechen im Tempo-Panel muessen unterscheidbar bleiben; zu viele gleichartige Umrandungen vermeiden.
- Die Kennzahlen heissen `Online` und `Rueckmeldungen`; vermeide redundante Kombinationen wie `Rueckmeldungen` direkt ueber `0 Rueckmeldungen`.
- Im Tendenzmodus bleiben `Details`/`Tendenz` und `Session beenden` erreichbar.

## Live-Ansicht: Teilnehmer und Presenter

- Farben und Icons fuer `Wahr/Falsch/?` muessen auch in der Teilnehmeransicht korrekt erscheinen.
- Dieselben Antwortsemantiken muessen im Host, Vote und Presenter konsistent aussehen.
- Wenn Host-seitig ein Blitzlichtformat wechselt, muss der Wechsel live auf Teilnehmerseite ankommen.
- Ergebnisbalken im Blitzlicht nutzen dieselben Icons wie die zugehoerigen Optionen, wenn das fuer das Format sinnvoll ist.
- Im Tempo-Vote-Client kann eine aktive Auswahl per Re-Tap und per Backdrop auf den Viewport-Hintergrund zurueckgesetzt werden.
- Rollenhinweise im Vote-Client muessen freundlich und knapp sein; vermeide redundante Zeilen wie `Ansicht / Teilnehmende Person`.
- Session-Codes werden ohne sichtbares `#` vorangestellt.

## Funktionale Regeln

### Session-Code-Stabilitaet

- Ein Formatwechsel im Blitzlicht innerhalb einer laufenden Veranstaltung darf keinen neuen Session-Code erzeugen.
- Teilnehmende bleiben im bestehenden Live-Kontext.

### Vergleichsrunde

- Eine Vergleichsrunde funktioniert nur mit demselben Blitzlicht-Format.
- Bei vorhandenem Vorher/Nachher-Kontext ist ein Formatwechsel zu blockieren oder klar als Reset mit Datenverlust zu kommunizieren.
- Hinweise muessen den fachlichen Effekt erklaeren:
  - Vergleichsrunde dann nicht mehr moeglich
  - bisherige Stimmen werden geloescht

### Beenden

- Standalone-Blitzlicht und Blitzlicht-in-Session brauchen beide eine sichtbare Beenden-Aktion.
- Das Verhalten ist kontextabhaengig:
  - in einer Veranstaltung: Session beenden
  - standalone: Blitzlicht-Runde beenden
- Beenden erfolgt nie stillschweigend, sondern mit klarer Bestaetigung.

### Tempo

- `TEMPO` ist ein eigener QuickFeedback-Typ mit vier Werten: `SPEED_UP`, `FOLLOWING`, `SLOW_DOWN`, `LOST`.
- Tempo ist mutable: Auswahl setzen, wechseln und entfernen; klassische Blitzlicht-Typen bleiben Einmal-Votes.
- Hosts sehen nur Aggregation und Tendenz, keine individuellen Rueckmeldungen.
- Die Tendenz wird erst bei ausreichender Rueckmeldequote aktiv und muss ruhig bleiben.

## Technische Leitplanken

- **Router & Procedures:** fachlich Blitzlicht, technisch `quickFeedback.*` — Übersicht und Mermaid-Ablauf in [`docs/features/blitzlicht-quickfeedback-api.md`](../features/blitzlicht-quickfeedback-api.md).
- Shared Types fuer Blitzlicht-Input/Output zuerst in `@arsnova/shared-types` definieren.
- Frontend und Backend muessen fuer neue Blitzlicht-Formate oder Mutationen gemeinsam angepasst werden.
- Lokale WebSocket-Pfade fuer `tRPC` und `Yjs` muessen im Dev-Betrieb robust und konsistent sein.
- Live-Synchronisation ist fuer Blitzlicht genauso kritisch wie fuer Quiz und Q&A.
- Neue Tempo-Aenderungen muessen gegen `docs/architecture/decisions/0029-tempo-as-predefined-blitzlicht-template.md` geprueft werden.

## Review-Checkliste

- Ist `Blitzlicht` sprachlich sauber von Peer-Instruction/Diskussionslogik getrennt?
- Verhalten sich Startseiten-Shortcut und Session-Kanal fuer den gleichen Modus konsistent?
- Bleibt der Session-Code bei Formatwechsel innerhalb einer Session stabil?
- Sind Chips kompakt, lesbar und visuell konsistent?
- Sind Icon-/Label-Abstaende in Aktionsreihen und Chips einheitlich?
- Ist `Session beenden` sichtbar, kontextklar und nicht wie ein Link gestaltet?
- Entsteht neuer Abstand wirklich an der wahrgenommenen Stelle?
- Bleibt die Startseite auf Desktop kompakt statt ueberbreit?
- Bleibt Tempo als Spotlight erkennbar, ohne die Hero-Chip-IA aufzubrechen?
- Sind Tempo-Icons auf Home, Host und Vote gross genug und zentriert?
- Verwendet die UI `Tempo-Feedback`, `Online` und `Rueckmeldungen` konsistent?
- Bleibt der Tempo-Host ruhig, lesbar und frei von unnoetigen Umrandungen?
- Kann der Vote-Client eine Tempo-Auswahl per Re-Tap und Backdrop zuruecksetzen?
