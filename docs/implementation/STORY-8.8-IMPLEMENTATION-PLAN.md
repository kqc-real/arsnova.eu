<!-- markdownlint-disable MD013 -->

# Story 8.8 - Implementierungsplan: Tempo-Blitzlicht als Host-Option

**Epic 8 · Erweiterte Live-Kanaele (Q&A, Blitzlicht)**  
**Ziel:** Das Feature `Tempo` wird als vordefiniertes Blitzlicht-Template innerhalb des bestehenden `quickFeedback`-Stacks umgesetzt. Es entsteht **kein** vierter Session-Kanal. Das Template muss sowohl im Session-Blitzlicht als auch im Standalone-Blitzlicht verfuegbar sein.

**Backlog-Bezug:** `Story 8.8 Tempo-Blitzlicht als Host-Option` in [`../../Backlog.md`](../../Backlog.md)  
**Architekturbezug:** `ADR-0029`, `ADR-0010`, `ADR-0013`, `ADR-0014`, `ADR-0019`, `ADR-0025`  
**Produktbezug:** Issue `#17` "Tempo-Blitzlicht als Host-Option (statt eigenem Session-Kanal)"

**Status:** Umgesetzt (2026-06-04)

**Umsetzungsnachweis:** Implementiert im bestehenden `quickFeedback`-Stack mit `TEMPO`-Template, atomarem mutablem Redis-Hotpath per Lua-Skript, aggregierter 60s/15s-Tendenz, Spotlight-Einstiegen, Startseiten-CTA `Tempo-Feedback` und lokalisierter Host-/Vote-UI. Validiert mit den gezielten Backend-/Frontend-Tests, Typechecks, lokalisiertem Frontend-Build und einer 500-Teilnehmenden-Abnahme mit parallel abgegebenen Tempo-Rueckmeldungen.

---

## Zielbild

Das Host-UI fuer Blitzlicht bietet sowohl in der Session als auch im Standalone-Blitzlicht zusaetzlich ein vordefiniertes Template `Tempo` mit genau vier Reaktionen:

- `🚀 Schneller`
- `🙂 Ich folge`
- `🐢 Langsamer`
- `😕 Verloren`

Fachliche Kerneigenschaften:

- Tempo ist ein **Blitzlicht-Template**, kein eigener Session-Kanal.
- Es gibt weiterhin genau **ein aktives Blitzlicht** zur selben Zeit.
- Teilnehmende koennen ihre Tempo-Auswahl **aendern** oder durch Re-Tap **entfernen**.
- Hosts sehen nur **Aggregation + Tendenz**, keine Einzelrueckmeldungen.
- Die Host-Ansicht bietet einen **Umschalter** zwischen Detaildarstellung und Tendenzindikator.
- Im Standalone-Blitzlicht ist der Tendenzmodus die **dominante, grosse und sofort lesbare Hauptansicht**.
- Auf der Startseite ist `Tempo` eine **Spotlight-Kachel**, nicht nur eine weitere kleine Pill.
- In der Blitzlicht-Host-Startflaeche ist `Tempo` ebenfalls eine **Spotlight-Kachel** und nicht nur ein weiterer kleiner Preset-Chip.
- Die bestehende Blitzlicht-Architektur wird erweitert, nicht verdoppelt.

---

## SWE-Lehrfluss

Die Story soll bewusst entlang eines sauberen SWE-Prozesses entwickelt werden:

1. Feature Request / GitHub-Issue
2. Feature-Branch
3. Branch-Entwicklung
4. Pull Request
5. Code Review
6. UX-Tests
7. UX-Feintuning
8. Produktion

Empfohlener Branchname:

- `codex/<issue-number>-tempo-blitzlicht`

---

## Historischer Ausgangsstand (vor Umsetzung)

| Bereich                    | Status                                                                                                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shared Types**           | `QuickFeedbackTypeEnum` kannte vor Umsetzung `MOOD`, `YESNO`, `YESNO_BINARY`, `TRUEFALSE_UNKNOWN`, `STARS`, `ABCD`. Ein Tempo-Typ fehlte.                                                                                                                                                            |
| **Frontend-Konfiguration** | `apps/frontend/src/app/features/feedback/feedback.config.ts` definiert die vorhandenen Optionen und Preset-Chips fuer Blitzlicht. Fuer `Tempo` fehlt ein Spotlight-Darstellungsmodell jenseits eines weiteren Standard-Presets.                                                                      |
| **Backend-Hotpath**        | `apps/backend/src/routers/quickFeedback.ts` behandelt Blitzlicht derzeit im Kern als Einmal-Vote: Redis-Set fuer `already voted`, Verteilung und Total werden hochgezaehlt.                                                                                                                          |
| **Teilnehmer-UI**          | `feedback-vote.component.ts` ist auf klassischen Vote-Abschluss zugeschnitten und kennt keine template-spezifische Mutable-Semantik.                                                                                                                                                                 |
| **Host-UI**                | Die Blitzlicht-Host-Ansichten koennen Typen starten und Live-Aggregate anzeigen, aber weder Tempo-Tendenz noch den vorgesehenen Umschalter zwischen Detaildarstellung und Tendenzindikator; fuer Standalone fehlt zudem das Zielbild einer grossen, one-glance-faehigen Tendenzansicht mit Zaehlern. |
| **Startseite**             | Das bisherige Hero-Modell ist auf drei Chips optimiert. Fuer `Tempo` fehlt bisher ein exponierter Einstieg fuer Standalone-Blitzlicht, der sichtbar ist, ohne die Hero-Reihe in eine vierte gleichartige Pill zu verwandeln.                                                                         |
| **Session-Architektur**    | Die Session-Shell ist bereits fuer `quickFeedback` etabliert. Fuer Tempo wird explizit **kein** weiterer Kanal eingefuehrt.                                                                                                                                                                          |

---

## Nicht-Ziele

- kein vierter Session-Kanal
- kein neues Session-Tab fuer Host oder Teilnehmende
- kein persistentes Parallel-Widget ausserhalb von Blitzlicht
- keine personenbezogene Verlaufsanalyse
- keine Gamification- oder Ranking-Semantik
- keine globale Aenderung aller Blitzlicht-Typen auf mutable Votes

---

## Technische Leitplanken

### 1. Tempo bleibt im `quickFeedback`-Modell

Das Feature wird innerhalb des bestehenden Blitzlicht-Stacks entwickelt:

- gleicher Kanal
- gleiche Host-Startlogik
- gleicher Teilnehmer-Einstieg
- gleiche Aggregationsansicht als Basis

Die fachliche Erweiterung muss dabei in **beiden** Host-Kontexten verfuegbar sein:

- Session-Blitzlicht
- Standalone-Blitzlicht

### 2. Mutable Verhalten gilt nur fuer `Tempo`

`Tempo` benoetigt eine Sondersemantik:

- Auswahl wechseln
- aktive Auswahl entfernen
- immer nur letzter Zustand zaehlt

Andere Blitzlicht-Typen bleiben beim heutigen Verhalten, solange keine explizite Folgeentscheidung etwas anderes verlangt.

### 3. Keine neue DB-Hotpath-Last

Die Live-Aktualisierung muss im bestehenden performanten Blitzlicht-Pfad bleiben:

- keine SQL-Schreiboperation pro Tap
- keine Vollreaggregation aller Stimmen pro Event
- keine polling-intensive Zusatzstrecke

Die Umsetzung nutzt dafuer eine atomare Redis-Mutation per Lua-Skript; Counts, aktueller Teilnehmerzustand und Tempo-Buckets werden O(1) pro Tap fortgeschrieben.

### 4. Ruhiger Indikator mit Teilnehmerbezug

Die Tendenz darf nicht aus dem bloessen Roh-Snapshot der aktuellen Tempo-Rueckmeldungen abgeleitet werden.

Verbindliche Richtung:

- Aktivierung nur bei ausreichender Rueckmeldequote relativ zu `activeParticipants`
- Bezugsbasis ist die gesamte aktive Teilnehmendenbasis des jeweiligen Blitzlicht-Kontexts, nicht nur `tempoVotes`
- geglaettete Berechnung ueber Rolling Window
- Hysterese vor jedem sichtbaren Indikatorwechsel

### 5. A11y und Mobile sind Teil der Kernfunktion

Die vier Tempo-Reaktionen muessen:

- auf kleinen Screens ohne horizontales Scrollen erreichbar sein
- klaren Fokus- und Aktivzustand haben
- screenreader-taugliche Namen tragen
- nicht ausschliesslich ueber Farbe unterscheidbar sein

Fuer die Host-UI im Standalone-Blitzlicht gilt zusaetzlich:

- die Tendenz muss auf Smartphone-Groesse mit einem Blick lesbar sein
- wesentliche Zaehler bleiben auch im Tendenzmodus sichtbar
- Umschalter und `Session beenden` bleiben erreichbar, ohne die Hauptinformation zu verdraengen

---

## Betroffene Dateien

### Shared Types

- `libs/shared-types/src/schemas.ts`

### Backend

- `apps/backend/src/routers/quickFeedback.ts`
- `apps/backend/src/routers/index.ts` falls Router-Exports angepasst werden muessen
- ggf. Hilfslogik unter `apps/backend/src/lib/quick-feedback*`

### Frontend

- `apps/frontend/src/app/features/feedback/feedback.config.ts`
- `apps/frontend/src/app/features/feedback/feedback-vote.component.ts`
- `apps/frontend/src/app/features/feedback/feedback-vote.component.html`
- `apps/frontend/src/app/features/feedback/feedback-host.component.ts`
- `apps/frontend/src/app/features/feedback/feedback-host.component.html`
- `apps/frontend/src/app/features/feedback/feedback-host.component.scss`
- `apps/frontend/src/app/features/home/home.component.ts`
- `apps/frontend/src/app/features/home/home.component.html`
- `apps/frontend/src/app/features/home/home.component.scss`
- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- ggf. zugehoerige Specs

### Tests

- Backend-Tests fuer `quickFeedback`
- Frontend-Specs fuer Host- und Vote-Komponenten
- Last-/Smoke-Skripte fuer Blitzlicht-Hotpath, sofern vorhanden

---

## Implementierungsstrategie

Die Umsetzung erfolgt in **6 Phasen**. Jede Phase soll:

- kompilierbar bleiben
- testbar bleiben
- keine unscharfen Zwischenvertraege einfuehren

---

## Phase 1: Shared Types und Blitzlicht-Typmodell erweitern

Ziel: Tempo wird als offizieller Blitzlicht-Typ beschreibbar.

### Aufgaben

| #   | Task                               | Beschreibung                                                                                                                 |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | **Tempo-Typ aufnehmen**            | `QuickFeedbackTypeEnum` um `TEMPO` erweitern oder aequivalente Typkonstante einfuehren.                                      |
| 1.2 | **Tempo-Werte definieren**         | Eigene Value-Enum fuer `SPEED_UP`, `FOLLOWING`, `SLOW_DOWN`, `LOST` anlegen.                                                 |
| 1.3 | **Ergebnis-Metadaten vorbereiten** | Falls noetig `QuickFeedbackResult` um template-spezifische Zusatzinfos fuer Tendenz/Indikator erweitern.                     |
| 1.4 | **Typgrenzen festziehen**          | Sicherstellen, dass `TEMPO` als eigener Typ branchbar ist und nicht ueber generische `ABCD`-Werte "hineingeschmuggelt" wird. |

### Ergebnis

- `shared-types` kann Tempo explizit beschreiben
- Frontend und Backend entwickeln gegen denselben Vertrag

---

## Phase 2: Frontend-Konfiguration fuer das neue Template

Ziel: Host und Teilnehmende erhalten eine saubere, lokalisierbare Template-Definition.

### Aufgaben

| #   | Task                                | Beschreibung                                                                                                                                                |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **Tempo-Optionen definieren**       | In `feedback.config.ts` die vier Reaktionen mit Icon, Label und accessible name hinterlegen.                                                                |
| 2.2 | **Host-Spotlight bauen**            | Host-Startflaechen in Session und Standalone um eine feste `Tempo`-Spotlight-Kachel erweitern statt nur einen weiteren Standard-Preset-Chip anzufuegen.     |
| 2.3 | **Anzeigehilfen kapseln**           | Helfer fuer Labels, Reihenfolge und ggf. Tendenz-Text zentral ablegen statt in Templates zu verteilen.                                                      |
| 2.4 | **Startseiten-Spotlight entwerfen** | `Tempo` als Standalone-Blitzlicht-Spotlight auf der Startseite vorsehen, ohne die kanonische 3-Chip-Reihe aus Story 6.7 zu einer vierten Pill zu erweitern. |

### Ergebnis

- eine zentrale Definition fuer Tempo
- keine duplizierten Emoji-/Label-Mappings
- ein sichtbarer, aber IA-konsistenter Startseiten-Spotlight-Einstieg fuer `Tempo`
- eine im Host sofort auffindbare `Tempo`-Spotlight-Kachel statt einer versteckten Zusatz-Pill

---

## Phase 3: Backend-Hotpath fuer mutable Tempo-Rueckmeldungen

Ziel: `quickFeedback` kann fuer `Tempo` Auswahlwechsel und Toggle-off korrekt behandeln.

### Aufgaben

| #   | Task                                            | Beschreibung                                                                                                                                                                  |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | **Vote-Logik verzweigen**                       | In `quickFeedback.vote` zwischen klassischem Einmal-Vote und mutablem `Tempo` unterscheiden.                                                                                  |
| 3.2 | **Atomare Redis-Mutation fuer Counts**          | Vorherigen Zustand einer teilnehmenden Person, Distribution, Toggle-off und neuen Zustand in einem Redis-Lua-Skript konsistent fortschreiben.                                 |
| 3.3 | **Redis-Schluessel pruefen**                    | Bestehende Redis-Struktur fuer Verteilung, Total und Teilnehmerzustand so nutzen/erweitern, dass kein Full-Rebuild und keine Race Condition pro Tap noetig ist.               |
| 3.4 | **Host-Result fuer Tendenz erweitern**          | Aggregat um deterministische Tendenz, Aktivierungszustand und ggf. Statusklasse fuer den Host-Umschalter erweitern.                                                           |
| 3.5 | **Anonymitaet absichern**                       | Sicherstellen, dass keine individuelle Zustandliste an Host/Presenter/Admin ausgeliefert wird.                                                                                |
| 3.6 | **Ablauf "anderes Blitzlicht startet" pruefen** | Beim Ersetzen eines laufenden Tempo-Blitzlichts muessen alte Tempo-Daten so beendet werden, dass kein UI- oder Redis-Zombie stehenbleibt.                                     |
| 3.7 | **Rolling-Window aufbauen**                     | 15-Sekunden-Buckets fuer ein 60-Sekunden-Fenster halten, damit die Tendenz geglaettet und nicht pro Einzelstimme neu springt.                                                 |
| 3.8 | **Aktivierungsschwelle mit Teilnehmerbezug**    | `activeParticipants` als Nenner heranziehen und den Indikator unterhalb einer Mindestquote neutral halten; der Nenner muss in Session und Standalone korrekt bestimmt werden. |

### Ergebnis

- Tempo verhaelt sich fachlich korrekt
- andere Blitzlicht-Typen regressieren nicht
- der Hotpath bleibt O(1) pro Tap

---

## Phase 4: Teilnehmer-UI fuer mutable Tempo-Interaktion

Ziel: Das bestehende Vote-UI bildet die neue Semantik sauber ab.

### Aufgaben

| #   | Task                                | Beschreibung                                                                                                   |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 4.1 | **Aktiven Zustand sichtbar machen** | `feedback-vote` markiert die aktuell gewaehlte Tempo-Reaktion klar und semantisch.                             |
| 4.2 | **Retap entfernt Auswahl**          | Ein Klick auf die aktive Option entfernt den Zustand statt ihn zu ignorieren.                                  |
| 4.3 | **Wechsel ohne Submit**             | Der Wechsel auf eine andere Tempo-Option erfolgt direkt per Tap ohne Zusatzdialog.                             |
| 4.4 | **One-shot-UX begrenzen**           | Hinweise wie "bereits abgestimmt" oder Abschlusszustand duerfen fuer `Tempo` nicht die Interaktion blockieren. |
| 4.5 | **Mobile/A11y prüfen**              | Buttongroessen, Fokus, Screenreader-Text und kleine Viewports absichern.                                       |

### Ergebnis

- Teilnehmende koennen Tempo wie gefordert laufend anpassen
- die UI bleibt innerhalb des bestehenden Blitzlicht-Flows konsistent

---

## Phase 5: Host-UI fuer Tendenz und Sichtbarkeit

Ziel: Hosts koennen Tempo gezielt starten und den Zustand schnell erfassen.

### Aufgaben

| #   | Task                                          | Beschreibung                                                                                                                                             |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | **Tempo in Host-Auswahl als Spotlight bauen** | Session- und Standalone-Host bieten `Tempo` als startbare, visuell hervorgehobene Spotlight-Kachel an statt als kleine Zusatz-Pill.                      |
| 5.2 | **Umschalter einfuehren**                     | Host-Ansicht bietet einen Toggle-Button fuer `Detaildarstellung` und `Tendenzindikator`.                                                                 |
| 5.3 | **Standalone-Tendenz als Hero bauen**         | Im Standalone-Blitzlicht wird die Tendenz gross, auffaellig und auf einen Blick lesbar dargestellt.                                                      |
| 5.4 | **Zaehler sichtbar halten**                   | Im Standalone-Tendenzmodus werden die Host-Kennzahlen `Online` und `Rueckmeldungen` deutlich angezeigt.                                                  |
| 5.5 | **Bedienleiste erhalten**                     | Umschalter und `Session beenden` bleiben auch im Standalone-Tendenzmodus sichtbar und gut erreichbar.                                                    |
| 5.6 | **Kontextgerechte Platzierung**               | `FeedbackHostComponent` rendert den Umschalter eingebettet im Session-Blitzlicht und standalone im dortigen Host-Layout jeweils an der richtigen Stelle. |
| 5.7 | **Keine Einzelpersonen-Leaks**                | UI zeigt keine Rohdaten, keine Listen, keine technisch internen IDs.                                                                                     |

### Ergebnis

- Hosts erkennen schnell, ob das Tempo passt
- die Zusatzinformation bleibt innerhalb der bestehenden Blitzlicht-IA

---

## Phase 6: Tests, PR und UX-Abnahme

Ziel: Das Feature wird sauber review- und releasefaehig.

### Tests

- Backend:
  - Vote neu setzen bei `Tempo`
  - Vote wechseln bei `Tempo`
  - Vote per Re-Tap entfernen
  - andere Blitzlicht-Typen bleiben Einmal-Vote
  - Host bekommt nur Aggregation und Tendenz
  - Tendenz bleibt unterhalb der Mindestquote neutral
  - Tendenz springt nicht bei einer Einzelstimme zwischen zwei Kategorien
- Frontend:
  - Session-Host und Standalone-Host koennen `Tempo` starten
  - Teilnehmer-UI markiert aktiven Zustand korrekt
  - Re-Tap entfernt Auswahl
  - kleine Screens / Tastaturbedienung funktionieren
  - Umschalter zwischen Detaildarstellung und Tendenz funktioniert in beiden Host-Kontexten
  - Standalone-Tendenzansicht bleibt auf Smartphone-Groesse mit einem Blick lesbar
  - `Online`, `Rueckmeldungen`, Umschalter und `Session beenden` bleiben im Standalone-Tendenzmodus sichtbar
  - neutraler Zustand und aktiver Zustand des Tendenzmodus sind klar unterscheidbar
- Performance:
  - kein regressiver Hotpath bei 500+ Teilnehmenden
  - keine neue auffaellige Polling- oder Rebuild-Last

### PR-Checkliste

- Story `8.8` und `ADR-0029` im PR verlinken
- Diff klar in `shared-types -> backend -> frontend -> tests` strukturieren
- benoetigte i18n-Strings mitziehen
- gezielt auf Regressionsrisiko fuer bestehende Blitzlicht-Typen reviewen lassen

### UX-Abnahme

- Host versteht auf den ersten Blick, dass `Tempo` ein Blitzlicht-Preset ist
- Auf der Startseite ist `Tempo` ohne Sucharbeit als Spotlight-Kachel auffindbar, aber nicht als vierter gleichrangiger Hero-Chip inszeniert
- In der Blitzlicht-Host-Auswahl ist `Tempo` ohne Sucharbeit als Spotlight-Kachel auffindbar und klar priorisiert
- Tendenz-Indikator ist sichtbar, aber nicht alarmistisch und nicht nervoes
- Der Umschalter zwischen Detaildarstellung und Tendenz ist in Session und Standalone sofort verstaendlich
- Die Standalone-Host-Ansicht macht die Lageeinschaetzung auf dem Handy ohne Nachdenken lesbar
- Teilnehmer koennen ihre Auswahl ohne Nachdenken aendern oder loeschen
- Mobile-Nutzung bleibt one-tap-faehig

---

## Entschiedene Designpunkte

- `TEMPO` ist ein eigener `QuickFeedbackType`; Werte und Semantik bleiben von `ABCD` und anderen klassischen Typen getrennt.
- Die Tendenzlogik lebt in `apps/backend/src/lib/quickFeedbackTempo.ts`; der Router reichert Host-/Client-Snapshots damit an.
- Der Tempo-Hotpath nutzt ein Redis-Lua-Skript in `quickFeedback.vote`, damit parallele Re-Taps und Wechsel die Verteilung nicht verlieren.
- Der Host-Umschalter ist als Segment-Button mit den Textlabels `Details` und `Tendenz` umgesetzt.

## Empfohlene Heuristik fuer die Tendenzberechnung

### Aktivierung

- `activeParticipants` = aktuelle Zahl der aktiven Teilnehmenden im jeweiligen Blitzlicht-Kontext
- `tempoVotes` = Zahl der Teilnehmenden mit aktuellem Tempo-Zustand
- Der Indikator bleibt neutral, solange `tempoVotes < max(8, ceil(0.10 * activeParticipants))`

### Glaettung

- Verteilung in `15s`-Buckets fuehren
- Entscheidungsgrundlage = rollendes Fenster der letzten `60s`
- Angezeigt wird der geglaettete Mittelwert, nicht der rohe Snapshot des letzten Events

### Hysterese

- Eine neue Tendenz muss in mindestens `2` aufeinanderfolgenden Buckets fuehren
- Alternativ darf sie nur bei einer klaren Marge gegenueber der bisherigen Tendenz sofort uebernehmen

### Beispielschwellen

- `lost / activeParticipants >= 0.12` -> `Mehrere Teilnehmende sind abgehaengt.`
- `(slow_down + lost) / activeParticipants >= 0.22` -> `Es wirkt zu schnell.`
- `speed_up / activeParticipants >= 0.22` und `(slow_down + lost) / activeParticipants < 0.10` -> `Die Gruppe kann schneller mitgehen.`
- `following / activeParticipants >= 0.50` und `(slow_down + lost) / activeParticipants < 0.15` -> `Die Mehrheit kann folgen.`
- Sonst, bei kleinem Abstand der Top-Gruppen oder breiter Streuung -> `Die Rueckmeldungen sind gemischt.`

### Zusatzscore

Optional kann parallel ein geglaetteter Score genutzt werden:

- `speed_up = -1`
- `following = 0`
- `slow_down = 1`
- `lost = 2`

Der Score dient dann als Sekundaersignal; harte Sicherheitsregeln fuer `lost` und `slow_down + lost` haben Vorrang.

---

## Definition of Done (story-spezifisch)

- `Tempo` ist als Blitzlicht-Template startbar.
- Teilnehmende koennen `Tempo` setzen, wechseln und per Re-Tap entfernen.
- Hosts sehen nur Aggregation und Tendenz.
- In Session- und Standalone-Host gibt es einen sichtbaren Umschalter zwischen Detaildarstellung und Tendenzmodus.
- Bestehende Blitzlicht-Typen verhalten sich unveraendert.
- Mobile- und A11y-Anforderungen sind fuer die vier Reaktionen erfuellt.
- Lastverhalten zeigt keinen auffaelligen Regressionshotspot fuer grosse Sessions.
- Parallel abgegebene Tempo-Rueckmeldungen von 500 Teilnehmenden werden korrekt aggregiert.
