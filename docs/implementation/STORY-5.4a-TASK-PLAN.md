<!-- markdownlint-disable MD013 -->

# Story 5.4a – Task-Plan: Erste Implementierungsrunde

**Epic 5 · Gamification & Audio-Effekte**
**Ziel der Runde 1:** Einen kleinen, testbaren Host-First Slice fuer den Foyer-Einflug liefern: Im Preset `Spielerisch` erscheinen neue Teilnehmende in der Host-Lobby als kompakte Chips in einer eigenen Foyer-Zone mit sichtbarem Einflug und ruhiger Endlage.

**Backlog-Bezug:** `Story 5.4a Foyer-Einflug im Preset Spielerisch`
**Strategische Grundlage:** `docs/implementation/STORY-5.4a-IMPLEMENTATION-PLAN.md`

**Status:** 📌 Arbeitsgrundlage fuer Runde 1

---

## Ziel von Runde 1

Runde 1 liefert bewusst **nicht** die komplette Story 5.4a, sondern den kleinsten sinnvollen Produkt-Slice:

- **Host-Lobby** im Preset `Spielerisch`
- **Nicht-Team-Modus zuerst**
- **eigene Foyer-Chip-Zone** statt Andocken an die Textliste
- **kompakte Chip-Labels** statt variabler Nickname-Breiten
- **reduced-motion-konforme** Bewegung

Damit steht eine belastbare Basis fuer spaetere Erweiterungen bereit:

- Teamspalten mit lokaler Einflugrichtung
- Teilnehmer-Mikrofeedback auf dem Smartphone
- feinere Dense-/Cluster-Logik
- optionaler Join-Sound

---

## Was Runde 1 abdeckt

- Effekt nur in `PLAYFUL` / `spielerisch`
- Effekt nur in der Lobby-/Connecting-Phase
- sichtbarer Einflug neuer Joins im Host
- ruhiger Endzustand nach dem Einflug
- keine Kollision mit Session-Code, QR-Zone oder Hero-Card
- variable Nickname-Laengen ohne springende Chip-Breiten
- `prefers-reduced-motion`-Variante

---

## Was Runde 1 bewusst noch nicht abdeckt

- teamkartenspezifische Einflugbahnen
- eigens aufbereitete Team-Slot-Systeme
- zweiter Arrival-Moment auf dem Teilnehmer-Geraet
- Join-Sound
- ausgearbeitete Cluster-/Sammel-Logik fuer hohe Join-Dichte

Diese Punkte bleiben Bestandteil des Gesamtplans in `STORY-5.4a-IMPLEMENTATION-PLAN.md`.

---

## Betroffene Dateien fuer Runde 1

### Aendern

- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.scss`

### Neu

- `apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.ts`
- `apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.html`
- `apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.scss`
- `apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.spec.ts`
- `apps/frontend/src/app/features/session/session-host/foyer-chip-label.util.ts`
- `apps/frontend/src/app/features/session/session-host/foyer-chip-label.util.spec.ts`

---

## Implementierungsschnitt fuer Runde 1

### Visuelle Zielzone

- Eine **eigene Foyer-Chip-Zone** innerhalb der Host-Lobby
- Position: im Lobby-Bereich, aber ausserhalb der QR-/Session-Code-Zone und nicht ueber der Start-Aktion
- Ziel: beamer-tauglich, klar lesbar, ruhig

### Datenquelle

- bestehende Host-Subscription `trpc.session.onParticipantJoined`
- Delta-Bildung ueber `participant.id` zwischen altem und neuem Payload

### Label-Strategie

- Chips nutzen **Display-Tokens**, nicht rohe Nickname-Breiten
- Standardfall: kurzer Name mit harter Maximalbreite
- Kindergarten-/Emoji-Fall: Emoji-only oder Emoji-plus-sehr-kurzer Token
- voller Name bleibt in A11y/Textlisten erhalten

---

## Task-Liste (Reihenfolge)

### Phase 1: Host-Gates und Join-Deltas

| #   | Task                                | Beschreibung                                                                                              | Datei                                            |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1.1 | **Effekt-Gate definieren**          | Neue berechnete Guard im Host: `preset playful && status lobby && enableRewardEffects && motion allowed`. | `session-host.component.ts`                      |
| 1.2 | **Vorherigen Payload merken**       | Letzten `SessionParticipantsPayload` lokal halten, um neue Teilnehmer ueber `participant.id` zu erkennen. | `session-host.component.ts`                      |
| 1.3 | **Join-Deltas berechnen**           | Bei jedem Subscription-Update nur neu hinzugekommene Personen extrahieren.                                | `session-host.component.ts`                      |
| 1.4 | **Arrival-Event-Modell einfuehren** | Interner Typ mit `participantId`, `displayToken`, `fullLabel`, `variant`, `createdAt`.                    | `session-host.component.ts` oder neue util-Datei |

### Phase 2: Label-Utility gegen variable Namensbreiten

| #   | Task                              | Beschreibung                                                                            | Datei                      |
| --- | --------------------------------- | --------------------------------------------------------------------------------------- | -------------------------- |
| 2.1 | **Utility anlegen**               | `foyer-chip-label.util.ts` kapselt die visuelle Labelbildung.                           | neue Datei                 |
| 2.2 | **Graphem-sichere Verkuerzung**   | Wenn moeglich `Intl.Segmenter`, sonst definierter Fallback; keine naiven UTF-16-Slices. | `foyer-chip-label.util.ts` |
| 2.3 | **Display-Token-Regeln umsetzen** | kurzer Name, Initialen, Emoji-only, neutraler Fallback fuer dichte oder anonyme Faelle. | `foyer-chip-label.util.ts` |
| 2.4 | **A11y-Label sichern**            | Neben dem kompakten Token immer auch die volle textuelle Bezeichnung bereitstellen.     | `foyer-chip-label.util.ts` |

### Phase 3: Neue Host-Komponente fuer die Foyer-Ebene

| #   | Task                                | Beschreibung                                                                                        | Datei                                 |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 3.1 | **Standalone-Komponente erstellen** | `foyer-entrance-layer.component.*` mit Input fuer aktive Arrival-Events.                            | neue Dateien                          |
| 3.2 | **Host-HTML anbinden**              | Komponente in `session-host.component.html` in die Lobby integrieren.                               | `session-host.component.html`         |
| 3.3 | **Foyer-Zone layouten**             | Eigene Layer-/Zonenflaeche mit sicherem Z-Index und ohne Kollision mit zentralen Infos.             | `foyer-entrance-layer.component.scss` |
| 3.4 | **Feste Chip-Geometrie bauen**      | feste Hoehe, definierte Maximalbreite, Ellipsis/kompakter Token; keine layouttreibende Namenbreite. | `foyer-entrance-layer.component.scss` |

### Phase 4: Einfluganimation fuer Runde 1

| #   | Task                                | Beschreibung                                                                                 | Datei                                       |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 4.1 | **Motion-Shell aufteilen**          | Aeussere Huelle fuer `translate/scale`, innere Huelle fuer `rotate`.                         | `foyer-entrance-layer.component.html/.scss` |
| 4.2 | **Standardflug umsetzen**           | kurzer Bogen vom Rand in die Foyer-Zone, `640ms` bis `720ms`, `ease-out`, kleiner Overshoot. | `foyer-entrance-layer.component.scss`       |
| 4.3 | **Ruhige Endlage sichern**          | Rotation laeuft bis `0deg` aus; danach kein permanentes Schweben.                            | `foyer-entrance-layer.component.scss`       |
| 4.4 | **Kindergarten-Variante absichern** | Tier-/Emoji-Token bekommen nur einen kleinen Tilt/Wobble statt aggressivem Vollspin.         | `foyer-entrance-layer.component.scss`       |
| 4.5 | **Reduced Motion einbauen**         | nur kurzer Slide-/Fade-in ohne sichtbare Rotation.                                           | `foyer-entrance-layer.component.scss`       |

### Phase 5: Lebenszyklus und Begrenzung

| #   | Task                             | Beschreibung                                                                                               | Datei                               |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 5.1 | **Event-Lebensdauer definieren** | Arrival-Events nach der Bewegung aus der aktiven Liste entfernen oder in einen ruhigen Slot ueberfuehren.  | `foyer-entrance-layer.component.ts` |
| 5.2 | **Aktive Menge begrenzen**       | Maximalzahl sichtbarer gleichzeitiger Arrival-Events fuer Runde 1 setzen, um Chaos zu vermeiden.           | `foyer-entrance-layer.component.ts` |
| 5.3 | **Graceful Skip bei hoher Last** | Wenn viele Events gleichzeitig eintreffen, Bewegung kuerzer oder direkter machen statt alles auszuspielen. | `foyer-entrance-layer.component.ts` |

### Phase 6: Tests und Validation

| #   | Task                       | Beschreibung                                                                      | Datei                                    |
| --- | -------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| 6.1 | **Utility-Spec schreiben** | Labelbildung fuer kurze, lange, emoji-lastige und Kindergarten-Nicknames testen.  | `foyer-chip-label.util.spec.ts`          |
| 6.2 | **Layer-Spec schreiben**   | Komponente rendert Arrival-Events, Reduced Motion und kompakte Token korrekt.     | `foyer-entrance-layer.component.spec.ts` |
| 6.3 | **Host-Spec erweitern**    | Join-Deltas und Gate-Logik im Host testen.                                        | `session-host.component.spec.ts`         |
| 6.4 | **Fokussierte Validation** | Frontend-Specs fuer die betroffenen Dateien und Frontend-Typecheck laufen lassen. | Test-/CLI-Schritt                        |

---

## Konkrete Definition fuer variable Namen

Runde 1 loest die Namensfrage explizit so:

1. **Die Animationsbreite ist konstant.** Kein voller Name bestimmt die Chipbreite.
2. **Jeder Chip bekommt einen Display-Token.** Dieser ist kurz und stabil.
3. **Der volle Name bleibt ausserhalb der Animation erhalten.** Zum Beispiel in der bestehenden Teilnehmerliste und in `aria-label`.
4. **Bei sehr langen Namen wird nicht die Karte groesser, sondern der Token kompakter.**
5. **Kindergarten-Emoji haben Vorrang vor Textlaenge.** Wenn ein Tier-Emoji den Nickname bereits gut repraesentiert, darf der visuelle Chip textaermer werden.

Das vermeidet drei haeufige Fehler:

- springende Flugbahnen durch wechselnde Breiten
- unruhige Reflows in der Lobby
- unlesbare Endlagen bei sehr langen Nicknames

---

## Empfohlene technische Reihenfolge im Arbeitszweig

1. `foyer-chip-label.util.ts` + Spec bauen
2. Host-Diff- und Gate-Logik in `session-host.component.ts`
3. `foyer-entrance-layer.component.*` als rein statische Komponente mit Mock-Events
4. echte Arrival-Events aus dem Host anbinden
5. Motion und Reduced Motion finalisieren
6. Specs und Frontend-Typecheck laufen lassen

Diese Reihenfolge minimiert Rework, weil zuerst die instabilste Variable - die Namensdarstellung - technisch eingehegt wird.

---

## Manuelle Abnahme fuer Runde 1

1. Host-Lobby im Preset `Spielerisch` zeigt bei neuen Joins sichtbare Chips.
2. Session-Code, QR-Zone und Start-Button bleiben lesbar und bedienbar.
3. Lange Nicknames fuehren nicht zu breiteren oder springenden Chips.
4. Kindergarten-/Emoji-Nicknames wirken nicht hektisch oder unscharf.
5. Im Preset `Serioes` erscheint kein Einflug.
6. Bei `prefers-reduced-motion: reduce` gibt es nur eine reduzierte Variante.

---

## Folgearbeiten nach Runde 1

Wenn Runde 1 stabil ist, folgen in Runde 2 und 3:

1. teamkartenspezifische Einflugrichtungen und Team-Slots
2. Teilnehmer-Mikrofeedback im `session-vote`
3. ausgearbeiteter Dense-/Cluster-Mode
4. optionaler Join-Sound
