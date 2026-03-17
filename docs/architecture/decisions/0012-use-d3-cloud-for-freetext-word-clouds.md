<!-- markdownlint-disable MD013 -->

# ADR-0012: d3-cloud als Layout-Engine fuer Freitext-Word-Clouds

**Status:** Accepted  
**Datum:** 2026-03-17  
**Entscheider:** Projektteam  

## Kontext

arsnova.eu zeigt Freitext-Antworten derzeit in einer einfachen, selbstgebauten Word-Cloud-Ansicht.

Der aktuelle Stand ist funktional, aber gestalterisch stark begrenzt:

- Woerter werden im Wesentlichen als umbrochene Tags in einem `flex-wrap`-Container dargestellt.
- Die Schriftgroesse variiert nach Haeufigkeit, aber es gibt **keine echte Layout-Logik** fuer eine visuell dichte Wolkenform.
- Das haeufigste Wort wird nicht gezielt zentriert oder hervorgehoben.
- Es gibt keine Spiralplatzierung, keine Kollisionspruefung, keine Rotationslogik und keine echte Wolkensilhouette.
- Der PNG-Export ist derzeit nur eine einfache zeilenweise Canvas-Ausgabe und bildet keine hochwertige Praesentationsgrafik.

Fuer Live-Sessions mit vielen unterschiedlichen Freitext-Antworten ist das UX-seitig unbefriedigend:

1. Die Darstellung wirkt eher wie eine Tag-Liste als wie eine echte Word-Cloud.
2. Auf Host- und Presenter-Ansichten fehlt die visuelle Verdichtung der wichtigsten Begriffe.
3. Die aktuelle Eigenloesung bietet zu wenig Gestaltungsoptionen fuer kuenftige Anforderungen wie Mittelpunkt-Gewichtung, Rotation, Padding, Dichte oder unterschiedliche Layoutstrategien.

Wir brauchen daher eine belastbare technische Entscheidung fuer die naechste Ausbaustufe der Freitext-Visualisierung.

## Entscheidung

### 1. Fuer echte Word-Cloud-Layouts wird `d3-cloud` verwendet

arsnova.eu verwendet fuer die naechste Ausbaustufe der Freitext-Word-Clouds die Bibliothek:

- `d3-cloud`

`d3-cloud` wird dabei **nicht direkt als UI-Komponente** eingesetzt, sondern als **Layout-Engine** fuer eine eigene Angular-Komponente.

### 2. Angular bleibt Owner der Komponente

Es wird **kein fremdes Komplett-Widget** ungeprueft in die Host- oder Presenter-UI eingebaut.

Stattdessen gilt:

- Angular bleibt verantwortlich fuer Datenfluss, Inputs, Outputs, Interaktion, Loading-Zustaende und Accessibility.
- `d3-cloud` berechnet die Positionen, Groessen und optionalen Rotationen der Woerter.
- Das Rendering erfolgt in einer eigenen, projektinternen Komponente fuer Host und Presenter.

Damit bleibt die Visualisierung in unsere Design-, Test- und i18n-Standards integrierbar.

### 3. Zielbild der Darstellung

Die neue Word-Cloud soll fachlich und visuell deutlich ueber die aktuelle Tag-Cloud hinausgehen.

Die Architekturentscheidung erlaubt und priorisiert insbesondere:

1. **Zentrierung wichtiger Woerter**  
   Das haeufigste oder eines der haeufigsten Woerter soll visuell dominanter und moeglichst zentral platziert werden.

2. **Echte Platzierungslogik mit Kollisionserkennung**  
   Woerter werden nicht nur in Zeilen umbrochen, sondern entlang einer Layoutlogik platziert, die Ueberlappungen verhindert.

3. **Konfigurierbare Darstellung**  
   Moegliche Parameter sind unter anderem:
   - Schriftgroessen-Skalierung
   - Wortabstand / Padding
   - Rotation
   - Farblogik
   - Layoutdichte
   - maximale Wortanzahl

4. **Bessere Praesentationsfaehigkeit**  
   Host- und Presenter-Ansicht sollen eine optisch glaubwuerdige Wortwolke zeigen, nicht nur eine technisch korrekte Begriffliste.

### 4. Browser-only ist fuer diesen Anwendungsfall akzeptiert

Die Word-Cloud ist eine Live-Visualisierung in Host- und Presenter-Kontexten. Fuer diese Views ist browserseitiges Rendering akzeptabel.

Deshalb gilt:

- Browser-only-Layout ist zulaessig.
- SSR ist fuer die eigentliche Word-Cloud-Darstellung kein hartes Muss.
- Wenn noetig, darf serverseitig ein einfacher Fallback-Zustand gerendert werden und die eigentliche Wolke erst im Browser entstehen.

### 5. Bestehende Aggregationslogik bleibt fachlich trennbar

Die Entscheidung betrifft primaer die **Visualisierung und Layout-Berechnung**, nicht zwingend die semantische Aufbereitung der Freitext-Antworten.

Die bestehende oder kuenftige Logik fuer:

- Tokenisierung
- Stopwoerter
- Mindestwortlaenge
- Zusammenfassung gleichartiger Begriffe
- moegliche spaetere Normalisierung oder Stemming-Regeln

bleibt fachlich getrennt von der Layout-Engine.

`d3-cloud` entscheidet also nicht ueber die Semantik der Begriffe, sondern ueber deren Platzierung.

### 6. Empfehlung fuer die konkrete Integration

Die empfohlene Integrationsform ist:

- eigene Angular-Komponente, z. B. `app-word-cloud`
- interne Nutzung von `d3-cloud` zur Positionsberechnung
- Rendering ueber SVG oder kontrolliertes Canvas innerhalb der Komponente
- projektinterne Steuerung von Export, Filterung, Interaktion und Responsiveness

Die bestehende einfache Word-Cloud ist damit eine **Uebergangsloesung**, nicht das langfristige Zielbild.

## Konsequenzen

### Positiv

- Deutlich bessere Darstellungsqualitaet fuer Freitext-Ergebnisse.
- Mehr Kontrolle ueber Mittelpunkt, Dichte, Rotation und visuelle Hierarchie.
- Keine Abhaengigkeit von einem kleinen Angular-Spezialpaket mit geringer Verbreitung.
- Die Layout-Engine ist etabliert, breit genutzt und fuer Word-Cloud-Szenarien bewaehrt.
- Angular-seitige Kapselung ermoeglicht saubere Integration in Host, Presenter, Export und Tests.

### Negativ / Risiken

- `d3-cloud` ist keine fertige Angular-Komponente; wir muessen selbst kapseln und testen.
- Das Layout ist browserseitig und kann bei sehr vielen Woertern Rechenzeit kosten.
- Einzelne Woerter koennen je nach Platz und Parametern verworfen werden, wenn sie nicht sinnvoll platziert werden koennen.
- Fuer wirklich hervorragende Ergebnisse muessen Layoutparameter, Farbregeln und Exportlogik zusaetzlich produktseitig gestaltet werden.

## Alternativen (geprueft)

- **Aktuelle Eigenloesung beibehalten:** verworfen, weil sie nur eine einfache Tag-Cloud liefert und die gewuenschte visuelle Qualitaet nicht erreicht.
- **`@kernpro/angular-wordcloud`:** verworfen als Primaerentscheidung, weil es zwar modern und Angular-nah ist, aber deutlich geringere Verbreitung hat und uns bei langfristiger Kontrolle und Anpassbarkeit staerker an ein kleines Spezialpaket bindet.
- **`wordcloud` / `wordcloud2.js`:** verworfen als Primaerentscheidung, weil es zwar leistungsfaehig ist, aber stilistisch und integrativ weniger gut zu einer modernen Angular-Kapselung passt als `d3-cloud`.
- **Komplette Eigenimplementierung ohne externe Layout-Engine:** verworfen, weil der Aufwand fuer Spiralplatzierung, Kollisionserkennung und robuste Layoutqualitaet unnoetig hoch waere.

## Umsetzungsleitplanken

- Die Angular-Komponente kapselt `d3-cloud` vollstaendig und exponiert nur projektgeeignete Inputs.
- Host- und Presenter-Ansicht verwenden dieselbe fachliche Datenbasis, aber koennen unterschiedliche Dichte- oder Groessenprofile erhalten.
- Interaktion wie Filterung, Auswahl einzelner Woerter und Export bleibt in projektinterner Kontrolle.
- Vor produktiver Aktivierung wird die Darstellung mit vielen heterogenen Freitext-Antworten visuell auf Smartphone, Laptop und Projektionsansicht geprueft.
- Die bisherige Tag-Cloud darf als Fallback oder Zwischenschritt bestehen bleiben, bis die neue Komponente stabil ist.

---

**Referenzen:** `apps/frontend/src/app/features/session/session-present/word-cloud.component.ts`, `apps/frontend/src/app/features/session/session-present/word-cloud.component.scss`, `apps/frontend/src/app/features/session/session-present/word-cloud.util.ts`, [ADR-0005: Angular Material Design](./0005-use-angular-material-design.md), [ADR-0009: Einheitliche Live-Session mit Tabs fuer Quiz, Q&A und Blitzlicht](./0009-unified-live-session-channels.md).
