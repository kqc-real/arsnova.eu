<!-- markdownlint-disable MD013 -->

# Word Cloud 3.0 - Host-first-Themenmodus fuer Q&A

**Arbeitstitel:** `Word Cloud 3.0`

**Folgt auf:** `Story 1.14`, `Story 1.14a`, `Story 1.14b`, `Word Cloud 2.1/2.2/2.3/2.4/2.5/2.6`

**Status:** kanonisches Zielbild fuer Story `1.14c`. Stufe 0 (Vertrag/UI) und Stufe 1 (privater Encoder + Clustering) sind im Repo; Kill-Switch default aus. Produktdoku Stufe 1: [`docs/features/word-cloud-semantic.md`](../features/word-cloud-semantic.md). Die optionale spaCy-Glaettung aus Story `1.14b` bleibt getrennt (`docs/features/word-cloud-spacy.md`).

**Voranalyse (2026-08-20):** Modellwahl, 8-vCPU/16-GB-Grenze, Zusammenspiel mit 8.9c, Gemini-Vergleich und Implementierungsstufen in [`WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md`](WORD-CLOUD-3.0-1.14c-VORANALYSE-2026-08-20.md). Die Voranalyse ersetzt dieses Zielbild nicht.

**Architekturbezug:** `ADR-0012`, `ADR-0013`, `ADR-0025`, `ADR-0026`, `ADR-0032`, `docs/implementation/WORD-CLOUD-2.1-LEMMA-STRATEGY.md`

**Abgrenzung:** spaCy als optionale sprachliche Glaettung ist in Story `1.14b` umgesetzt (`docs/features/word-cloud-spacy.md`) und ist nicht identisch mit diesem semantischen `3.0`-Themenpfad.

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

## Stand August 2026

Der lokale Host-first-Pfad ist produktseitig vorhanden. `THEME` bleibt der lexikalische Phrasenmodus, nicht die semantische Clusterung:

- gemeinsamer Analysevertrag in `libs/shared-types/src/schemas.ts` (`LEXICAL`, `THEME`, `SEMANTIC`)
- Backend-Router in `apps/backend/src/routers/wordCloud.ts`
- deterministischer Theme-Analyzer in `apps/backend/src/lib/wordCloudAnalysis.ts`
- Host-Toggle `Einzelwörter` / `Wörter & Phrasen` / `Themen` in Q&A-Dialog und Host-Freitext
- Vollbilddialog fuer denselben Analysemodus in `apps/frontend/src/app/features/session/session-host/qa-word-cloud-dialog.component.ts`
- gemeinsamer Renderer fuer gelieferte Analyse-Entries in `apps/frontend/src/app/features/session/session-present/word-cloud.component.ts`
- erklaerbare Tooltips, CSV-Ausgabe und Quellenlisten
- **Stufe 0 (2026-08-20):** `SEMANTIC` ist in Host-Q&A und Host-Freitext sichtbar; ohne Kill-Switch antwortet `wordCloud.analyze` mit `status: disabled`, `fallbackUsed: true` und 2.x-Eintraegen. Keine leere Karte. Presenter bleibt aussen vor.
- **Stufe 1 (2026-08-20):** privater Encoder-Sidecar (Compose-Profil `encoder`, Unix-Socket oder internes HTTP), agglomeratives Clustering im Backend, extraktive Labels. Host-Q&A-Themenmodus fuer `de`/`en`. Kill-Switch `WORD_CLOUD_SEMANTIC_ENABLED` default aus. Ohne/mit totem Server bleibt 2.x. Freitext-Toggle faellt in 1.14c kontrolliert lexikalisch zurueck; Encoder-Clustering fuer Freitext ist Story 1.14d. Kanonisch: [`docs/features/word-cloud-semantic.md`](../features/word-cloud-semantic.md).

Nicht umgesetzt und deshalb Gegenstand der weiteren `1.14c`-Stufen beziehungsweise eigener Folgestorys:

- optionale quellengebundene Labelbildung durch ein Open-Weight-LLM (Stufe 2)
- Confidence-Filter fuer den lokalen Document-Frequency-Pfad
- Presenter-Q&A- und Presenter-Freitext-Themenmodus
- Encoder-Clustering fuer Freitext-Snapshots (**Story 1.14d**; dieselbe Kaskade wie Q&A; die Stufe-0-UI ist vorhanden)
- physisch getrennte Inferenzbox mit LLM, GPU und den Mess-/FinOps-/Lizenz-Nachweisen fuer eine spaetere Produktivfreigabe
- 8.9c Slice 4 (generatives Summary-Modell auf derselben Serverrolle, anderem Auftrag)

---

## Story-Zuschnitt

**Als Lehrperson** moechte ich in der Q&A-Wortwolke neben der heutigen lexikalischen Ansicht einen **Themenmodus** sehen, der haeufige Wortvarianten und typische Paraphrasen zu erklaerbaren Themenclustern zusammenfasst, damit ich im Livebetrieb schneller erkenne, **worum** die Fragen eigentlich kreisen, ohne die Nachvollziehbarkeit der Anzeige zu verlieren.

---

## Warum dieser Zuschnitt

Dieser Zuschnitt ist fuer das bestehende Repo der realistischste erste `3.0`-Schritt, weil er:

- den groessten didaktischen Mehrwert im Host-Kontext liefert
- die bestehende `2.x`-Wolke nicht destabilisiert
- den semantischen Layer von der eigentlichen d3-Visualisierung trennt
- Embedding- und optionale LLM-Inferenz vollstaendig aus dem synchronen Live-Hotpath heraushaelt
- die sprachliche Qualitaet sichtbar anhebt, ohne sofort ein Vollprogramm fuer alle Kanaele und Locales zu versprechen

Nicht jede spaetere `3.x`-Faehigkeit muss in diese erste Story hinein.

---

## Nicht-Ziele

- **kein** LLM im Participant- oder synchronen Live-Hotpath; eine optionale, host-ausgeloeste und quellengebundene Labelbildung auf dem getrennten Inferenzserver gehoert dagegen zum Vergleichs- und Zielumfang
- **kein** Ersetzen der heutigen lexikalischen Wolke als Fallback
- **kein** semantischer Presenter-Rollout in derselben Story
- **kein** semantischer Ausbau fuer Quiz-Freitext in derselben Story (Folgestory **1.14d**)
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
10. **Getrennte Inferenzrolle:** Embedding-Modell und optionales Open-Weight-LLM laufen produktionsnah auf einem eigenen, nicht oeffentlich erreichbaren Inferenzserver; der heutige App-/PostgreSQL-/Redis-Single-Host bleibt die belegte Baseline.
11. **Mess- und Kostenentscheid:** Qualitaet, Latenz, Ressourcen, Ausfallverhalten und Unit Costs werden fuer lexikalische, spaCy-, Encoder-/Clustering- und optionale LLM-Varianten reproduzierbar verglichen; eine Produktivaktivierung braucht ein separates Freigabegate.

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
- semantische Mitgliedschaft entsteht aus **mehrsprachigen Embeddings + deterministischem, erklaerbarem Clustering**; ein optionales Open-Weight-LLM darf nur quellengebundene Labels oder Kurzfassungen formulieren und keine Mitglieder erfinden
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
const WordCloudAnalysisVariantEnum = z.enum(['LEXICAL', 'THEME', 'SEMANTIC']);
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
  status: WordCloudClusterStatusEnum,
  modelVersion: z.string().nullable(),
  snapshotHash: z.string(),
  entries: z.array(WordCloudAnalysisEntryDTOSchema),
});
```

`sessionCode` ist dabei absichtlich Teil des Inputs, weil `hostProcedure` im Backend die Host-Autorisierung ueber `code` oder `sessionCode` im Raw-Input aufloest.

Der Vertrag ist damit nicht mehr nur eine theoretische Option, sondern bereits die gemeinsame Schnittstelle fuer Host-Frontend und den aktuellen Backend-Analysepfad.

### 3. Lexikalischer Pfad bleibt der sichere Fallback

Die bestehende Logik in `word-cloud-term.service.ts` und `word-cloud.util.ts` bleibt erhalten und ist weiterhin der sofort verfuegbare, deterministische Fallback.

Das ist keine Uebergangsnotloesung, sondern eine bewusste Resilienzgrenze.

### 4. Erklaerbare Kaskade statt LLM-Monolith

Die technische Linie fuer Story `1.14c` ist:

1. lexikalischen `2.x`-Pfad als sofortigen Fallback liefern
2. optional die sprachliche Glaettung aus Story `1.14b` anwenden
3. sichtbare Q&A-Fragen mit einem versionierten mehrsprachigen Encoder einbetten
4. Mitgliedschaften deterministisch clustern und Unsicherheit ausweisen
5. optional ein Open-Weight-LLM ausschliesslich fuer lesbare, quellengebundene Labels oder Kurzfassungen verwenden
6. Cluster als Label, Konfidenz, Mitgliedsliste, Analyseversion und Erzeugungszeitpunkt ausgeben

Der aktuelle lokale Analyzer bleibt eine wichtige deterministische Baseline:

- locale-spezifische Stopwortfilter fuer `de` / `en`
- normalisierte Kern-Tokens plus angrenzende 2er-Phrasen als Kandidaten
- regelbasierte Gruppierung fuer haeufige deutsche und englische Flexionsfaelle
- Anchor-Auswahl ueber Wiederholung, Phrase-vs.-Token und numerische Evidenz
- Confidence-Wert fuer die erklaerbare Einordnung `hoch` / `mittel` / `vorsichtig`
- kein frei generiertes LLM-Label und keine opake Mitgliedschaft

Die neue Inferenzkaskade ersetzt diese Baseline nicht. Jede Stufe besitzt Early-Exit, Timeout und Fallback. Das LLM erhaelt nur die bereits gebildeten Cluster samt Mitgliedsfragen; schemawidrige, quellenlose oder widerspruechliche Antworten werden verworfen.

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

### 7. Inferenzserver und Live-App bleiben getrennte Serverrollen

Der heutige belegte Produktionspfad bleibt ein Single Host fuer App, PostgreSQL und Redis. Story `1.14c` fuehrt fuer Encoder und optionales Open-Weight-LLM einen eigenen, privat erreichbaren Inferenzserver ein. Browser und Teilnehmende greifen nie direkt darauf zu. Queue, Cache, Modellversion, Ressourcenlimits, Telemetrie, Service-Credential beziehungsweise mTLS und Kill-Switch gehoeren zum Serververtrag.

Die separate Serverrolle darf spaeter auch den eigenstaendigen Klassifikationsauftrag aus Story `8.9b` oder den Zusammenfassungsauftrag aus `8.9c` ausfuehren. `1.14c` und `8.9b` behalten getrennte Schemas, Ausloeser, Queues, Caches und Modelllebenszyklen: `8.9b` klassifiziert einzelne persistierte Fragen, waehrend `1.14c` nur host-ausgeloeste unveraenderliche Snapshots clustert. `8.9c` verwendet dagegen einen getrennten schema- und quellengebundenen Zusammenfassungsvertrag mit eigenem Anfrage-/Ergebnislebenszyklus; Betrieb, Modelllebenszyklus und Servergrenze bleiben bei `1.14c`.

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

### Phase 2: Inferenzserver und Analysevertrag als getrennten Pfad einziehen

Ziel: Der neue Themenmodus wird nicht im Renderer versteckt, sondern als eigener Analysepfad geliefert.

Aufgaben:

- schema-first tRPC-/Worker-Vertrag fuer host-ausgeloeste Snapshot-Analyse einfuehren
- Input aus sichtbaren Q&A-Fragen, Gewichten, Locale, Metrik und `sessionCode` bilden
- versionierte Embedding-Erzeugung auf dem privaten Inferenzserver anbinden
- deterministische Clusterbildung mit nachvollziehbarer Mitgliedsliste liefern
- optionale, quellengebundene Open-Weight-LLM-Labelbildung hinter eigenem Early-Exit und Budget anbinden
- leeres oder unsicheres Ergebnis sauber signalisieren statt schlechte Cluster zu erzwingen

Ergebnis:

- Host kann eine erklaerbare Themenliste anfordern; Modell-, Queue- oder Schemafehler fallen kontrolliert auf die lokale Analyse zurueck, wenn keine belastbaren Themen entstehen

### Phase 3: Host-Integration mit automatischem Fallback

Ziel: Der Host nutzt die Themenanalyse produktiv, ohne den Livebetrieb zu riskieren.

Aufgaben:

- Themenmodus in Karte und Vollbild integrieren
- Lade-, Fehler- und Fallbackzustaende sauber auf die bestehende Q&A-Card aufsetzen
- Tooltip und CSV fuer Themenmodus erweitern
- bestehende Sortiermodi mit Themenmodus verheiraten

Ergebnis:

- Der Host-Vollbilddialog bietet `Einzelwoerter`, `Begriffe & Phrasen` und `Themen`; der gemeinsame Renderer zeigt semantische Entries samt Konfidenz, Mitgliedern und Analyseversion, ohne Rohtexte selbst zu analysieren.

### Phase 4: Tests, Fixtures und Performance-Grenzen absichern

Ziel: `3.0` bleibt ueber Zeit wartbar und erklaerbar.

Pflichtchecks:

- `de`-/`en`-Fixtures mit echten Paraphrasen
- Vergleich von lexikalischer, spaCy-, Embedding-/Clustering- und optionaler LLM-Variante
- keine Regression im lokalen Termpfad
- Theme-Fallback bei Fehler, Timeout, Ueberlastung und ungueltiger Modellantwort
- Tooltip- und CSV-Integritaet
- unveraenderte Join-, Vote-, Q&A-Submit-, WebSocket-/Reconnect- und lexikalische Baselines bei langsamem oder ausgefallenem Inferenzserver
- Ressourcen-, Energie- und Unit-Cost-Bericht mit Umgebung, Modellversion und Geltungsgrenze

### Phase 5: Kursnachweise und spaetere Produktpfade sauber trennen

Im Cloud-Computing-Kurs werden Deployment, Messung, Resilienz, Privacy/Security und Wirtschaftlichkeit des Zwei-Server-Pfads demonstriert und schrittweise umgesetzt. Die Produktivaktivierung bleibt eine gesonderte Entscheidung. Nicht Teil von `1.14c`, aber direkte Anschlusskandidaten sind:

- Presenter-Q&A bekommt spaeter denselben Themenmodus auf Cache-Basis
- Quiz-Freitext-Themenmodus: **Story 1.14d** (gleicher Encoder, anderer Snapshot)
- Mehrsprachigkeit ueber `de`/`en` hinaus
- spaetere kuratierte Fachdomain-Synonyme

---

## Teststrategie

### Backend

- Clusterbildung mit festen Fixture-Sets testen
- erklaerbare Labels statt Zufallsstrings absichern
- unsichere Cluster duerfen verworfen werden
- Router-Antworten fuer Fehler-/Leerzustand explizit testen
- getrennte Contract-Tests fuer Snapshot-Zustaende von `1.14c` und per-Frage-Klassifikation von `8.9b`
- manipulierte, quellenlose und schemawidrige Modellantworten verwerfen

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
- Inferenzserver ist getrennt, privat, versioniert, ressourcenbegrenzt und per Kill-Switch deaktivierbar
- reproduzierbare Qualitaets-, Last-, Ressourcen-, Resilienz- und FinOps-Nachweise liegen vor
- relevante Backend- und Frontend-Tests sind gruen

---

## Restpunkte nach dem aktuellen Implementierungsstand

- weitere Fixture-Sets fuer reale Q&A-Daten zur Confidence-Kalibrierung
- moegliche Heuristik-Schaerfung gegen generische Tragerwoerter in weiteren Domainen
- Festlegung und Messung geeigneter Encoder-, Clustering-, Quantisierungs- und optionaler LLM-Varianten
- Kursartefakte fuer Zwei-Server-IaC, Datenfluss, Bedrohungsmodell, Last/Ressourcen und TCO/FinOps
- spaetere Entscheidung, ob Presenter-Q&A einen gecachten Themenmodus erhalten soll
- spaetere Entscheidung, ob andere Locales aktiv gehaertet oder bewusst lexikalisch belassen werden

---

## Kurzempfehlung

Der erste sinnvolle `3.0`-Schritt fuer arsnova.eu ist **kein Vollumbau der Wortwolke**, sondern ein **erklaerbarer Themenmodus fuer Host-Q&A mit getrenntem Open-Weight-Inferenzserver**.

Damit wird der groesste inhaltliche Mehrwert erschlossen, ohne die bestehende `2.x`-Staerke zu verlieren:

- livefaehig
- nachvollziehbar
- moderationsnah
- messbar und iterativ ausbaubar

Embeddings, deterministisches Clustering und die optionale quellengebundene LLM-Labelbildung gehoeren zu Story `1.14c`. Encoder-Clustering fuer Quiz-Freitext ist Story `1.14d`. Presenter-Rollout und weitere Locales bleiben spaetere `3.x`-Folgestorys.
