<!-- markdownlint-disable MD013 -->

# ADR-0014: Mobile-first Informationsarchitektur fuer Host-Views

**Status:** Accepted  
**Datum:** 2026-03-17  
**Entscheider:** Projektteam  

## Kontext

arsnova.eu wurde in den Live-Session-Host-Views bislang sichtbar stark aus einer Desktop- und Beamer-Perspektive heraus gestaltet.

Das ist fuer viele Lehrszenarien hilfreich, reicht aber nicht mehr als primaeres Architekturmodell aus.

Im realen Einsatz ist das Smartphone fuer Dozierende kein Sonderfall, sondern ein produktives Host-Geraet:

1. Lehrpersonen testen die App zuerst auf ihrem eigenen Smartphone.
2. Outdoor-Events, Seminare, Exkursionen oder kleinere Gruppen finden ohne Beamer oder Desktop statt.
3. Eine echte Live-Session kann produktiv komplett vom Smartphone aus gesteuert werden.
4. Teilnehmende sind gleichzeitig bereits verbunden, waehrend der Host mobil zwischen Quiz, Q&A und Blitzlicht wechselt.

Damit wird die mobile Host-Ansicht unmittelbar akzeptanzkritisch.

Der aktuelle Stand zeigt fuer Smartphone mehrere strukturelle Spannungen:

- Die obere Steuerzone aus Tabs, Live-Banner und Zusatz-Controls ist fuer kleine Screens zu dicht.
- Mehrere `fixed`-Elemente, Offset-Berechnungen und `dvh`-Hoehen konkurrieren miteinander.
- Einzelne Kanaele sind fachlich verbunden, wirken mobil aber wie unterschiedlich gedachte Mini-Layouts.
- Scrollbarkeit, Touch-Abstaende und visuelle Priorisierung sind nicht in allen Views gleich robust.

Ohne eigene Architekturentscheidung drohen zwei Fehlrichtungen:

- Mobile Layouts werden nur als nachtraegliche CSS-Korrekturen behandelt.
- Die Informationsarchitektur bleibt implizit desktop-zentriert, obwohl Smartphone-Hosting fachlich vollwertig ist.

Dieses ADR baut auf `ADR-0005` (Angular Material Design), `ADR-0009` (einheitliche Live-Session mit Tabs fuer Quiz, Q&A und Blitzlicht) und `ADR-0010` (Blitzlicht als Kernmodus) auf.

## Entscheidung

### 1. Smartphone-Hosting ist ein produktiver Primaermodus

Die Host-Rolle auf dem Smartphone wird in arsnova.eu nicht mehr als Test-, Fallback- oder Randfall behandelt.

Sie ist ein **vollwertiger produktiver Bedienmodus** fuer echte Live-Sessions.

Das bedeutet:

- Alle zentralen Host-Aufgaben muessen auf Smartphone produktiv bedienbar sein.
- Mobile Host-Views werden als gleichberechtigte UX-Schicht geplant und bewertet.
- Die Akzeptanz auf Smartphone ist ein eigenes Qualitaetskriterium, nicht nur ein Nebenprodukt der Desktop-Ansicht.

### 2. Die mobile Differenzierung erfolgt ueber responsive Informationsarchitektur, nicht ueber eigene Rollen oder Routen

Es wird **keine eigene Mobile-Host-Rolle**, **keine eigene Mobile-Route** und **kein Session-Sondermodus** fuer Smartphone eingefuehrt.

Stattdessen gilt:

- dieselbe Route
- dieselbe fachliche Host-Rolle
- dieselben Kernfunktionen
- aber eine **gezielt andere Informationsarchitektur unter Mobile-Breakpoints**

Die Differenzierung erfolgt also primaer ueber responsives Layout, Priorisierung und Interaktionsdichte.

### 3. Desktop bleibt erhalten, Mobile bekommt eigene Priorisierung

Desktop- und Beamer-Ansichten bleiben wichtige Zielbilder und werden nicht pauschal umgebaut.

Fuer Smartphone gilt jedoch:

- Anpassungen erfolgen explizit unter `@media`-Breakpoints.
- Mobile darf Inhalte anders stapeln, komprimieren, einklappen oder in anderer Reihenfolge priorisieren.
- Es ist zulaessig, dass Mobile dieselben Informationen in anderer Dichte und Hierarchie zeigt als Desktop.

Die Architekturentscheidung lautet damit bewusst:

- **funktionale Gleichheit**
- bei **darstellerischer und informationsarchitektonischer Differenz**

### 4. Die obere Host-Steuerzone wird mobil vereinfacht

Die Kombination aus Kanal-Tabs, Live-Banner, Session-Code, Teilnehmerzahl, Join-Aktion, Sound-Steuerung und Zusatz-Buttons darf auf Smartphone nicht als verdichtete Desktop-Miniatur bestehen bleiben.

Mobil gilt:

1. **Primarinformationen zuerst**  
   Session-Code, aktueller Kanal, Status und wichtigste Aktion haben Prioritaet.

2. **Sekundaeraktionen kompakter oder indirekter**  
   Zusatzfunktionen duerfen in Menues, Sheets, `details`-Bereiche oder reduzierte Buttongruppen ausgelagert werden.

3. **Stabile Scroll-Logik vor visueller Fixierung**  
   Mobile Layouts duerfen nicht von mehreren uebereinander liegenden `fixed`-Ebenen abhaengen, wenn dadurch Bedienbarkeit oder Scrollbarkeit leiden.

### 5. Vertikale Lesbarkeit und Scrollbarkeit sind harte Anforderungen

Fuer Smartphone-Host-Views gilt produktiv:

- Jede relevante Ansicht muss vollstaendig scrollbar und bedienbar sein.
- Wichtige Aktionen duerfen nicht abgeschnitten, ueberlagert oder nur durch unnatuerliche Scroll-Kombinationen erreichbar sein.
- Safe-Areas, Browser-Chrome und kleine Viewports muessen in der Hoehenlogik beruecksichtigt werden.
- Verschachtelte Hoehenkonstruktionen mit konkurrierenden `100vh`/`100dvh`/`min-height`-Berechnungen sind kritisch zu hinterfragen.

Scrollbarkeit ist damit kein Implementierungsdetail, sondern Teil der Informationsarchitektur.

### 6. Alle Host-Kanaele nutzen mobil ein gemeinsames Layoutsystem

Quiz, Q&A, Blitzlicht und Ergebnisansichten bleiben fachlich unterschiedliche Kanaele, sollen mobil aber wie Teile einer gemeinsamen Host-Oberflaeche wirken.

Deshalb gilt:

- einspaltige, klar lesbare Haupthierarchie
- konsistente Abstaende zwischen Widgets
- gemeinsame mobile Spacing- und Padding-Logik
- vergleichbare Kartenbreiten und vertikale Rhythmik
- grosse, fingerfreundliche Touch-Ziele

Kanalindividuelle Ausnahmen sind erlaubt, muessen aber gegen das gemeinsame mobile Host-System begruendet werden.

### 7. Mobile reduziert Gleichzeitigkeit, nicht Faehigkeit

Auf Smartphone darf die UI weniger Dinge gleichzeitig prominent zeigen als auf Desktop.

Das ist kein Funktionsverlust, sondern gewollte IA-Reduktion.

Insbesondere gilt:

- Prioritaet vor Vollstaendigkeit im sichtbaren Erstbereich
- progressive Offenlegung vor visueller Ueberladung
- fokussierte Primaraktionen vor Werkzeugdichte

Eine mobile Host-Ansicht ist erfolgreich, wenn sie unter realen Live-Bedingungen ruhig, schnell und sicher bedienbar ist, nicht wenn sie moeglichst viel Desktop-Struktur auf engem Raum repliziert.

### 8. Mobile Host-Qualitaet wird produktnah bewertet

Die Freigabe neuer oder ueberarbeiteter Host-Views erfolgt nicht allein anhand von Desktop-Screenshots oder Emulator-Eindruck.

Sie soll produktnah geprueft werden:

- auf realen Smartphones
- in echten oder realistisch simulierten Live-Sessions
- mit Scroll, Kanalwechsel, Start-/Stop-Aktionen und laengerem Bedienfluss

## Konsequenzen

### Positiv

- Smartphone-Hosting wird fachlich und gestalterisch ernst genommen.
- Die Host-Views erhalten eine nachvollziehbare Informationsarchitektur statt punktueller CSS-Reparaturen.
- Desktop kann stabil bleiben, waehrend Mobile gezielt verbessert wird.
- Kanaele wie Quiz, Q&A und Blitzlicht wirken mobil konsistenter.
- Die Akzeptanz im realen Ersteinsatz durch Dozierende steigt wahrscheinlicher deutlich.

### Negativ / Risiken

- Responsive Arbeit wird umfangreicher, weil Mobile nicht mehr als reine Ableitung von Desktop behandelt werden kann.
- Einzelne Host-Views muessen bewusst neu priorisiert und zum Teil vereinfacht werden.
- Es kann Diskussionen geben, wenn Mobile weniger Gleichzeitigkeit zeigt als Desktop.
- Mehr mobile Spezialisierung unter `@media`-Breakpoints erhoeht die CSS-Komplexitaet und den Testaufwand.

## Alternativen (geprueft)

- **Mobile nur als Desktop-Ableitung mit kleineren CSS-Korrekturen behandeln:** verworfen, weil das die eigentliche IA-Frage nicht loest und die produktive Smartphone-Nutzung unterschaetzt.
- **Eigenen Mobile-Host-Modus oder eigene Mobile-Route einfuehren:** verworfen, weil das Rolle und Routing unnoetig fragmentiert und dieselbe fachliche Host-Aufgabe kuenstlich doppelt modelliert.
- **Nur fuer Test-Sessions mobile Sonderregeln aktivieren:** verworfen, weil Smartphone-Hosting auch in echten produktiven Sessions vorkommt.
- **Desktop zugunsten eines kompromisshaften Einheitslayouts vereinfachen:** verworfen, weil Beamer- und Desktop-Nutzung weiterhin eigenstaendige Staerken haben und nicht verschlechtert werden sollen.

## Umsetzungsleitplanken

- Mobile Anpassungen an Host-Views erfolgen primaer in `@media (max-width: ...)`-Bloecken.
- Die obere Steuerzone wird mobil systematisch vereinfacht, nicht nur optisch zusammengedrueckt.
- Scrollbarkeit und Safe-Area-Verhalten werden fuer jede Host-Ansicht explizit mitgedacht.
- Sekundaere Aktionen duerfen mobil einklappbar, menuegestuetzt oder spaeter im Flow erscheinen, solange Kernaufgaben voll verfuegbar bleiben.
- Neue Kanal-Widgets muessen mobile Abstaende, Touch-Ziele und vertikale Lesbarkeit von Anfang an beruecksichtigen.
- Die Desktop-Ansicht wird nur dann geaendert, wenn eine mobile Verbesserung dies zwingend fachlich mit erfordert.

---

## Umsetzungsstand (2026-03-13)

Die Architektur wurde umgesetzt. Zentrale Aenderungen:

- **Vier-Zonen-Layout:** Top-Toolbar, Session-Channel-Tabs, Live-Channel-Shell (QR, Code, Musik), Channel-Panel sind in allen Phasen (connecting, running, result) und allen Kanaelen (Quiz, Q&A, Blitzlicht) konsistent positioniert.
- **Keine fixed-Elemente mehr in session-host:** Tabs, Banner und Controls sind statisch im Dokumentfluss; natuerliche Scrollbarkeit ohne Ueberlagerungen.
- **Mobile Host-Tokens:** `--host-mobile-inline`, `--host-mobile-stack-gap`, `--host-mobile-card-padding`, `--host-mobile-toolbar-gap`, `--host-mobile-safe-bottom` in `styles.scss`.
- **Q&A-Host:** Im Vier-Zonen-Modell stabilisiert, Safe-Bottom auf Mobile.
- **Blitzlicht:** Ergebnisbalken und Format-Buttons zwischen embedded (Kanal) und standalone (Startseite) angeglichen; 2-Button-Layout (Ja/Nein) zentriert.
- **Fullscreen-Button:** Auf Smartphone (inkl. Landscape) ausgeblendet.

Story 2.8 gilt als erfuellt.

---

**Referenzen:** `apps/frontend/src/app/features/session/session-host/session-host.component.scss`, `apps/frontend/src/app/features/feedback/feedback-host.component.scss`, `apps/frontend/src/app/features/feedback/feedback-vote.component.scss`, `apps/frontend/src/app/features/session/session-vote/session-vote.component.scss`, `apps/frontend/src/app/features/session/session-present/session-present.component.scss`, [ADR-0005: Angular Material Design](./0005-use-angular-material-design.md), [ADR-0009: Einheitliche Live-Session mit Tabs fuer Quiz, Q&A und Blitzlicht](./0009-unified-live-session-channels.md), [ADR-0010: Blitzlicht als Kernmodus fuer Live-Sessions](./0010-blitzlicht-as-core-live-mode.md).
