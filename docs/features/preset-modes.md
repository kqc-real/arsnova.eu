# Preset-Modi (Session-Voreinstellungen)

Die Preset-Modi sind ein zentrales Unterscheidungsmerkmal von arsnova.eu. Sie erlauben es Dozenten, mit **einem Klick** eine komplette Session-Konfiguration zu laden – optimiert für den jeweiligen Einsatzzweck. Kein langwieriges Zusammenklicken einzelner Optionen, kein versehentliches Vergessen eines Toggles.

## Konzept & Motivation

In klassischen Audience-Response-Systemen (Kahoot!, Mentimeter) gibt es meist einen einzigen Modus. arsnova.eu erkennt, dass Hörsaal-Quizze je nach Kontext **fundamental verschiedene Anforderungen** haben:

| Szenario | Bedürfnis |
|----------|-----------|
| Prüfungsvorbereitung | Kein sozialer Druck, Fokus auf Inhalt, anonyme Teilnahme |
| Auflockerung in der Vorlesung | Wettbewerb, Rangliste, Sound, Emoji-Reaktionen |
| Teamarbeit im Seminar | Gruppenbildung, kooperative Auswertung |

Die Preset-Modi lösen dieses Problem mit **zwei Grundkonfigurationen**, die der Dozent jederzeit individuell anpassen kann.

## Die zwei Presets

### Seriös

> *Druckfrei, anonym, Fokus auf Inhalt.*

![Preset: Seriös](preset-serioes.png)

**Defaults:**
- Alle Gamification-Features **aus** (keine Rangliste, keine Effekte, keine Sounds)
- Namensmodus: **Anonym**
- Lesephase: **an** (Studierende lesen zuerst die Frage, bevor die Antwortphase startet)
- Zeitlimit: **aus**

**Typischer Einsatz:** Formative Assessments, Prüfungsvorbereitung, sensible Themen, bei denen Studierende sich nicht exponieren sollen.

### Spielerisch

> *Rangliste, Sound & Effekte, Motivation & Wettbewerb.*

![Preset: Spielerisch](preset-spielerisch.png)

**Defaults:**
- Rangliste: **an**
- Effekte bei richtiger Antwort: **an**
- Anfeuerungstexte: **an**
- Emoji-Reaktionen: **an**
- Sound: **an**
- Zeitlimit: **an**
- Namensmodus: **Nicks** (mit Altersgruppe „Nobelpreisträger")
- Lesephase: **aus**

**Typischer Einsatz:** Auflockerung in der Vorlesung, Wettbewerbs-Quizze, Gamified Learning.

### Spielerisch + Team-Modus

Wenn der **Team-Modus** mit dem Preset **Spielerisch** kombiniert wird, soll die Session schon vor der ersten Frage nach Wettbewerb aussehen, ohne hektisch zu werden:

- Bereits beim **Beitritt** sehen Teilnehmende farbige Teamkarten und bekommen bei manueller Auswahl einen kleinen positiven Bestätigungsmoment.
- In der **Host-Lobby** erscheinen Teams gruppiert mit Farben und Mitgliedern; auf dem Beamer darf das wie ein bevorstehendes Teamduell wirken.
- In den **Ergebnisphasen auf dem Teilnehmergerät** bleibt der Teamgedanke sichtbar: eigene Teamkarte, Teamrang, Team-Punkte und eine kleine Topliste schaffen einen kollektiven Reward statt nur Individual-Feedback.
- Im **Present-/Beamer-Finale** gibt es eine Siegerkarte und ein Team-Balkenboard; im Preset `PLAYFUL` mit dezentem Finish-Effekt.
- Alle dekorativen Bewegungen bleiben an `@media (prefers-reduced-motion: no-preference)` gebunden.
- Gamification-Effekte sind unterstützend: klare Zugehörigkeit, leichte Spannung, kein visuelles Chaos.

## Optionen im Detail

Jede Option ist ein Toggle (an/aus) und gehört zu einer Kategorie:

### Gamification & Auswertung

| Option | Icon | Beschreibung |
|--------|------|-------------|
| Rangliste (Punkte & Platzierung) | `leaderboard` | Zeigt eine Live-Rangliste nach jeder Frage |
| Effekte bei richtiger Antwort | `auto_awesome` | Visuelle Belohnungseffekte bei korrekter Antwort |
| Anfeuerungstexte nach Antwort | `campaign` | Motivierende Nachrichten nach der Antwortabgabe |
| Emoji-Reaktionen zulassen | `emoji_emotions` | Teilnehmer können mit Emojis reagieren |
| Bonus-Token für Top-Plätze | `emoji_events` | Belohnungen für die besten Platzierungen |

### Teilnahme & Nicknames

Der Namensmodus bestimmt, wie Teilnehmer im Quiz erscheinen:

| Modus | Icon | Beschreibung |
|-------|------|-------------|
| **Nicks** | `theater_comedy` | Vordefinierte Pseudonyme aus einer Altersgruppe (s. Nickname-Themes) |
| **Eigen** | `edit` | Teilnehmer wählen frei einen Nickname |
| **Anonym** | `visibility_off` | Keine sichtbaren Namen, vollständige Anonymität |

### Ablauf & Zeit

| Option | Icon | Beschreibung |
|--------|------|-------------|
| Zeitlimit pro Frage (Countdown) | `timer` | Countdown-Timer für jede Frage |
| Zuerst lesen, dann antworten | `menu_book` | Zwei-Phasen-Modus: Lesephase → Antwortphase |

### Team

| Option | Icon | Beschreibung |
|--------|------|-------------|
| In Teams spielen | `groups` | Aktiviert den Team-Modus (2–8 Teams wählbar) |
| Teams auto/manuell zuweisen | `shuffle` | Art der Teamzuweisung (nur aktiv wenn Team-Modus an) |
| Eigene Team-Namen | `edit_note` | Optional: eigene Namen statt `Team A`, `Team B`, …; Vorschau der effektiv entstehenden Teams im Quiz-Setup |

### Audio

| Option | Icon | Beschreibung |
|--------|------|-------------|
| Sound bei Aktionen | `volume_up` | Akustisches Feedback bei Aktionen |
| Hintergrundmusik in Lobby | `music_note` | Musik während der Wartelobby |

### Optionsabhängigkeiten

Manche Optionen erfordern eine übergeordnete Option:

```
teamAssignment → teamMode (muss an sein)
```

Ist die Parent-Option aus, wird die abhängige Option ausgegraut und auf „aus" erzwungen.

## Aktueller UI-Stand Team-Modus

- `quiz/new` und `quiz/:id`: Teamanzahl, Auto/Manual-Zuweisung und optionale eigene Team-Namen mit Live-Vorschau
- `join/:code`: Teamkarten mit Farben, Mitgliederzahl und Auswahlzustand; bei `AUTO` sichtbare Teamvorschau, bei `MANUAL` direkte Auswahl
- `session/:code/host`: Teamübersicht in der Lobby sowie Team-Leaderboard in der Abschlussansicht
- `session/:code/present`: Team-Siegerkarte und kompaktes Balkenboard für das Beamer-Finale
- `session/:code/vote`: kollektiver Team-Reward in `RESULTS` und `FINISHED` mit eigener Teamkarte und Mini-Leaderboard

Offen bleibt vor allem die formale Story-Abnahme; der sichtbare Teamfluss von Setup über Join/Lobby bis Vote/Present ist jetzt umgesetzt.

## Nickname-Themes (Altersgruppen)

Im Modus **Nicks** wählt der Dozent eine Altersgruppe, die den Nickname-Pool bestimmt:

![Nickname-Theme-Auswahl](preset-nickname-theme.png)

| Theme | Icon | Beschreibung |
|-------|------|-------------|
| Nobelpreisträger | `military_tech` | Namen berühmter Nobelpreisträger (Default) |
| Kita | `child_care` | Kindgerechte, einfache Tiernamen o.Ä. |
| Grundschule | `abc` | Altersgerechte Fantasienamen |
| Mittelstufe | `calculate` | Wissenschaftliche Begriffe |
| Oberstufe | `school` | Komplexere, akademische Pseudonyme |

Die Themes sind als Zod-Enum `NicknameThemeEnum` in `libs/shared-types/src/schemas.ts` definiert und werden sowohl im Frontend als auch im Backend validiert.

## Persistenz (localStorage)

Alle Einstellungen werden **pro Preset** im Browser des Dozenten gespeichert. Es gibt keinen Server-Roundtrip – das passt zum Zero-Knowledge-Prinzip.

| Key | Inhalt |
|-----|--------|
| `home-preset` | Aktives Preset (`serious` \| `spielerisch`) |
| `home-preset-options-serious` | JSON mit Optionen, Namensmodus, Theme, Teamanzahl |
| `home-preset-options-spielerisch` | JSON mit Optionen, Namensmodus, Theme, Teamanzahl |
| `home-theme` | UI-Theme (`system` \| `dark` \| `light`) |

**Payload-Struktur** (Beispiel):

```json
{
  "options": {
    "showLeaderboard": true,
    "enableRewardEffects": true,
    "enableMotivationMessages": true,
    "enableEmojiReactions": true,
    "bonusTokenCount": false,
    "defaultTimer": true,
    "readingPhaseEnabled": false,
    "teamMode": false,
    "teamAssignment": false,
    "enableSoundEffects": true,
    "backgroundMusic": false
  },
  "nameMode": "nicknameTheme",
  "nicknameThemeValue": "NOBEL_LAUREATES",
  "teamCountValue": 2
}
```

## Komponenten-Architektur

```mermaid
graph TD
    HC["HomeComponent<br/><small>Orchestrierung, Session-Code, Navigation</small>"]
    PTC["PresetToastComponent<br/><small>Preset-UI, Optionen, Speichern</small>"]
    TPS["ThemePresetService<br/><small>Globaler State: Preset + Theme</small>"]
    LS["localStorage<br/><small>Persistenz pro Preset</small>"]
    ST["@arsnova/shared-types<br/><small>NicknameThemeEnum (Zod)</small>"]

    HC -->|"presetToastVisible signal"| PTC
    PTC -->|"closed output"| HC
    PTC -->|"inject()"| TPS
    PTC -->|"saveAndClose()"| LS
    PTC -->|"loadPreset()"| LS
    TPS -->|"setPreset()"| LS
    PTC -->|"NicknameThemeEnum.safeParse()"| ST

    style HC fill:#1a1a2e,stroke:#e94560,color:#fff
    style PTC fill:#1a1a2e,stroke:#0f3460,color:#fff
    style TPS fill:#1a1a2e,stroke:#16213e,color:#fff
    style LS fill:#0f3460,stroke:#533483,color:#fff
    style ST fill:#0f3460,stroke:#533483,color:#fff
```

## User-Flow: Preset konfigurieren

```mermaid
flowchart TD
    A["Startseite öffnen"] --> B{"Preset wählen<br/>(Header-Toggle)"}
    B -->|Seriös| C["Preset: Seriös geladen"]
    B -->|Spielerisch| D["Preset: Spielerisch geladen"]
    C --> E["Preset-Toast öffnet sich"]
    D --> E
    E --> F{"Optionen anpassen?"}
    F -->|Ja| G["Chips togglen,<br/>Namensmodus wählen,<br/>Theme/Teamanzahl setzen"]
    G --> F
    F -->|Nein| H{"Aktion"}
    H -->|Speichern| I["localStorage aktualisiert"]
    H -->|Zurücksetzen| J["Defaults des aktiven Presets laden"]
    H -->|Preset wechseln| K["Anderes Preset laden"]
    H -->|Schließen| L["Toast schließen"]
    I --> L
    J --> F
    K --> E
    L --> M["Session starten<br/>mit gespeicherter Konfiguration"]

    style A fill:#16213e,stroke:#0f3460,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style I fill:#0f3460,stroke:#533483,color:#fff
    style M fill:#1a1a2e,stroke:#0f3460,color:#fff
```

## Erweiterungspunkte

| Was | Wo | Aufwand |
|-----|-----|---------|
| Neues Nickname-Theme | `NicknameThemeEnum` in `libs/shared-types`, `NICKNAME_THEME_OPTIONS` in `preset-toast.component.ts` | Gering |
| Neue Preset-Option | `PRESET_OPTION_IDS` + Kategorie in `preset-toast.component.ts`, `getPresetDefaults()` anpassen | Gering |
| Neue Kategorie | `PRESET_CATEGORIES` erweitern | Gering |
| Drittes Preset (z.B. „Prüfung") | `PresetValue`-Type in `ThemePresetService`, neuer Default-Block in `getPresetDefaults()`, Header-Toggle erweitern | Mittel |
| Server-seitige Preset-Sync | Neuer tRPC-Endpoint, Prisma-Schema erweitern | Hoch |
