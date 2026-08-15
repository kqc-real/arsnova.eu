<!-- markdownlint-disable MD013 -->

# Word Cloud - Zielbild fuer spaCy als optionale Glaettung

**Status:** Zielbild, nicht umgesetzt  
**Stand:** Mai 2026  
**Bezug:** `Word Cloud 2.5`, `docs/implementation/WORD-CLOUD-2.1-LEMMA-STRATEGY.md`, `docs/implementation/WORD-CLOUD-3.0-STORY-VORSCHLAG.md`  
**Implementierungsplan:** `docs/implementation/WORD-CLOUD-SPACY-GLAETTUNG-IMPLEMENTATION-PLAN.md`

---

## Kernaussage

spaCy soll in `arsnova.eu` **nicht** als semantischer Themenmodus in den Livepfad geschaltet werden.

spaCy soll spaeter nur als **optionale sprachliche Glaettung** innerhalb der bestehenden lexikalischen Wortwolken-Pipeline dienen:

- **kein** Ersatz fuer die heutige Wortwolke
- **keine** Blackbox-Semantik
- **kein** Dauerlauf bei jeder neuen Eingabe
- **keine** Analyse im Renderer

Das Ziel ist:

> dieselbe erklaerbare lexikalische Wortwolke wie heute, aber auf Wunsch mit besser zusammengefuehrten Sprachformen.

---

## Produktthese

Lemmatisierung mit spaCy erzeugt fuer `arsnova.eu` **keine semantische Begriffswolke**.

Sie erzeugt nur eine kontrollierte **Glaettung**:

- `frage`, `fragen` laufen zusammen
- `validieren`, `validiert`, `validierung` laufen zusammen
- `distribution`, `distributions` laufen zusammen

Das sichtbare Ergebnis bleibt eine **lexikalische** Wolke:

- Begriffe und Phrasen werden weiterhin ueber nachvollziehbare Oberflaechenmerkmale gebildet
- Gewichtung bleibt weiterhin Document-Frequency-basiert
- Q&A-Sortiermodi bleiben erhalten
- Tooltips und Exporte bleiben erklaerbar

Semantische Themenbildung bleibt davon getrennt ein eigener `3.x`-Pfad.

---

## Zielbild im Produkt

### 1. Gilt fuer beide Wortwolken

Von der optionalen Glaettung sollen beide Stellen profitieren:

- **Quiz-/Freitext-Wortwolke**
- **Q&A-Wortwolke**

Die Glaettung ist also kein Q&A-Sonderfall und kein Freitext-Sonderfall, sondern eine optionale Vorverarbeitung fuer die gemeinsame Term-Pipeline.

### 2. Nur host-ausgeloest

Die Glaettung startet **nur**, wenn der Host sie explizit anfordert.

Es gibt:

- **keine** automatische Analyse bei jeder neuen Antwort oder Frage
- **keinen** Participant-Toggle
- **keine** versteckte Dauerbelastung im Hintergrund

### 3. Snapshot statt Livelauf

Die Glaettung arbeitet auf einem **konkreten Snapshot** der aktuell sichtbaren Daten:

- Host oeffnet die Wortwolke
- Host fordert Glaettung an
- der aktuelle Datenstand wird analysiert
- das Ergebnis bleibt stehen
- kommen neue Fragen/Antworten hinzu, wird der Stand nur als **veraltet** markiert
- erst ein erneuter Host-Trigger berechnet neu

### 4. Die lexikalische Wortwolke bleibt der sichere Standard

Wenn spaCy nicht verfuegbar ist oder kein belastbares Ergebnis liefert:

- bleibt die heutige Wolke sichtbar
- faellt der Dialog hart auf den bestehenden `2.x`-Pfad zurueck
- entstehen keine leeren Zwischenzustaende

---

## UX-Zielbild

Die Glaettung soll **nicht** als technisches NLP-Feature in die Haupt-UI hineinragen.

Empfohlenes Wording:

- Aktion: `Sprachformen glaetten`
- Aktivzustand: `Glaettung aktiv`
- nach neuen Daten: `Neu analysieren`

Nicht empfohlen:

- `Lemmatisieren`
- `spaCy`
- `NLP`
- `Semantik`

### Platzierung

Die Aktion gehoert als **sekundaere Host-Aktion** in den Wortwolken-Dialog:

- Freitext-Dialog
- Q&A-Dialog

Sie sollte nicht als dritter grosser Modusblock neben Sortierung und Analyseart erscheinen.

### Sichtbare Zustandslogik

1. `Sprachformen glaetten`
2. Analyse laeuft
3. `Glaettung aktiv`
4. Bei neuem Input: `Neue Antworten seit letzter Glaettung` oder `Neue Fragen seit letzter Glaettung`
5. `Neu analysieren`

---

## Fachliche Regeln

### 1. Glaettung, nicht Semantik

spaCy darf nur Sprachformen normalisieren, nicht Themen frei erfinden.

### 2. Namen nicht blind lemmatisieren

Eigennamen bleiben moeglichst in ihrer Oberflaechenform erhalten.

### 3. Komposita nicht naiv zerlegen

Deutsche Komposita sind ein spaeteres Spezialthema. Die erste Stufe der Glaettung darf sie nicht aggressiv aufbrechen.

### 4. Geschuetzte Fachbegriffe bleiben geschuetzt

Vorhandene Produktregeln fuer technische Begriffe bleiben verbindlich, z. B.:

- `C++`
- `C#`
- `npm install`
- `docker compose`
- `HTTP 404`

### 5. Anzeigetext und Gruppierungsschluessel werden getrennt

Die Glaettung soll nicht dazu fuehren, dass die sichtbare Wolke unnatuerliche Lemmaformen zeigt.

Darum gilt:

- **key** = normalisierte Form fuer Gruppierung
- **label** = lesbare, haeufige oder bevorzugte Oberflaechenform fuer die Anzeige

---

## Technisches Zielbild

### Pipeline

Die bestehende Trennung bleibt erhalten:

`Daten holen -> optional glaetten -> lexikalisch aggregieren -> rendern -> tooltip/export`

spaCy sitzt dabei **vor** der heutigen Aggregation, nicht daneben und nicht im Renderer.

### Logische Reihenfolge

1. Quelldaten sammeln
2. bestehendes Cleaning anwenden
3. technische Begriffe schuetzen
4. optional spaCy-Normalisierung auf dem Snapshot ausfuehren
5. aus normalisierten Einheiten wieder Kandidaten fuer Unigramme/Bigramme/Trigramme bilden
6. bestehende DF-Gewichtung, Phrasenbevorzugung und Filterlogik anwenden
7. gewichtete Terme an die bestehende Visualisierung liefern

### Was spaCy liefern darf

spaCy soll fuer diesen Pfad nur linguistische Hilfsdaten liefern:

- Token
- Lemma
- POS
- optional Entity-Typ

Mehr wird fuer die erste Glaettungsstufe nicht benoetigt.

### Empfohlene Filterbasis

Die erste sinnvolle spaCy-Variante fuer `arsnova.eu` ist:

- `NOUN`
- `PROPN`
- geschuetzte technische Begriffe

Optional spaeter:

- selektive Phrasenbildung ueber angrenzende nominale Einheiten

Nicht Ziel der ersten Stufe:

- freie Verb-/Adjektivwolke
- vollstaendige NER-gesteuerte Themenbildung

---

## Architektur im Repo

### Bestehende Komponenten, die bleiben

- `apps/frontend/src/app/features/session/session-present/word-cloud-term.service.ts`
- `apps/frontend/src/app/features/session/session-present/word-cloud.util.ts`
- `apps/backend/src/lib/wordCloudAnalysis.ts`
- `apps/backend/src/routers/wordCloud.ts`
- `libs/shared-types/src/schemas.ts`

### Empfohlene Erweiterungen

#### Shared types

Der Analysevertrag sollte spaeter um eine Normalisierungsachse erweitert werden, etwa:

```ts
normalization: 'NONE' | 'LEMMA';
normalizationApplied: 'NONE' | 'LEMMA';
fallbackLocale: 'de' | 'en' | 'fr' | 'it' | 'es';
```

Wichtig:

- die heutige einzelne `locale` reicht fuer echte polylinguale Analyse nur begrenzt
- fuer spaetere Mehrsprachigkeit braucht es pro Snapshot mindestens eine belastbare Fallback-Sprache
- besser waere spaeter eine lokale Sprachschaetzung pro Item oder pro Cluster

#### Backend

Empfohlene neue Bausteine:

- `wordCloudNormalizer.ts`
- `spacyClient.ts`
- optional `wordCloudAnalysisCache.ts`

#### Betriebsmodell

Wenn spaCy kommt, dann als **optionaler Sidecar-Service** hinter dem Backend:

- nicht im Angular-Frontend
- nicht im Node-App-Container selbst
- nicht als Pflicht fuer jede lokale Entwicklungsumgebung
- intern ueber Unix-Socket (`NLP_SOCKET_PATH`), nicht ueber einen oeffentlichen Port

### Modelllizenzen

arsnova.eu bleibt MIT. Die offiziellen spaCy-Kernmodelle sind Drittwerk und werden nicht zu MIT. Es gibt keine App-Lizenz, unter der alle fuenf Locales als ein Open-Source-Paket mitgeliefert werden duerften. Lizenzhinweise gehoeren in `NOTICE` beziehungsweise eine Drittlizenzseite, nicht ins Impressum oder in die Datenschutzerklaerung.

- `de`/`en` (MIT): Standard-Sidecar
- `fr` (LGPL-LR): erlaubt mit Namensnennung, Lizenztext und Ersetzbarkeit
- `es` (GPL-3.0): erlaubt als gekennzeichnetes GPL-Drittteil; Image nicht als reines MIT ausweisen
- `it` (`it_core_news_sm`, CC BY-NC-SA 3.0): nicht im MIT-Default; lexikalischer Fallback fuer verteilte Installationen; optional nur als klar getrenntes Extra fuer den eigenen altruistischen Betrieb

Die erste Qualitaetsstufe bleibt `de`/`en`. `fr`/`es` folgen erst nach Fixtures und Lizenzartefakten.

---

## Cache-Zielbild

Damit Host-Neuberechnungen billig bleiben, braucht die Glaettung zwei Cache-Ebenen:

### 1. Text-Cache

Normalisierte Einzeltexte nach:

- Sprache
- Text-Hash
- Analyseversion

### 2. Snapshot-Cache

Komplette Wortwolkenanalyse nach:

- Session
- Kanal
- Sortiermetrik
- Normalisierungsmodus
- Snapshot-Hash

Damit gilt:

- derselbe Host-Stand wird nicht doppelt analysiert
- kleine UI-Interaktionen loesen keine neue NLP-Runde aus
- Presenter kann spaeter denselben Snapshot verwenden

---

## Kanalbezug

### Freitext

Freitext profitiert stark, weil kurze Antworten oft an Flexionsformen zerbrechen.

### Q&A

Q&A profitiert, weil laengere Fragen oft dieselben Kerne in verschiedenen Sprachformen und Phrasen tragen.

### Wichtig

Die Glaettung aendert **nicht** die Q&A-Sortierlogik:

- `Meist unterstuetzt`
- `Beste Fragen`
- `Umstritten`

Sie aendert nur, **wie sprachlich aehnliche Begriffe zusammengefuehrt werden**.

---

## Nicht-Ziele

- kein spaCy im Participant-Livepfad
- kein spaCy bei jeder neuen Eingabe
- kein Participant-Umschalter
- kein stilles Ersetzen der heutigen Wortwolke
- keine semantische Synonym- oder Intent-Clusterung
- kein neues Layout-System
- kein WYSIWYG-PNG-Snapshot als primaeres Ziel

---

## Akzeptanzkriterien fuer eine spaetere Umsetzung

1. Host kann in Freitext- und Q&A-Wortwolken explizit `Sprachformen glaetten` ausloesen.
2. Die bestehende lexikalische Wolke bleibt voll funktionsfaehig und ist der Standard.
3. Die Glaettung laeuft nur auf Host-Anforderung und nur auf dem aktuellen Snapshot.
4. Neue Daten markieren das Ergebnis als veraltet, starten aber keine automatische Neuberechnung.
5. Bei Fehler oder Nichtverfuegbarkeit bleibt die bisherige Wolke sichtbar.
6. Sichtbare Labels bleiben lesbar; Lemmaformen muessen nicht 1:1 angezeigt werden.
7. Geschuetzte technische Begriffe bleiben unveraendert erhalten.
8. Q&A- und Freitext-Wolke profitieren ueber dieselbe Normalisierungsachse.
9. Die Render-Komponente analysiert weiterhin keine Rohtexte selbst.
10. Mitgelieferte Modelle folgen der MIT-Auslieferungsgrenze: `de`/`en` im Default, `fr`/`es` mit NOTICE/GPL-Kennzeichnung, `it_core_news_sm` nicht im MIT-Default.

---

## Einordnung gegenueber Word Cloud 3.0

spaCy als Glaettungsoption ist **nicht** gleich `Word Cloud 3.0`.

Abgrenzung:

- **spaCy-Glaettung** = bessere lexikalische Verdichtung
- **Word Cloud 3.0** = eigener Themen-/Clusterpfad

Darum ist spaCy hier ein **optional vorgelagerter Qualitaetslayer**, kein semantischer Themenmodus.

---

## Entscheidungslinie

Wenn `arsnova.eu` spaeter spaCy nutzt, dann unter dieser Leitplanke:

> spaCy verbessert auf Host-Anforderung die sprachliche Oberflaeche der bestehenden Wortwolke, ersetzt aber weder ihre Erklaerbarkeit noch fuehrt es verdeckt eine semantische Themenanalyse ein.
