<!-- markdownlint-disable MD013 -->

# Word Cloud 3.0 - Host-first-Themenmodus fuer Q&A

**Arbeitstitel:** `Word Cloud 3.0`  
**Folgt auf:** `Story 1.14`, `Story 1.14a`, `Word Cloud 2.1/2.2/2.3/2.4`  
**Status:** konzeptioneller Zielpfad; die aktuelle Produkt-UI nutzt seit `Word Cloud 2.5` bewusst `Einzelwoerter` / `Begriffe & Phrasen` statt `Themen`
**Architekturbezug:** `ADR-0012`, `docs/implementation/WORD-CLOUD-2.1-LEMMA-STRATEGY.md`

---

## Zielbild

Der erste echte `3.0`-Schritt soll **nicht** die gesamte Wortwolke auf einmal semantisieren.

Stattdessen soll der **Host im Q&A-Kanal** spaeter zusaetzlich zur heutigen lexikalischen Ansicht einen **erklaerbaren semantischen Themenmodus** bekommen:

- die bisherige lexikalische Wolke bleibt voll funktionsfaehig
- der Host kann dann zwischen lexikalischen Begriffen/Phrasen und semantischen Themenclustern wechseln
- die bestehenden Sortierlinsen `TOP`, `BEST`, `CONTROVERSIAL` bleiben erhalten
- Themen werden aus sichtbaren Fragen gebildet, nicht aus opaken Blackbox-Labels
- Tooltips und Export erklaeren, welche Fragen in einem Thema gelandet sind
- Presenter und Quiz-Freitext bleiben in dieser ersten Story bewusst auf dem stabilen `2.x`-Pfad

Damit wird `3.0` zu einer **Host-first-Moderationsstory** mit hohem Nutzwert und kontrolliertem Risiko.

---

## Stand Mai 2026

Der lokale Host-first-Pfad ist inzwischen produktseitig vorhanden, aber nicht als echter semantischer Themenmodus beschriftet:

- gemeinsamer Analysevertrag in `libs/shared-types/src/schemas.ts`
- Backend-Router in `apps/backend/src/routers/wordCloud.ts`
- deterministischer Theme-Analyzer in `apps/backend/src/lib/wordCloudAnalysis.ts`
- Host-Toggle `Einzelwoerter` / `Begriffe & Phrasen` in `apps/frontend/src/app/features/session/session-host/qa-word-cloud-dialog.component.html`
- Vollbilddialog fuer denselben Analysemodus in `apps/frontend/src/app/features/session/session-host/qa-word-cloud-dialog.component.ts`
- gemeinsamer Renderer fuer gelieferte Analyse-Entries in `apps/frontend/src/app/features/session/session-present/word-cloud.component.ts`
- erklaerbare Tooltips, CSV-Ausgabe und Quellenlisten

Nicht umgesetzt als Teil dieses Standes sind weiterhin:

- ein echter, sichtbar beschrifteter semantischer Themenmodus
- Confidence-Filter fuer den lokalen Document-Frequency-Pfad
- Presenter-Q&A-Rollout als eigener Produktpfad
- semantischer Quiz-Freitext-Rollout
- LLM- oder Embedding-basierte Labelbildung im Livepfad
- eigenes Timeout-/Budget-Management fuer einen spaeteren semantischen Pfad

---

## Story-Zuschnitt

**Als Lehrperson** moechte ich in der Q&A-Wortwolke neben der heutigen lexikalischen Ansicht einen **Themenmodus** sehen, der haeufige Wortvarianten und typische Paraphrasen zu erklaerbaren Themenclustern zusammenfasst, damit ich im Livebetrieb schneller erkenne, **worum** die Fragen eigentlich kreisen, ohne die Nachvollziehbarkeit der Anzeige zu verlieren.

---

## Warum dieser Zuschnitt

Dieser Zuschnitt ist fuer das bestehende Repo der realistischste erste `3.0`-Schritt, weil er:

- den groessten didaktischen Mehrwert im Host-Kontext liefert
- die bestehende `2.x`-Wolke nicht destabilisiert
- den semantischen Layer von der eigentlichen d3-Visualisierung trennt
- ohne LLM im Livepfad auskommt
- die sprachliche Qualitaet sichtbar anhebt, ohne sofort ein Vollprogramm fuer alle Kanaele und Locales zu versprechen

Nicht jede spaetere `3.x`-Faehigkeit muss in diese erste Story hinein.

---

## Nicht-Ziele

- **kein** LLM im Live-Hotpath
- **kein** Ersetzen der heutigen lexikalischen Wolke als Fallback
- **kein** semantischer Presenter-Rollout in derselben Story
- **kein** semantischer Ausbau fuer Quiz-Freitext in derselben Story
- **keine** Vollabdeckung aller unterstuetzten Locales auf `de`-/`en`-Niveau in der ersten Stufe
- **keine** opaken Cluster ohne erklaerbare Mitgliedschaft
- **keine** neue WYSIWYG-Export-Logik fuer PNG

---

## Akzeptanzkriterien

1. **Zwei Analysemodi im Host:** Die Q&A-Wortwolke im Host bietet zusaetzlich zur bestehenden Ansicht einen expliziten semantischen Themenmodus.
2. **Kein Regressionspfad fuer den lokalen Termpfad:** Der heutige `2.x`-Pfad bleibt funktional identisch, inklusive Sortiermodi, Tooltips, Antwortfilter und Export.
3. **Erklaerbare Themencluster:** Im semantischen Modus werden sichtbare `PINNED`-/`ACTIVE`-Fragen zu Themenclustern zusammengefasst, wenn die Zusammenlegung nachvollziehbar belegbar ist.
4. **Moderationsgewichte bleiben erhalten:** `TOP`, `BEST` und `CONTROVERSIAL` wirken auch im Themenmodus weiter als Gewichtungsbasis.
5. **Tooltip mit Evidenz:** Ein Themen-Tooltip zeigt mindestens Thema, gewichteten Wert, zugrunde liegende Metrik und eine kleine Liste zugehoeriger Beispiel-Fragen.
6. **Export bleibt lesbar:** CSV exportiert im Themenmodus mindestens `label,count,members,basis`.
7. **Fallback ohne UI-Bruch:** Wenn der Themenpfad keine belastbaren Themenanker findet oder kein brauchbares Ergebnis liefert, faellt die UI automatisch auf den lokalen Termpfad zurueck, ohne leere oder kaputte Karte. Der Backend-Fallback liefert dabei tokenisierte Begriffe, keine kompletten Fragesaetze.
8. **Sprachgrenze bewusst:** `de` und `en` sind fuer den Themenmodus in dieser Story Pflicht; andere Locales fallen kontrolliert auf den lokalen Termpfad zurueck.
9. **Scope-Grenze bleibt stabil:** Presenter-Q&A und Quiz-Freitext verhalten sich nach dieser Story weiterhin wie heute.

---

## Technische Leitidee

Die bestehende Architektur bleibt erhalten:

`daten holen -> analysieren -> rendern -> tooltip/export/filter`

Seit `Word Cloud 2.5` bekommt die Visualisierung keine Rohtexte mehr als primaere Analysequelle, sondern bereits gewichtete Terme. `analysieren` hat damit zwei klar getrennte Pfade:

- **lexikalisch**: heutiger `2.x`-Pfad in `word-cloud-term.service.ts` plus `word-cloud.util.ts`
- **themenbasiert**: neuer `3.0`-Pfad fuer den Host-Q&A-Kontext

Wichtig ist dabei:

- `app-word-cloud` bleibt primaer eine **Rendering- und Interaktionskomponente**
- der Themenmodus wird als **eigener Analysevertrag** eingefuehrt, nicht als schwer wartbarer Sonderfall mitten im Renderer
- semantische Qualitaet soll aus **Kandidatenextraktion + erklaerbarer Clusterbildung** kommen, nicht aus frei formulierten KI-Labels
- die Host-Theme-Analyse startet nur fuer geoeffnete Q&A-Wortwolken, damit der Livebetrieb keine verdeckten Backend-Analysen fuer ungenutzte Dialoge ausloest

---

## Architekturentscheidungen fuer dieses Repo

### 1. Host-first statt Full-Rollout

Der erste `3.0`-Schritt wird auf den **Host-Q&A-Pfad** begrenzt.

Begruendung:

- dort ist der Moderationsnutzen am hoechsten
- dort existieren bereits Gewichte (`TOP`, `BEST`, `CONTROVERSIAL`)
- dort sind Tooltips, Vollbild und Sortierlogik schon vorhanden
- Presenter und Freitext bleiben so robust, waehrend `3.0` iterativ gehaertet wird

### 2. Analysevertrag von der Visualisierung trennen

Die heutige Komponente `app-word-cloud` soll nicht selbst semantische Logik ausrechnen.

Stattdessen braucht es einen klaren Analysevertrag.

Der aktuelle Stand liegt bereits im Shared Layer in `libs/shared-types/src/schemas.ts`, u. a. mit:

```ts
const WordCloudAnalysisVariantEnum = z.enum(['LEXICAL', 'THEME']);
const AnalyzeWordCloudInputSchema = z.object({
  sessionCode: z.string(),
  mode: WordCloudAnalysisVariantEnum,
  locale: WordCloudAnalysisLocaleEnum,
  metric: WordCloudWeightMetricEnum,
  items: z.array(WordCloudAnalysisSourceItemSchema),
  maxEntries: z.number().int().positive().max(50).optional(),
});

const WordCloudAnalysisEntryDTOSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().int(),
  basisLabel: z.string().nullable(),
  members: z.array(WordCloudAnalysisMemberDTOSchema),
  variants: z.array(z.string()),
  confidence: z.number().min(0).max(1).nullable(),
});

const AnalyzeWordCloudOutputSchema = z.object({
  mode: WordCloudAnalysisVariantEnum,
  locale: WordCloudAnalysisLocaleEnum,
  metric: WordCloudWeightMetricEnum,
  generatedAt: z.string(),
  fallbackUsed: z.boolean(),
  entries: z.array(WordCloudAnalysisEntryDTOSchema),
});
```

`sessionCode` ist dabei absichtlich Teil des Inputs, weil `hostProcedure` im Backend die Host-Autorisierung ueber `code` oder `sessionCode` im Raw-Input aufloest.

Der Vertrag ist damit nicht mehr nur eine theoretische Option, sondern bereits die gemeinsame Schnittstelle fuer Host-Frontend und den aktuellen Backend-Analysepfad.

### 3. Lexikalischer Pfad bleibt der sichere Fallback

Die bestehende Logik in `word-cloud-term.service.ts` und `word-cloud.util.ts` bleibt erhalten und ist weiterhin der sofort verfuegbare, deterministische Fallback.

Das ist keine Uebergangsnotloesung, sondern eine bewusste Resilienzgrenze.

### 4. Erklaerbare Kandidaten statt reine Embedding-Magie

Die technische Linie fuer diese Story ist inzwischen:

1. **Keyphrase-Kandidaten** extrahieren
2. Kandidaten normalisieren
3. nur dann zusammenfuehren, wenn Aehnlichkeit und Labelwahl erklaerbar sind
4. Cluster als lesbare Labels plus Mitgliedsliste ausgeben

Der aktuelle Analyzer macht das bewusst deterministisch und ohne Modellabhaengigkeit:

- locale-spezifische Stopwortfilter fuer `de` / `en`
- normalisierte Kern-Tokens plus angrenzende 2er-Phrasen als Kandidaten
- regelbasierte Gruppierung fuer haeufige deutsche und englische Flexionsfaelle
- Anchor-Auswahl ueber Wiederholung, Phrase-vs.-Token und numerische Evidenz
- Confidence-Wert fuer die erklaerbare Einordnung `hoch` / `mittel` / `vorsichtig`
- kein frei generiertes LLM-Label in dieser Story

### 5. Zeitbudget und Fallback sind Produktanforderungen

`3.0` darf die Livekarte nicht blockieren.

Darum gilt:

- Themenanalyse ist **asynchron** zur lexikalischen Sofortanzeige
- bei Fehler oder Timeout bleibt die Karte benutzbar
- der Host darf nie in einen leeren Zwischenzustand ohne sinnvolle Anzeige fallen

### 6. Sortierung und Analyse bleiben orthogonal

Die Modi `TOP`, `BEST`, `CONTROVERSIAL` bleiben **Gewichtungsmodi**.

`Lexikalisch` vs. `Themen` ist eine **Analyseentscheidung**.

Dadurch bleibt die UI fachlich klar:

- eine Achse beantwortet: **Welche Fragen wiegen stark?**
- die andere Achse beantwortet: **Wie werden Begriffe bzw. Themen gebildet?**

---

## Betroffene Dateien

### Bestehende Frontend-Dateien

- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.spec.ts`
- `apps/frontend/src/app/features/session/session-host/qa-word-cloud-dialog.component.ts`
- `apps/frontend/src/app/features/session/session-host/qa-word-cloud-dialog.component.html`
- `apps/frontend/src/app/features/session/session-present/word-cloud.component.ts`
- `apps/frontend/src/app/features/session/session-present/word-cloud.component.html`
- `apps/frontend/src/app/features/session/session-present/word-cloud.component.spec.ts`
- `apps/frontend/src/app/features/session/session-present/word-cloud.util.ts`

### Neue oder erweiterte Backend-/Shared-Layer-Flaechen

- `libs/shared-types/src/schemas.ts` falls ein stabiler Analysevertrag geteilt wird
- `apps/backend/src/routers/index.ts`
- `apps/backend/src/routers/wordCloud.ts`
- `apps/backend/src/lib/wordCloudAnalysis.ts`

---

## Realistische Umsetzungsreihenfolge

### Phase 1: Vertrag und UI-Rahmen ohne Fachlogik umbauen

Ziel: Die Host-Oberflaeche kann zwischen Analysemodi unterscheiden, ohne dass sich fachlich schon etwas aendert.

Aufgaben:

- Analysemodus im Host einfuehren, z. B. `lexical | theme`
- Toggle in Host-Karte und Host-Dialog einbauen
- `app-word-cloud` so vorbereiten, dass spaeter nicht nur lokale `WordCloudTerm[]`, sondern auch semantische Analyse-Entries darstellbar sind
- bestehende Specs fuer `Lexikalisch` gruen halten

Ergebnis:

- kein Fachgewinn, aber die technische Einhaengestelle fuer `3.0` steht

### Phase 2: Themenanalyse als separaten Backend-Pfad einziehen

Ziel: Der neue Themenmodus wird nicht im Renderer versteckt, sondern als eigener Analysepfad geliefert.

Aufgaben:

- neuen tRPC-Router fuer Themenanalyse einfuehren
- Input aus sichtbaren Q&A-Fragen, Gewichten, Locale, Metrik und `sessionCode` bilden
- Kandidatenextraktion fuer `de`/`en` implementieren
- Clusterbildung mit nachvollziehbarer Mitgliedsliste liefern
- leeres oder unsicheres Ergebnis sauber signalisieren statt schlechte Cluster zu erzwingen

Ergebnis:

- Host kann eine erklaerbare Themenliste anfordern; der aktuelle Backend-Pfad nutzt deterministische Kandidaten- und Phrasenbildung fuer `de`/`en` und faellt kontrolliert lexikalisch zurueck, wenn keine belastbaren Themenanker entstehen

### Phase 3: Host-Integration mit automatischem Fallback

Ziel: Der Host nutzt die Themenanalyse produktiv, ohne den Livebetrieb zu riskieren.

Aufgaben:

- Themenmodus in Karte und Vollbild integrieren
- Lade-, Fehler- und Fallbackzustaende sauber auf die bestehende Q&A-Card aufsetzen
- Tooltip und CSV fuer Themenmodus erweitern
- bestehende Sortiermodi mit Themenmodus verheiraten

Ergebnis:

- Der Host-Vollbilddialog ist fuer zwei lokale Ansichten nutzbar: `Einzelwoerter` sowie `Begriffe & Phrasen`. Analysierte semantische Entries bleiben eine spaetere Ausbaustufe; der gemeinsame Renderer kann solche Entries weiterhin darstellen.

### Phase 4: Tests, Fixtures und Performance-Grenzen absichern

Ziel: `3.0` bleibt ueber Zeit wartbar und erklaerbar.

Pflichtchecks:

- `de`-/`en`-Fixtures mit echten Paraphrasen
- keine Regression im lokalen Termpfad
- Theme-Fallback bei Fehler/Timeout
- Tooltip- und CSV-Integritaet
- keine deutliche Verlangsamung der Host-Karte im normalen Livebetrieb

### Phase 5: Folgestories sauber abspalten

Nicht mehr Teil dieser ersten Story, aber direkte Anschlusskandidaten:

- Presenter-Q&A bekommt spaeter denselben Themenmodus auf Cache-Basis
- Quiz-Freitext bekommt spaeter einen eigenen `3.x`-Pfad
- Mehrsprachigkeit ueber `de`/`en` hinaus
- spaetere kuratierte Fachdomain-Synonyme

---

## Teststrategie

### Backend

- Clusterbildung mit festen Fixture-Sets testen
- erklaerbare Labels statt Zufallsstrings absichern
- unsichere Cluster duerfen verworfen werden
- Router-Antworten fuer Fehler-/Leerzustand explizit testen

### Frontend

- Host-Specs fuer Analyse-Toggle und Fallback
- Wortwolken-Komponente fuer Themes-Tooltip und CSV erweitern
- keine Regression der heutigen `Q&A-Word-Cloud`-Specs

### Produktnaher Smoke-Test

Beispielhafte Q&A-Sets sollten nach `3.0` sichtbar besser zusammenlaufen, etwa:

- `Kommt Kapitel 4 in die Klausur?`
- `Ist Kapitel 4 klausurrelevant?`
- `Brauchen wir Kapitel 4 fuer die Pruefung?`

Diese Fragen duerfen nicht als drei praktisch getrennte Hauptthemen enden.

Ein zweiter sinnvoller Kalibrierfall fuer den aktuellen Analyzer ist:

- ein einzelnes `Kapitel 4`-Signal darf als Thema sichtbar sein, aber nur mit vorsichtiger Confidence
- drei klar paraphrasennahe Fragen zu `lineare Regression` sollen in die hohe Confidence-Stufe laufen

---

## Empfohlene Definition of Done

- Host-Q&A bietet neben `Einzelwoerter` / `Begriffe & Phrasen` einen klar getrennten semantischen Themenmodus
- der lokale Termpfad bleibt regressionsfrei
- Themenmodus liefert fuer `de` und `en` sichtbar nuetzlichere Cluster als `2.x`
- jede Themenkarte bleibt ueber Tooltip/Export erklaerbar
- Fehler und Timeouts kippen kontrolliert auf den lokalen Termpfad
- relevante Backend- und Frontend-Tests sind gruen

---

## Restpunkte nach dem aktuellen Implementierungsstand

- weitere Fixture-Sets fuer reale Q&A-Daten zur Confidence-Kalibrierung
- moegliche Heuristik-Schaerfung gegen generische Tragerwoerter in weiteren Domainen
- spaetere Entscheidung, ob Presenter-Q&A einen gecachten Themenmodus erhalten soll
- spaetere Entscheidung, ob andere Locales aktiv gehaertet oder bewusst lexikalisch belassen werden

---

## Kurzempfehlung

Der erste sinnvolle `3.0`-Schritt fuer arsnova.eu ist **kein Vollumbau der Wortwolke**, sondern ein **erklaerbarer Themenmodus fuer Host-Q&A**.

Damit wird der groesste inhaltliche Mehrwert erschlossen, ohne die bestehende `2.x`-Staerke zu verlieren:

- livefaehig
- nachvollziehbar
- moderationsnah
- iterativ ausbaubar

Alles, was darueber hinausgeht, sollte als spaetere `3.x`-Folgestory geschnitten werden und nicht in die erste semantische Ausbaustufe gepresst werden.
