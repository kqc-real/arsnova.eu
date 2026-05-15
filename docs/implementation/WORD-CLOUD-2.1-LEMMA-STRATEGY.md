<!-- markdownlint-disable MD013 -->

# Word Cloud 2.1 – Strategie fuer Stemming, Lemmatisierung und Lemma-Gruppierung

**Status:** umgesetzt und bis `Word Cloud 2.5` stabilisiert (Mai 2026)
**Bezug:** Freitext- und Q&A-Wortwolke in `apps/frontend/src/app/features/session/session-present/word-cloud-term.service.ts`, `apps/frontend/src/app/features/session/session-present/word-cloud.util.ts` und `apps/frontend/src/app/features/session/session-present/word-cloud.component.ts`
**Ergaenzung zu:** `docs/architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md`
**Weiterfuehrung:** `docs/implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md`

---

## Ziel

`Word Cloud 2.1` schliesst die Luecke zwischen reiner Tokenzaehlung und einem spaeteren semantischen `3.x`-Layer.

Die Wortwolke soll nicht nur **identische Tokens zaehlen**, sondern **sprachlich verwandte Formen** zusammenfuehren, ohne dabei die sichtbare Wolke unleserlich oder technisch zu teuer zu machen.

Der Stand nach `Word Cloud 2.1` bis `2.5` ist:

- Aggregation laeuft jetzt auf einem **locale-spezifischen Group-Key** statt nur auf exakten Tokens.
- Fuer Host und Presenter erzeugt ein testbarer **Term-Extractor-Service** gewichtete Terme vor der Visualisierung.
- Q&A und Freitext nutzen eine bereinigte **Document-Frequency-Gewichtung**: ein Begriff zaehlt pro Antwort/Frage maximal einmal.
- Die UI selektiert, filtert und exportiert auf **Gruppenbasis**.
- Fuer haeufige deutsche und englische Wortfamilien gibt es eine **kontrollierte, regelbasierte Normalisierung**.
- Die sichtbare Wolke zeigt weiterhin **lesbare Begriffe** statt roher Stems.
- Wiederholungen innerhalb derselben Antwort zaehlen pro Wortfamilie nur noch **einmal**.
- Variantenlisten bleiben fuer Tooltip und CSV erhalten.

Beispielsweise laufen heute zusammen:

- `validieren`, `validiert`, `validierung`
- `visualisieren`, `visualisierung`
- `haengt`, `haengen`

Nicht Ziel dieser Ausbaustufe ist bereits eine voll semantische Clusterung wie:

- `verstehen`, `nachvollziehen`, `einordnen`
- `regression`, `modell`, `prognose`

Das ist spaeter `Word Cloud 3.x` oder ein eigener semantischer Layer.

Seit Mai 2026 existiert fuer den Host-Q&A-Pfad eine umschaltbare Ansicht zwischen Einzelwoertern und Begriffen/Phrasen. Die aktuelle Produktlinie bleibt aber bewusst ein deterministischer `2.x`-Pfad im Frontend: Die Visualisierung bekommt gewichtete Terme und analysiert keine Rohtexte mehr selbst. Semantische Synonym- oder Intent-Cluster bleiben `Word Cloud 3.x`.

---

## Aktueller Produktstand

Die aktuelle Pipeline kombiniert inzwischen:

- Tokenisierung
- Lowercasing
- Stopwortfilter pro Locale
- Zahlennormalisierung wie `3,14 -> 3.14`
- Schutz technischer Begriffe wie `C++`, `C#`, `npm install`, `docker compose` und `HTTP 404`
- Unigramme, Bigramme und Trigramme mit staerkerer Phrasengewichtung
- adaptive Mindesthaeufigkeit nach Datenmenge
- Abwertung von Begriffen, die in sehr vielen Dokumenten vorkommen
- locale-spezifische Group-Keys
- regelbasierte Wortfamilien-Gruppierung fuer haeufige `de`-/`en`-Faelle
- Auswahl einer lesbaren sichtbaren Anzeigeform pro Gruppe
- Antwortfilter und CSV-Export auf Gruppenbasis
- Tooltip-/CSV-Ausgabe der Varianten pro Gruppe
- Antwortzaehlung pro Gruppe maximal einmal je Antwort

Sie macht bewusst **noch nicht**:

- keine semantische Synonym- oder Themen-Clusterung
- keine Embeddings
- kein LLM im Livepfad
- keine serverseitige Modellabhaengigkeit pro Render

Folge: Die Wolke ist produktiv deutlich robuster als eine rohe Tokenliste, bleibt aber fachlich weiterhin **lexikalisch statt semantisch**.

Die wichtigste technische Trennung ist inzwischen:

- `WordCloudTermExtractorService`: fachliche Term-Ermittlung und Gewichtung
- `WordCloudComponent`: Rendering, Tooltip, Auswahl, Dialog, CSV und PNG
- Host/Presenter-Komponenten: liefern Dokumente, Sortiergewichte und Locale

---

## Kernentscheidung

**Reines Stemming soll nicht die Endloesung sein.**

Die umgesetzte Zielarchitektur ist:

`token -> normalisieren -> lemma/group-key -> zaehlen -> beste Anzeigeform waehlen`

Das bedeutet:

- intern wird auf einer **kanonischen Form** aggregiert
- sichtbar bleibt eine **lesbare Oberflaechenform**
- die Wolke zeigt **keine Stems**

Beispiel:

| Eingaben                                 | Interner Key           | Sichtbare Form                  |
| ---------------------------------------- | ---------------------- | ------------------------------- |
| `validieren`, `validiert`, `validierung` | gemeinsame Wortfamilie | haeufigste oder bevorzugte Form |
| `haengt`, `haengen`                      | `haengen`              | `haengen`                       |
| `3,14`, `3.14`                           | `3.14`                 | `3.14`                          |

---

## Zielstruktur im Code

Die Aggregation arbeitet nicht mehr nur mit sichtbaren Tokens, sondern mit Buckets:

```ts
type AggregateBucket = {
  groupKey: string;
  preferredDisplay: string | null;
  count: number;
  variants: Map<string, number>;
};
```

Die exportierte Wortliste fuer UI, Tooltip und CSV bleibt davon getrennt:

```ts
type AggregatedWord = {
  word: string;
  count: number;
  groupKey: string;
  variants: string[];
};
```

Damit werden heute bereits mehrere Produktfunktionen getragen:

- Tooltip: „enthaelt 4 Schreibformen“
- Antwortfilter auf Gruppenbasis
- CSV mit `word,count,variants`

---

## Umgesetzte Pipeline

### 1. Tokenisierung

Bleibt im Kern leichtgewichtig:

- Lowercasing
- Zahlennormalisierung
- Stopwortfilter

### 2. Gruppierungsnormalisierung

Eine locale-spezifische Normalisierung ordnet Tokens in kontrollierte Wortfamilien ein:

```ts
function getWordGrouping(
  token: string,
  locale: SupportedLocale,
): {
  groupKey: string;
  display: string;
} {
  // locale-spezifische Regeln / Lemma-Mapping
}
```

Dabei werden nur sichere, kleine Regeln im Frontend abgebildet, zum Beispiel fuer:

- ae/oe/ue-Varianten
- haeufige deutsche und englische Flexions- oder Ableitungsformen
- kuratierte Wortfamilien wie `validierung -> validieren`

### 3. Aggregation pro Antwort

Gezaehlt wird nicht mehr jedes Token-Vorkommen roh, sondern pro Antwort maximal einmal je `groupKey`:

```ts
for (const grouping of uniqueGroupingsPerResponse) {
  bucket.count += weight;
  bucket.variants.set(display, (bucket.variants.get(display) ?? 0) + weight);
}
```

Das verhindert, dass eine einzelne Antwort durch Wiederholung desselben Begriffs unverhaeltnismaessig dominant wird.

### 4. Anzeigeform und Varianten

Pro Bucket wird eine lesbare sichtbare Form bestimmt:

1. bevorzugte kuratierte Form, falls vorhanden
2. sonst haeufigste sichtbare Variante
3. bei Gleichstand die kuerzere / lesbarere Form

Varianten bleiben parallel erhalten, damit UI und Export erklaeren koennen, was intern zusammengefuehrt wurde.

### 5. UI, Filter und Export

Die Gruppierung wirkt heute bis in die Oberflaeche hinein:

- Wortauswahl und Antwortfilter arbeiten auf `groupKey`-Basis
- Tooltips zeigen im Quiz-Freitext `Nennungen` und in gewichteten Q&A-Wolken `Groessenwert`, Quellenanzahl und Gewichtungsbasis
- Q&A-Tooltips koennen zusaetzlich die wichtigsten zugehoerigen Fragen mit lesbarem haengendem Einzug listen
- CSV exportiert `word,count,variants`
- Stopwoerter sind produktseitig fest ausgeblendet
- die sichtbare Wolke bleibt ein lesbares d3-Layout, keine Stem-Liste

---

## Word Cloud 2.2 – Betriebsstabilitaet und UX

Die nachgelagerte Ausbaustufe `2.2` hat die 2.1-Logik produktseitig stabilisiert:

- Das alte Live-Layout bleibt sichtbar, bis ein neues `d3-cloud`-Layout fertig berechnet ist. Dadurch springt die Wolke bei Updates nicht mehr kurz in ein Fallback.
- Filter werden ueber `selectionScopeKey` an die aktuelle Frage gebunden und bei Fragenwechseln oder verschwundenen Gruppen sauber zurueckgesetzt.
- Die Antwortenliste nutzt einen Suchindex pro Antwort und wird seitenweise (`50` Eintraege) aufgezogen.
- Der PNG-Export bleibt bewusst ein geordneter Zeilenexport nach Wortgroesse, waehrend die Live-Ansicht das freie d3-Layout zeigt.
- Host und Presenter nutzen dieselbe Gruppierungslogik; der Host hat zusaetzlich einen expliziten Freeze-/Live-Schalter.

---

## Word Cloud 2.3 – Q&A-Profil

Die gemeinsame Wortwolken-Komponente hat zusaetzlich ein eigenes Q&A-Profil bekommen, ohne den Freitext-Pfad zu verbiegen.

Der Q&A-spezifische Ausbau umfasst:

- ein explizites Analyseprofil `qa` statt stiller Sonderfaelle in Host oder Presenter
- abgeflachte Upvote-Gewichtung ueber `1 + round(sqrt(upvotes))` statt linearer Dominanz
- zusaetzliche Frage-Fuelltokens pro Locale, damit Woerter wie `genau`, `bitte`, `need` sowie Q&A-Traeger wie `frage`, `question`, `topic`, `sujet`, `domanda` oder `pregunta` die Wolke weniger verschlechtern
- leichte, regelbasierte Begriffsphrasen fuer haeufige Bigramme wie `kapitel 4` oder `lineare regression`
- eine `outputOnly`-Buehnenansicht fuer oeffentliche Presenter-Screens ohne Export-, Antworten- oder Maximieren-UI

Wichtig ist dabei:

- Das ist weiterhin **kein semantischer 3.x-Layer**.
- Es bleibt eine kontrollierte lexikalische Verdichtung.
- Die Q&A-Wolke soll dadurch weniger nach kompletten Fragesaetzen und mehr nach Begriffsfeld aussehen.
- Backend-Fallbacks im Host-Q&A-Phrasenmodus nutzen dieselbe Grundidee: Sie fallen auf tokenisierte, stopwortbereinigte Begriffe zurueck, nicht auf komplette Fragetexte.

Fuer den spaeteren Host-first-Themenmodus und dessen semantischen Analysepfad siehe `docs/implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md`.

Technisch bleibt die Trennung sauber:

- Fachlogik in `word-cloud.util.ts`
- Visualisierung in `word-cloud.component.ts`
- Q&A-Host/Presenter reichen nur noch Profil und Gewichte ein

---

## Word Cloud 2.4 – Sortierabhaengige Q&A-Hostansicht

Die naechste Ausbaustufe hat die Q&A-Wortwolke enger an die Host-Moderation gekoppelt, ohne den Presenter-Pfad aufzublaehen.

Der Host nutzt heute dieselbe Q&A-Wolke in drei Analyse-Linsen:

- `TOP`: Gewichtung ueber Netto-Score
- `BEST`: Gewichtung ueber den Wilson-Score
- `CONTROVERSIAL`: Gewichtung ueber den Kontroversitaets-Score

Dabei wechseln nicht nur die Gewichte, sondern auch:

- Titel und Hint der Q&A-Wolke
- Tooltip-Metrik (`Groessenwert`, Zahl der zugehoerigen Fragen, Gewichtungsbasis)
- die inhaltliche Lesart des Begriffsfelds
- die Q&A-Livewirkung kann im Dialog eingefroren und wieder live fortgesetzt werden

Die Groesse eines Begriffs wird weiterhin aus der aktiven Sortiermetrik abgeleitet, aber seit 2026-05-14 nicht mehr als reine Summe aller Fragegewichte dargestellt: Begriffe aus nur einer stark bewerteten Frage werden leicht gedaempft, waehrend Begriffe aus mehreren Fragen stabiler wirken. Damit dominiert eine einzelne stark gevotete Frage die Wolke weniger stark.

Fuer die Host-Vollansicht gilt zusaetzlich:

- der Sortierumschalter bleibt **oberhalb** der Wolke sichtbar
- die Wolke nutzt die volle verfuegbare Dialogbreite
- die Layout-Hoehe orientiert sich an der real verfuegbaren Buehnenflaeche statt nur an einer statischen Wortzahlheuristik
- der Tooltip nutzt einen echten UI-Tooltip statt des nativen `title`, damit Umbruch, Lesbarkeit und haengender Einzug der zugehoerigen Fragen kontrollierbar bleiben

Wichtig ist dabei:

- Der Presenter bleibt bewusst bei einer reduzierten oeffentlichen Q&A-Buehne ohne diese Host-Steuerung.
- Der PNG-Export bleibt weiterhin ein geordneter Zeilenexport; die Host-Vollansicht ist eine Analyse- und Moderationsansicht, kein WYSIWYG-Export.

## Word Cloud 2.5 – Document-Frequency-Term-Service

`Word Cloud 2.5` verschiebt die eigentliche Term-Ermittlung aus der Render-Komponente in einen eigenen Angular-Service.

Der Service verarbeitet Dokumente statt UI-Rohtexte:

```ts
type WordCloudTermDocument = {
  id: string;
  title?: string | null;
  body?: string | null;
  tags?: readonly string[] | null;
  weight?: number | null;
};
```

Zurueck kommt eine bereits gewichtete Liste:

```ts
type WordCloudTerm = {
  key: string;
  label: string;
  score: number;
  documentFrequency: number;
  sourceCount: number;
  variants: string[];
  kind: 'unigram' | 'bigram' | 'trigram' | 'protected';
  members: WordCloudTermMember[];
};
```

Die Regeln sind bewusst deterministisch:

- kein TF-IDF als Hauptverfahren
- keine rohe Worthaeufigkeit als Hauptverfahren
- pro Dokument zaehlt ein Term maximal einmal
- Titel zaehlen staerker als Body, Tags ebenfalls staerker als Body
- `de`, `en`, `fr`, `it`, `es` nutzen Sprach-Stopwoerter plus Forum-Stopwoerter
- technische Begriffe werden vor der Tokenisierung geschuetzt
- Phrasen werden staerker gewichtet als Einzelwoerter
- Mindesthaeufigkeit: unter `15` Dokumenten `minDf=1`, unter `50` Dokumenten `minDf=2`, sonst `minDf=3`
- Terme in mehr als `80 %` der Dokumente werden abgewertet; bei kleinen Datenmengen weniger hart als bei grossen Foren

Damit gilt fuer Host und Presenter:

- Freitext-Wolken analysieren Antworten als Dokumente.
- Q&A-Wolken analysieren Fragen als Dokumente.
- Die Q&A-Sortierung wirkt ueber das Dokumentgewicht, nicht ueber eine zweite UI-Aggregation.
- Die Visualisierung rendert `WordCloudTerm[]` und faellt nur fuer alte Pfade auf `analysisEntries` oder rohe Antworten zurueck.

---

## Was bewusst noch nicht passiert

- keine semantische Synonym- oder Themen-Clusterung
- keine Embedding-Suche
- kein LLM im Livepfad
- keine serverseitige Modellabhaengigkeit fuer jeden Render
- keine aggressive Zusammenlegung ohne Fachkontext

Warum:

- die Wortwolke ist live und praesentationsnah
- der Performance-Hotspot ist das Layout, nicht die Aggregation
- falsche Zusammenfuehrungen zerstoeren Vertrauen schneller als fehlende Zusammenfuehrungen

---

## Performance-Leitplanken

Aus dem bisherigen Benchmark und dem aktuellen 2.2-Stand ist klar:

- Aggregation und Gruppierung sind billig
- das Layout ist der eigentliche Hotspot

Darum darf die Sprach-Normalisierung weiterhin:

- **linear** zur Tokenanzahl laufen
- keine grossen Modelle laden
- keine Netzwerkabhaengigkeit haben
- keine asynchronen Live-Delays erzeugen

Richtwert:

- komplette Vorverarbeitung fuer typische Freitextsets soll deutlich unter `10 ms` bleiben
- das Niveau soll in der gleichen Groessenordnung wie die bisherige Aggregation bleiben

---

## Teststrategie

Die Gruppierungs- und Termlogik braucht eigene, explizite Tests in `word-cloud.util.spec.ts`, `word-cloud-term.service.spec.ts` und Integrationschecks in `word-cloud.component.spec.ts`.

Pflichtfaelle:

- `validieren`, `validiert`, `validierung` laufen zusammen
- `visualisieren`, `visualisierung` laufen zusammen
- `haengt`, `haengen` laufen zusammen
- Zahlen bleiben korrekt zusammengefuehrt
- Stopwoerter werden weiterhin vorhersagbar gefiltert
- englische und deutsche Regeln greifen nicht versehentlich sprachfremd
- sichtbare Anzeigeform ist stabil und lesbar
- mehrfaches Auftreten desselben Begriffs in einer Antwort zaehlt nur einmal
- Document-Frequency zaehlt pro Frage/Antwort maximal einmal
- Titel-/Tag-Gewichte schlagen Body-Gewichte
- technische Begriffe bleiben als geschuetzte Terme erhalten
- Bigramme/Trigramme werden extrahiert und sinnvoll staerker gewichtet
- adaptive `minDf` und Abwertung ubiquitaerer Terme greifen vorhersehbar

Zusatztests:

- keine Regression bei CSV-/Tooltip-Varianten
- keine Regression bei PNG-Export und Antwortfilter
- Antwortfilter funktioniert auf Gruppenbasis korrekt
- Q&A-Sortiermodi veraendern die Termgewichte ohne Rohtextanalyse in der Visualisierung

---

## Offene Themen fuer `Word Cloud 3.x`

`Word Cloud 2.1/2.2` loest die sichtbarsten lexikalischen Probleme. Offen bleiben bewusst:

- semantische Cluster statt nur Wortfamilien
- kuratierte Synonymtabellen fuer Fachdomainen
- moegliche gemeinsame Nutzung der Gruppierungslogik in Frontend, Backend oder Shared-Layer
- spaetere Mehrsprachigkeit ueber reine Wortformen hinaus

Ein konkreter, fuer dieses Repo heruntergebrochener Story-Vorschlag fuer den ersten `3.0`-Schritt steht in `docs/implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md`.

## Kurzfazit

**Stemming allein** waere fuer ARSnova zu grob gewesen.  
**Kontrollierte Lemma-/Wortfamilien-Gruppierung plus Anzeigeform** ist die richtige `Word Cloud 2.1`-Linie und ist produktiv umgesetzt.

Der aktuelle technische Weg ist:

`Dokumente -> technische Terme schuetzen -> tokenisieren -> Group-Key/Phrasen -> Document-Frequency-Gewichtung -> beste Anzeigeform zeigen`

Damit verbessert sich die sprachliche Verdichtung deutlich, ohne die Live-Performance oder die Lesbarkeit der Wolke zu opfern. Der naechste echte Sprung ist kein weiteres Stemming, sondern ein spaeterer semantischer `3.x`-Layer.
