<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Manuelle WCAG-2.2-AA-Prüfmatrix – PR #101

**Projekt:** arsnova.eu  
**Prüfgegenstand:** PR #101 „A11y: WCAG-2.2-AA-Restblocker schließen“  
**Stand der Vorlage:** 2026-07-20  
**Status:** Ausführung ausstehend  
**Ergänzt:** [`ACCESSIBILITY-MANUELLE-PRUEFMATRIX.md`](./ACCESSIBILITY-MANUELLE-PRUEFMATRIX.md)  
**Umsetzungsnachweis:** [`ACCESSIBILITY-UMSETZUNGSJOURNAL.md`](./ACCESSIBILITY-UMSETZUNGSJOURNAL.md)

## Zweck und Abgrenzung

Diese zweite Matrix ist das ausführbare manuelle Abnahmeprotokoll für die in
PR #101 ergänzten oder durch strengere Accessibility-Gates sichtbar gewordenen
Interaktionen. Sie ersetzt weder die allgemeine Prüfmatrix noch automatisierte
Tests.

Ein Ergebnis gilt nur dann als **bestanden**, wenn Datum, Prüfer:in, Umgebung
und ein nachvollziehbares Artefakt eingetragen sind. Automatisch grüne Checks
dürfen nicht als manuelle Abnahme eingetragen werden.

Statuswerte: `offen`, `bestanden`, `fehlgeschlagen`, `blockiert`.

## Testaufbau

### Pflichtumgebungen

| ID  | Browser / Betriebssystem     | Assistive Technology | Pflicht   |
| --- | ---------------------------- | -------------------- | --------- |
| E1  | Safari / aktuelles macOS     | VoiceOver            | ja        |
| E2  | Firefox / aktuelles Windows  | NVDA                 | ja        |
| E3  | Edge / Windows Forced Colors | Tastatur             | ja        |
| E4  | Chrome / Android             | TalkBack             | empfohlen |
| E5  | Safari / iOS                 | VoiceOver            | empfohlen |

### Testdaten

1. Quiz mit mindestens einer Single-Choice- und einer Freitext- oder
   numerischen Frage anlegen.
2. Für die Fragen einen gemeinsamen Timer von 30 Sekunden konfigurieren.
3. Session mit einem Host und drei Teilnehmenden öffnen:
   - T1: `Standard`,
   - T2: `10× Zeit`,
   - T3: `Ohne Timer`.
4. Für Konfliktprüfungen einen Nickname auf einem zweiten Gerät erneut wählen.
5. Tests mindestens in `de` und `en` durchführen; lange Texte zusätzlich in
   `fr` oder `it` prüfen.

### Nachweise

Empfohlene Ablage:
`tmp/a11y-manual/pr101/<ID>-<locale>-<environment>.<png|mp4|md>`.

Screenreader-Prüfungen benötigen ein kurzes Protokoll mit Fokusreihenfolge,
angesagtem Namen, Rolle, Zustand und gegebenenfalls Fehlermeldung.

## A – Persönliche Zeitanpassung und Punktanzeige

| ID  | WCAG 2.2               | Prüfschritte                                                                                           | Erwartung                                                                                                                                                         | Status | Datum | Prüfer:in | Umgebung | Artefakt |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | --------- | -------- | -------- |
| A01 | 2.1.1, 3.3.2, 4.1.2    | Vote-Ansicht per Tastatur öffnen; „Zeit anpassen“ und alle drei Segmente mit Screenreader durchlaufen. | Titel, Hilfetext, Gruppenrolle, gewählter Zustand und Optionen werden verständlich angesagt; Bedienung ohne Zeiger möglich.                                       | offen  |       |           |          |          |
| A02 | 1.4.10, 1.4.12, 2.4.11 | Segmented-Control bei 320 CSS-Pixel, 200 % und 400 % Zoom prüfen.                                      | Beschriftungen sind vertikal zentriert, dürfen umbrechen und werden weder abgeschnitten noch vom Fokusindikator verdeckt.                                         | offen  |       |           |          |          |
| A03 | 2.2.1                  | T2 auf `10× Zeit` setzen, gemeinsamen Countdown ablaufen lassen und Frage `ACTIVE` lassen.             | T2 kann nach 30 Sekunden weiter antworten; persönliche Restzeit und Eingabemöglichkeit bleiben erhalten.                                                          | offen  |       |           |          |          |
| A04 | 2.2.1                  | T3 auf `Ohne Frist` setzen und gemeinsamen Countdown ablaufen lassen.                                  | Persönlicher Countdown verschwindet; Eingabe bleibt bis zur Host-Aktion möglich; Label lautet „Ohne Frist“.                                                       | offen  |       |           |          |          |
| A05 | 2.2.1, 3.2.2           | Zeitanpassung wechseln, Seite neu laden und Session erneut betreten.                                   | Gespeicherte Auswahl wird wiederhergestellt; der Wechsel löst keine unerwartete Navigation oder Abgabe aus.                                                       | offen  |       |           |          |          |
| A06 | 1.3.1, 1.4.10          | Punktvorschau während des gemeinsamen Countdowns beobachten.                                           | Zahl und Einheit bleiben zusammen; der Text lautet je nach Fragetyp verständlich „Richtige Antwort jetzt“ oder „Volle Wertung jetzt“.                             | offen  |       |           |          |          |
| A07 | 2.2.1, 3.2.4           | Punktvorschau nach Ablauf des gemeinsamen Countdowns beobachten.                                       | Der zeitabhängige Wert bleibt konstant; die Anzeige lautet „Nachlaufzeit · richtige Antwort“ und verwendet kein irreführendes „bis zu“ oder „bei voller Wertung“. | offen  |       |           |          |          |
| A08 | 4.1.3                  | Punktvorschau mindestens 15 Sekunden mit Screenreader beobachten.                                      | Der sichtbare Sekunden-/Punkte-Ticker erzeugt keine fortlaufenden störenden Live-Ansagen.                                                                         | offen  |       |           |          |          |
| A09 | 2.2.2                  | Punktvorschau ausblenden, Seite neu laden, wieder einblenden.                                          | Ausgeblendeter Zustand bleibt erhalten; Wiedereinblenden ist per Tastatur möglich; keine `aria-live`-Spam.                                                        | offen  |       |           |          |          |

## B – Informierte Host-Entscheidung

| ID  | WCAG 2.2       | Prüfschritte                                                            | Erwartung                                                                                                | Status | Datum | Prüfer:in | Umgebung | Artefakt |
| --- | -------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ | ----- | --------- | -------- | -------- |
| B01 | 2.2.1, 3.3.2   | T2 und T3 noch nicht antworten lassen; Host-Aktionsbereich prüfen.      | Vor „Ergebnis zeigen“ erscheint die konkrete Zahl noch antwortender Personen mit Zeitanpassung.          | offen  |       |           |          |          |
| B02 | 4.1.3          | Während der Host-Ansicht antwortet T2, T3 bleibt offen.                 | Der Statushinweis wird höflich aktualisiert und zählt nur noch T3; keine übermäßige Wiederholung.        | offen  |       |           |          |          |
| B03 | 2.2.1, 3.2.2   | Nach Raum-Countdown „Trotzdem freigeben“ wählen und Dialog bestätigen.  | Bestätigung erklärt Ende persönlicher Fenster; danach RESULTS; Override wird geloggt.                    | offen  |       |           |          |          |
| B04 | 2.2.1          | Vor Raum-Countdown versuchen freizugeben, während `EXTENDED` offen ist. | Aktion bleibt gesperrt bzw. Backend lehnt Force-Close ab.                                                | offen  |       |           |          |          |
| B05 | 2.2.1          | Host wartet, bis T2 und T3 geantwortet haben.                           | Hinweis verschwindet bei null offenen angepassten Eingabefenstern; alle gültigen Antworten sind erfasst. | offen  |       |           |          |          |
| B06 | 1.4.10, 2.4.11 | Host-Hinweis und Aktionsleiste bei 320 CSS-Pixel und 400 % Zoom prüfen. | Hinweis steht vollständig oberhalb der Aktionen; Schaltflächen und Fokus werden nicht verdeckt.          | offen  |       |           |          |          |

## C – Fokus, Reflow und Fehlerbehandlung

| ID  | WCAG 2.2             | Prüfschritte                                                                       | Erwartung                                                                                                               | Status | Datum | Prüfer:in | Umgebung | Artefakt |
| --- | -------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ | ----- | --------- | -------- | -------- |
| C01 | 2.4.3, 2.4.7, 2.4.11 | `/join` auf Desktop per Tastatur öffnen.                                           | Code-Eingabe erhält den vorgesehenen Fokus; Fokusindikator ist vollständig sichtbar.                                    | offen  |       |           |          |          |
| C02 | 2.4.3, 3.3.1, 3.3.3  | Bereits vergebenen Nickname absenden.                                              | Inline-Fehler benennt den Nickname-Konflikt; Seite bleibt bedienbar, Auswahl kann korrigiert werden.                    | offen  |       |           |          |          |
| C03 | 3.3.1, 3.3.3         | Join mit absichtlich nicht erreichbarer oder fehlerhafter Datenbank/API ausführen. | Technischer Fehler wird nicht fälschlich als „Nickname vergeben“ ausgegeben.                                            | offen  |       |           |          |          |
| C04 | 1.4.10, 2.4.11       | `/quiz/new` und `/admin` mit 320 CSS-Pixel vollständig durchtabben.                | Material-Formfelder scrollen in den sichtbaren Bereich; kein Fokus wird durch Toolbar, Label oder Container verdeckt.   | offen  |       |           |          |          |
| C05 | 1.4.10, 2.4.11       | Startseite laden, Offline-Zustand auslösen und Toolbar durchtabben.                | Offline-Banner ist sichtbar und angesagt; Logo, Einstellungen und deren Fokus liegen vollständig unterhalb des Banners. | offen  |       |           |          |          |
| C06 | 1.4.11, 2.4.7        | Allgemeine Textlinks in hell/dunkel sowie Forced Colors fokussieren.               | Fokusrahmen besitzt erkennbaren Abstand zum Text und ausreichenden Kontrast.                                            | offen  |       |           |          |          |
| C07 | 2.5.8                | Interaktive Ziele der Kernseiten bei 320 CSS-Pixel prüfen.                         | Ziele erreichen 24 × 24 CSS-Pixel oder erfüllen die WCAG-Abstands-/Inline-Ausnahme.                                     | offen  |       |           |          |          |

## D – Semantik, Namen und Übersetzungen

| ID  | WCAG 2.2     | Prüfschritte                                                                        | Erwartung                                                                                                                | Status | Datum | Prüfer:in | Umgebung | Artefakt |
| --- | ------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ | ----- | --------- | -------- | -------- |
| D01 | 1.3.1, 2.4.6 | Startseite über die Überschriftennavigation des Screenreaders prüfen.               | Genau ein sinnvolles `h1`; die Kartenüberschriften folgen als `h2`.                                                      | offen  |       |           |          |          |
| D02 | 1.3.1, 2.4.6 | Admin-Login und Admin-Inhalt über Überschriftennavigation prüfen.                   | „Admin-Login“ ist `h1`; nachgelagerte Bereiche besitzen eine nachvollziehbare `h2`-Struktur.                             | offen  |       |           |          |          |
| D03 | 1.3.1, 2.4.6 | Host-Lobby, aktive Frage, Vote-Frage, Session-Fehler und Wortwolke prüfen.          | Lobby/Frage/Fehler haben `h1`; Vote Region+`h1`; Wortwolke `h2 mat-card-title`.                                          | offen  |       |           |          |          |
| D04 | 2.5.3, 4.1.2 | `/quiz` öffnen und jede Quizkarte mit Screenreader sowie Sprachsteuerung ansteuern. | Der zugängliche Linkname enthält den sichtbaren Quiznamen; sichtbarer Text und Accessible Name widersprechen sich nicht. | offen  |       |           |          |          |
| D05 | 3.1.1, 3.1.2 | A01–D04 in `en` und stichprobenartig `fr` oder `it` wiederholen.                    | Seitensprache stimmt; neue Timer- und Host-Texte enthalten keine deutschen Reste oder falschen Pronomen.                 | offen  |       |           |          |          |
| D06 | 1.4.10       | Neue Texte in `fr` und `it` bei 320 CSS-Pixel prüfen.                               | Host-Hinweis, Segmente und Punktanzeige umbrechen ohne Überlauf oder abgeschnittene Pflichtinformation.                  | offen  |       |           |          |          |

## Automatische Vorbedingungen

Vor dem manuellen Lauf müssen folgende Checks für denselben Commit grün sein:

- Localized Production Build;
- Unit- und Integrationstests;
- Typecheck und ESLint;
- Changed Files Format;
- Lighthouse Accessibility;
- Playwright Smoke E2E einschließlich 320-Pixel-Reflow;
- CodeQL und Trivy;
- Prisma Migration Drift;
- PDF/UA-1 Validation.

Diese Checks sind Vorbedingungen, aber kein Ersatz für A01–D06.

## Ergebniszusammenfassung

| Bereich                      | Bestanden | Fehlgeschlagen | Blockiert | Offen  | Bemerkung |
| ---------------------------- | --------- | -------------- | --------- | ------ | --------- |
| A – Zeitanpassung und Punkte | 0         | 0              | 0         | 9      |           |
| B – Host-Entscheidung        | 0         | 0              | 0         | 6      |           |
| C – Fokus und Reflow         | 0         | 0              | 0         | 7      |           |
| D – Semantik und i18n        | 0         | 0              | 0         | 6      |           |
| **Gesamt**                   | **0**     | **0**          | **0**     | **28** |           |

## Freigabeentscheidung

- [ ] Alle Pflichtfälle in E1, E2 und E3 ausgeführt.
- [ ] Keine fehlgeschlagenen Fälle mit Auswirkung auf WCAG 2.2 A oder AA.
- [ ] Blockierte Fälle mit Grund und Nachholtermin dokumentiert.
- [ ] Abweichungen als Issue mit WCAG-Kriterium, Reproduktion und Artefakt erfasst.
- [ ] Ergebnis in der allgemeinen Prüfmatrix und im Umsetzungsjournal referenziert.

**Entscheidung:** nicht abgenommen  
**Datum:**  
**Verantwortlich:**  
**Restabweichungen / Issues:**
