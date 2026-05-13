<!-- markdownlint-disable MD013 -->

# Word Cloud 2.1 – Strategie fuer Stemming, Lemmatisierung und Lemma-Gruppierung

**Status:** umgesetzt und in `Word Cloud 2.2` stabilisiert (Mai 2026)  
**Bezug:** Freitext-Wortwolke in `apps/frontend/src/app/features/session/session-present/word-cloud.util.ts` und `apps/frontend/src/app/features/session/session-present/word-cloud.component.ts`  
**Ergaenzung zu:** `docs/architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md`

---

## Ziel

`Word Cloud 2.1` schliesst die Luecke zwischen reiner Tokenzaehlung und einem spaeteren semantischen `3.x`-Layer.

Die Wortwolke soll nicht nur **identische Tokens zaehlen**, sondern **sprachlich verwandte Formen** zusammenfuehren, ohne dabei die sichtbare Wolke unleserlich oder technisch zu teuer zu machen.

Der Stand nach `Word Cloud 2.1/2.2` ist:

- Aggregation laeuft jetzt auf einem **locale-spezifischen Group-Key** statt nur auf exakten Tokens.
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

---

## Aktueller Produktstand

Die aktuelle Pipeline kombiniert inzwischen:

- Tokenisierung
- Lowercasing
- Stopwortfilter pro Locale
- Zahlennormalisierung wie `3,14 -> 3.14`
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
- Tooltips zeigen `Anzahl` und bei Bedarf die wichtigsten `Formen`
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
- zusaetzliche Frage-Fuelltokens pro Locale, damit Woerter wie `genau`, `bitte` oder `need` die Wolke weniger verschlechtern
- leichte, regelbasierte Themenphrasen fuer haeufige Bigramme wie `kapitel 4` oder `lineare regression`
- eine `outputOnly`-Buehnenansicht fuer oeffentliche Presenter-Screens ohne Export-, Antworten- oder Maximieren-UI

Wichtig ist dabei:

- Das ist weiterhin **kein semantischer 3.x-Layer**.
- Es bleibt eine kontrollierte lexikalische Verdichtung.
- Die Q&A-Wolke soll dadurch weniger nach kompletten Fragesaetzen und mehr nach Themenraum aussehen.

Technisch bleibt die Trennung sauber:

- Fachlogik in `word-cloud.util.ts`
- Visualisierung in `word-cloud.component.ts`
- Q&A-Host/Presenter reichen nur noch Profil und Gewichte ein

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

Die Gruppierungslogik braucht eigene, explizite Tests in `word-cloud.util.spec.ts` und Integrationschecks in `word-cloud.component.spec.ts`.

Pflichtfaelle:

- `validieren`, `validiert`, `validierung` laufen zusammen
- `visualisieren`, `visualisierung` laufen zusammen
- `haengt`, `haengen` laufen zusammen
- Zahlen bleiben korrekt zusammengefuehrt
- Stopwoerter werden weiterhin vorhersagbar gefiltert
- englische und deutsche Regeln greifen nicht versehentlich sprachfremd
- sichtbare Anzeigeform ist stabil und lesbar
- mehrfaches Auftreten desselben Begriffs in einer Antwort zaehlt nur einmal

Zusatztests:

- keine Regression bei CSV-/Tooltip-Varianten
- keine Regression bei PNG-Export und Antwortfilter
- Antwortfilter funktioniert auf Gruppenbasis korrekt

---

## Offene Themen fuer `Word Cloud 3.x`

`Word Cloud 2.1/2.2` loest die sichtbarsten lexikalischen Probleme. Offen bleiben bewusst:

- semantische Cluster statt nur Wortfamilien
- kuratierte Synonymtabellen fuer Fachdomainen
- moegliche gemeinsame Nutzung der Gruppierungslogik in Frontend, Backend oder Shared-Layer
- spaetere Mehrsprachigkeit ueber reine Wortformen hinaus

## Kurzfazit

**Stemming allein** waere fuer ARSnova zu grob gewesen.  
**Kontrollierte Lemma-/Wortfamilien-Gruppierung plus Anzeigeform** ist die richtige `Word Cloud 2.1`-Linie und ist produktiv umgesetzt.

Der aktuelle technische Weg ist:

`token -> normalisieren -> lemma/group-key -> zaehlen -> beste Anzeigeform zeigen`

Damit verbessert sich die sprachliche Verdichtung deutlich, ohne die Live-Performance oder die Lesbarkeit der Wolke zu opfern. Der naechste echte Sprung ist kein weiteres Stemming, sondern ein spaeterer semantischer `3.x`-Layer.
