<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Manuelle WCAG-2.2-AA-Prüfmatrix

**Projekt:** arsnova.eu  
**Prüfmaßstab:** WCAG 2.2, Konformitätsstufe AA  
**Stand der Vorlage:** 2026-07-20  
**Zugehörig:** [`ACCESSIBILITY-AUDIT-WCAG-2.2-AA.md`](./ACCESSIBILITY-AUDIT-WCAG-2.2-AA.md),
[`ACCESSIBILITY-UMSETZUNGSJOURNAL.md`](./ACCESSIBILITY-UMSETZUNGSJOURNAL.md)

**PR-spezifische Ergänzung:** Die detaillierten Abnahmeschritte für persönliche
Zeitanpassung, Host-Hinweis, Punktvorschau sowie die zuletzt verschärften
Fokus-/Reflow-Gates stehen in
[`ACCESSIBILITY-MANUELLE-PRUEFMATRIX-PR101.md`](./ACCESSIBILITY-MANUELLE-PRUEFMATRIX-PR101.md).

## Zweck

Diese Matrix ist der ausführbare Nachweis für Prüfungen, die axe, Lighthouse
und Unit-Tests nicht ersetzen können. Ein leeres oder unvollständiges
Ergebnisfeld bedeutet: **nicht abgenommen**. Kein Eintrag darf als bestanden
markiert werden, ohne Datum, Prüfer:in und Umgebung.

Statuswerte:

| Status         | Bedeutung                                      |
| -------------- | ---------------------------------------------- |
| offen          | noch nicht geprüft                             |
| bestanden      | Erwartung erfüllt, Artefakt vorhanden          |
| fehlgeschlagen | Verstoß bestätigt                              |
| blockiert      | Prüfung nicht möglich (Umgebung, Daten, Gerät) |

## Pflichtumgebungen

| ID  | Browser / OS                          | Assistive Technology       | Pflicht   |
| --- | ------------------------------------- | -------------------------- | --------- |
| E1  | Safari / aktuelles macOS              | VoiceOver                  | ja        |
| E2  | Firefox / aktuelles Windows           | NVDA                       | ja        |
| E3  | Chrome / Android                      | TalkBack                   | empfohlen |
| E4  | Safari / iOS                          | VoiceOver                  | empfohlen |
| E5  | Windows High Contrast / Forced Colors | Tastatur ohne Screenreader | ja        |

## Kernrouten und Zustände

Für jede Zeile: Locale mindestens `de` und eine weitere Sprache; bei
Textlängenproblemen zusätzlich `fr` oder `it`.

| ID  | Route / Zustand                         | Eingabe         | Erwartung                                                              | Status | Datum | Prüfer:in | Umgebung | Artefakt |
| --- | --------------------------------------- | --------------- | ---------------------------------------------------------------------- | ------ | ----- | --------- | -------- | -------- |
| M01 | `/` Startseite, Skip-Link               | Tastatur        | Skip-Link erster Tabstopp, aktiviert `#main-content`, sichtbarer Fokus | offen  |       |           |          |          |
| M02 | `/` Startseite, Überschriften           | Screenreader    | ein `h1`, Kartentitel als `h2`, sinnvolle Reihenfolge                  | offen  |       |           |          |          |
| M03 | `/join` Desktop                         | Tastatur        | Codefeld erhält Fokus nach Shell-Verankerung                           | offen  |       |           |          |          |
| M04 | `/join` Touch                           | Touch           | keine ungefragte virtuelle Tastatur                                    | offen  |       |           |          |          |
| M05 | Quiz neu / bearbeiten, Markdown-Editor  | Tastatur + SR   | Labels, Toolbar, Vorschau und Fehler ansprechbar                       | offen  |       |           |          |          |
| M06 | Quiz bearbeiten, Fragen sortieren       | Tastatur        | Auf/Ab ohne Dragging, Live-Region kündigt Position an                  | offen  |       |           |          |          |
| M07 | Host-Lobby / Presenter                  | Tastatur + SR   | Landmarks, Countdown-Ansage, keine Fokusfalle außerhalb Dialoge        | offen  |       |           |          |          |
| M08 | Teilnehmer Vote mit Timer               | Tastatur + SR   | persönliche Zeitverlängerung oder „ohne Limit“ vor Ablauf nutzbar      | offen  |       |           |          |          |
| M09 | Teilnehmer Vote ohne Timer              | Tastatur + SR   | Eingabe bleibt bis Submit/Host-Wechsel bedienbar                       | offen  |       |           |          |          |
| M10 | Q&A Teilnehmer und Moderation           | Tastatur + SR   | Upvote-Zustände, Sortierung, Dialoge mit Escape und Fokusrückgabe      | offen  |       |           |          |          |
| M11 | Blitzlicht / Feedback                   | Tastatur + SR   | Sterne als Radiogruppe, Tempo-Hilfe dialoggerecht                      | offen  |       |           |          |          |
| M12 | Wortwolke Presenter                     | Screenreader    | Textliste mit Rang und Häufigkeit parallel zur Grafik                  | offen  |       |           |          |          |
| M13 | Bild-Lightbox                           | Tastatur        | Öffnen, Zoom/Pan ohne Dragging, Zoomstatus, Schließen, Fokusrückgabe   | offen  |       |           |          |          |
| M14 | MOTD- und Preset-Dialog                 | Tastatur + SR   | Focus Trap, Escape, inerter Hintergrund, Fokusrückgabe                 | offen  |       |           |          |          |
| M15 | Session-Ende Teilnehmer/Host            | Tastatur + SR   | Statusregion statt falschem Modal; nächste Aktion erreichbar           | offen  |       |           |          |          |
| M16 | Admin-Login                             | Screenreader    | `h1` „Admin-Login“, Formularlabel und Fehlermeldungen                  | offen  |       |           |          |          |
| M17 | Admin nach Login                        | Screenreader    | Shell-`h1`, Kartentitel als `h2`, Tab-Inhalte erreichbar               | offen  |       |           |          |          |
| M18 | Hilfe / Legal                           | Tastatur + Zoom | Überschriften, Links unterscheidbar, Reflow ohne horizontalen Scroll   | offen  |       |           |          |          |
| M19 | Offline-Banner                          | Screenreader    | Statusmeldung wahrnehmbar, keine Fokusverdeckung                       | offen  |       |           |          |          |
| M20 | Landing Start / Impressum / Datenschutz | Tastatur + SR   | `h1`/`h2`-Struktur, Kontrast, unterstrichene Textlinks                 | offen  |       |           |          |          |

## Zoom, Kontrast und Motion

| ID  | Prüfung                                    | Erwartung                                                | Status | Datum | Prüfer:in | Umgebung | Artefakt |
| --- | ------------------------------------------ | -------------------------------------------------------- | ------ | ----- | --------- | -------- | -------- |
| Z01 | Browserzoom 200 % auf Kernrouten           | Inhalte nutzbar, keine verdeckten Pflichtaktionen        | offen  |       |           |          |          |
| Z02 | Browserzoom 400 % bzw. 1280×1024 bei 400 % | einspaltiger Reflow, kein notwendiges Horizontalskrollen | offen  |       |           |          |          |
| Z03 | Sticky Header / Bottom-Actions bei Fokus   | Fokus nicht dauerhaft verdeckt (2.4.11)                  | offen  |       |           |          |          |
| Z04 | Virtuelle Tastatur iOS/Android             | Codefeld und Vote-Submit bleiben erreichbar              | offen  |       |           |          |          |
| Z05 | Forced Colors / Windows High Contrast      | Fokus, Borders und Icons bleiben erkennbar               | offen  |       |           |          |          |
| Z06 | `prefers-reduced-motion`                   | dekorative Animationen reduziert, Funktion bleibt        | offen  |       |           |          |          |
| Z07 | Light/Dark × spielerisch/seriös            | Kontrast und Fokus in allen vier Kombinationen           | offen  |       |           |          |          |

## Locales

| ID  | Prüfung                                     | Erwartung                                       | Status | Datum | Prüfer:in | Umgebung | Artefakt |
| --- | ------------------------------------------- | ----------------------------------------------- | ------ | ----- | --------- | -------- | -------- |
| L01 | `html[lang]` für de/en/fr/es/it             | passt zur URL-Locale                            | offen  |       |           |          |          |
| L02 | Accessible Names in en/fr/es/it             | keine unvermittelten DE-Reste in Kernflows      | offen  |       |           |          |          |
| L03 | Lange Übersetzungen FR/IT bei 320 CSS-Pixel | Buttons und Kartentitel umbrechen ohne Overflow | offen  |       |           |          |          |

## PDF/UA Reader-Abnahme

veraPDF allein reicht nicht. Pro Locale mindestens eine Stichprobe:

| ID  | Datei / Locale | Reader + AT                 | Erwartung                                        | Status | Datum | Prüfer:in | Artefakt |
| --- | -------------- | --------------------------- | ------------------------------------------------ | ------ | ----- | --------- | -------- |
| P01 | de             | Preview/Acrobat + VoiceOver | Titel, Sprache, Reihenfolge, Alt-Texte, Tabellen | offen  |       |           |          |
| P02 | en             | Acrobat + NVDA              | Links und Überschriften sinnvoll navigierbar     | offen  |       |           |          |
| P03 | fr             | Preview/Acrobat + VoiceOver | kein Font-/Ersatzglyph-Problem im Lesepfad       | offen  |       |           |          |
| P04 | es             | Acrobat + NVDA              | Tabellenkopf und Datenzellen zugeordnet          | offen  |       |           |          |
| P05 | it             | Preview/Acrobat + VoiceOver | Dokumenttitel und Sprache korrekt                | offen  |       |           |          |

## Abschlussregel

Eine öffentliche Aussage „WCAG 2.2 AA konform“ ist erst zulässig, wenn:

1. alle Blocker aus dem Audit behoben und automatisch validiert sind;
2. E1, E2 und E5 mit den Kernzeilen M01–M20 sowie Z01–Z07 dokumentiert bestanden sind;
3. die PDF-Reader-Schritte P01–P05 mindestens stichprobenartig bestanden sind;
4. offene Restfehler als außerhalb des erklärten Scope oder als bekannte
   Ausnahmen mit Begründung dokumentiert sind.
