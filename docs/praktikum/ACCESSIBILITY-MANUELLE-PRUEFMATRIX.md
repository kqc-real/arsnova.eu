<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Manuelle WCAG-2.2-AA-Prüfmatrix

**Projekt:** arsnova.eu
**Prüfmaßstab:** WCAG 2.2, Konformitätsstufe AA
**Stand:** 2026-07-27
**Status:** formal abgenommen
**Zugehörig:** [`ACCESSIBILITY-AUDIT-WCAG-2.2-AA.md`](./ACCESSIBILITY-AUDIT-WCAG-2.2-AA.md),
[`ACCESSIBILITY-UMSETZUNGSJOURNAL.md`](./ACCESSIBILITY-UMSETZUNGSJOURNAL.md)

**PR-spezifische Ergänzung:** Die detaillierten Abnahmeschritte für persönliche
Zeitanpassung, Host-Hinweis, Punktvorschau sowie die zuletzt verschärften
Fokus-/Reflow-Gates stehen in
[`ACCESSIBILITY-MANUELLE-PRUEFMATRIX-PR101.md`](./ACCESSIBILITY-MANUELLE-PRUEFMATRIX-PR101.md).

## Zweck

Diese Matrix ist der ausführbare Nachweis für Prüfungen, die axe, Lighthouse
und Unit-Tests nicht ersetzen können. Die Projektverantwortung hat die
vollständige Ausführung am 2026-07-27 bestätigt. Die gemeinsame
Abnahmemetadaten gelten für alle mit „bestanden“ markierten Zeilen; leere
Einzelfelder sind deshalb kein offener Status.

## Formale Abnahme

- **Datum:** 2026-07-27
- **Verantwortung:** Projektverantwortliche Abnahme
- **Umgebungen:** VoiceOver/Safari auf macOS, NVDA/Firefox auf Windows,
  Tastatur in Windows High Contrast/Forced Colors; ergänzende Browser- und
  Betriebssystemstichproben
- **Darstellung:** echter Browserzoom bei 200 % und 400 %, 320-CSS-Pixel-Reflow,
  Light/Dark, spielerisch/seriös und Reduced Motion
- **Dokumente:** PDF/UA-1-Validierung mit veraPDF sowie Bedienprüfung der fünf
  Locale-Demos mit PDF-Reader und Screenreader
- **Ergebnis:** M01–M20, Z01–Z07, L01–L03 und P01–P05 bestanden; keine offenen
  oder fehlgeschlagenen WCAG-2.2-A-/AA-Fälle
- **Abnahmebasis:** Bestätigung der Projektverantwortung vom 2026-07-27,
  technisches Audit, Umsetzungsjournal, CI-Gates und PDF/UA-Prüfprotokoll

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

| ID  | Route / Zustand                         | Eingabe         | Erwartung                                                              | Status    | Datum      | Prüfer:in      | Umgebung | Artefakt     |
| --- | --------------------------------------- | --------------- | ---------------------------------------------------------------------- | --------- | ---------- | -------------- | -------- | ------------ |
| M01 | `/` Startseite, Skip-Link               | Tastatur        | Skip-Link erster Tabstopp, aktiviert `#main-content`, sichtbarer Fokus | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M02 | `/` Startseite, Überschriften           | Screenreader    | ein `h1`, Kartentitel als `h2`, sinnvolle Reihenfolge                  | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M03 | `/join` Desktop                         | Tastatur        | Codefeld erhält Fokus nach Shell-Verankerung                           | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M04 | `/join` Touch                           | Touch           | keine ungefragte virtuelle Tastatur                                    | bestanden | 2026-07-27 | Projektabnahme | E3/E4    | Abnahmebasis |
| M05 | Quiz neu / bearbeiten, Markdown-Editor  | Tastatur + SR   | Labels, Toolbar, Vorschau und Fehler ansprechbar                       | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M06 | Quiz bearbeiten, Fragen sortieren       | Tastatur        | Auf/Ab ohne Dragging, Live-Region kündigt Position an                  | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M07 | Host-Lobby / Presenter                  | Tastatur + SR   | Landmarks, Countdown-Ansage, keine Fokusfalle außerhalb Dialoge        | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M08 | Teilnehmer Vote mit Timer               | Tastatur + SR   | persönliche Zeitverlängerung oder „ohne Limit“ vor Ablauf nutzbar      | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M09 | Teilnehmer Vote ohne Timer              | Tastatur + SR   | Eingabe bleibt bis Submit/Host-Wechsel bedienbar                       | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M10 | Q&A Teilnehmer und Moderation           | Tastatur + SR   | Upvote-Zustände, Sortierung, Dialoge mit Escape und Fokusrückgabe      | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M11 | Blitzlicht / Feedback                   | Tastatur + SR   | Sterne als Radiogruppe, Tempo-Hilfe dialoggerecht                      | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M12 | Wortwolke Presenter                     | Screenreader    | Textliste mit Rang und Häufigkeit parallel zur Grafik                  | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M13 | Bild-Lightbox                           | Tastatur        | Öffnen, Zoom/Pan ohne Dragging, Zoomstatus, Schließen, Fokusrückgabe   | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M14 | MOTD- und Preset-Dialog                 | Tastatur + SR   | Focus Trap, Escape, inerter Hintergrund, Fokusrückgabe                 | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M15 | Session-Ende Teilnehmer/Host            | Tastatur + SR   | Statusregion statt falschem Modal; nächste Aktion erreichbar           | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M16 | Admin-Login                             | Screenreader    | `h1` „Admin-Login“, Formularlabel und Fehlermeldungen                  | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M17 | Admin nach Login                        | Screenreader    | Shell-`h1`, Kartentitel als `h2`, Tab-Inhalte erreichbar               | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M18 | Hilfe / Legal                           | Tastatur + Zoom | Überschriften, Links unterscheidbar, Reflow ohne horizontalen Scroll   | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M19 | Offline-Banner                          | Screenreader    | Statusmeldung wahrnehmbar, keine Fokusverdeckung                       | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| M20 | Landing Start / Impressum / Datenschutz | Tastatur + SR   | `h1`/`h2`-Struktur, Kontrast, unterstrichene Textlinks                 | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |

## Zoom, Kontrast und Motion

| ID  | Prüfung                                    | Erwartung                                                | Status    | Datum      | Prüfer:in      | Umgebung | Artefakt     |
| --- | ------------------------------------------ | -------------------------------------------------------- | --------- | ---------- | -------------- | -------- | ------------ |
| Z01 | Browserzoom 200 % auf Kernrouten           | Inhalte nutzbar, keine verdeckten Pflichtaktionen        | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| Z02 | Browserzoom 400 % bzw. 1280×1024 bei 400 % | einspaltiger Reflow, kein notwendiges Horizontalskrollen | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| Z03 | Sticky Header / Bottom-Actions bei Fokus   | Fokus nicht dauerhaft verdeckt (2.4.11)                  | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| Z04 | Virtuelle Tastatur iOS/Android             | Codefeld und Vote-Submit bleiben erreichbar              | bestanden | 2026-07-27 | Projektabnahme | E3/E4    | Abnahmebasis |
| Z05 | Forced Colors / Windows High Contrast      | Fokus, Borders und Icons bleiben erkennbar               | bestanden | 2026-07-27 | Projektabnahme | E5       | Abnahmebasis |
| Z06 | `prefers-reduced-motion`                   | dekorative Animationen reduziert, Funktion bleibt        | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| Z07 | Light/Dark × spielerisch/seriös            | Kontrast und Fokus in allen vier Kombinationen           | bestanden | 2026-07-27 | Projektabnahme | E1/E2/E5 | Abnahmebasis |

## Locales

| ID  | Prüfung                                     | Erwartung                                       | Status    | Datum      | Prüfer:in      | Umgebung | Artefakt     |
| --- | ------------------------------------------- | ----------------------------------------------- | --------- | ---------- | -------------- | -------- | ------------ |
| L01 | `html[lang]` für de/en/fr/es/it             | passt zur URL-Locale                            | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| L02 | Accessible Names in en/fr/es/it             | keine unvermittelten DE-Reste in Kernflows      | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |
| L03 | Lange Übersetzungen FR/IT bei 320 CSS-Pixel | Buttons und Kartentitel umbrechen ohne Overflow | bestanden | 2026-07-27 | Projektabnahme | E1/E2    | Abnahmebasis |

## PDF/UA Reader-Abnahme

veraPDF allein reicht nicht. Pro Locale mindestens eine Stichprobe:

| ID  | Datei / Locale | Reader + AT                 | Erwartung                                        | Status    | Datum      | Prüfer:in      | Artefakt     |
| --- | -------------- | --------------------------- | ------------------------------------------------ | --------- | ---------- | -------------- | ------------ |
| P01 | de             | Preview/Acrobat + VoiceOver | Titel, Sprache, Reihenfolge, Alt-Texte, Tabellen | bestanden | 2026-07-27 | Projektabnahme | Abnahmebasis |
| P02 | en             | Acrobat + NVDA              | Links und Überschriften sinnvoll navigierbar     | bestanden | 2026-07-27 | Projektabnahme | Abnahmebasis |
| P03 | fr             | Preview/Acrobat + VoiceOver | kein Font-/Ersatzglyph-Problem im Lesepfad       | bestanden | 2026-07-27 | Projektabnahme | Abnahmebasis |
| P04 | es             | Acrobat + NVDA              | Tabellenkopf und Datenzellen zugeordnet          | bestanden | 2026-07-27 | Projektabnahme | Abnahmebasis |
| P05 | it             | Preview/Acrobat + VoiceOver | Dokumenttitel und Sprache korrekt                | bestanden | 2026-07-27 | Projektabnahme | Abnahmebasis |

## Abschlussregel

Eine öffentliche Aussage „WCAG 2.2 AA konform“ ist erst zulässig, wenn:

1. alle Blocker aus dem Audit behoben und automatisch validiert sind;
2. E1, E2 und E5 mit den Kernzeilen M01–M20 sowie Z01–Z07 dokumentiert bestanden sind;
3. die PDF-Reader-Schritte P01–P05 mindestens stichprobenartig bestanden sind;
4. offene Restfehler als außerhalb des erklärten Scope oder als bekannte
   Ausnahmen mit Begründung dokumentiert sind.

Diese Abschlussregel ist seit 2026-07-27 erfüllt. Es bestehen keine offenen
A-/AA-Befunde. Empfehlungen zur fortlaufenden Qualitätssicherung sind
nicht blockierend und begründen keine Einschränkung der Abnahme.
