<!-- markdownlint-disable MD013 -->

# ADR-0023: PWA-Update-Hinweis ohne Modal und ohne stilles Live-Reload

**Status:** Accepted  
**Datum:** 2026-04-30  
**Entscheider:** Projektteam

## Kontext

arsnova.eu nutzt im Frontend einen Angular-Service-Worker (`SwUpdate`) und zeigt bei `VERSION_READY` derzeit einen sichtbaren Update-Hinweis mit expliziter Aktion `Jetzt laden`.

Für das weitere Produktverhalten standen drei Varianten zur Diskussion:

1. **Modaler Update-Hinweis**: Ein blockierendes Dialogfenster zwingt früh zur Aktualisierung.
2. **Stilles Update ohne sichtbaren Hinweis**: Die App aktualisiert sich unauffällig bei nächster Navigation oder nächster Benutzerinteraktion.
3. **Nicht blockierender Hinweis**: Ein sichtbarer Banner informiert über die neue Version; die Aktualisierung erfolgt explizit durch die Nutzer:innen.

Die Entscheidung ist für arsnova.eu heikel, weil die App nicht nur statische Seiten ausliefert, sondern auch:

- laufende Quiz-, Q&A- und Blitzlicht-Sessions,
- Host- und Presenter-Steuerung mit Live-Zuständen,
- Teilnehmendenansichten mit zeitkritischen Phasen,
- Editoren mit potenziell ungespeichertem lokalen Zustand.

Ein Update-Muster, das auf einer statischen Website unproblematisch ist, kann in einer Live-Session Vertrauen, Timing oder Orientierung beschädigen.

## Entscheidung

### 1. Ein modales Update-Fenster wird als Standard verworfen

Der Update-Hinweis für Service-Worker-Versionen wird **nicht** als blockierendes Modal umgesetzt.

Stattdessen bleibt das Produktmuster:

- **sichtbarer, nicht blockierender Hinweis**
- **explizite Nutzeraktion** zum Aktualisieren
- kein erzwungener Dialog allein deshalb, weil eine neue Version verfügbar ist

Begründung:

- Ein Modal erzeugt unnötig den Eindruck eines riskanten oder potenziell destruktiven Vorgangs.
- Für normale Teilnehmenden- und Lesekontexte ist ein blockierender Eingriff zu aggressiv.
- In Live-Situationen ist Sichtbarkeit wichtig, aber Zwang ohne fachliche Notwendigkeit nicht.

### 2. Es gibt kein stilles Auto-Reload in Live- oder Bearbeitungskontexten

Ein Service-Worker-Update darf **nicht still** durch ein automatisches Reload auf der nächsten Benutzerinteraktion oder dem nächsten internen Seitenwechsel umgesetzt werden, solange sich die Person in einem fachlich sensiblen Kontext befindet.

Dazu zählen insbesondere:

- Host-Ansicht
- Presenter-Ansicht
- Teilnehmendenansichten während `QUESTION_OPEN`, `ACTIVE` oder vergleichbaren Live-Phasen
- Quiz bearbeiten
- Quiz neu
- sonstige Ansichten mit lokalem, noch nicht persistiertem Zustand

Begründung:

- Ein stilles Reload kann laufende Live-Steuerung, Countdown-Wahrnehmung oder Session-Kontext abrupt unterbrechen.
- Auf Bearbeitungsseiten droht Verlust lokaler Änderungen oder zumindest der Eindruck davon.
- „Unbemerktes Update“ ist für arsnova.eu kein belastbares UX-Ziel, solange Live-Zustände und Editor-State betroffen sein können.

### 3. Der Standard für Update-Hinweise bleibt ein Banner

Für normale Version-Updates gilt:

- Anzeige als **Banner**
- explizite Aktion wie `Jetzt laden`
- kein implizites Reload durch reinen Angular-Routenwechsel

Der Banner ist ausreichend sichtbar, ohne die App unnötig zu blockieren.

### 4. Kontextabhängige Eskalation bleibt möglich, aber nur bei fachlicher Notwendigkeit

Ein stärkeres Muster als der Banner ist nur dann zulässig, wenn eine neue Version **fachlich kritisch** ist, zum Beispiel bei:

- inkompatibler Client-/Server-Version,
- bekannten Fehlern in Host-/Presenter-Steuerung,
- sicherheitsrelevanten Problemen,
- sonstigen Zuständen, in denen das Arbeiten mit der alten Version nicht mehr zuverlässig vertretbar ist.

Auch dann ist der Standard **nicht automatisch ein Modal**. Die Eskalation muss fachlich begründet und separat entschieden werden.

### 5. Produktregel für arsnova.eu

- **Default:** sichtbarer Banner mit expliziter Reload-Aktion
- **Kein Modal als Standard**
- **Kein stilles Auto-Reload** in Live- oder Editor-Kontexten
- **Kein Reload allein durch internen Seitenwechsel**

## Konsequenzen

### Positiv

- Update-Verhalten bleibt transparent und vertrauenswürdig.
- Live-Sessions werden nicht heimlich durch Reloads unterbrochen.
- Nutzer:innen bekommen keinen unnötigen Eindruck von drohendem Datenverlust durch ein Pflicht-Modal.
- Das bestehende PWA-Muster bleibt einfach und gut verständlich.

### Negativ / Risiken

- Einzelne Nutzer:innen arbeiten unter Umständen länger mit einer älteren Version weiter, bis sie den Banner aktiv nutzen.
- Bei selten genutzten Routen kann ein nicht blockierender Hinweis leichter ignoriert werden.
- Wenn künftig wirklich kritische Mismatch-Fälle auftreten, braucht es zusätzlich eine klar definierte Eskalationslogik.

## Alternativen (geprüft)

- **Globales Update-Modal:** verworfen, weil es unnötig blockiert und psychologisch Datenverlust oder Risiko signalisiert, obwohl das für normale Updates nicht der gewünschte Standard ist.
- **Stilles Reload bei nächster Interaktion oder Navigation:** verworfen, weil es in Live- und Bearbeitungskontexten fachlich und UX-seitig zu riskant ist.
- **Nur Reload beim Browser-Neustart, kein sichtbarer Hinweis:** verworfen, weil Nutzer:innen dann zu wenig Transparenz über verfügbare Updates haben.

## Implementierungsleitplanken

- `SwUpdate.versionUpdates` darf weiterhin einen sichtbaren Update-Zustand setzen.
- Das UI-Muster für normale Updates bleibt ein Banner in der App-Hülle.
- Ein interner Angular-Routenwechsel löst kein automatisches Update-Reload aus.
- Automatische Reloads in Host-, Presenter-, Vote- oder Editor-Kontexten sind ohne separate ADR bzw. explizite Produktentscheidung nicht zulässig.

## Triggerung des Update-Hinweises

Der Update-Banner wird im aktuellen Frontend über den Angular-Service-Worker ausgelöst:

1. `SwUpdate.versionUpdates` wird in der App-Hülle abonniert.
2. Sobald Angular ein Event vom Typ `VERSION_READY` meldet, wird der sichtbare Update-Zustand gesetzt.
3. Erst nach expliziter Nutzeraktion (`Jetzt aktualisieren`) läuft `reloadWithUpdate()`, das `activateUpdate()` und danach `window.location.reload()` ausführt.

Zusätzliche Prüftrigger für neue Versionen:

- beim Start der App, sobald `serviceWorker.ready` verfügbar ist,
- danach in einem periodischen Intervall,
- zusätzlich bei `document.visibilitychange`, wenn der Tab wieder sichtbar wird.

Wichtig:

- Ein interner Angular-Routenwechsel ist **kein** Update-Trigger für ein automatisches Reload.
- Ohne Nutzeraktion bleibt der Banner sichtbar; er wird nicht per Timer oder Navigation verworfen.

### Lokale Dev-Triggerung

Im Dev-Modus stellt die App einen expliziten Test-Hook bereit, um den Banner ohne echtes Service-Worker-Update sichtbar zu machen.

DevTools-Konsole:

```js
window.__triggerUpdateBanner();
```

Der Hook ist ausschließlich für lokale UI-Abnahme und Entwicklung gedacht und wird beim Destroy der App-Hülle wieder entfernt.

## Implementierungsstand (Projekt arsnova.eu)

Stand 2026-04-30:

- Das Frontend hört in `app.component.ts` auf `SwUpdate.versionUpdates`.
- Bei `VERSION_READY` wird ein sichtbarer Update-Banner angezeigt.
- Die Aktualisierung erfolgt erst nach expliziter Nutzeraktion über `reloadWithUpdate()`.
- Ein interner Seitenwechsel innerhalb der Angular-App führt derzeit nicht automatisch zur Aktivierung des Updates.
- Für lokale Tests kann der Banner im Dev-Modus per `window.__triggerUpdateBanner()` eingeblendet werden.

---

**Referenzen:** [app.component.ts](../../../apps/frontend/src/app/app.component.ts), [app.component.html](../../../apps/frontend/src/app/app.component.html), [ADR-0008: Internationalisierung (i18n)](./0008-i18n-internationalization.md), [ADR-0014: Mobile-first Informationsarchitektur für Host-Views](./0014-mobile-first-information-architecture-for-host-views.md), [ADR-0020: Einheitliche Exit-Strategie für Session-Pfade](./0020-session-end-and-error-exit-to-home.md)
