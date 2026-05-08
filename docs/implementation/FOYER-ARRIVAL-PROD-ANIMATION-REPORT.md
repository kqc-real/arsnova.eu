# Bericht: Foyer-Arrival-Animation im Production-Build

Stand: 2026-05-08

## Kurzfassung

Das Foyer-Arrival-Feature funktionierte lokal im Dev-Server wie erwartet, verlor aber im optimierten Production-Build die eigentliche Fluganimation. In Produktion war weiterhin sichtbar, dass neue Teilnehmende im Team ankamen, aber der Chip erschien erst direkt auf der Teamkarte statt vom Viewportrand einzufliegen.

Der Fehler lag **nicht** an einem unvollständigen Merge, **nicht** an einem veralteten Deploy und **nicht** an den zuletzt getesteten Flug-Offsets. Die Ursache war belastbar ein Build-/Kapselungsproblem zwischen Angular-Style-Scoping und lokalen `@keyframes` der Foyer-Komponente. Der Fix wurde lokal im Production-Build reproduziert, verifiziert, ausgerollt und anschließend in der echten Produktion bestätigt.

## Beobachtetes Symptom

- Lokal im Dev-Server: Chip fliegt sichtbar von außen ein.
- Lokal im Production-Build: Chip erscheint erst auf oder nahe der Teamkarte.
- Produktion: zunächst gleiches fehlerhaftes Verhalten wie im lokalen Production-Build.
- Rest des Features blieb intakt:
  - Queue/Timing
  - Team-Puls
  - Badge-/Namenslogik
  - Landing-State

Das war ein wichtiger Hinweis darauf, dass nicht die Ankunftslogik selbst kaputt war, sondern nur die visuelle Transform-Animation.

## Ausschlussdiagnose

Folgende Hypothesen wurden geprüft und verworfen:

1. **PR nicht vollständig gemerged**
   - `origin/main` enthielt alle relevanten Feature-Commits.
   - `git diff origin/main..codex/foyer-arrivals` war leer.

2. **Produktionsdeploy liefert alten Stand**
   - Die ausgelieferten Live-Chunks auf `arsnova.eu` enthielten den vollständigen Foyer-Code.
   - Auch der spätere Offset-Fix mit `innerWidth`/`innerHeight` war im Live-Bundle enthalten.

3. **CSS-Variablen mit `max()/calc()` in `translate3d(...)` sind die Hauptursache**
   - Wurde durch Umstellung auf konkrete `px`-Werte getestet.
   - Ergebnis: keine Änderung des Prod-Fehlers.

Erst der Vergleich **lokaler Production-Build vs. Dev-Server** hat gezeigt, dass der Fehler systematisch im optimierten Build liegt. Die spätere Verifikation nach Rollout hat diesen Befund auch für die echte Produktionsumgebung bestätigt.

## Belastbarer Befund

Ein gezielter Smoke-Test gegen den lokalisierten Prod-Build auf `http://localhost:4201/de` zeigte:

- der Chip war im DOM vorhanden,
- die CSS-Variablen für die Flugbahn waren korrekt gesetzt,
- aber der erste sichtbare Frame erschien bereits auf der Teamkarte,
- `transform` blieb effektiv `none` oder direkt nahe am Zielzustand.

Nach tieferer Inspektion des kompilierten JS/CSS war sichtbar:

- Angular schrieb die lokalen Foyer-`@keyframes` im Prod-Build auf komponentengescope-te Namen um,
- die referenzierenden `animation`-/`animation-name`-Deklarationen zeigten aber nicht konsistent auf dieselben Namen,
- dadurch liefen einzelne Animationen noch, andere aber faktisch nicht.

Besonders tückisch war:

- Trail-/Nebenanimationen konnten weiterhin sichtbar sein,
- die Hauptbewegung des Chips dagegen fiel aus.

Das erzeugte den irreführenden Eindruck, dass nur die Flugbahn selbst falsch berechnet sei.

Dieser Befund ist inzwischen nicht mehr nur lokal reproduziert, sondern auch produktiv bestätigt:

- lokaler Dev-Server: korrekt
- lokaler Production-Build: fehlerhaft
- echte Produktion vor Fix: fehlerhaft
- lokaler Production-Build nach Fix: korrekt
- echte Produktion nach Fix: korrekt

Damit ist die Ursachenanalyse belastbar abgeschlossen.

## Ursache

Die Foyer-Layer-Komponente nutzte lokale, komponentenspezifische Styles mit mehreren `@keyframes`. Im Angular-Production-Build wurden diese Animationen durch Style-Encapsulation transformiert.

Für diese Komponente war diese Kombination problematisch:

- viele lokale `@keyframes`
- mehrere parallel laufende Animationen pro Element
- CSS-Custom-Properties als Eingangsgrößen
- optimierter/lokalisierter Production-Build

Dadurch entstand ein Build-spezifischer Bruch zwischen:

- den erzeugten Keyframe-Namen
- und den referenzierenden Animation-Deklarationen

## Einordnung: Angular-Bug oder Wissenslücke?

Der aktuelle Befund reicht **nicht** aus, um sauber von einem bestätigten Angular-Core-Bug zu sprechen.

Was wir belastbar sagen können:

- Das Verhalten tritt im **optimierten Angular-Production-Build** auf.
- Es hängt mit **Style-Encapsulation und umgeschriebenen Keyframe-Namen** zusammen.
- Der Effekt verschwindet, sobald die Komponente aus dieser lokalen Kapselung herausgenommen wird.

Damit gibt es zwei plausible Lesarten:

1. **Framework-seitige Schwäche oder Bug im Build-/Scoping-Pfad**
   - Dann wäre Angulars Behandlung von lokalen `@keyframes` plus referenzierenden Animationsdeklarationen in diesem Setup inkonsistent.
   - Dafür spricht, dass die kompilierten Keyframe-Namen im Prod-Build sichtbar umgeschrieben wurden, die referenzierenden Namen aber nicht konsistent dieselbe Form hatten.

2. **Unzureichende Annahme unsererseits über Angular-Scoping**
   - Dann ist das Verhalten zwar unangenehm, aber innerhalb des Framework-Modells nicht überraschend genug, um es als Bug zu klassifizieren.
   - Dafür spricht, dass wir lokale, stark gekoppelte Bewegungsanimationen in einer emuliert gekapselten Komponente eingesetzt haben, ohne den Production-Build früh mitzutes­ten.

Für den Projektkontext ist die zweite Formulierung die bessere und belastbarere:

> Der Fehler war vor allem eine **Wissens- und Robustheitslücke im Umgang mit Angular-Style-Scoping für lokale Animationen**, möglicherweise verstärkt durch einen fragilen oder fehleranfälligen Build-Pfad im Framework.

Das heißt praktisch:

- **Nicht bewiesen:** „Angular hat definitiv einen Bug.“
- **Sehr wohl bewiesen:** Lokale, komplexe `@keyframes` in emuliert gekapselten Angular-Komponenten sind für produktionskritische Animationen ein riskanter Pfad.

Deshalb sollte die Lehre für zukünftige Implementierungen nicht lauten:

> „Angular ist kaputt.“

sondern:

> „Bei Angular-Komponenten mit komplexen Bewegungsanimationen müssen wir Style-Scoping, Keyframe-Namen und den Production-Build explizit als technische Risikozone behandeln.“

## Angular-Hintergrund: was hier technisch passiert

Nicht alle Entwicklerinnen und Entwickler müssen diese Angular-Ecke im Alltag kennen. Für diesen Befund sind aber ein paar Begriffe wichtig.

### 1. `ViewEncapsulation`

Angular kann Komponenten-Stile unterschiedlich kapseln.

Die hier relevante Standardvariante ist meist:

- `ViewEncapsulation.Emulated`

Das bedeutet:

- Die Styles stehen zwar in der Komponenten-Datei,
- Angular behandelt sie aber nicht als wirklich isoliertes Shadow DOM,
- sondern emuliert die Kapselung über zusätzliche Attribute im DOM und umgeschriebene Selektoren.

Vereinfacht:

- Angular hängt an gerenderte Elemente Attribute wie `_ngcontent-xyz`
- und erweitert die CSS-Selektoren so, dass sie nur innerhalb dieser Komponente matchen.

Beispielhaft wird aus:

```scss
.foyer-entrance-layer__chip-shell { ... }
```

im Build etwas in der Art von:

```css
.foyer-entrance-layer__chip-shell[_ngcontent-xyz] { ... }
```

Das ist normalerweise erwünscht, weil Komponenten sich so nicht gegenseitig „verschmutzen“.

### 2. Lokale `@keyframes`

Bei normalen CSS-Regeln ist das Scoping relativ naheliegend. Bei Animationen kommt aber ein zweiter Mechanismus dazu:

- `@keyframes` definieren globale Animationsnamen
- `animation` oder `animation-name` referenzieren diese Namen später als String-Identifier

Beispiel:

```scss
@keyframes foyer-overlay-chip-arrive-transform {
  from { ... }
  to { ... }
}

.chip {
  animation-name: foyer-overlay-chip-arrive-transform;
}
```

Das Problem dabei:

- Der Selektor `.chip` kann einfach per Attribut erweitert werden.
- Der Name eines Keyframes ist aber kein normaler Selektor, sondern ein referenzierter Bezeichner.

Wenn ein Framework hier Namespacing oder Umbenennung vornimmt, müssen **Definition** und **Referenz** exakt konsistent bleiben.

### 3. Was Angular im Build macht

Im Development-Modus und im Production-Build läuft nicht immer exakt dieselbe Transformation.

Im Production-Build kommen typischerweise dazu:

- Optimierung
- Minifizierung
- andere Build-Pfade
- Extraktion und Zusammenfassung von Styles
- Lazy-Chunk-Aufteilung
- bei uns zusätzlich lokalisierte Bundles

Für dieses Feature heißt das konkret:

- Die Foyer-Komponente liegt in einem lazy geladenen Host-Chunk.
- Ihre Styles werden im Build transformiert.
- Die `@keyframes` wurden im kompilierten Output sichtbar umbenannt bzw. komponentenspezifisch markiert.

Genau an dieser Stelle entstand der Bruch:

- Die Keyframe-Definitionen und
- die referenzierenden Animationsnamen

blieben im optimierten Build nicht robust genug gekoppelt.

### 4. Warum der Dev-Server trotzdem „richtig“ wirkte

Der Angular-Dev-Server ist kein perfekter Stellvertreter für den finalen Build.

Er unterscheidet sich unter anderem in:

- Build-Optimierung
- Chunking
- CSS-Verarbeitung
- Timing und Reihenfolge von Style-Injektion
- Hot-Reload-/Entwicklungsmodus

Deshalb konnte lokal im Dev-Server alles korrekt aussehen, obwohl genau derselbe Code im echten Production-Build anders reagierte.

Das ist der zentrale Lerneffekt:

> Bei visuellen Animationen ist „läuft im Dev-Server“ in Angular kein ausreichender Beweis für „läuft auch im ausgelieferten Build“.

### 5. Warum `ViewEncapsulation.None` hier geholfen hat

Mit:

- `ViewEncapsulation.None`

werden die Styles dieser Komponente nicht mehr emuliert gekapselt, sondern global ausgegeben.

Das heißt hier praktisch:

- keine komponentenspezifisch umgeschriebenen Selektoren für diese Foyer-Stile,
- keine lokale Keyframe-Umbenennung in diesem problematischen Pfad,
- dadurch wieder konsistente Zuordnung zwischen `@keyframes` und `animation-name`.

Das ist **kein** genereller Rat für alle Komponenten. Globales Styling kann auch Nachteile haben. Für diese spezielle Komponente war es aber sinnvoll, weil:

- die Klassennamen bereits sehr spezifisch sind,
- die Animation zentral und isoliert ist,
- und die Robustheit im Production-Build hier wichtiger war als strenge lokale Stil-Kapselung.

### 6. Warum die Umstellung auf `animation-*`-Longhands zusätzlich sinnvoll war

Vorher wurden mehrere Foyer-Animationen als kompakte `animation:`-Shorthands formuliert.

Das ist gültiges CSS, aber in einem schwierigen Build-/Scoping-Kontext schwerer zu inspizieren.

Die Longhands:

- `animation-name`
- `animation-duration`
- `animation-delay`
- `animation-timing-function`
- `animation-fill-mode`

helfen hier aus zwei Gründen:

1. Der Output ist leichter lesbar und debugbar.
2. Die problematische Kopplung zwischen Name und restlichen Timing-Parametern wird expliziter.

Die Longhands allein waren nicht der vollständige Fix, aber sie machen den kritischen Pfad robuster und besser prüfbar.

### 7. Praktische Faustregel für Angular in diesem Bereich

Wenn eine Angular-Komponente:

- eigene `@keyframes`
- mehrere parallele Animationen
- CSS-Custom-Properties
- starke visuelle Bedeutung
- und einen Lazy-Load-/Production-Pfad

kombiniert, dann sollte sie als **Build-sensibel** behandelt werden.

Für solche Komponenten gilt künftig:

1. im Dev-Server testen
2. im echten Prod-Build testen
3. kompilierten CSS-/Chunk-Output notfalls prüfen
4. früh entscheiden, ob Emulated Encapsulation hier wirklich der richtige Modus ist

## Umgesetzter Fix

Der Fix besteht aus zwei Teilen:

1. **`ViewEncapsulation.None` für `FoyerEntranceLayerComponent`**
   - Datei: [apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.ts](/Users/kqc/arsnova.eu/apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.ts)
   - Grund: Die Foyer-Animationen sind stark komponentenintern, aber ihre Klassennamen sind bereits spezifisch genug. Der Gewinn an Robustheit im Prod-Build ist hier wichtiger als emuliertes Style-Scoping.

2. **Umstellung kritischer Foyer-Animationen auf explizite `animation-*`-Longhands**
   - Datei: [apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.scss](/Users/kqc/arsnova.eu/apps/frontend/src/app/features/session/session-host/foyer-entrance-layer.component.scss)
   - Grund: Die Deklarationen wurden eindeutiger und besser prüfbar; zugleich wurde der kritische Animationspfad vereinfacht.

## Verifikation

Der Fix wurde in vier Stufen verifiziert:

1. **Gezielte Frontend-Specs**
   - `foyer-entrance-layer.component.spec.ts`
   - `session-host.component.spec.ts`

2. **Vollständige Hook-Kette beim Commit**
   - Backend: 236 Tests
   - Frontend: 635 Tests

3. **Lokaler Production-Smoke mit echtem Browser**
   - Vor dem Fix: erster sichtbarer Chip direkt auf der Teamkarte
   - Nach dem Fix: erster sichtbarer Chip startet wieder deutlich außerhalb der Karte und bewegt sich frameweise hinein

4. **Bestätigung in der echten Produktion nach Deploy**
   - Vor dem Fix: Einflug in Produktion nicht sichtbar
   - Nach dem Fix: Einflug in Produktion wieder sichtbar und korrekt

Damit ist der Fehler nicht nur theoretisch oder lokal, sondern auch in der ausgelieferten Produktionsumgebung abgesichert.

## Leitlinien für zukünftige Animationen

Für künftige UI-Animationen in Angular/MD3-Komponenten sollten folgende Regeln gelten:

### 1. Prod-Build immer separat gegenprüfen

Ein funktionierender Dev-Server ist **kein** hinreichender Beweis für korrekte Animationen im Production-Build.

Pflicht bei neuen, sichtbaren Bewegungsanimationen:

- einmal lokaler optimierter Build
- einmal echte Browserprüfung gegen diesen Build

### 2. Lokale `@keyframes` in stark animierten Komponenten mit Vorsicht

Wenn eine Komponente:

- viele `@keyframes`,
- mehrere parallele Animationen,
- CSS-Custom-Properties,
- und komplexe Timing-Ketten

kombiniert, sollte früh entschieden werden, ob `ViewEncapsulation.None` für genau diese Komponente robuster ist.

### 3. Animationen nicht nur auf DOM-Präsenz testen

Ein Chip im DOM bedeutet nicht, dass seine Bewegungsanimation funktioniert.

Bei Smoke-Tests für Animationen sollten nach Möglichkeit mindestens geprüft werden:

- Startposition relativ zum Ziel
- `transform`
- `opacity`
- mehrere Zeitpunkte statt nur ein Endzustand

### 4. Nebenanimationen können Hauptfehler verschleiern

Glow, Trail oder Presence-Effekte können weiter laufen, obwohl die eigentliche Transform-Animation kaputt ist. Deshalb nie aus sichtbaren Nebeneffekten schließen, dass der Bewegungsweg intakt ist.

### 5. Komplexe Animationen lieber auf wenige robuste Ebenen begrenzen

Besser:

- klarer Wrapper
- klarer Bewegungscontainer
- wenige eindeutig benannte `@keyframes`

Schlechter:

- viele verschachtelte Elemente mit jeweils eigener Animation
- mehrere potenziell build-sensitive Ebenen gleichzeitig

## Konkrete Empfehlung für kommende Features

Bei neuen Host-/Lobby-/Arrival-Animationen sollte die Abnahme künftig explizit diese Frage enthalten:

> Läuft die Animation auch im lokalisierten optimierten Production-Build sichtbar vom Start- zum Zielzustand?

Solange diese Frage nicht mit einem echten Prod-Build-Test beantwortet ist, sollte ein Animationsfeature nicht als abgeschlossen gelten.

## Betroffene Fix-Commits

- `fb4becc` `fix(session): harden foyer arrival flight offsets`
- `8744e32` `fix(session): restore foyer flight animation in prod`

Der zweite Commit behebt die eigentliche Prod-Ursache.
