# arsnova.eu – ausführliche Funktionsübersicht der App

> Stand dieser Übersicht: 2026-06-04
>
> Grundlage: Auswertung des aktuellen Repos, insbesondere `apps/frontend`, `apps/backend`, `libs/shared-types`, `prisma/schema.prisma`, `README.md`, `docs/ROUTES_AND_STORIES.md` und der Feature-Dokumente unter `docs/features/`.

## Ziel dieser Datei

Diese Datei versucht, den **tatsächlichen Funktionsumfang der App im aktuellen Codebestand** möglichst vollständig zu beschreiben. Sie ist bewusst **codebasiert** und nicht nur produkt- oder marketingorientiert.

Beschrieben wird primär die **eigentliche Web-App** aus Angular-Frontend, Node/tRPC-Backend, Redis, PostgreSQL und Yjs-Sync. Die separate Astro-Landingpage in `apps/landing` wird nur am Rand erwähnt, weil sie nicht den interaktiven Kern der Anwendung bildet.

## Kurzfassung

`arsnova.eu` ist ein **mehrsprachiges Audience-Response-System** für Lehre, Training, Workshops, Events und Business-Kontexte. Die App bündelt drei Live-Formen in einem Produkt:

- **Quiz**
- **Q&A**
- **Blitzlicht / Quick Feedback**

Der Kern der Anwendung ist:

- **ohne Pflichtkonto** nutzbar
- **local-first** beim Erstellen von Quiz-Inhalten
- **live-fähig** über Session-Codes, tRPC-WebSockets, Redis-Kurzzeitdaten und Yjs-Sync
- **mehrsprachig** in fünf Sprachen
- **PWA-fähig** für mobile Nutzung
- auf **Datensparsamkeit und DSGVO-orientierten Betrieb** ausgelegt

Die App trennt klar zwischen vier Rollen:

- **Host / Lehrperson**: erstellt Inhalte und steuert Live-Sessions
- **Present / Beamer**: zeigt die öffentliche Raumansicht
- **Teilnehmende**: treten per Code oder QR bei und interagieren
- **Admin / Betreiber**: betreibt, prüft, sperrt, exportiert und kommuniziert plattformweit

Rollenrechte werden dabei **nicht nur über die URL**, sondern zusätzlich über Tokens bzw. serverseitige Prüfungen abgesichert:

- Host- und Present-Zugriffe sind an **Host-Tokens** gebunden.
- Standalone-Blitzlicht nutzt eigene **Feedback-Host-Tokens**.
- Admin-Funktionen laufen über separate **Admin-Session-Tokens**.
- Teilnehmendenpfade bleiben kontoarm und ohne Host-Credential nutzbar.

## 1. Hauptbestandteile der App

| Bereich               | Zentrale Routen                                              | Zweck                                                                                  |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Startseite            | `/`                                                          | Session-Code eingeben, letzte Sessions öffnen, Quiz/Q&A/Blitzlicht starten, MOTD sehen |
| Quiz-Sammlung         | `/quiz`                                                      | Eigene Quizze lokal verwalten, importieren, exportieren, live schalten                 |
| Quiz-Erstellung       | `/quiz/new`, `/quiz/:id`, `/quiz/:id/preview`                | Quiz anlegen, bearbeiten, prüfen, direkt aus der Vorschau starten                      |
| Quiz-Sync             | `/quiz/sync/:docId`                                          | Quiz-Sammlung auf einem zweiten Gerät oder mit anderen Personen synchron öffnen        |
| Join                  | `/join/:code`                                                | Einstieg für Teilnehmende in eine Session                                              |
| Session Host          | `/session/:code/host`                                        | Lehrendensteuerung für Quiz, Q&A und Blitzlicht                                        |
| Session Present       | `/session/:code/present`                                     | Beamer- / Raumansicht                                                                  |
| Session Vote          | `/session/:code/vote`                                        | Teilnehmendenansicht für Antworten, Q&A, Blitzlicht, Ergebnis und Feedback             |
| Standalone-Blitzlicht | `/feedback/:code`, `/feedback/:code/vote`                    | Schnelle Feedback-Runden außerhalb einer normalen Quiz-Session                         |
| Admin                 | `/admin`                                                     | Betreiberzugriff auf Sessions, Exporte, Löschungen, Legal Hold, MOTD                   |
| Hilfe und Info        | `/help`, `/news-archive`, `/legal/imprint`, `/legal/privacy` | Produktbeschreibung, Nachrichtenarchiv, Impressum, Datenschutz                         |

Zusätzlich werden **Locale-Präfixe** wie `/de/...`, `/en/...`, `/fr/...`, `/es/...`, `/it/...` unterstützt. Fachlich sind das dieselben Routen mit lokalisierter Oberfläche.

## 2. Startseite und globaler Einstieg

Die Startseite ist nicht nur eine Landing-Ansicht, sondern ein echter **operativer Einstiegspunkt**.

### 2.1 Session-Einstieg für Teilnehmende

- Eingabe eines **6-stelligen Session-Codes**
- Validierung des Codes direkt in der UI
- Weiterleitung je nach Ziel:
  - normale Quiz-/Q&A-Session: zu `/join/:code`
  - Blitzlicht-Code: zu `/feedback/:code/vote`
  - beendete Session: verständliche Fehlermeldung
- Anzeige und Wiederverwendung **zuletzt genutzter Session-Codes**

### 2.2 Schnellstart für Hosts

Von der Startseite aus können Hosts direkt:

- die **Quiz-Sammlung** öffnen
- einen **Q&A-Kanal** starten
- ein **Blitzlicht** starten

Wichtig ist: Q&A und Blitzlicht können nicht nur als Zusatzkanäle einer bestehenden Session laufen, sondern auch sehr schnell aus dem Home-Bereich heraus initialisiert werden.

### 2.3 Standalone-Blitzlicht von der Startseite

Die Startseite bietet vordefinierte Blitzlicht-Typen als Sofortstart:

- Stimmungsbild
- Ja / Nein / Vielleicht
- Ja / Nein
- Wahr / Falsch / Weiß nicht
- Sterne
- ABCD
- Tempo-Feedback mit `🚀 Schneller`, `🙂 Ich folge`, `🐢 Langsamer`, `😕 Verloren`

Ein Klick erzeugt eine neue Runde, Host-Token und Beitrittslink. Danach wechselt die App direkt in die Host-Ansicht des Blitzlichts.

### 2.4 Sync-Link für die Quiz-Sammlung

Auf der Startseite kann auch ein **Quiz-Sync-Link** eingefügt werden. Damit lässt sich eine geteilte Quiz-Sammlung direkt auf einem anderen Gerät oder in einem anderen Tab öffnen.

### 2.5 MOTD und News

Die Startseite ist der primäre Ort für die **Message of the Day**:

- Overlay mit aktueller Plattform-Mitteilung
- explizite Kenntnisnahme
- Daumen hoch / runter
- Schließen per Button, Backdrop und Wischgeste
- Unterdrückung bereits erledigter Versionen per lokalem Clientzustand

### 2.6 Globale Einstiegseigenschaften

Über die App-Shell sind global verfügbar:

- Sprachwechsel
- Theme-Wechsel
- lokaler Preset-Wechsel zwischen **Seriös** und **Spielerisch**
- News-/Archiv-Icon mit Ungelesen-Badge
- Server-Status im Footer
- PWA-Installations- und Update-Hinweise

## 3. Quiz-Sammlung, Editor und Vorbereitung

Die Quiz-Sammlung ist der **inhaltliche Arbeitsbereich** für Hosts. Sie ist deutlich mehr als eine einfache Liste.

### 3.1 Grundprinzip: local-first und kontoarm

Quiz-Inhalte werden zunächst **lokal im Browser** gehalten. Die App benötigt dafür kein persönliches Nutzerkonto. Erst beim Live-Start wird eine serverseitige Kopie hochgeladen und an eine Session gebunden.

### 3.2 Quiz-Sammlung

Die Sammlung unterstützt:

- eigenes Quiz anlegen
- Demo-Quiz mit allen Fragetypen
- Quiz öffnen und bearbeiten
- Quiz duplizieren
- Quiz löschen
- Sortierung nach Aktualität
- Erkennung, ob ein Quiz gerade live verwendet wird
- Zugriff auf vergangene Bonuscodes und letztes Session-Feedback pro Quiz-Historie

### 3.3 Quiz-Metadaten

Jedes Quiz kann folgende Metadaten besitzen:

- Name
- Beschreibung
- optionales Motivbild per URL oder Asset-Pfad

Die Beschreibung und Fragetexte unterstützen **Markdown** und **KaTeX**.

### 3.4 Unterstützte Fragetypen

Aktuell sind im Editor und in der Laufzeit umgesetzt:

- **Single Choice**
- **Multiple Choice**
- **Freitext**
- **Kurzantwort (`SHORT_TEXT`)**
- **Umfrage**
- **Bewertungsskala**

Die Bewertungsskala unterstützt Min-/Max-Werte und benutzerdefinierte Labels für die Endpunkte.
Kurzantwort unterstützt Musterlösungen, maximale Eingabelänge, Normalisierung, Distanz-/Toleranzlogik sowie numerische Antworten mit optionalen Einheiten.

### 3.5 Fragenmodell und Editierfunktionen

Pro Frage stehen unter anderem zur Verfügung:

- Frage formulieren
- Antworten hinzufügen und entfernen
- richtige Antwort(en) markieren
- Schwierigkeitsgrad festlegen
- Timer pro Frage überschreiben
- Lesephase für einzelne Fragen überspringen
- Fragen per **Drag-and-Drop** umsortieren
- Fragen temporär **deaktivieren**, ohne sie zu löschen
- Panels auf- und zuklappen

Für Single-Choice-Fragen gibt es zusätzlich Schnellformate bzw. vordefinierte Antwortmuster.

### 3.6 Quizweite Einstellungen

Ein Quiz kann sehr fein konfiguriert werden. Wichtige Einstellungsblöcke sind:

- Rangliste an / aus
- freie Nicknames erlauben
- anonymer Modus
- Standard-Timer
- Timer-Skalierung nach Schwierigkeit
- Lesephase global an / aus
- Soundeffekte an / aus
- Belohnungseffekte an / aus
- Motivationsmeldungen an / aus
- Emoji-Reaktionen an / aus
- Team-Modus an / aus
- Teamanzahl
- Teamzuweisung automatisch oder manuell
- eigene Teamnamen
- Nickname-Thema nach Alters- bzw. Zielgruppe
- Bonuscode-Anzahl
- Preset des Quiz: **PLAYFUL** oder **SERIOUS**
- Hintergrundmusik-Konfiguration

### 3.7 Vorschau und Schnellkorrektur

Die Vorschau ist ein eigenständiger Arbeitsmodus und kann:

- Fragen in echter Reihenfolge durchblättern
- Validierungswarnungen anzeigen
- Inline-Schnellkorrekturen an Frage und Antworten erlauben
- Timer und Lesephase direkt gegenprüfen
- direkt aus der Vorschau eine Live-Session starten
- auf Wunsch Vollbild anfordern

### 3.8 Import und Export

Die Sammlung unterstützt:

- JSON-Export eines Quiz
- JSON-Import eines Quiz
- Importnormalisierung mit **Warnungen**, falls eingehende Daten angepasst werden mussten
- Export im definierten Quiz-Importformat

Zusätzlich existiert ein **KI-Import-Workflow**:

- Die App zeigt einen System-Prompt für die bevorzugte externe KI an.
- Ein dort erzeugtes Quiz-JSON kann direkt in die Sammlung importiert werden.
- Die App schickt dafür nicht automatisch Inhalte an fremde KI-Dienste; sie liefert primär den Prompt und übernimmt den Import des erzeugten JSONs.

### 3.9 Mehrgeräte-Sync der Quiz-Sammlung

Ein großer Teil der Sammlungsfunktion ist die **Yjs-basierte Synchronisierung**.

Umgesetzt sind:

- Sync-Raum-ID
- Öffnen der Sammlung auf einem zweiten Gerät per Link
- geteilte Bibliothek statt nur lokalem Zustand
- IndexedDB-/Browser-Persistenz als lokaler Spiegel
- Anzeige anderer aktiver Geräte
- Anzeige von letztem Sync und Herkunft eines Remote-Änderers
- Auflösen einer geteilten Verknüpfung, ohne lokale Daten zu verlieren

Das ist funktional relevant: Die App kann nicht nur Quizze erstellen, sondern dieselbe Sammlung über mehrere Geräte hinweg weiterbearbeiten.

## 4. Live-Sessions und Rollenmodell

Eine Live-Session ist der eigentliche Betriebsmodus der App.

### 4.1 Session-Erstellung

Beim Start einer Session erzeugt das Backend:

- eine neue Session mit **6-stelligem Code**
- ein **Host-Token**
- optional eine serverseitige Quiz-Kopie

Es gibt mehrere Startformen:

- klassische Quiz-Session mit hochgeladenem Quiz
- Q&A-zentrierte Session
- kanalbasierte Session ohne direkt angehängtes Quiz
- Session mit bereits aktivierten Zusatzkanälen

Außerdem kann eine Session später noch erweitert werden:

- Q&A-Kanal aktivieren
- Blitzlicht-Kanal aktivieren
- Quiz nachträglich anhängen
- Quiz vor der ersten gestarteten Frage austauschen

### 4.2 Host-Rolle

Die Host-Ansicht ist die umfangreichste Oberfläche der App. Sie übernimmt Sessionsteuerung, Kanalmanagement, Live-Auswertung und Abschluss.

#### Lobby und Beitritt

In der Lobby sind verfügbar:

- Session-Code
- QR-Code
- Join-Link kopieren
- Live-Teilnehmerliste
- Teamübersicht
- visuelle Join-/Ankunftsmomente
- Anzeige aktiver Teilnehmer bzw. Presence
- Umschalten in einen immersiven Hostmodus
- Vollbildunterstützung

#### Quiz-Steuerung

Der Host kann den Quizablauf steuern über:

- nächste Frage
- Antworten freigeben
- Ergebnisse anzeigen
- Diskussionsphase starten
- zweite Abstimmungsrunde starten
- Session beenden

Unterstützt werden dabei:

- globale oder pro Frage übersprungene **Lesephasen**
- Countdown-Synchronisation
- Fortschrittsanzeige, wie viele schon abgestimmt haben
- Anzeige, ob alle abgestimmt haben
- Readiness-Signal in der Lesephase

#### Live-Daten in der Host-Ansicht

Der Host sieht zusätzlich:

- aktuelle Frage inklusive korrekter Antworten
- Live-Freitextdaten
- Freitext-Wortwolke mit Document-Frequency-Termgewichtung, Einfrieren/Live-Fortsetzen sowie CSV-/PNG-Export
- Q&A-Wortwolke mit Host-Sortiermodi (`Meist unterstuetzt`, `Beste Fragen`, `Umstritten`), Document-Frequency-Termgewichtung, geschuetzten technischen Begriffen, Quellenanzahl im Tooltip, Freeze im Dialog und Vollansicht mit Sortiertoggle
- Q&A-Fragenliste
- Blitzlicht-Ergebnisse
- Emoji-Reaktionen
- Rangliste
- Team-Rangliste
- aggregiertes Session-Feedback

#### Kanalsteuerung

Der Host kann zwischen drei Live-Kanälen wechseln:

- Quiz
- Q&A
- Blitzlicht

Für diese Kanäle kann der Host:

- sie aktivieren
- sie schließen und wieder öffnen
- einen bevorzugten Live-Kanal setzen
- kanalabhängige UI-Tabs steuern

#### Laufende Anpassungen

Während der Session kann der Host zusätzlich:

- das eigene Host-Preset und Theme lokal wechseln; Join-, Vote- und Present-Clients behalten ihr eigenes Preset und Theme
- den Q&A-Titel live ändern
- Quiz austauschen, solange die Session noch in der Startphase ist

#### Audio und Inszenierung

Die Host-Ansicht enthält ein eigenes Musik-/Audio-System:

- Phasenmusik für Lobby, Lesephase und Countdown
- Track-Auswahl pro Phase
- Stummschalten
- SFX-Steuerung
- countdownbezogene Effekte

### 4.3 Present-Rolle

Die Present-Ansicht ist die öffentliche Raumansicht für Beamer oder große Displays.

Sie zeigt je nach Situation:

- Lobby und Join-Hinweise
- aktuelle Frage
- Antwortoptionen
- Countdown
- Ergebnisse
- Team-Finale
- grosse Freitext-Wortwolke als Standard-Buehnenansicht bei aktiver Freitextfrage
- reduzierte Q&A-Wortwolke als oeffentliche Begriffs- und Phrasenbuehne ohne Bedien-UI
- sichtbare Q&A-Fragen
- angepinnte Q&A-Frage
- Blitzlicht-Balkendiagramm

Die Present-Ansicht ist damit nicht nur eine Kopie der Host-Ansicht, sondern eine reduzierte, publikumsgeeignete Projektion.

### 4.4 Teilnehmendenrolle

Die Vote-Ansicht ist die aktive Interaktionsoberfläche für Teilnehmende.

Sie unterstützt:

- Lobby und Wartesituation
- Nickname-/Team-Identität
- Empfang der aktuellen Frage
- Antwortabgabe je nach Fragetyp
- Countdown
- Lesebereitschaft bestätigen
- Ergebnisansicht
- persönliche Scorecard
- Q&A-Einreichung und Bewertung
- eingebettetes Blitzlicht
- Emoji-Reaktionen
- Session-Abschluss mit Bonuscode und Feedback

Die Teilnehmendenansicht bekommt außerdem **rollenabhängig reduzierte Fragedaten**:

- in der Lesephase nur den Fragenstamm
- in der aktiven Abstimmung keine preisgegebenen Korrektmarkierungen
- in der Ergebnisphase erst die aufgelösten Informationen

Das ist ein eigener Sicherheits- und Fairness-Aspekt der App.

Die Vote-Oberfläche verwaltet dabei auch Clientzustand wie:

- Rejoin-Token
- lokale Abstimmungsmarker
- eigenes Team
- lokales Theme und Preset
- Session-End-Gates für Bonuscode oder Feedback

### 4.5 Join-Rolle

Die Join-Seite übernimmt den eigentlichen Eintritt in eine Session.

Sie kann:

- Sessiondaten laden
- Nickname-Kollisionen vermeiden
- Nicknamen aus thematischen Listen anbieten
- freie Nicknames zulassen oder verbieten
- anonymen Beitritt unterstützen
- Teamwahl bei manueller Zuweisung anzeigen
- Teamvorschau bei automatischer Zuweisung zeigen
- Session- und Nicknamelisten periodisch aktualisieren

Gerade der Join-Flow ist stark konfigurationsabhängig und übernimmt die vom Host vorgegebenen Regeln.

## 5. Q&A als eigener Live-Kanal

Q&A ist kein bloßes Zusatzfeature, sondern ein eigenständiger Fachbereich der App.

### 5.1 Nutzungsformen

Q&A kann laufen als:

- komplette **Q_AND_A-Session**
- Zusatzkanal innerhalb einer Quiz-Session
- aus dem Home-Bereich schnell gestarteter Kanal

### 5.2 Teilnehmerfunktionen

Teilnehmende können:

- Fragen einreichen
- bis zu **drei Fragen pro Session** stellen
- eigene Fragen wieder löschen
- fremde Fragen bewerten
- je nach Oberfläche aufwärts oder auf- und abwärts voten
- eigene Fragen nicht selbst bewerten

### 5.3 Moderation und Sichtbarkeit

Der Host kann:

- Moderation an / aus schalten
- Fragen freigeben
- Fragen anpinnen
- Fragen entpinnen
- Fragen archivieren
- Fragen löschen

Statusmodell pro Frage:

- `PENDING`
- `ACTIVE`
- `PINNED`
- `ARCHIVED`
- `DELETED`

### 5.4 Kanalsteuerung

Der Q&A-Kanal kann:

- aktiviert werden
- geschlossen und wieder geöffnet werden
- einen eigenen Titel tragen
- in Moderations- und Nicht-Moderationsmodus wechseln

### 5.5 Darstellung

Q&A erscheint:

- in der Host-Ansicht als Moderations- und Steuerbereich inklusive Sortiermodi `Meist unterstuetzt` / `Beste Fragen` / `Umstritten`, Bewertungsmetriken und sortierabhaengiger Q&A-Wortwolke
- in der Present-Ansicht als sichtbare Fragenliste, Pin-Highlight und reduzierte Q&A-Wortwolke aus denselben gewichteten Termen
- in der Vote-Ansicht als Einreichungs- und Abstimmungsoberfläche

## 6. Blitzlicht / Quick Feedback

Blitzlicht ist technisch leichtgewichtig, fachlich aber sehr breit einsetzbar.

### 6.1 Unterstützte Typen

Im aktuellen Stand sind umgesetzt:

- Stimmung positiv / neutral / negativ
- Ja / Nein / Vielleicht
- Ja / Nein
- Wahr / Falsch / Weiß nicht
- Sterne
- ABCD

### 6.2 Nutzungsformen

Blitzlicht kann laufen:

- **standalone** mit eigenem Code und Host-Token
- **sessiongebunden** als Kanal einer normalen Live-Session

### 6.3 Host-Funktionen

Der Host kann im Blitzlicht:

- eine Runde starten
- Typ wechseln
- Abstimmung sperren und entsperren
- Runde zurücksetzen
- Diskussionsphase starten
- zweite Runde starten
- Runde beenden
- Link kopieren
- QR-Code anzeigen

### 6.4 Teilnehmendenfunktionen

Teilnehmende können:

- je Runde genau einmal abstimmen
- je nach Typ passende Eingaben wählen
- auf zweite Runden reagieren
- Theme und Preset lokal im eigenen Browser behalten; weder Standalone- noch Session-Blitzlicht übernimmt Host-Style
- beim Tempo-Feedback ihre aktuelle Auswahl wechseln oder per Re-Tap entfernen

### 6.5 Ergebnismodus

Das Blitzlicht zeigt live:

- Verteilung der Stimmen
- Gesamtzahl der Stimmen
- Rundenstatus
- Sperrstatus
- bei Doppelrunden eine **Meinungsverschiebung** zwischen Runde 1 und Runde 2
- beim Tempo-Feedback eine aggregierte Tendenz mit den Host-Kennzahlen **Online** und **Rückmeldungen**

Technisch liegt dieser Kanal in Redis-Kurzzeitzuständen und läuft ohne eigenes Prisma-Datenmodell.

## 7. Teams, Punkte, Gamification und Abschluss

Ein erheblicher Teil der App-Funktion liegt in der Auswertung und Inszenierung des Quizbetriebs.

### 7.1 Team-Modus

Der Team-Modus unterstützt:

- 2 bis 8 Teams
- automatische Round-Robin-Zuweisung
- manuelle Teamwahl
- eigene Teamnamen
- farbcodierte Teams
- Team-Lobby
- Team-Leaderboard
- Team-Finale auf Vote- und Present-Seite

### 7.2 Punkte und Leaderboards

Die Punkteberechnung berücksichtigt:

- Schwierigkeitsgrad
- Antwortzeit
- Frageart
- Antwortkorrektheit
- die **effektive Stimme** pro Frage/Runde; bei Peer Instruction ersetzt Runde 2 für Scoring und Auswertung die erste Runde

Zusätzlich existieren:

- persönliches Leaderboard
- Team-Leaderboard
- persönliche Zwischen-Scorecard
- Rangänderung zwischen Fragen

### 7.3 Peer Instruction

Peer Instruction ist in zwei Domänen umgesetzt:

- im Quiz
- im Blitzlicht

Der Ablauf ist jeweils:

- erste Abstimmungsrunde
- Diskussionsphase
- zweite Abstimmungsrunde
- Vergleich der Ergebnisse
- effektive Rundenwertung für Score, Leaderboard, Bonuscodes und Exporte

### 7.4 Belohnungs- und Motivationssystem

Je nach Quiz-Preset, lokalem UI-Preset und Quizkonfiguration sind verfügbar:

- Soundeffekte
- Belohnungseffekte
- Motivationsnachrichten
- Emoji-Reaktionen
- Streak-Multiplikatoren

### 7.5 Bonuscodes

Nach einer beendeten Session können die besten Teilnehmenden automatisch einen **Bonuscode** erhalten.

Umgesetzt sind:

- konfigurierbare Anzahl von Bonuscodes
- Generierung nach Session-Ende
- Anzeige beim Teilnehmenden
- Liste für den Host
- CSV-Export
- spätere Sichtbarkeit in der Quiz-Sammlung
- serverseitige Verifikation und Löschung einzelner Codes

Die Bonuslogik ist auf datensparsame Nachnutzung ausgelegt: Der Code ist die Brücke zwischen Pseudonym und späterer freiwilliger Einlösung.

### 7.6 Session-Feedback

Nach einer beendeten Session kann pro Teilnehmer genau einmal Feedback abgegeben werden.

Unterstützt werden:

- Gesamtbewertung
- Qualitätsbewertung der Fragen
- Angabe, ob man ein solches Format wiederholen würde
- aggregierte Auswertung für Host und Sammlung

### 7.7 Exporte

Die App unterstützt mehrere Exportarten:

- CSV-Export der Sessionergebnisse
- aggregierter, hostseitiger Session-Export mit anonymisierten bzw. zusammengefassten Ergebnissen
- Bonuscode-Export
- Admin-Export als Behörden-PDF oder JSON
- Admin-Export einer Session als Quiz-Importformat

## 8. Admin-Funktionen und Betreiberpfad

Der Admin-Bereich ist ein echter Betreiberbereich und kein kosmetisches Dashboard.

### 8.1 Authentifizierung

Admin-Zugriff basiert auf:

- Shared Secret
- Admin-Session-Token
- serverseitig geschützten `adminProcedure`-Routen

Die URL `/admin` allein verleiht keine Rechte.

### 8.2 Sessions recherchieren

Admins können:

- Sessions listen
- nach Status, Typ und Code filtern
- eine Session per Code nachschlagen
- Session-Details öffnen
- Quizfragen und Antworten inspizieren

### 8.3 Rechtliche Sicherung und Löschung

Im Admin-Bereich sind vorhanden:

- **Legal Hold** setzen und lösen
- Session endgültig löschen
- alle Sessions mit Sicherheitsphrase löschen
- Audit-Logging der Maßnahmen

### 8.4 Behördenexport

Admins können einen Fall-Export erzeugen als:

- PDF
- JSON

Der Export enthält unter anderem:

- Session-Metadaten
- Quizstruktur
- aggregierte Antwortdaten
- rechtliche Halteinformationen
- Audit-Spuren

### 8.5 Plattformstatistik

Admins können außerdem:

- den Rekord für maximale Teilnehmerzahl zurücksetzen
- plattformweite Rekordwerte über Server-Status / Detaildialog nachvollziehen
- MOTD-Interaktionsstatistiken gezielt zurücksetzen

## 9. MOTD, News-Archiv und Plattformkommunikation

Die App besitzt ein eigenes, integriertes System für Betreiberkommunikation.

### 9.1 Öffentliche Seite

Nutzende sehen:

- aktuelle Meldung als Overlay auf der Startseite
- Archiv-Dialog im Header
- Archiv-Seite unter `/news-archive`
- Ungelesen-Badges in Toolbar und Footer

### 9.2 Interaktionen

Für MOTDs existieren getrennte Interaktionsarten:

- Kenntnisnahme
- Daumen hoch
- Daumen runter
- Schließen per Button
- Schließen per Swipe

### 9.3 Admin-Oberfläche für MOTD

Im Admin-Bereich können Betreiber:

- MOTDs anlegen
- MOTDs bearbeiten
- Status setzen: Draft, Scheduled, Published, Archived
- Priorität vergeben
- Start- und Endzeit festlegen
- Sichtbarkeit im Archiv steuern
- Markdown pro Sprache pflegen
- Vorschau rendern
- Interaktionsstatistiken zurücksetzen
- Textvorlagen anlegen, bearbeiten und löschen

### 9.4 Mehrsprachigkeit der Meldungen

MOTDs unterstützen getrennte Inhalte für:

- Deutsch
- Englisch
- Französisch
- Spanisch
- Italienisch

Mit Fallbacklogik, falls eine Sprache nicht gepflegt ist.

## 10. Globale Produktfunktionen

Neben den fachlichen Kernflows hat die App mehrere plattformweite Funktionen.

### 10.1 Sprachen

Die App ist lokalisiert für:

- Deutsch
- Englisch
- Französisch
- Spanisch
- Italienisch

Lokalisiert sind:

- zentrale Routen
- Oberfläche
- Rechtstexte
- Help-Seite
- MOTD

### 10.2 Theme und Presets

Es gibt zwei getrennte globale Ebenen:

- **Theme**: system / hell / dunkel
- **Preset**: seriös / spielerisch

Die Presets beeinflussen nicht nur Farben, sondern auch Standardverhalten und Sessionoptionen.

### 10.3 PWA

Die App ist als Progressive Web App ausgelegt und unterstützt:

- Installationshinweise
- Service Worker
- Update-Banner
- Manifest
- App-Icons und Screenshots

### 10.4 Server-Status und Verbindungsfeedback

Die App zeigt im Footer:

- Serverzustand
- Lastzustand
- aktive Sessions
- laufende Blitzlicht-Runden
- aktive Teilnehmende
- abgeschlossene Quiz-Sessions
- Status-Ampel für den aktuellen Plattformzustand
- Archiv-Badge

Zusätzlich existieren:

- `health.footerBundle` für Footer-Dot und schlanke Statusdaten
- `health.stats` für den Detaildialog
- getrennte DTO-Werte `serviceStatus` und `loadStatus`
- Plattformstatistiken aus `PlatformStatistic` und `DailyStatistic`, inklusive Allzeit- und 30-Tage-Rekorden
- Verbindungsbanner
- WebSocket-Verbindungsstatus mit Reconnect-Logik

### 10.5 Hilfe-, Datenschutz- und Impressumsseiten

Die App enthält eigene Inhaltsseiten für:

- Hilfe
- Datenschutz
- Impressum
- News-Archiv

Die Rechtstexte werden als Markdown pro Locale geladen.

## 11. Datenschutz, Datenhaltung und Lebenszyklus

Datenschutz ist nicht nur im Wording sichtbar, sondern im Datenmodell und in den Cleanup-Regeln.

### 11.1 Grundprinzip

Die App folgt weitgehend einem **Zero-Account- und Local-First-Modell**:

- kein reguläres Benutzerkonto für Hosts oder Teilnehmende
- Quizerstellung lokal im Browser
- serverseitige Daten primär für Live-Betrieb
- Token-basierte Rollen statt klassischer Benutzerverwaltung

### 11.2 Gespeicherte Domänenobjekte

Im Datenmodell existieren unter anderem:

- Quiz
- Frage
- Antwortoption
- Session
- Participant
- Vote
- Team
- BonusToken
- SessionFeedback
- QaQuestion
- QaUpvote
- Motd
- MotdLocale
- MotdInteractionCounter
- MotdTemplate
- PlatformStatistic
- DailyStatistic
- AdminAuditLog
- MotdAuditLog

### 11.3 Cleanup und Retention

Wichtige Lebenszyklusregeln im Ist-Stand:

- verwaiste aktive Sessions werden nach **24 Stunden** beendet
- beendete Sessions werden nach **24 Stunden** gelöscht, sofern kein Legal Hold und keine noch aufzubewahrenden Bonuscodes oder Feedbackdaten entgegenstehen
- Bonuscodes werden nach **90 Tagen** bereinigt
- Session-Feedback wird nach **90 Tagen** bereinigt
- Quick-Feedback-Zustände laufen nach etwa **30 Minuten** ab
- Presence-Daten sind kurzlebig
- Readiness-Daten werden pro Frage separat gehalten

### 11.4 Besitz- und Zugriffsschutz

Wichtige Zugriffsebenen sind:

- Host-Token für Host- und Present-Routen
- Session-Host-Prüfung im Backend
- Admin-Token für Betreiberfunktionen
- lokale Besitzsignatur bzw. Zugriffsnachweis für Quiz-Historie in der Sammlung

## 12. Technische Grundlagen, die fachlich relevant sind

Die technische Architektur ist selbst Teil des Funktionsumfangs, weil viele Features ohne sie nicht existieren würden.

### 12.1 Frontend

- Angular 21.2.x
- Standalone Components
- Angular Material 3
- Signals
- lokalisierte Routen
- SSR/Prerender für ausgewählte Seiten

### 12.2 Backend

- Express
- tRPC v11 für HTTP und WebSocket
- PostgreSQL via Prisma 7.4.x
- Redis für Rate-Limits, Host-/Admin-Token-TTLs und kurzlebige Live-Hilfsdaten
- Yjs-WebSocket-Server für Sammlungssync

### 12.3 Realtime und Synchronisation

Fachlich relevante Realtime-Bausteine:

- Status-Subscriptions
- Current-Question-Subscriptions
- Teilnehmer-Subscriptions
- Blitzlicht-Subscriptions
- Q&A-Refresh-Mechanismen
- WebSocket-Reconnect
- Yjs-Sync für Quizsammlung

### 12.4 Produktionsverhalten

Das Backend kann im Produktivmodus:

- lokalisierte Frontend-Builds ausliefern
- Sprachwahl über `Accept-Language` berücksichtigen
- `robots.txt` und `sitemap.xml` servieren
- das gebaute Frontend direkt mitausliefern

## 13. Bekannte Grenzen und noch offene Punkte

Die App ist funktional schon breit, aber nicht in jedem Bereich endgültig abgeschlossen. Der aktuelle Repo-Stand weist explizit auf offene oder noch nicht vollständig ausgereifte Themen hin.

Dazu gehören laut Root-Dokumentation insbesondere:

- vollständige Last- und Performance-Teststrecken
- abschließende Barrierefreiheitsprüfung
- Confidence-Erweiterungen und weitere Auswertungsvarianten
- delegierte Q&A-Moderation und weitere Q&A-Erweiterungen
- weitere Word-Cloud-Ausbaustufen
- Härtung einzelner Sync-/Komplexitätsbereiche

Diese Übersicht beschreibt daher den **aktuellen produktiven Funktionsumfang**, nicht den vollständigen Zielzustand des Backlogs.

## 14. Einordnung des Gesamtprodukts

Zusammengefasst ist `arsnova.eu` im aktuellen Stand keine einzelne Quizmaske, sondern ein zusammengesetztes System aus:

- lokalem Quiz-Authoring
- Live-Session-Orchestrierung
- mehreren Interaktionskanälen
- Team- und Gamification-Mechaniken
- Auswertungs- und Exportpfaden
- Betreiber- und Compliance-Funktionen
- plattformweiter Kommunikation
- mehrsprachiger, installierbarer Web-App-Infrastruktur

Gerade die Kombination aus **Quiz**, **Q&A**, **Blitzlicht**, **local-first Sammlung**, **mehrsprachiger App-Shell**, **Admin-/Legal-Pfad** und **MOTD-System** macht den Funktionsumfang deutlich größer als bei einer reinen „Frage anzeigen und Antwort einsammeln“-App.
