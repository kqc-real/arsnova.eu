<!-- markdownlint-disable MD013 -->

# Story 5.4a – Implementierungsplan: Foyer-Einflug im Preset Spielerisch

**Epic 5 · Gamification & Audio-Effekte**
**Ziel:** Neue Teilnehmende erscheinen waehrend der Connecting-/Lobby-Phase im Preset `Spielerisch` als farbige Chips, die sichtbar in das Foyer bzw. in Teamspalten einfliegen, ohne Session-Code, QR-Zone oder Teamkarten unlesbar zu machen.

**Backlog-Bezug:** `Story 5.4a Foyer-Einflug im Preset Spielerisch`
**Bezug zu bestehender Planung:** `docs/implementation/EPIC-5-IMPLEMENTATION-PLAN.md` (Story 5.4 behandelt Belohnungseffekte waehrend/nach dem Spiel; Story 5.4a erweitert den Lobby-Einstieg davor)

**Status:** 📌 Planungsdokument / vor Implementierung

---

## Zielbild

Im Preset `Spielerisch` entsteht in der Lobby ein klar lesbarer, beamer-tauglicher Einflug neuer Teilnehmender:

- **Host-Lobby / Beamer:** Neue Joins werden als Chips in einer eigenen Foyer-Ebene visualisiert.
- **Team-Modus:** Jede Teamkarte bekommt einen eigenen lokalen Einflugraum mit konsistenter Einflugseite.
- **Teilnehmenden-Geraet:** Nach erfolgreichem Join gibt es einen kleineren Ankunftsmoment, keinen zweiten grossen Lobby-Aufbau.
- **Ruhiger Endzustand:** Nach dem Einflug docken Chips stabil an und bleiben nicht permanent in Bewegung.
- **A11y / Reduced Motion:** Bei reduzierter Bewegung wird der Effekt deutlich vereinfacht oder auf sanfte Einblendung reduziert.

---

## Nicht-Ziele

- kein neues Backend- oder shared-types-Vertragsformat in der ersten Ausbaustufe
- keine neue REST-Schnittstelle
- kein Ersatz der bestehenden textuellen Lobby-Listen
- keine permanente, frei herumfliegende Chip-Wolke
- keine zusaetzliche Preisgabe personenbezogener Daten in anonymen Kontexten
- kein verpflichtender Join-Sound

---

## Leitentscheidungen

1. **Frontend-first, bestehende Daten nutzen.**
   Der erste Slice basiert auf der bestehenden Host-Subscription fuer Teilnehmerbeitritte und auf dem bestehenden Join-Erfolg im Teilnehmenden-Client.

2. **Animierte Ebene und Text-Ebene bleiben getrennt.**
   Die Chip-Animation ist eine eigene visuelle Schicht und spiegelt nicht 1:1 die vorhandenen Namenslisten oder Teamlisten wider.

3. **Chips nutzen feste Geometrie statt roher Namensbreite.**
   Unterschiedlich lange Nicknames duerfen weder die Flugbahnen noch die Endslots verschieben.

4. **Teamkarten bekommen lokale Einflugrichtungen.**
   Nicht alle Teams nutzen dieselbe globale Einflugseite; die Richtung leitet sich aus der aktuell gerenderten Kartenposition ab.

5. **Kindergarten-Pseudonymset bekommt sanftere Icon-Bewegung.**
   Normale Chips duerfen sichtbar mitauslaufen; Tier-Icons sollen eher einen kurzen, abbremsenden Impuls als einen vollen Spin erhalten.

---

## Ist-Stand (relevante Einbaupunkte)

| Bereich                 | Status                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Host-Lobby**          | `session-host.component.html/.ts/.scss` enthaelt Hero-Card, Live-Banner, Teamkarten und bestehende Teilnehmerlisten. Neue Teilnehmerbeitritte kommen bereits live ueber `trpc.session.onParticipantJoined`. |
| **Teilnehmenden-Lobby** | `session-vote.component.html/.ts/.scss` kennt die Joining-/Lobby-Phase und den erfolgreichen Auto-Join, zeigt bisher aber keinen eigenen Ankunftsmoment.                                                    |
| **Preset-/Effektlogik** | Preset `PLAYFUL` / `spielerisch`, `enableRewardEffects` und `enableSoundEffects` existieren bereits und koennen als Gate fuer die Story wiederverwendet werden.                                             |
| **Datenmodell**         | `SessionParticipantsPayload` liefert bereits `participants` und `participantCount`; fuer Story 5.4a ist in Phase 1 kein DTO-Ausbau zwingend noetig.                                                         |

---

## Betroffene Dateien

### Primaer

- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.scss`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.scss`

### Neu (empfohlen)

- `apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.ts`
- `apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.html`
- `apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.scss`
- `apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.spec.ts`
- `apps/frontend/src/app/features/session/session-host/foyer-chip-label.util.ts`
- `apps/frontend/src/app/features/session/session-host/foyer-chip-label.util.spec.ts`

### Optional / global

- `apps/frontend/src/styles.scss` (nur falls globale Keyframes oder Motion-Tokens noetig werden)

---

## Architektur- und Datenfluss

### Host-Lobby

1. `session-host.component.ts` merkt sich den letzten bekannten `SessionParticipantsPayload`.
2. Bei jedem neuen `onParticipantJoined`-Payload wird die Teilnehmermenge per `participant.id` gegen den vorherigen Stand diffed.
3. Fuer jede neu hinzugekommene Person wird ein **Arrival Event** erzeugt.
4. Dieses Event wird an eine eigene visuelle Schicht `foyer-entrance-layer` uebergeben.
5. Die Schicht rendert den Einflug, verwaltet kurze Lebenszyklen und entfernt das Event nach dem Andocken wieder aus dem aktiven Queue.

### Teilnehmenden-Geraet

1. Nach erfolgreichem `session.join` wird lokal ein kleiner Arrival-Moment ausgelost.
2. Es gibt **keine** zweite komplexe Foyer-Simulation auf dem Smartphone.
3. Die bestaetigende Mikrointeraktion ist an dieselben Gates gebunden: `spielerisch`, Lobby-Phase, Effekte aktiv, kein `prefers-reduced-motion: reduce`.

### Warum kein neuer Backend-Vertrag im ersten Slice?

- Die Story braucht primaer **Join-Deltas**, keine neuen fachlichen Session-Daten.
- Die Host-Seite bekommt die Beitritte bereits live.
- Der Teilnehmer-Client kennt den erfolgreichen Join bereits lokal.
- Zusatzausbau erst dann, wenn spaeter Sound, feinere Gruppierung oder Cross-Device-Synchronitaet separat begruendet werden.

---

## Bewegungsgrammatik

## Host ohne Team-Modus

- Neue Chips landen **nicht** direkt auf textuellen Listenelementen.
- Stattdessen gibt es im Foyer eine eigene, kompakte **Chip-Zone** nahe der Lobby-Flaeche oder nahe der Teilnehmerzaehlung.
- Flugbahn: kurzer Bogen vom Rand in den Foyer-Bereich.
- Timing: ca. `640ms` bis `720ms`, `ease-out`, kleiner Overshoot vor der Endlage.
- Rotation: sichtbare, bis zum Zielpunkt abbremsende Rotation des Chips; Endlage ruhig.
- Danach bleibt der Textbereich der normalen Teilnehmerliste unveraendert lesbar.

## Host im Team-Modus

- Jede Teamkarte bekommt einen eigenen lokalen Einflugraum.
- Die Einflugseite wird **nicht hart am Teamindex**, sondern an der aktuell gerenderten Kartenposition bestimmt:
  - linke Kartenhaelfte → Einflug von links / links-oben
  - rechte Kartenhaelfte → Einflug von rechts / rechts-oben
- Pro Team werden 2 bis 4 leicht versetzte Bahnen genutzt, damit kein mechanischer Ketteneffekt entsteht.
- Ziel ist ein **Docking-Anker** knapp innerhalb der Kartenkante; danach kurzer Nachlauf in einen ruhigen Endslot.
- Bei mehreren fast gleichzeitigen Joins desselben Teams arbeiten die Chips in kleinen Wellen mit kurzem Stagger.

## Kindergarten-Pseudonymset

- Tier-Icons oder starke Emoji-Markierungen sollen **nicht** mit einem lauten Vollspin arbeiten.
- Empfohlen ist:
  - Chip fliegt in der Team-/Foyerrichtung ein.
  - Das Tier-Icon bekommt nur einen kurzen Tilt/Wobble oder eine kleine abbremsende Drehung.
- Ziel: spielerisch, aber nicht billig oder unscharf.

## Teilnehmenden-Geraet

- Kleiner Pop-/Slide-in oder Mini-Chip-Ankunft oberhalb des Wartestatus.
- Keine grosse Buehne, kein konkurrierendes zweites Lobby-Layout.
- Dauer deutlich kuerzer als auf dem Host (`240ms` bis `360ms`).

---

## Umgang mit unterschiedlich langen Namen

Das ist fuer Story 5.4a eine **verbindliche Designentscheidung**: Der animierte Chip darf **nicht** von der vollen Nickname-Laenge abhaengen.

### Regel 1: Eigene Display-Tokens statt roher Nicknames

Die Animationsschicht arbeitet mit einem separaten `displayToken`:

- **Kindergarten-Emoji vorhanden:** Emoji-only oder Emoji-plus-sehr-kurzer Token
- **anonymer Kontext:** abstraktes Symbol, Initiale oder neutraler Chip
- **dichte Team-/Batch-Situation:** kompakter Token (1 bis 2 Initialen oder sehr kurze Graphemform)
- **entspannte Einzel-/Kleingruppe:** kurzer Name mit harter Maximalbreite

### Regel 2: Feste Chip-Geometrie

- Chips haben feste Hoehe und definierte Maximalbreite.
- Kein Chip darf durch lange Labels seine Flugbahn, Lane oder Endposition verbreitern.
- Ueberlauf wird immer kontrolliert behandelt, z. B. ueber Ellipsis oder Downgrade auf kompaktere Darstellung.

### Regel 3: Graphem-sichere Verkuerzung

Normale String-Slices reichen nicht, weil Nicknames Emoji, kombinierte Zeichen oder Sonderzeichen enthalten koennen.

Empfohlen:

- Utility `foyer-chip-label.util.ts`
- Verkuerzung nach Graphemen statt nach UTF-16-Positionen
- bei Bedarf Nutzung von `Intl.Segmenter`, mit definierter Fallback-Strategie

### Regel 4: Voller Name bleibt in Text- und A11y-Ebene erhalten

- Der volle Nickname bleibt in `aria-label`, Tooltip oder bestehender textueller Teilnehmer-/Teamliste erhalten.
- Die Chip-Ebene ist eine **visuelle Bewegungsdarstellung**, keine vollstaendige Textdarstellung.

### Regel 5: Die Animation dockt an Slots, nicht an Textbreiten

- Im Team-Modus dockt die Bewegung an **Slots oder Rails** innerhalb der Teamkarte an, nicht an die exakte Breite eines Namenseintrags.
- Im Nicht-Team-Modus docken Chips an eine eigene Foyer-Zone oder an eine kompakte Chip-Ansammlung an, nicht an die Textliste.

### Praktische Konsequenz

Damit loest Story 5.4a die Namenslaenge nicht ueber immer intelligentere Chip-Breiten, sondern ueber die klare Trennung:

- **Bewegungsebene:** kompakt, stabil, geometrisch kontrolliert
- **Textebene:** vollstaendige Namen, bestehende Listen, saubere A11y

---

## Effekt-Gates

Der Effekt wird nur aktiv, wenn alle folgenden Bedingungen erfuellt sind:

1. Session-/Theme-Preset ist `PLAYFUL` bzw. `spielerisch`
2. Session ist in der Lobby-/Connecting-Phase
3. Effekt-Schalter wie `enableRewardEffects` sind aktiv
4. `prefers-reduced-motion` verlangt keine starke Reduktion

Optional zusaetzlich:

- Join-Sound nur, wenn `enableSoundEffects` aktiv ist und Browser-Autoplay/User-Gesture dies erlaubt

---

## Skalierung bei vielen Joins

Die Story verlangt Lesbarkeit auch unter Last. Deshalb wird die Bewegung ab steigender Join-Dichte bewusst vereinfacht:

| Last                             | Verhalten                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| **1 bis 3 neue Joins**           | voller Einflug mit sichtbarer Kurve und ruhigem Docking                                    |
| **4 bis 7 neue Joins**           | kuerzere Flugbahnen, engerer Stagger, kompaktere Tokens                                    |
| **8+ neue Joins in kurzer Zeit** | reduzierte Bewegungsdauer, ggf. Sammel-/Cluster-Logik, keine ausufernde Einzelchoreografie |

Wichtig:

- Die Darstellung skaliert ueber **kuerzere Bewegung und kompaktere Tokens**, nicht ueber mehr Chaos.
- Session-Code, QR-Zone und Start-Aktion muessen jederzeit lesbar bleiben.

---

## Implementierungsstrategie

Die Umsetzung erfolgt in **5 Phasen**.

---

## Phase 1: Host-Deltas und Arrival-Event-Modell

Ziel: Aus den bestehenden Live-Teilnehmerdaten eine saubere, testbare Join-Ereignisschicht ableiten.

| #   | Task                             | Beschreibung                                                                                          | Datei                                            |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1.1 | **Vorherigen Payload merken**    | Vorherigen `SessionParticipantsPayload` im Host halten, um neue `participant.id` erkennen zu koennen. | `session-host.component.ts`                      |
| 1.2 | **Join-Diff berechnen**          | Neu hinzugekommene Teilnehmende per ID diffen; nur diese werden animiert.                             | `session-host.component.ts`                      |
| 1.3 | **Arrival-Event-Typ definieren** | Interner Typ fuer Zielbereich, Teaminfo, Display-Token, Motion-Variante und Zeitstempel.              | `session-host.component.ts` oder neue util-Datei |
| 1.4 | **Effect-Gates kapseln**         | `playful + lobby + effects enabled + motion allowed` in eine eigene berechenbare Guard ueberfuehren.  | `session-host.component.ts`                      |

### Ergebnis

- Host kann neue Joins deterministisch erkennen
- keine Animation fuer bereits vorhandene Teilnehmende beim Re-Render

---

## Phase 2: Eigene Foyer-Schicht fuer den Host

Ziel: Die Lobby bekommt eine separate Animationsebene, ohne das bestehende Layout fachlich umzubauen.

| #   | Task                           | Beschreibung                                                                                              | Datei                                       |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 2.1 | **Neue Komponente anlegen**    | `foyer-entrance-layer.component.*` als Standalone-Komponente fuer Arrival-Events und Layout-Anchor.       | neue Dateien                                |
| 2.2 | **Host-HTML anbinden**         | Komponente in die Lobby einhaengen, ohne Hero-Card, QR-Zone oder Teamkarten zu ueberdecken.               | `session-host.component.html`               |
| 2.3 | **Motion-Shell aufbauen**      | Aeussere Huelle fuer Flugbahn, innere Huelle fuer Rotation / Icon-Impuls.                                 | `foyer-entrance-layer.component.html/.scss` |
| 2.4 | **Ruhigen Endzustand sichern** | Events nach dem Andocken in stabile Slots ueberfuehren oder geordnet aus der aktiven Flugphase entfernen. | `foyer-entrance-layer.component.ts/.scss`   |
| 2.5 | **Reduced Motion Variante**    | Statt Einflug: kurzer Slide-/Fade-in mit stabiler Endlage.                                                | `foyer-entrance-layer.component.scss`       |

### Ergebnis

- sichtbarer Foyer-Einflug im Host
- keine direkte Kollision mit der Text-Lobby

---

## Phase 3: Team-Modus, Slot-System und Namensstrategie

Ziel: Teamspalten und variable Namen robust abbilden.

| #   | Task                            | Beschreibung                                                                                                                  | Datei                                         |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 3.1 | **Teamanchor bestimmen**        | Gerenderte Teamkarten ueber DOM-Position/Rect erfassen, um Einflugseite und Docking-Anker aus der echten Position abzuleiten. | `session-host.component.ts` + neue Komponente |
| 3.2 | **Slots / Rails definieren**    | Pro Teamkarte kleine Endslots oder Rail-Zonen definieren; keine Kopplung an Textbreiten der Namensliste.                      | `foyer-entrance-layer.component.ts/.scss`     |
| 3.3 | **Display-Token-Utility bauen** | Graphem-sichere Verkuerzung / Initialenbildung / Emoji-only-Varianten kapseln.                                                | `foyer-chip-label.util.ts`                    |
| 3.4 | **Kindergarten-Sonderfall**     | Tier-Icons mit sanfterem Bewegungsimpuls statt vollem Spin behandeln.                                                         | `foyer-entrance-layer.component.scss`         |
| 3.5 | **Dense-Mode umsetzen**         | Bei hoher Join-Dichte auf kompaktere Tokens und kuerzere Flugbahnen umschalten.                                               | `foyer-entrance-layer.component.ts/.scss`     |

### Ergebnis

- Teamkarten haben konsistente, lesbare Join-Richtung
- lange Nicknames destabilisieren die Animation nicht

---

## Phase 4: Teilnehmenden-Geraet mit kleinem Ankunftsmoment

Ziel: Erfolgreicher Join wird auch auf dem Smartphone spielerisch bestaetigt, aber deutlich kompakter als im Host.

| #   | Task                         | Beschreibung                                                                 | Datei                               |
| --- | ---------------------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| 4.1 | **Join-Erfolg abfangen**     | Nach erfolgreichem `session.join` einen lokalen Arrival-State setzen.        | `session-vote.component.ts`         |
| 4.2 | **Mini-Animation einbauen**  | Kleiner Chip-/Badge-Pop oberhalb oder innerhalb der bestehenden Lobby-Karte. | `session-vote.component.html/.scss` |
| 4.3 | **Gates wiederverwenden**    | Nur im passenden Preset und nur in der Lobby zeigen.                         | `session-vote.component.ts`         |
| 4.4 | **Reduced Motion absichern** | Statt Pop/Rotation nur sanfte Bestaetigung.                                  | `session-vote.component.scss`       |

### Ergebnis

- erfolgreicher Eintritt fuehlt sich auf dem Smartphone bestaetigt an
- keine doppelte, konkurrierende Foyer-Buehne

---

## Phase 5: Tests, Verifikation und Abnahme

Ziel: Story 5.4a ist nicht nur visuell reizvoll, sondern stabil und rueckbaubar.

### Technische Checks

| #   | Task                     | Beschreibung                                                                              |
| --- | ------------------------ | ----------------------------------------------------------------------------------------- |
| 5.1 | **Host-Spec erweitern**  | Join-Deltas, Gates und Teambestimmung testen.                                             |
| 5.2 | **Neue Layer-Specs**     | Arrival-Event-Rendering, Dense-Mode, Reduced Motion, Kindergarten-Variante.               |
| 5.3 | **Label-Utility testen** | Graphem-Verkuerzung, Initialenbildung, Emoji-only, A11y-Label.                            |
| 5.4 | **Vote-Spec erweitern**  | Mikro-Ankunft nach erfolgreichem Join pruefen.                                            |
| 5.5 | **Frontend-Validation**  | fokussierte Specs, Frontend-Typecheck, lokalisierter Build falls UI-Text geaendert wurde. |

### Manuelle Abnahme

Mindestens folgende Szenarien muessen einmal manuell geprueft werden:

1. Host-Lobby im Preset `Spielerisch`, Nicht-Team-Modus, mehrere Joins
2. Host-Lobby im Team-Modus mit mehreren Teams und parallelen Joins
3. Kindergarten-Pseudonymset mit Tier-Icons
4. Smartphone-Join mit kleinem Arrival-Moment
5. `prefers-reduced-motion: reduce`
6. Kontrast-/Lesbarkeitscheck auf Beamer oder grossem Screen

---

## Abnahmekriterien fuer die Umsetzung

- Der Effekt erscheint nur in `Spielerisch` und nur in der Lobby-/Connecting-Phase.
- Neue Joins sind sichtbar, ohne Session-Code, QR oder Startaktion zu ueberdecken.
- Teamkarten behalten klare Leserichtung und Team-Erkennbarkeit.
- Lange Nicknames fuehren weder zu springenden Slots noch zu ausfransenden Chip-Breiten.
- Der Endzustand ist ruhig und dauerhaft lesbar.
- Bei `prefers-reduced-motion` ist die Bewegung deutlich reduziert.
- Die Teilnehmenden-Ansicht bekommt nur einen kleinen, passenden Arrival-Moment.

---

## Empfohlene Umsetzungsreihenfolge

1. **Phase 1** Join-Deltas und Arrival-Event-Modell
2. **Phase 2** Host-Foyer-Schicht
3. **Phase 3** Team-Modus + Namensstrategie + Dense-Mode
4. **Phase 4** Teilnehmer-Mikrofeedback
5. **Phase 5** Tests + manuelle Lobby-Abnahme

---

## Risiken und Gegenmassnahmen

| Risiko                                                | Auswirkung                                | Gegenmassnahme                                                     |
| ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Lange Namen sprengen die Animation                    | springende Breiten, unlesbare Teamkarten  | feste Chip-Geometrie, Display-Token, Slots statt Textbreiten       |
| Zu viele parallele Joins erzeugen Chaos               | hektische Lobby, schlechte Beamer-Wirkung | Dense-Mode, kuerzere Flugwege, Batched Waves                       |
| Teamrichtung stimmt nach Responsive-Reflow nicht mehr | unplausible Einflugseiten                 | Richtung aus realer Kartenposition statt hartem Teamindex ableiten |
| Emoji-/Tier-Icons wirken unscharf bei Vollrotation    | billiger Eindruck                         | nur kurzer Icon-Impuls, keine aggressive Vollrotation              |
| Animationsschicht verdeckt zentrale Lobby-Infos       | Bedien- und Lesbarkeitsprobleme           | eigene Rand-/Kartenzonen, klare Z-Index- und Safe-Zone-Regeln      |
| Reduced Motion wird vergessen                         | A11y-Regression                           | Gate von Anfang an in Phase 1 und 2 mitbauen                       |
