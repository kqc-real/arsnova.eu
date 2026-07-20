<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Accessibility-Audit · WCAG 2.2 AA

**Projekt:** arsnova.eu  
**Stand:** 2026-07-20

**Zweck:** Lehr- und Arbeitsgrundlage für Softwarequalitätsmanagement, Frontend-Entwicklung und Review  
**Prüfmaßstab:** [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/), Konformitätsstufe AA

## Kurzurteil

arsnova.eu besitzt bereits eine überdurchschnittlich gute technische
Accessibility-Basis. Dazu gehören Angular Material, Skip-Links, Landmarks,
sichtbare Fokusindikatoren, viele Live-Regionen, Reduced Motion,
Formularfehler-Fokus, lokalisierte Oberflächen und ein eigenes PDF/UA-Profil.

Eine WCAG-2.2-AA-Konformität ist dennoch **nicht nachgewiesen**. Im initialen
Audit wurden zwölf konkrete Level-A-/AA-Defekte identifiziert. Eine Nachprüfung
vom 2026-07-20 ergänzte offene Risiken bei Überschriften, Timing,
Fokusverdeckung und der Vollständigkeit automatischer Gates.

Die bestätigten technischen Befunde sind auf `main` bis einschließlich PR #101
mit einer Ausnahme behoben: Die persönliche Zeitanpassung gilt nur, solange die
Frage `ACTIVE` bleibt. Gibt der Host das Ergebnis vorher frei, enden auch
`EXTENDED`- und `OFF`-Eingabefenster. Der sichtbare Host-Hinweis macht diese
Entscheidung transparent, garantiert die Anpassung aber nicht und schließt
WCAG 2.2.1 daher noch nicht vollständig.

Routenübergreifende axe-Tests, Angular-Template-Regeln, Landing-A11y-Gate,
ungewichtete Lighthouse-Einzelaudits, 320-Pixel-Reflow und veraPDF/PDF-UA-1
sind blockierende CI-Nachweise. PR #102 ergänzt dafür eine zweite,
PR-101-spezifische manuelle Prüfmatrix.

Offen bleibt die vollständige manuelle Abnahme mit VoiceOver/Safari,
NVDA/Firefox, echtem 200-/400-%-Browserzoom, Windows Forced Colors und
PDF-Readern. Deshalb wird weiterhin **keine formale WCAG-2.2-AA-Konformität
erklärt**.

Ein hoher Lighthouse-Score ist dabei kein Konformitätsnachweis: Die
Produktionsstartseite erreichte im Audit 100 Punkte, obwohl derselbe
Lighthouse-Bericht einen Verstoß gegen „Label in Name“ auswies, der nicht in die
Score-Gewichtung einging.

## 1. Lernziele

Nach der Arbeit mit diesem Dokument kannst du:

1. automatisierte A11y-Prüfungen von einer vollständigen WCAG-Prüfung
   unterscheiden;
2. Befunde anhand eines WCAG-Erfolgskriteriums, einer Code-Evidenz und eines
   reproduzierbaren Tests beschreiben;
3. Accessibility-Maßnahmen nach Schweregrad und Abhängigkeiten priorisieren;
4. automatische, manuelle und assistive Prüfverfahren zu einer Teststrategie
   kombinieren;
5. erklären, warum ein grüner Lighthouse-Score allein keine
   WCAG-2.2-AA-Konformität belegt;
6. einen größeren Qualitätsbefund in kleine, überprüfbare Pull Requests
   zerlegen.

## 2. Begriffe und Bewertungslogik

### 2.1 Erfolgskriterium, Konformität und Prüfwerkzeug

Ein WCAG-Erfolgskriterium beschreibt eine testbare Anforderung. Für
WCAG 2.2 AA müssen alle Erfolgskriterien der Stufen A und AA erfüllt sein.
Konformität bezieht sich auf vollständige Webseiten und vollständige Prozesse,
nicht nur auf einzelne Komponenten.

Werkzeuge wie Lighthouse oder axe prüfen automatisch erkennbare Teilmengen.
Sie können Fehler finden, aber keine vollständige Konformität beweisen.
Insbesondere Tastaturreihenfolge, Screenreader-Verständlichkeit, Zoom,
Kontrast in allen Zuständen, Fokusmanagement und komplexe Live-Prozesse
benötigen zusätzliche Prüfungen.

### 2.2 In diesem Dokument verwendete Kategorien

| Kategorie               | Bedeutung                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Bestätigter Defekt**  | Code und/oder Laufzeitverhalten belegen einen konkreten Verstoß.                                            |
| **Risiko**              | Die Implementierung ist auffällig; ein manueller Laufzeittest muss entscheiden.                             |
| **Nachweisbedarf**      | Eine Maßnahme kann vorhanden sein, wurde aber noch nicht vollständig gegen das Erfolgskriterium abgenommen. |
| **Vorhandene Maßnahme** | Im Repo ist eine konkrete positive A11y-Implementierung nachweisbar.                                        |

## 3. Umfang und Methode des Audits

### 3.1 Untersuchte Bereiche

- Angular-Frontend unter `apps/frontend/`
- Astro-Landing-App unter `apps/landing/`
- globale Styles, Routing, Formulare, Dialoge und Live-Ansichten
- Quiz-Erstellung und Quiz-Bearbeitung
- Home, Join, Session-Vote, Session-Host, Q&A und Blitzlicht
- Accessibility-Tests, Lighthouse-Konfiguration und CI
- Session-Ergebnisbericht und PDF/UA-Profil
- Projekt- und Qualitätsdokumentation

### 3.2 Eingesetzte Verfahren

1. statische Prüfung von Templates, TypeScript, SCSS, Tests und Dokumentation;
2. Suche nach Fokus-, ARIA-, Tastatur-, Drag-, Dialog- und Formularmustern;
3. Browserprüfung der produktiven deutschen und englischen Anwendung;
4. drei Lighthouse-Accessibility-Läufe mit Lighthouse 12.8.2 und
   axe-core 4.12.1;
5. Prüfung der PDF-Metadaten eines deutschen PDF/UA-Demoexports mit
   `pdfinfo`;
6. Abgleich mit den neuen WCAG-2.2-Kriterien, insbesondere 2.4.11, 2.5.7 und
   2.5.8.

### 3.3 Historische Lighthouse-Ergebnisse des initialen Audits

| Route                            | Score | Automatisch gefundener Befund                                          |
| -------------------------------- | ----: | ---------------------------------------------------------------------- |
| `https://arsnova.eu/de/`         |   100 | „Label in Name“: sichtbares „Los geht's“, Accessible Name „Teilnehmen“ |
| `https://arsnova.eu/de/quiz/new` |    95 | Markdown-Textarea ohne zugeordnetes Label                              |
| `https://arsnova.eu/de/help`     |   100 | kein automatischer Verstoß in diesem Zustand                           |

Der Startseitenbefund zeigt eine wichtige Grenze des Scores: Ein Audit kann
fehlschlagen, ohne den gerundeten Kategorien-Score zu senken. Die Befunde sind
inzwischen behoben. Das aktuelle Gate blockiert auch fehlgeschlagene
Accessibility-Audits mit Gewicht `0`; `manual`, `notApplicable` und
`informative` bleiben ausdrücklich ausgenommen.

### 3.4 Grenzen dieses Audits

Nicht vollständig durchgeführt wurden:

- NVDA mit Firefox;
- VoiceOver mit Safari über alle Kernprozesse;
- 200-%- und 400-%-Zoom auf allen Zuständen;
- systematische Kontrastmessungen aller Theme-/Preset-Kombinationen;
- Forced Colors und Betriebssystem-Hochkontrast;
- vollständige Tastaturläufe aller Host-/Vote-Phasen;
- alle dynamischen Zustände in allen fünf Locales;
- PAC-Gegenprüfung und manuelle PDF-Reader-Abnahme.

Dieses Dokument ist daher ein belastbares technisches Audit und
Umsetzungsplan, aber **keine Zertifizierung**.

## 4. Bereits umgesetzte Accessibility-Maßnahmen

### 4.1 Semantik und Orientierung

- Skip-Link „Zum Inhalt springen“:
  `apps/frontend/src/app/app.component.html`
- `main`-Landmark und `contentinfo`-Footer:
  `apps/frontend/src/app/app.component.html`
- Banner-Landmark in der Top-Toolbar:
  `apps/frontend/src/app/shared/top-toolbar/top-toolbar.component.html`
- lokalisierte Seitentitel und korrekte `html@lang`-Werte im
  Produktionsbuild;
- Startseiten-Hero als `h1`, Kartentitel als `h2`; Admin-Login als `h1` und
  nachgelagerte Admin-/MOTD-Bereiche als `h2`;
- Skip-Link und Hauptnavigation auch in der Landing-App:
  `apps/landing/src/layouts/BaseLayout.astro`.

### 4.2 Fokus und Tastatur

- Material Strong Focus Indicators:
  `apps/frontend/src/styles.scss`
- globale und komponentenspezifische `:focus-visible`-Zustände;
- gemeinsamer Helper zum Fokussieren und Scrollen auf das erste ungültige
  Formularfeld:
  `apps/frontend/src/app/shared/focus-invalid-field.util.ts`
- Initialfokus und Fokus-Rückgabe für reguläre Material-Dialoge;
- Escape-Unterstützung in mehreren Dialogen und Fullscreen-Ansichten;
- Tastatursteuerung in der Quiz-Vorschau;
- Markdown-Werkzeugleiste mit Zustandsinformationen über `aria-pressed`.

### 4.3 Status- und Fehlermeldungen

- `role="alert"` für Verbindungs- und Formularfehler;
- `role="status"` und `aria-live="polite"` für zahlreiche Live-Zustände;
- `aria-busy`, `aria-invalid` und `aria-describedby` in mehreren
  Formular- und Ladeprozessen;
- verständliche Statuslabels für Serverzustand, Votes und Feedback.

### 4.4 Motion, Reflow und Touch

- globale Regel für `prefers-reduced-motion: reduce`;
- zusätzliche Reduced-Motion-Regeln in Vote, Dialogen, Home und Lightbox;
- Mobile-first-Layouts und ein Playwright-Smoke für 320 CSS-Pixel;
- Reflow-/Fokus-Smoke für fünf Locales, Join, Quiz neu, Hilfe, Legal, Admin und
  Offline-Banner sowie expliziten Desktop-Join-Fokus;
- flexible Dialog-, Bild-, Tabellen- und KaTeX-Breiten;
- 44- bis 48-Pixel-Zielgrößen in wichtigen Interaktionsbereichen.

### 4.5 Nicht nur Farbe

- Richtig/falsch wird in vielen Ergebnisansichten zusätzlich durch Symbole
  oder Text vermittelt;
- Statusanzeigen besitzen überwiegend textuelle Accessible Names;
- Rankings und Heatmaps enthalten zusätzliche Zahlen beziehungsweise
  Beschriftungen;
- der Server-Status-Chart besitzt ein `role="img"` und eine Beschreibung.

### 4.6 Sprache und Internationalisierung

- Angular-i18n für `de`, `en`, `fr`, `es`, `it`;
- lokalisierte Routen und Dokumenttitel;
- lokalisierte Datums- und Zahlenformate;
- zahlreiche `i18n-aria-label`- und `$localize`-Verwendungen;
- produktiver englischer Build mit `html lang="en"` wurde im Audit
  verifiziert.

### 4.7 PDF/UA

Das Repo enthält ein separates PDF/UA-Profil für Session-Ergebnisberichte:

- semantisches HTML als Ausgangspunkt;
- getaggter Playwright-PDF-Export;
- Sprache, Dokumenttitel und XMP-Metadaten;
- Strukturbaum und RoleMap;
- Links mit zugänglichen Beschreibungen;
- reduzierte dekorative Darstellungen für das PDF/UA-Profil;
- Unit-Tests für PDF/UA-Metadaten und PDF-Optionen.

Der geprüfte deutsche Demoexport meldete:

```text
Tagged: yes
Suspects: no
Metadata Stream: yes
```

Dieser initiale `pdfinfo`-Nachweis war positiv, ersetzte aber keine formale
Validierung. Inzwischen prüft veraPDF 1.30.2 die fünf Locale-Demos in CI; alle
bestehen PDF/UA-1. Die Reader-/Screenreader-Abnahme bleibt offen.

### 4.8 Qualitätssicherung

- Angular-Template-A11y-Lint;
- statische und dynamische axe-Scans; alle WCAG-A/AA-Verstöße blockieren
  unabhängig von der axe-Impact-Einstufung;
- Landing-axe-Gate;
- Lighthouse-CI für fünf Routen mit Score 100 und blockierenden
  Einzelaudits einschließlich Gewicht `0`;
- Reflow-, Fokus- und Zielgrößen-Smokes bei 320 CSS-Pixel;
- veraPDF-PDF/UA-1-Gate für fünf Locale-Demos;
- Unit-Tests für ARIA-, Live-Region-, Fokus- und Tastaturverhalten;
- verpflichtende UI-PR-Checkliste und dokumentierte Vorgaben zu Fokus,
  Kontrast, Reduced Motion, Touch-Zielen und Fehlervalidierung.

### 4.9 Persönliche Zeitanpassung

- Teilnehmende können für getimte Fragen `Standard`, `10× Zeit` oder
  `Ohne Timer` wählen;
- Präferenz wird am Participant und auf dem Gerät gespeichert und bei Rejoin
  wiederhergestellt;
- persönliche Deadline und gemeinsamer Session-Timer sind getrennt;
- die persönliche Deadline gilt derzeit nur im Status `ACTIVE`; eine vorzeitige
  Ergebnisfreigabe durch den Host beendet auch angepasste Eingabefenster;
- die Punktelogik bleibt am gemeinsamen Countdown, damit der
  Nachteilsausgleich keinen Zeitbonus erzeugt;
- eine lokale Punktvorschau kennzeichnet die Nachlaufzeit mit festem
  zeitabhängigem Mindestwert;
- der Host sieht vor „Ergebnis zeigen“, wie viele Personen mit
  Zeitanpassung noch antworten, und bleibt für den Ablauf verantwortlich; der
  Hinweis ersetzt keine technische Garantie des persönlichen Zeitfensters.

### 4.10 Accessibility, UX und Design

In der Entwicklungspraxis besteht häufig die Sorge, Barrierefreiheit mache
Oberflächen zwangsläufig unruhiger, langsamer oder weniger attraktiv. Diese
Sorge ist nicht völlig unbegründet: Eine mechanisch ergänzte Beschriftung, ein
schlecht implementierter Fokuswechsel oder doppelte Alternativ-Bedienelemente
können die bestehende UX tatsächlich verschlechtern.

Die richtige Schlussfolgerung ist jedoch nicht, Accessibility zu vermeiden.
Barrierefreiheit ist eine Designanforderung wie Mobile First, Performance oder
Internationalisierung. Sie muss früh in Informationsarchitektur, Komponenten
und Interaktionsmodell einbezogen werden. Nachträgliche Sonderlösungen sind
meist sichtbarer und schlechter als eine von Anfang an inklusive
Standardkomponente.

#### Der Curb-Cut-Effekt

Viele A11y-Maßnahmen helfen auch Menschen ohne Sehbeeinträchtigung. Dieses
Prinzip wird häufig als **Curb-Cut-Effekt** bezeichnet: Abgesenkte Bordsteine
wurden für Rollstühle gebaut, helfen aber ebenso mit Kinderwagen, Fahrrad,
Rollkoffer oder Lieferwagen.

Übertragen auf arsnova.eu:

- **sichtbare Labels** helfen bei Autofill, langen Formularen und dann, wenn
  ein Placeholder während der Eingabe verschwindet;
- **große Zielbereiche** verbessern die Bedienung auf dem Smartphone, in
  Bewegung, bei Kälte oder mit nur einer Hand;
- **Pointer Cancellation** verhindert versehentliches Absenden auch bei
  Touchpads, Touchscreens und unruhiger Umgebung;
- **vollständige Tastaturbedienung** hilft Power-Usern, Lehrenden am
  Präsentationsrechner und Menschen mit temporären Handverletzungen;
- **klare Fokusführung** macht Seitenwechsel und Dialoge berechenbarer;
- **verständliche Fehler- und Statusmeldungen** helfen bei Stress, schlechter
  Verbindung, hoher kognitiver Last und in Live-Lehrsituationen;
- **Reduced Motion** hilft nicht nur bei vestibulären Einschränkungen, sondern
  auch bei Migräne, Konzentration und Präsentationen;
- **redundante Darstellung statt „nur Farbe“** verbessert die Nutzung bei
  Sonnenlicht, schlechten Displays und Projektoren;
- **semantische Überschriften und Landmarks** unterstützen Screenreader,
  Tastaturnavigation, Suchmaschinen und KI-gestützte Reader.

Accessibility betrifft daher nicht nur Blindheit. Motorische, auditive,
kognitive, sprachliche, temporäre und situative Einschränkungen gehören
ebenfalls zum Nutzungskontext.

#### Auswirkungen der bisher umgesetzten Änderungen

| Änderung                                      | Auswirkung auf die bisherige UX                                         | Allgemeiner Nutzen                                                      | Zu prüfendes Risiko                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| sichtbare Labels für Freitext und Kurzantwort | etwas mehr vertikaler Platz; teilweise Wiederholung des Placeholders    | Feldzweck bleibt während der Eingabe sichtbar                           | Dichte und Textwiederholung auf kleinen Viewports                       |
| Vote-Submit bei `click` statt `pointerdown`   | wenige Millisekunden spätere Auslösung                                  | Aktion kann vor dem Loslassen abgebrochen werden; weniger Fehlbedienung | Verhalten exakt am Timerende                                            |
| Sterne als Radiogruppe                        | Maus und Optik bleiben gleich; pro Gruppe nur noch ein Tabstopp         | kürzere Tab-Reihenfolge und erwartbare Pfeiltastenbedienung             | Tastaturmuster und Fokusdarstellung                                     |
| nur ein Tabstopp am Session-Code              | kein visueller Unterschied                                              | weniger unnötige Tastaturschritte                                       | Click auf den visuellen Wrapper muss weiter das Eingabefeld fokussieren |
| Markdown-Felder mit echten Labels             | kein visueller Unterschied, da vorhandene Labels wiederverwendet werden | größere Click-Fläche und verständlicher Feldname                        | eindeutige IDs bei dynamischen Antwortfeldern                           |
| Fokus nach SPA-Navigation                     | für Mausbedienung meist unsichtbar; eventuell sichtbarer Fokusrahmen    | neuer Seitenanfang ist sofort auffindbar und wird angekündigt           | überraschender Fokuswechsel oder konkurrierender Autofokus              |
| Toolbar erscheint bei Tastaturfokus           | beim Durchtabben wird die ausgeblendete Toolbar wieder sichtbar         | fokussierte Controls bleiben sichtbar und bedienbar                     | unerwartete Bewegung; Reduced Motion beachten                           |
| Focus Traps in modalen Overlays               | Optik bleibt gleich; Initialfokus kann als Fokusrahmen sichtbar sein    | Tab bleibt im Dialog; Hintergrundbedienung wird verhindert              | unerwarteter Initialfokus oder nicht erreichbarer Schließen-Button      |
| Fokus-Rückgabe nach Dialogende                | normalerweise unsichtbar                                                | Arbeit wird am auslösenden Control fortgesetzt                          | Auslöser kann während des Dialogs aus dem DOM verschwinden              |
| inerte Hintergründe bei MOTD und Tempo-Hilfe  | Hintergrund reagiert während des Dialogs nicht                          | verhindert versehentliche Eingaben und unklare Fokuswechsel             | Overlay muss auf allen Viewports zuverlässig schließbar bleiben         |
| persönliche Zeitanpassung                     | zusätzlicher kompakter MD3-Bereich in der Vote-Ansicht                  | individuelle Bedienzeit ohne Änderung des gemeinsamen Quizablaufs       | Verständlichkeit, Platzbedarf und Screenreader-Ausgabe                  |
| lokale Punktvorschau                          | sichtbare Zahl neben dem Countdown                                      | zeitabhängige Wertung wird vor der Abgabe transparent                   | keine irreführende Aussage in der Nachlaufzeit oder Live-Region-Spam    |
| Host-Hinweis auf offene Zeitfenster           | zusätzliche Statuskarte oberhalb der Ergebnisaktion                     | Host trifft eine informierte Entscheidung über das Ende der Eingabe     | Aktionsleiste darf bei Zoom und Mobile nicht verdeckt werden            |
| Offline-Banner verschiebt fixe Toolbar        | Toolbar liegt bei Offline-Zustand etwas tiefer                          | Logo, Einstellungen und Fokus bleiben sichtbar                          | dynamische Bannerhöhe und lange Übersetzungen                           |

Der lokalisierte Build und Unit-Tests sichern Semantik und Verhalten ab, können
aber keine visuelle Freigabe ersetzen. Insbesondere die neuen sichtbaren
Vote-Labels und das Timer-Grenzverhalten benötigen einen manuellen
Browser-Smoke.

#### Fortlaufendes A11y-UX-Änderungsprotokoll

Dieses Protokoll wird mit jedem Umsetzungsschritt ergänzt. Es dokumentiert
nicht nur den WCAG-Fix, sondern auch die Wirkung auf bestehende Bedienung und
Gestaltung. Das separate
[`ACCESSIBILITY-UMSETZUNGSJOURNAL.md`](./ACCESSIBILITY-UMSETZUNGSJOURNAL.md)
führt zusätzlich Buch über konkrete Dateien, Verhaltensänderungen,
Prüfergebnisse, offene manuelle Abnahmen sowie spätere PR- und
Commit-Referenzen.

| Datum      | Planschritt                      | UX-/Designwirkung                                                                                                                        | Absicherung                                                                                |
| ---------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 2026-07-19 | PR 1 – Semantik und Eingaben     | sichtbare Vote-Labels benötigen mehr Höhe; Tab-Reihenfolge wird kürzer; Submit erfolgt erst bei `click`                                  | Komponenten- und Gesamttests, lokalisierter Build; Mobile- und Timer-Smoke noch manuell    |
| 2026-07-19 | PR 2 – Navigation und Fokus      | Seitenwechsel erhalten einen logischen Fokus; versteckte Toolbar erscheint beim Durchtabben                                              | Fokus-Unit-Tests, Gesamttests und lokalisierter Build; 400-%-Zoom bleibt manuell           |
| 2026-07-19 | PR 3 – Dialoge und Overlays      | modale Optik bleibt bestehen; Tastaturfokus wird eingeschlossen, Hintergrund bei MOTD/Tempo inert und Fokus nach Schließen zurückgegeben | Focus-Trap-, Escape- und Rückkehrtests; visuelle Mobile-Prüfung bleibt erforderlich        |
| 2026-07-19 | PR 4 – Interaktion und Struktur  | Reorder- und Lightbox-Buttons ergänzen sichtbare Controls; Markdown und Wortwolken erhalten stabilere Informationsstrukturen             | Komponenten-, i18n- und Build-Prüfungen; Zielgrößen, Zoom und Screenreader bleiben manuell |
| 2026-07-20 | PR 9 – AA-Restblocker            | Headings bleiben optisch stabil; strengere Gates machen bisher verdeckte Fehler sichtbar; Offline-Toolbar erhält sicheren Abstand        | PR #101: Lighthouse, Playwright, axe, Typecheck, Tests, CodeQL und Trivy grün              |
| 2026-07-20 | PR 9b – Timer-Nachteilsausgleich | persönlicher MD3-Timerbereich, lokale Punktvorschau und Host-Hinweis ergänzen den Live-Ablauf ohne Änderung der Fairness                 | PR #101 automatisch grün; Host-Freigabe kann angepasste Eingabefenster weiterhin beenden   |

Der CDK Focus Trap erhöht die betroffenen Lazy Chunks im bisherigen
Buildvergleich jeweils nur grob um weniger als 2 kB Rohgröße. Das Initial
Bundle blieb durch diesen Schritt unverändert. Auch technische Auswirkungen
wie Bundle-Größe und Laufzeitkosten gehören in die fortlaufende Bewertung.

#### Mögliche Auswirkungen der noch offenen Abnahmen

- **Screenreader-Nachprüfungen** können zu kürzeren Statusmeldungen oder einer
  angepassten Ansagereihenfolge führen.
- **echter 200-/400-%-Zoom** kann zusätzliche Abstände für Sticky- und
  Bottom-Aktionen erfordern.
- **größere Touch-Ziele** können mehr Platz beanspruchen, reduzieren aber
  Fehlbedienung für alle Mobile-Nutzer:innen.
- **lange Übersetzungen** können kompaktere Beschriftungen oder bewusst
  mehrzeilige Controls erfordern.
- **Timer- und Host-Hinweise** müssen informativ bleiben, ohne den
  zeitkritischen Live-Ablauf visuell zu überladen.
- **stärkere Kontraste und Fokusindikatoren** verändern das visuelle Gewicht,
  schaffen aber auch auf Beamern, älteren Displays und im Freien mehr
  Klarheit.

#### Gestaltungsregeln für inklusive UX

1. **Keine parallele „A11y-Oberfläche“ bauen.** Dieselbe Komponente soll für
   alle verständlich und bedienbar sein.
2. **Native und etablierte Komponenten bevorzugen.** Sie benötigen weniger
   Sonderlogik und wirken konsistenter.
3. **Sichtbare Labels in das Layout einplanen.** Nicht nachträglich als
   zusätzliche Textzeile anhängen, wenn eine vorhandene Überschrift oder
   Legende genutzt werden kann.
4. **Alternativen kompakt integrieren.** Reorder-Buttons dürfen kontextuell
   erscheinen, müssen aber ohne Hover erreichbar bleiben.
5. **Fokus nur aus einem nachvollziehbaren Anlass verschieben.** Navigation,
   Dialogöffnung und Validierungsfehler sind solche Anlässe; gewöhnliche
   Inhaltsupdates meist nicht.
6. **Nutzerpräferenzen respektieren.** Reduced Motion reduziert nicht die
   gesamte Gestaltung, sondern vermeidet unnötige Bewegung.
7. **Nicht nur technisch abnehmen.** Mobile, Tastatur, Screenreader, Zoom,
   Übersetzungslängen und visuelle Hierarchie gemeinsam prüfen.
8. **Fachliche Eigenschaften bewahren.** Bei Timern, Abstimmungen und
   Live-Phasen darf ein A11y-Fix Fairness oder Zuverlässigkeit nicht
   unbeabsichtigt verändern.

#### UX-Abnahme für jeden A11y-Pull-Request

- [ ] Desktop und Mobile visuell geprüft
- [ ] normale Maus-/Touch-Bedienung unverändert oder bewusst verbessert
- [ ] vollständiger Tastaturpfad geprüft
- [ ] Fokus erscheint nur an erwartbaren Stellen und bleibt sichtbar
- [ ] lange Übersetzungen in `de`, `en`, `fr`, `es`, `it` berücksichtigt
- [ ] Reduced Motion und Dark/Light geprüft
- [ ] keine unnötige Text- oder Button-Dopplung
- [ ] zeitkritische und fachliche Abläufe separat getestet
- [ ] Vorher/Nachher-Auswirkung im Pull Request beschrieben

## 5. Bestätigte A/AA-Defekte – historischer Befundbestand

Die Einträge beschreiben Ausgangsbefunde und ihren aktuellen Status. Bis auf
5.13 sind die bestätigten technischen Defekte geschlossen. Offene manuelle
Nachweise stehen in Abschnitt 6 und in den beiden Prüfmatrizen.

### 5.1 Aktion bereits beim Drücken des Zeigers

**WCAG:** 2.5.2 Pointer Cancellation, Level A  
**Evidenz:** `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`,
Methode `onVoteSubmitPointerDown`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #89). Der
`pointerdown`-Handler wurde entfernt; die Abstimmung wird ausschließlich über
den nachgelagerten `click` ausgelöst. Ein Regressionstest deckt
`pointerdown`/`pointercancel` und den anschließenden Click ab.

**Ausgangsbefund:** Die Abstimmung wurde bereits beim `pointerdown` ausgelöst. Nutzer:innen konnten
die Aktion nicht abbrechen, indem sie den Zeiger vor dem Loslassen vom Ziel
wegbewegen.

**Umgesetzt:** Die fachliche Aktion wird über `click` ausgelöst.

### 5.2 Markdown-Textarea ohne programmatische Beschriftung

**WCAG:** 1.3.1, 3.3.2 und 4.1.2, Level A  
**Evidenz:**
`apps/frontend/src/app/shared/markdown-katex-editor/markdown-katex-editor.component.html`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #89). Der Editor
verlangt eine eindeutige `fieldId`; alle Einbindungsstellen verknüpfen damit
ihre sichtbaren Labels direkt mit der internen `textarea`.

**Ausgangsbefund:** Die interne `textarea` erhielt weder ein `label` noch `aria-label` oder
`aria-labelledby`. Ein `aria-label` am Angular-Komponenten-Host wird nicht
automatisch auf die innere `textarea` übertragen.

**Umgesetzt:** Eine explizite Editor-API bindet die sichtbare
Feldbeschriftung direkt an die `textarea`.

### 5.3 Vote-Freitext und Kurzantwort nur mit Placeholder

**WCAG:** 1.3.1 und 3.3.2, Level A  
**Evidenz:**
`apps/frontend/src/app/features/session/session-vote/session-vote.component.html`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #89). Beide
Eingaben besitzen persistente sichtbare Labels; der Kurzantwort-Zähler ist über
`aria-describedby` zugeordnet.

**Ausgangsbefund:** Die Eingaben für `FREETEXT` und `SHORT_TEXT` besaßen lediglich einen
Placeholder. Placeholder verschwinden während der Eingabe und sind kein
Ersatz für eine persistente Beschriftung.

**Umgesetzt:** Sichtbare Labels sind technisch verknüpft; Zähler und Fehler
werden über `aria-describedby` zugeordnet.

### 5.4 Inkonsistente Sterne-Radiogruppe

**WCAG:** 4.1.2 Name, Role, Value, Level A  
**Evidenz:**
`apps/frontend/src/app/features/session/session-vote/session-vote.component.html`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #89). Die Sterne
verwenden nun `role="radio"`, `aria-checked`, roving `tabindex` sowie
Pfeil-, Pos1- und Ende-Tasten.

**Ausgangsbefund:** Der Container verwendete `role="radiogroup"`, seine Kinder waren jedoch normale
Buttons mit `aria-pressed`. Damit stimmen übergeordnete Rolle,
Kindrollen und Zustandsmodell nicht überein.

**Umgesetzt:** Die Sterne verwenden ein vollständiges Radiogruppen-Pattern.

### 5.5 Custom-Overlays ohne vollständiges modales Fokusmodell

**WCAG:** 2.1.1, 2.4.3 und 4.1.2, Level A  
**Evidenz unter anderem:**

- `apps/frontend/src/app/features/home/home.component.html`
- `apps/frontend/src/app/shared/preset-toast/preset-toast.component.html`
- `apps/frontend/src/app/features/feedback/feedback-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #89). MOTD,
Preset-Konfiguration, Tempo-Hilfe sowie die Beitritts-Overlays von Feedback-
und Session-Host verwenden CDK Focus Traps mit Initialfokus. Escape,
Backdrop-Schließen und Fokus-Rückgabe sind abgesichert. MOTD und Tempo-Hilfe
setzen ihren Hintergrund zusätzlich auf `inert`. Der Session-Endzustand wird
nicht mehr fälschlich als modaler Dialog ausgezeichnet.

**Ausgangsbefund:** Mehrere Eigenimplementierungen sahen modal aus und sperrten Pointerinteraktion
im Hintergrund, verwendeten aber kein durchgängiges Focus-Trap-/Inert-Modell.
Beim produktiven MOTD-Overlay war ein Eingabefeld hinter dem Overlay
fokussiert.

**Umgesetzt:** Die Eigenimplementierungen besitzen Initialfokus, Focus Trap,
passende modale Semantik, inerten Hintergrund, Escape und Fokus-Rückgabe.

### 5.6 Fokusverlust nach SPA-Navigation

**WCAG:** 2.4.3 Focus Order, Level A  
**Evidenz:** `apps/frontend/src/app/app.component.ts`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #89).
Folge-Navigationen scrollen den primären Container nach oben und fokussieren
die neue Hauptüberschrift, ersatzweise das `main`-Landmark. Initial- und
Fragmentnavigationen werden ausgenommen; das Landmark ist zugleich ein
verlässliches Skip-Link-Ziel.

**Ausgangsbefund:** Nach einer clientseitigen Navigation von „Quiz erstellen“ zur Quiz-Liste fiel
der Fokus im Browser auf `body`. Der Router scrollt zwar an den Anfang, setzt
aber keinen neuen logischen Fokus.

**Umgesetzt:** Eine zentrale Router-Fokusstrategie fokussiert nach
Folgenavigationen die neue Hauptüberschrift oder `main` und nimmt die
Initialnavigation aus.

### 5.7 Sichtbares Label fehlt im Accessible Name

**WCAG:** 2.5.3 Label in Name, Level A  
**Evidenz:** `apps/frontend/src/app/features/home/home.component.html`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #89). Das
abweichende `aria-label` wurde entfernt; der sichtbare Buttontext bildet nun
auch den Accessible Name.

**Ausgangsbefund:** Der sichtbare CTA lautete „Los geht's“, sein Accessible Name war
„Teilnehmen“. Sprachsteuerung kann den sichtbaren Wortlaut deshalb nicht
zuverlässig verwenden.

**Umgesetzt:** Der sichtbare Wortlaut bildet vollständig den Accessible Name.

### 5.8 Doppelter, unbenannter Tabstopp am Session-Code

**WCAG:** 2.4.3 und 4.1.2, Level A  
**Evidenz:** `apps/frontend/src/app/features/home/home.component.html`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #89). Wrapper-
`tabindex` und Wrapper-Tastaturhandler wurden entfernt; nur das native
Eingabefeld bleibt in der Tab-Reihenfolge.

**Ausgangsbefund:** Vor dem eigentlichen Textfeld lag ein `div` mit `tabindex="0"`, Click- und
Tastaturhandlern, aber ohne Rolle und Namen. Anschließend folgt das native
Textfeld als zweiter Tabstopp.

**Umgesetzt:** Nur das native `input` bleibt fokussierbar.

### 5.9 Markdown kann die Überschriftenhierarchie brechen

**WCAG:** 1.3.1 Info and Relationships, Level A  
**Evidenz:**
`apps/frontend/src/assets/demo/quiz-demo-showcase.de.json`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #90).
Markdown-Überschriften werden relativ zum jeweiligen Einbettungskontext
gestaffelt und durch einen Regressionstest abgesichert.

**Ausgangsbefund:** Die gebündelte Demo enthielt eine Markdown-H1 innerhalb eines bereits durch H2
strukturierten Kartenkontexts. Importierte oder selbst erstellte Inhalte können
dadurch die Seitenhierarchie ebenfalls verändern.

**Umgesetzt:** Markdown-Überschriften werden abhängig vom Einbettungskontext
gestaffelt.

### 5.10 Vollständig ausgeblendete Toolbar bleibt fokussierbar

**WCAG:** 2.4.11 Focus Not Obscured (Minimum), Level AA  
**Evidenz:**
`apps/frontend/src/app/shared/top-toolbar/top-toolbar.component.scss`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #89). `focusin`
setzt den Hidden-State im App-Shell zurück; `:focus-within` macht die Toolbar
bereits im selben Rendering-Zyklus sichtbar.

**Ausgangsbefund:** Die ausgeblendete Toolbar wurde per `transform` vollständig aus dem Viewport
geschoben. Ihre Controls bleiben grundsätzlich Bestandteil der
Tab-Reihenfolge.

**Umgesetzt:** Die Toolbar wird bei `focusin` sofort eingeblendet.

### 5.11 Drag-and-drop ohne Ein-Zeiger-Alternative

**WCAG:** 2.5.7 Dragging Movements, Level AA  
**Evidenz:**
`apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.html`

**Umsetzungsstand 2026-07-19:** Auf `main` behoben (PR #90). Sichtbare
44-Pixel-Buttons verschieben Fragen nach oben oder unten; dieselben Aktionen
sind per Tastatur erreichbar und eine Live-Region kündigt die neue Position an.

Im Ausgangsstand wurden Fragen ausschließlich über CDK Drag-and-drop
umsortiert. Sichtbare „Nach oben“-/„Nach unten“-Aktionen und eine verständliche
Positionsansage fehlten.

**Ursprünglich erforderlich:** Buttons oder ein anderes Single-Pointer- und
Tastaturverfahren ergänzen und die neue Position nach der Aktion verständlich
ankündigen.

### 5.12 Nicht vollständig lokalisierte assistive Texte

**WCAG:** 3.1.2 Language of Parts, Level AA  
**Evidenz unter anderem:**
`apps/frontend/src/app/features/session/session-host/session-host.component.html`

**Status 2026-07-19:** Auf `main` umgesetzt (PR #90). Die inventarisierten
statischen und dynamischen Accessible Names werden über Angular i18n oder
`$localize` erzeugt. Dazu gehören Countdown, Q&A-Voting, Quiz-Antwortaktionen,
Aktionsgruppen, Inhaltsnavigation, Preset-Status und Lightbox. Alle fünf
Locale-Dateien sind synchron; maschinell unpassende Übersetzungen wurden
fachlich korrigiert. Die Laufzeitprüfung mit Screenreadern in allen Locales
bleibt Teil von PR 7.

**Ausgangsbefund:** Einige ARIA-Texte wurden als feste deutsche Strings zusammengesetzt, zum
Beispiel der Host-Countdown. In nichtdeutschen Builds kann dadurch eine
anderssprachige Phrase ohne Sprachkennzeichnung entstehen.

**Umgesetzt:** Alle inventarisierten sichtbaren und assistiven Texte werden
über Angular i18n oder `$localize` geführt und in allen fünf Locale-Dateien
gepflegt.

### 5.13 Keine persönliche Anpassung aktiver Quiz-Timer

**WCAG:** 2.2.1 Timing Adjustable, Level A

**Evidenz:** Vote-Deadline in
`apps/backend/src/routers/vote.ts` und Vote-UI in
`apps/frontend/src/app/features/session/session-vote/`

**Umsetzungsstand 2026-07-20:** Teilweise umgesetzt, Konformitätsrisiko offen
(PR #101). Teilnehmende können `10× Zeit` oder `Ohne Timer` wählen. Solange die
Frage `ACTIVE` ist, setzt das Backend die persönliche Deadline durch; Scoring
und gemeinsamer Ablauf bleiben am Session-Timer. Der Host erhält einen Hinweis
auf noch offene angepasste Eingabefenster.

Wechselt der Host vor Ablauf dieser Fenster zu `RESULTS` oder `DISCUSSION`,
weist das Backend weitere Antworten zurück. Bei `EXTENDED` liegt der
Statuswechsel dann vor der persönlichen Deadline; bei `OFF` existiert keine
Deadline, die eine Abgabe außerhalb von `ACTIVE` erlauben könnte. Der
Host-Hinweis ist damit eine informierte Ablaufentscheidung, aber keine
technische Garantie des Nachteilsausgleichs.

**Ausgangsbefund:** Für getimte Fragen gab es nur den gemeinsamen Host-Timer.
Eine globale timerlose Session war möglich, aber kein persönlicher
Nachteilsausgleich während einer getimten Veranstaltung.

**Umgesetzt:** Schema-first-Erweiterung von Prisma, Shared Contracts, tRPC,
Vote-Deadline, MD3-Segmented-Control, Punktvorschau und Host-Fortschritt.

**Noch erforderlich:** Entweder muss der Statuswechsel offene persönliche
Fenster technisch respektieren, oder eine beanspruchte Ausnahme für
zeitkritische Echtzeitereignisse muss fachlich begründet, eng abgegrenzt und
manuell gegen WCAG 2.2.1 bewertet werden. Eine Vote-Annahme nach sichtbarer
Ergebnisfreigabe darf dabei keine Lösungsdaten oder Wertungsvorteile eröffnen.

### 5.14 Unvollständige Überschriftenhierarchie auf Home und Admin

**WCAG:** 1.3.1 Info and Relationships und 2.4.6 Headings and Labels

**Evidenz:**
`apps/frontend/src/app/features/home/home.component.html` und
`apps/frontend/src/app/features/admin/`

**Umsetzungsstand 2026-07-20:** Auf `main` behoben (PR #101). Der
Startseiten-Hero ist das `h1`, Kartentitel sind `h2`; Admin-Login und
nachgelagerte Admin-/MOTD-Bereiche besitzen eine nachvollziehbare
`h1`-/`h2`-Struktur.

**Ausgangsbefund:** Visuelle Kartentitel verwendeten Material-Titelklassen,
bildeten aber nicht durchgängig die semantische Seitenhierarchie ab.

**Umgesetzt:** Semantische Heading-Elemente bei unveränderter visueller
Material-Darstellung und Regressionstests für die Startseite.

## 6. Weitere Risiken und noch erforderliche Nachweise

Die folgenden Punkte sind nicht automatisch als Verstoß zu werten, müssen vor
einer AA-Freigabe aber gezielt geprüft werden:

| Prüfbereich      | Nachweis                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Kontrast         | 4,5:1 für normalen Text, 3:1 für große Schrift sowie 3:1 für UI-Komponenten und Fokusindikatoren |
| Reflow           | keine Funktions- oder Informationsverluste bei 320 CSS-Pixel und 400 % Zoom                      |
| Zielgröße        | 2.5.8 einschließlich 24-Pixel-Minimum und Abstands-Ausnahmen auf allen Controls                  |
| Fokus verdeckt   | Sticky Header, Bottom-Actions, Snackbars, virtuelle Tastatur und Overlays                        |
| Tastatur         | vollständige Kernprozesse ohne Maus oder Touch                                                   |
| Screenreader     | NVDA/Firefox und VoiceOver/Safari, insbesondere Live-Phasen und Dialoge                          |
| Statusmeldungen  | weder fehlende noch übermäßig häufige Ansagen                                                    |
| Wortwolke/Charts | textuelle Alternativen für Häufigkeit, Rang und Datenbeziehungen                                 |
| High Contrast    | Forced Colors und Betriebssystem-Hochkontrast                                                    |
| Timing           | Host-Freigabe beendet angepasste Fenster; 2.2.1 technisch schließen oder Ausnahme begründen      |
| Locales          | alle Kernflows in `de`, `en`, `fr`, `es`, `it`                                                   |
| PDF/UA           | veraPDF/PAC, Tagstruktur, Lesereihenfolge, Links und Alternativtexte                             |

## 7. Lücken in Tooling und Prozess

### 7.1 Historischer Ausgangsstand vor PR #91 und PR #92

Die folgende Liste beschreibt den Stand des initialen Audits, nicht den
aktuellen Zustand auf `main`:

- Lighthouse-CI prüfte nur die Startseiten `/de/` und `/en/`.
- Der Mindestscore betrug 90 statt vollständiger Fehlerfreiheit.
- Fehlgeschlagene, aber ungewichtete Audits konnten den Score unverändert
  lassen.
- Es gab kein `@axe-core/playwright`, pa11y oder `vitest-axe`.
- ESLint prüfte keine Angular-HTML-Templates auf Accessibility-Regeln.
- Die funktionalen Playwright-Smokes enthielten keinen systematischen
  Accessibility-Scan.
- Die Landing-App besaß kein Accessibility-Gate.
- Das PDF/UA-Profil wurde nicht mit einem externen Validator in CI geprüft.
- Der dokumentierte Projektstandard war WCAG 2.1 AA; Story 6.5 war offen.

**Aktueller Status 2026-07-20:** Die Tooling-Lücken wurden mit PR #91, PR #92
und PR #101 geschlossen:
Template-Lint, axe, Lighthouse-Einzelaudits, Landing-Gate, dynamische Smokes
und veraPDF sind blockierende CI-Prüfungen. Der dokumentierte Zielstandard
wurde auf WCAG 2.2 AA aktualisiert. axe blockiert alle WCAG-A/AA-Verstöße
unabhängig vom Impact; Lighthouse blockiert auch fehlgeschlagene Audits mit
Gewicht `0`. Story 6.5 bleibt bis zur vollständigen manuellen PR-7-,
PR-101- und Reader-Abnahme offen.

### 7.2 Bedeutung für die Lehre

Dieser Stand eignet sich gut, um drei Qualitätsprinzipien zu zeigen:

1. **Automation ist notwendig, aber nicht vollständig.**
2. **Ein Score kann relevante Fehler verdecken.**
3. **Accessibility muss als Prozess über Entwicklung, Review, CI und manuelle
   Abnahme organisiert werden.**

## 8. Umsetzungsplan

Die technische Umsetzung erfolgte in kleinen, unabhängig prüfbaren Pull
Requests: zuerst Level-A-Defekte, anschließend AA-Interaktionen, dauerhafte
Gates, PDF/UA und die Restblocker aus der Nachprüfung. Der tatsächliche
Arbeitsstand wird im
[`Accessibility-Umsetzungsjournal`](./ACCESSIBILITY-UMSETZUNGSJOURNAL.md)
fortlaufend protokolliert.

### PR 1 – Kritische Semantik und Eingaben

**Status 2026-07-19:** Punkte 1 bis 6 auf `main` umgesetzt (PR #89) und mit
Frontend-Tests, Typecheck sowie lokalisiertem Produktionsbuild validiert.

**Umfang**

1. Abstimmung nicht mehr bei `pointerdown` absenden.
2. Markdown-Textarea technisch beschriften.
3. sichtbare Labels für Freitext und Kurzantwort ergänzen.
4. Sternebewertung semantisch konsistent umsetzen.
5. doppelten Tabstopp am Session-Code entfernen.
6. sichtbares und assistives Label des Home-CTAs angleichen.
7. Ergebnis-Icons auf redundante oder missverständliche Screenreader-Ausgabe
   prüfen.

**Abnahme**

- reine Tastaturbedienung;
- keine Label-, Name- oder ARIA-Verstöße in axe/Lighthouse;
- fokussierte Unit-Tests für Pointer Cancellation, Labels und Radiotastatur;
- lokalisierter Produktionsbuild.

### PR 2 – Fokus und SPA-Navigation

**Status 2026-07-19:** Zentrale Fokusstrategie, Skip-Link-Ziel und
Toolbar-Wiederanzeige auf `main` umgesetzt (PR #89). Die fixierten
Vote-/Host-Aktionsleisten besitzen bereits zustandsabhängige
Bottom-Padding-Reserven; die manuelle Abnahme bei 400 % Zoom bleibt Bestandteil
von PR 7.

**Umfang**

1. zentrale Router-Fokusstrategie implementieren;
2. Initialnavigation von Fokusverschiebung ausnehmen;
3. neue Seitenüberschrift oder `main` fokussieren;
4. Seitentitelwechsel verständlich ankündigen;
5. ausgeblendete Toolbar bei Fokus wieder einblenden;
6. Sticky Header, Bottom-Actions und Snackbars gegen 2.4.11 prüfen.

**Abnahme**

- Home → Quiz → Bearbeiten → Zurück ohne Fokusverlust;
- Fokus bleibt bei 400 % Zoom sichtbar;
- dokumentierte Tests für 2.4.3, 2.4.7 und 2.4.11.

### PR 3 – Dialoge und Overlays

**Status 2026-07-19:** Custom-Overlays inventarisiert und auf `main` mit CDK
Focus Trap, Initialfokus, Escape sowie Fokus-Rückgabe abgesichert (PR #89).
Die bestehende visuelle Gestaltung wurde beibehalten; die
manuelle Mobile- und Screenreader-Abnahme bleibt Bestandteil von PR 7.

**Umfang**

1. alle Custom-Overlays inventarisieren;
2. soweit möglich auf Material/CDK Dialog migrieren;
3. Initialfokus und Focus Trap einführen;
4. Hintergrund inert setzen;
5. Escape und Fokus-Rückgabe absichern;
6. modale Rolle und Beschriftung konsistent setzen.

**Abnahme**

- Fokus kann den offenen Dialog nicht verlassen;
- Hintergrund ist nicht im Accessibility Tree bedienbar;
- Öffnen, Schließen und Rückkehr zum Auslöser funktionieren per Tastatur;
- Overlay-Tests für Desktop und Mobile.

### PR 4 – WCAG-2.2-Interaktionen und Inhaltsstruktur

**Status 2026-07-19:** Auf `main` umgesetzt (PR #90). Fragen lassen sich über
44-Pixel-Buttons sortieren und ihre neue Position wird angekündigt.
Markdown-Überschriften werden relativ zum Einbettungskontext normalisiert,
Wortwolken besitzen eine textuelle Rang-/Häufigkeitsliste, die mobile
Landing-Navigation nutzt Listen- statt Menürollen und die Lightbox bietet
klickbare Zoom-/Pan-Alternativen. Alle neuen assistiven Texte wurden für
`de`, `en`, `fr`, `es` und `it` synchronisiert. Die manuelle
Screenreader-, Reflow- und Zielgrößenabnahme bleibt Bestandteil von PR 7.

**Umfang**

1. „Nach oben“-/„Nach unten“-Alternative zum Dragging ergänzen;
2. neue Position über eine Live-Region ankündigen;
3. Markdown-Überschriften kontextbezogen staffeln;
4. Wortwolken um textuelle Häufigkeits-/Ranginformationen ergänzen;
5. Landing-`role="menu"` durch normale Navigationssemantik ersetzen;
6. Zielgrößen systematisch prüfen;
7. Lightbox-Zoom und -Pan auf eine Alternative ohne Dragging prüfen.

**Abnahme**

- Fragen vollständig ohne Dragging sortierbar;
- stabile Überschriftenhierarchie;
- Abnahme von 1.3.1, 2.5.7 und 2.5.8.

### PR 5 – i18n assistiver Texte

**Status 2026-07-19:** Auf `main` automatisch validiert (PR #90). Harte
deutsche beziehungsweise englische Accessible Names wurden entfernt,
bestehende statische Messages erhielten stabile IDs und neue dynamische Texte
wurden mit Singular-/Pluralvarianten ergänzt. Klickbare Markdown-Bilder sind
zusätzlich per Tastatur erreichbar und benennen ihre Vollansicht-Aktion. Die
vier Zielkataloge enthalten 2.351 von 2.351 Quell-Einheiten; 964
Frontend-Tests, Typecheck, ESLint und der lokalisierte Produktionsbuild sind
erfolgreich. Eine manuelle Screenreader-Abnahme steht weiterhin aus.

**Umfang**

1. statische und dynamische ARIA-Texte inventarisieren;
2. alle Texte über `i18n-aria-label` oder `$localize` führen;
3. Host-Countdown, Drag-Controls und Q&A-Aktionen korrigieren;
4. alle fünf Locale-Dateien synchronisieren.

**Abnahme**

- keine deutsche assistive Beschriftung in nichtdeutschen Builds;
- `html@lang` je Locale verifiziert;
- `npm run build:localize -w @arsnova/frontend`.

### PR 6 – Automatisierte Qualitätssicherung

**Status:** automatisch validiert auf `main` (PR #91, 2026-07-19).
Angular-Template-A11y-Lint, statische und dynamische axe-Scans, Landing-Gate,
Audit-Level-Lighthouse sowie
Reflow-, Fokus- und Zielgrößen-Smokes sind in npm-Skripte und CI integriert.
Die lokalen Nachweise umfassen zwölf statische Frontend-Zustände, drei
Landing-Seiten, zehn Unified-Session-Zustände, vier SHORT_TEXT-Zustände und fünf
Lighthouse-A11y-Routen mit Score 100 ohne fehlgeschlagenes
Accessibility-Audit. PR #101 erweiterte den Reflow-/Fokus-Smoke auf
15 Zustände plus den expliziten Desktop-Join-Fokus. Automatisierte Prüfungen
ersetzen die manuelle Matrix aus PR 7 nicht.

**Umfang**

1. Angular-Template-A11y-Lint einführen;
2. `@axe-core/playwright` in Kernflows integrieren;
3. statische und dynamische Kernrouten prüfen;
4. Landing-A11y-Gate ergänzen;
5. Lighthouse nicht nur nach Kategorien-Score bewerten;
6. alle fehlgeschlagenen Accessibility-Audits als CI-Fehler behandeln;
7. Viewport-, Zoom- und Zielgrößen-Smokes erweitern.

**Mindestrouten und -zustände**

- Home in Deutsch und Englisch;
- Quiz-Liste, Quiz neu und Quiz bearbeiten;
- Join und Lobby;
- Vote aktiv, Ergebnis und Session-Ende;
- Host, Q&A und Blitzlicht;
- Hilfe und Legal;
- Fehler-, Offline-, Lade- und Leerzustände.

**Abnahme**

- keine serious/critical axe-Verstöße;
- kein fehlgeschlagenes Lighthouse-Accessibility-Audit;
- CI blockiert bekannte Regressionen.

### PR 7 – Manuelle Abschlussprüfung

**Status 2026-07-20:** in Arbeit. Die allgemeine und die
PR-101-spezifische ausführbare Matrix sind konkretisiert.
Browserprüfungen für Tastatur, 320-CSS-Pixel-Reflow, Fokus, Zielgrößen,
zusätzliche Locale-Routen sowie emuliertes Reduced Motion und Forced Colors
wurden durchgeführt. Dabei wurden Initialfokus, Skip-Link, der delegierte
Fokusindikator des Session-Codes und die Fokussteuerung der mobilen
Einstellungen verbessert und regressionsgesichert. Echte Prüfungen mit
VoiceOver/Safari, NVDA/Firefox, 200-/400-Prozent-Browser-Zoom und
Windows-High-Contrast stehen aus. PR 7 und damit die formale
WCAG-2.2-AA-Abnahme sind deshalb noch nicht abgeschlossen.

**Prüfmatrix**

- Tastatur-only;
- VoiceOver/Safari;
- NVDA/Firefox;
- 200 % und 400 % Zoom;
- 320 CSS-Pixel Reflow;
- Light/Dark und beide Presets;
- Reduced Motion;
- High Contrast/Forced Colors;
- alle Kernzustände und Locales.

Die konkrete Durchführung, die bereits erhobenen Nachweise, die behobenen
Befunde und die verbleibenden externen Abnahmeschritte stehen im
[`ACCESSIBILITY-UMSETZUNGSJOURNAL.md`](./ACCESSIBILITY-UMSETZUNGSJOURNAL.md)
unter „PR 7 – Manuelle Abschlussprüfung“. Die allgemeine
[`manuelle Prüfmatrix`](./ACCESSIBILITY-MANUELLE-PRUEFMATRIX.md) wird durch die
[`PR-101-Prüfmatrix`](./ACCESSIBILITY-MANUELLE-PRUEFMATRIX-PR101.md) mit
25 konkreten Fällen für Timer, Host-Hinweis, Fokus, Reflow, Semantik und i18n
ergänzt.

**Abnahme**

Jeder Befund enthält:

- Route und Zustand;
- WCAG-Kriterium;
- erwartetes und beobachtetes Verhalten;
- Schweregrad;
- Reproduktionsschritte;
- Status und Regressionstest.

### PR 8 – PDF/UA und Dokumentation

**Status 2026-07-19:** automatisch validiert auf `main` (PR #92). veraPDF
1.30.2 prüft die fünf Locale-Demos in einem eigenen CI-Gate gegen PDF/UA-1. Ein dabei ausschließlich
im französischen Bericht gefundener Verstoß durch nicht eingebettete
Standardfonts im visuellen Fortsetzungsstempel wurde behoben. Alle fünf
Dateien bestehen das PDF/UA-1-Profil. Das strukturelle und visuelle
Prüfprotokoll steht in
[`ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md`](./ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md).
Reader-/Screenreader-Prüfungen mit VoiceOver und NVDA sowie ein optionaler
PAC-Gegencheck bleiben offen.

**Umfang**

1. veraPDF oder PAC in Release- beziehungsweise CI-Prüfung integrieren;
2. reale PDF/UA-Exporte aller Locales validieren;
3. Tags, Lesereihenfolge, Alternativtexte und Links manuell prüfen;
4. Projektstandard auf WCAG 2.2 AA aktualisieren;
5. Story 6.5 erst nach vollständiger Abnahme schließen.

**Abnahme**

- externer PDF/UA-Validator ohne relevante Fehler;
- dokumentiertes manuelles PDF-Protokoll;
- aktualisierte Qualitäts- und Testdokumentation.

### PR 9 – WCAG-AA-Restblocker und Timer-Nachteilsausgleich

**Status 2026-07-20:** Auf `main` umgesetzt und automatisch validiert
(PR #101), mit offenem Konformitätsrisiko bei WCAG 2.2.1. PR #102 ergänzt das
spezifische manuelle Abnahmeprotokoll.

**Umfang**

1. Home- und Admin-Überschriftenhierarchie korrigieren;
2. axe auf alle WCAG-A/AA-Verstöße unabhängig vom Impact verschärfen;
3. Lighthouse-Audits mit Gewicht `0` blockieren;
4. Reflow-/Fokus-Smoke auf zusätzliche Routen, Locales und Offline erweitern;
5. persönliche Timer-Modi Standard/10×/Ohne Timer umsetzen;
6. lokale Punktvorschau und informierten Host-Hinweis ergänzen;
7. allgemeine und PR-spezifische manuelle Prüfmatrix pflegen.

**Automatischer Nachweis**

- Localized Build, Typecheck, Tests und ESLint;
- axe, Lighthouse und Playwright Smoke E2E;
- CodeQL, Trivy und Migration Drift;
- veraPDF/PDF-UA-1.

**Offene Abnahme**

- Statuswechsel muss persönliche `EXTENDED`-/`OFF`-Fenster respektieren oder
  als zulässige Echtzeit-Ausnahme begründet werden;
- 25 Fälle der PR-101-Matrix;
- VoiceOver/Safari, NVDA/Firefox und Windows Forced Colors;
- echter 200-/400-%-Browserzoom und PDF-Reader.

## 9. Empfohlene Reihenfolge und Definition of Done

### Reihenfolge

1. PR 1: unmittelbare Level-A-Defekte;
2. PR 2 und PR 3: Fokus, Navigation und Dialoge;
3. PR 4 und PR 5: neue WCAG-2.2-AA-Kriterien und i18n;
4. PR 6: dauerhafte Regressionserkennung;
5. PR 8 und PR 9: PDF/UA sowie technische AA-Restblocker;
6. PR 7 und die PR-101-Matrix: formaler manueller Nachweis und Abschluss.

### Definition of Done für WCAG 2.2 AA

WCAG 2.2 AA darf erst als erfüllt dokumentiert werden, wenn:

- alle bestätigten A-/AA-Defekte geschlossen sind;
- alle automatischen A11y-Gates grün sind;
- keine fehlgeschlagenen Audits durch Score-Gewichtung verborgen bleiben;
- die manuelle Prüfmatrix keine offenen A-/AA-Befunde enthält;
- alle Kernprozesse und nicht nur Einzelrouten geprüft wurden;
- alle fünf Locales einbezogen wurden;
- der PDF/UA-Prozess separat validiert wurde;
- Auditprotokoll, Testfälle und bekannte Ausnahmen nachvollziehbar im Repo
  dokumentiert sind.

## 10. Vorschlag für eine Lehrveranstaltung

### 10.1 Gruppenaufteilung

| Gruppe | Auftrag                        | Ergebnis                                      |
| ------ | ------------------------------ | --------------------------------------------- |
| A      | Formulare und Accessible Names | reproduzierbare Befunde und fokussierte Tests |
| B      | Tastatur, Fokus und Dialoge    | Tastaturprotokoll und Fokusdiagramm           |
| C      | WCAG 2.2: 2.4.11, 2.5.7, 2.5.8 | Kriterienanalyse und Lösungsvorschlag         |
| D      | axe, Lighthouse und CI         | Vergleich der Werkzeugabdeckung               |
| E      | Screenreader und Zoom          | manuelles Testprotokoll                       |
| F      | PDF/UA                         | Validatorbericht und Lesereihenfolge          |

### 10.2 Arbeitsauftrag

1. Wählt einen Befund aus Abschnitt 5.
2. Formuliert erwartetes und beobachtetes Verhalten ohne den Code zu
   verändern.
3. Ordnet den Befund einem WCAG-Kriterium zu.
4. Reproduziert ihn mit mindestens zwei Verfahren, zum Beispiel Codeprüfung
   und Browserlauf.
5. Entwerft einen möglichst kleinen Fix.
6. Definiert einen automatischen und einen manuellen Regressionstest.
7. Dokumentiert, welche Aussage euer Test **nicht** erlaubt.

### 10.3 Reflexionsfragen

1. Warum erzielte die Startseite 100 Punkte, obwohl ein Audit fehlschlug?
2. Welche Befunde kann axe zuverlässig finden, welche nicht?
3. Wann ist ein visuell modales Overlay auch technisch modal?
4. Warum ist ein Drag-Handle mit Accessible Name noch keine Lösung für
   WCAG 2.5.7?
5. Welche Nachteile hat eine automatische Fokusverschiebung nach jeder
   Navigation?
6. Wie verhindert man, dass A11y-Tests nur den deutschen Happy Path prüfen?
7. Warum sind „Tagged: yes“ und „Suspects: no“ noch kein PDF/UA-Nachweis?

## 11. Reproduzierbare Befehle

```bash
# Bestehender Frontend-A11y-Smoke
npm run lighthouse:a11y -w @arsnova/frontend

# Lokalisierter Produktionsbuild
npm run build:localize -w @arsnova/frontend

# 320-px-Reflow-Smoke bei laufender Anwendung
BASE_URL=http://localhost:4200 npm run check:viewport -w @arsnova/frontend

# Frontend-Tests
npm run test -w @arsnova/frontend

# Frontend-Typecheck
npm run typecheck -w @arsnova/frontend
```

Für Lighthouse gegen eine bereits laufende Route:

```bash
LIGHTHOUSE_URL=http://localhost:4200/de/quiz/new \
  npm run lighthouse:a11y -w @arsnova/frontend
```

## 12. Quellen und Projektbezug

### Offizielle Grundlagen

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Neue Erfolgskriterien in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)
- [Understanding 2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)

### Projektinterne Grundlagen

- [`PRAKTIKUM-SQM.md`](./PRAKTIKUM-SQM.md)
- [`Softwarequalitaetsmanagement-Beschreibung-4-Referate.md`](./Softwarequalitaetsmanagement-Beschreibung-4-Referate.md)
- [`docs/ui/PR-CHECKLIST-UI.md`](../ui/PR-CHECKLIST-UI.md)
- [`docs/ui/STYLEGUIDE.md`](../ui/STYLEGUIDE.md)
- [`docs/TESTING.md`](../TESTING.md)
- [`ACCESSIBILITY-UMSETZUNGSJOURNAL.md`](./ACCESSIBILITY-UMSETZUNGSJOURNAL.md)
- [`ACCESSIBILITY-MANUELLE-PRUEFMATRIX.md`](./ACCESSIBILITY-MANUELLE-PRUEFMATRIX.md)
- [`ACCESSIBILITY-MANUELLE-PRUEFMATRIX-PR101.md`](./ACCESSIBILITY-MANUELLE-PRUEFMATRIX-PR101.md)
- [`ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md`](./ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md)
- [`Backlog.md`](../../Backlog.md), insbesondere Story 6.5
- [`docs/EPIC6-AC-PRUEFUNG.md`](../EPIC6-AC-PRUEFUNG.md)

## 13. Pflegehinweis

Dieses Dokument bildet einen zeitgebundenen Auditstand ab. Bei jeder
Umsetzung ist:

1. der zugehörige Befund mit PR oder Commit zu verlinken;
2. der Regressionstest zu dokumentieren;
3. der Status „offen“, „in Arbeit“, „behoben“ oder „akzeptierte Ausnahme“
   nachzuführen;
4. zwischen technischem Fix und formaler WCAG-Abnahme zu unterscheiden.

_Auditstand: 2026-07-20. Technische Befunde bis PR #101 aktualisiert;
WCAG 2.2.1 und manuelle Gesamtabnahme weiterhin offen; keine Zertifizierung._
