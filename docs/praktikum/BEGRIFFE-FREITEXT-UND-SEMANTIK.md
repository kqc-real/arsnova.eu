<!-- markdownlint-disable MD013 MD022 MD032 MD024 MD033 -->

# Freitext, Sprache und „intelligente“ Auswertung — ein ausführlicher Leitfaden für Studierende

Dieses Dokument ist **didaktisch** geschrieben: Du brauchst **keine** Vorlesung „Einführung in die Linguistik“ absolviert zu haben. Ziel ist, dass du **Begriffe wie Syntax, Semantik, Lexik, Stemming** sicher einordnen kannst — und verstehst, **warum** eine einfache Wortzähl-Wortwolke und ein **LLM-gestütztes Bündeln** von Antworten **unterschiedliche Probleme** lösen.

**Bezug zum Praktikum:** In arsnova.eu werden Freitextantworten u. a. für eine **Wortwolke** genutzt (heute stark **lexikalisch**: Wörter zählen). Eure Aufgabe denkt **semantisch** und **lexikonisch** weiter: ähnliche **Bedeutungen** und **Schreibweisen** sollen sinnvoll zusammengeführt werden — unterstützt durch ein **selbst gehostetes Sprachmodell**.

---

## Inhaltsverzeichnis

1. [Warum du diese Begriffe kennen solltest](#1-warum-du-diese-begriffe-kennen-solltest)
2. [Sprache in Schichten: eine Landkarte](#2-sprache-in-schichten-eine-landkarte)
3. [Lexikon und Lexik — der Wortschatz](#3-lexikon-und-lexik--der-wortschatz)
4. [Morphologie — wie Wörter „von innen“ gebaut sind](#4-morphologie--wie-wörter-von-innen-gebaut-sind)
5. [Syntax — wie Wörter zu Sätzen werden](#5-syntax--wie-wörter-zu-sätzen-werden)
6. [Semantik — was gemeint ist](#6-semantik--was-gemeint-ist)
7. [Pragmatik — Bedeutung im Kontext](#7-pragmatik--bedeutung-im-kontext)
8. [„Normalisieren“ von Freitext — was damit gemeint ist](#8-normalisieren-von-freitext--was-damit-gemeint-ist)
9. [Stemming und Lemmatisierung im Detail](#9-stemming-und-lemmatisierung-im-detail)
10. [Orthographie: Schreibweisen, Tippfehler, Varianten](#10-orthographie-schreibweisen-tippfehler-varianten)
11. [Semantische Nähe: Synonyme, Paraphrase, Embeddings](#11-semantische-nähe-synonyme-paraphrase-embeddings)
12. [Mehrsprachigkeit und cross-lingual](#12-mehrsprachigkeit-und-cross-lingual)
13. [Welche Methode löst welches Problem? — Übersicht](#13-welche-methode-löst-welches-problem--übersicht)
14. [Literatur und weiterführende Links](#14-literatur-und-weiterführende-links)
15. [Übungsaufgaben](#15-übungsaufgaben) · [Musterlösungen](#musterlösungen)

---

## 1. Warum du diese Begriffe kennen solltest

In Diskussionen über **NLP** (Natural Language Processing) und über **LLMs** werden **Syntax**, **Semantik**, **Lexik** und **Stemming** oft **durcheinander** verwendet. Das führt zu **falschen Erwartungen**:

- Wenn jemand sagt: „Wir machen **Stemming**, dann sind alle gleichbedeutenden Antworten zusammen“, stimmt das **so nicht**: Stemming hilft vor allem bei **grammatischen Formen desselben Wortes** (laufen, lief, gelaufen → eine Wortfamilie), **nicht** bei „Synonymen“ oder **verschiedenen Sprachen**.

- Wenn jemand sagt: „Das LLM macht **Syntax**“, kann das stimmen — oft meint man aber eigentlich **Semantik** oder **Zusammenfassung**.

**Merke:** Klare Begriffe helfen dir, dein **Konzept** sauber zu schreiben und deine **Implementierung** (Regeln vs. LLM vs. beides) zu rechtfertigen.

---

## 2. Sprache in Schichten: eine Landkarte

Linguisten beschreiben Sprache oft **schichtweise**, von **klein** nach **groß**:

| Schicht (vereinfacht) | Frage                                        | Beispielhafte Fragestellung |
| --------------------- | -------------------------------------------- | --------------------------- |
| **Laute / Schrift**   | Wie klingt oder sieht es?                    | Phonetik, Orthographie      |
| **Morphologie**       | Aus welchen Teilen bestehen Wörter?          | _ge-lauf-en_                |
| **Lexikon**           | Welche Wörter und Bedeutungen gibt es?       | _laufen_ vs. _Lauf_         |
| **Syntax**            | Wie baut man Sätze?                          | Wortstellung, Kasus         |
| **Semantik**          | Was bedeutet es?                             | Bedeutung von Sätzen        |
| **Pragmatik**         | Was will jemand in der Situation ausdrücken? | Ironie, Höflichkeit         |

**Wichtig:** Das ist ein **Modell**. In der echten Welt verschmelzen die Grenzen — aber als **Denkwerkzeug** ist es sehr nützlich.

Für **Freitext in der Lehre** sind typischerweise besonders relevant:

- **Lexik + Morphologie + Orthographie** → „gleiche Wörter in verschiedenen Formen oder Schreibweisen“
- **Semantik** → „**gleiche Idee**, andere Wörter“
- **Pragmatik** → „was soll die Zusammenfassung für die Lehrkraft leisten?“ (z. B. nur Themen, keine Namen nennen)

---

## 3. Lexikon und Lexik — der Wortschatz

**Lexikon** (Substantiv): oft das **Wörterbuch** als Buch oder Datenbank.

**Lexik / lexikalisch** (Adjektiv): bezieht sich auf den **Wortschatz** — also auf **Wörter** (und manchmal feste Wendungen) als **Einheiten**, mit denen man arbeitet.

**Intuition:** Stell dir das Lexikon wie ein **Katalog** vor: Welche **Lexeme** (Wörter im abstrakten Sinn) gibt es? Zu jedem Lexem können viele **Wortformen** gehören (_laufen, läufst, lief, …_) — die gehören dann eher zur **Morphologie**.

In der Informatik sagt man oft **„lexikalische Analyse“**, wenn **Text in Tokens** (z. B. Wörter) zerlegt wird — **ohne** tiefes Verständnis der Grammatik. Das ist **nicht** dasselbe wie **„semantische Analyse“**.

**Beispiel (Freitext):**

- „Das **Klima** ist wichtig.“
- „**Climate** matters.“

**Lexikalisch** sind das **verschiedene Wörter** (Deutsch vs. Englisch). **Semantisch** können die Sätze **sehr nah** sein — deshalb reicht reines **Zählen gleicher Schreibungen** nicht.

**Weiterlesen:** [Wikipedia: Lexicon](https://en.wikipedia.org/wiki/Lexicon)

---

## 4. Morphologie — wie Wörter „von innen“ gebaut sind

**Morphologie** beschäftigt sich mit der **Struktur von Wörtern**: aus **Morphemen** (kleinste bedeutungstragende Bausteine).

Zwei große Bereiche:

1. **Flexion (Beugung):** gleiche „Lexem-Idee“, andere grammatische Merkmale
   - _laufen_ → _lief_, _gelaufen_, _wir laufen_
2. **Derivation (Wortbildung):** neues Lexem durch Affixe
   - _glücklich_ → _Glück_, *Ver*lust

**Warum das für Normalisierung wichtig ist:** Viele klassische Verfahren (Stemming, Lemmatisierung) nutzen genau diese Idee: **verschiedene Oberflächenformen** auf eine **gemeinsame Basis** zurückführen.

**Merke:** Morphologie ist **wortintern**. Zwei **verschiedene Lexeme** (_Haus_ und _Gebäude_) morphologisch zu „vereinen“ geht so **nicht** — dafür brauchst du **Bedeutungswissen** (Semantik, Wissensdatenbank oder Modell).

**Weiterlesen:** [Wikipedia: Morphology (linguistics)](<https://en.wikipedia.org/wiki/Morphology_(linguistics)>)

---

## 5. Syntax — wie Wörter zu Sätzen werden

**Syntax** regelt, wie Wörter zu **Phrasen und Sätzen** kombiniert werden: **Wortstellung**, **Kongruenz**, **Kasus** usw.

**Beispiele:**

- „Der Student **beantwortet** die Frage.“ (Standard-Wortstellung Deutsch)
- „**Beantwortet** der Student die Frage?“ (Verb an zweiter Stelle im Aussagesatz — anders als Englisch)

**Bezug Informatik / Compiler:** In der Informatik heißt „Syntax“ oft: **formale Regeln**, ob ein Text **wohlgeformt** ist (Klammern, JSON). Bei **natürlicher Sprache** ist Syntax **weicher** — es gibt mehrere gültige Formen und **Umgangssprache**.

**Für eine Wortwolke:** Reine **Syntax** ist selten der Haupthebel — außer du **pars**t Sätze, um z. B. nur **Substantive** zu zeigen. Das ist ein **eigenes Feature** (POS-Tagging), nicht dasselbe wie „semantische Wolke“.

**Weiterlesen:** [Britannica: Linguistics (Syntax/Morphology)](https://www.britannica.com/science/linguistics/Morphology)

---

## 6. Semantik — was gemeint ist

**Semantik** = **Bedeutung**. In der **lexikalischen Semantik** geht es um **Wortbedeutungen** und **Beziehungen zwischen Wörtern**:

- **Synonymie:** _schnell_ und _rasch_ (nah verwandt; selten absolut identisch)
- **Hyperonymie / Hyponymie:** _Tier_ (Oberbegriff) und _Hund_ (Unterbegriff)
- **Antonymie:** _warm_ und _kalt_

**Für Freitext:** Zwei Personen schreiben **unterschiedliche Wörter**, meinen aber **dasselbe** („Die Vorlesung war **anschaulich**“ vs. „**verständlich** erklärt“). Das ist ein **semantisches** Phänomen.

**Wichtig:** Computer „verstehen“ Bedeutung nicht von selbst. Übliche Annäherungen:

- **Wissensressourcen** (Thesauri, WordNet-artige Netze — stark sprachabhängig)
- **Statistik auf großen Textmengen** (Wörter treten in ähnlichen Kontexten auf)
- **Neuronalen Sprachmodellen** (Embeddings, Transformer), die **numerische Repräsentationen** von Text lernen
- **LLMs**, die Text **generieren oder strukturieren** — mit allen Stärken und Risiken (Halluzination, Bias)

**Weiterlesen:** [Wikipedia: Lexical semantics](https://en.wikipedia.org/wiki/Lexical_semantics)

---

## 7. Pragmatik — Bedeutung im Kontext

**Pragmatik** fragt: Was wird **in dieser Situation** mit einem Satz **gemeint** — inklusive **Implikaturen** (was man andeutet, ohne es zu sagen), **Ironie**, **Höflichkeit**.

**Beispiel:**

- „**Schön**, dass wir das heute noch schaffen.“ kann **wörtlich** positiv sein oder **ironisch**, wenn die Stimmung angespannt ist.

Für **automatische Wortwolken** ist Pragmatik oft **schwierig**, weil Kontext fehlt. Für **LLM-Zusammenfassungen** von Q&A ist Pragmatik **relevant**, weil du klare **Regeln** brauchst (z. B. „keine Wertung der Lehrenden“, „keine Namen“).

---

## 8. „Normalisieren“ von Freitext — was damit gemeint ist

**Normalisieren** heißt in der NLP-Praxis oft: **Roh-Text in eine einheitlichere Form bringen**, damit Programme **vergleichen** oder **zählen** können.

Typische Schritte (nicht alle sind immer sinnvoll):

| Schritt                                | Beispiel                       | Was es bewirkt                          |
| -------------------------------------- | ------------------------------ | --------------------------------------- |
| Trimmen                                | Leerzeichen entfernen          | saubere Ränder                          |
| Einheitliche Unicode-Normalisierung    | z. B. zusammengesetzte Zeichen | weniger „falsche“ Duplikate             |
| Kleinschreibung                        | „Haus“ → „haus“                | **Vorsicht:** Eigennamen, „US“ vs. „us“ |
| Entfernen von Interpunktion (optional) | Punkt weg                      | einfachere Token                        |
| **Stemming / Lemma**                   | siehe nächster Abschnitt       | Wortformen angleichen                   |
| **Schreibvarianten**                   | Tippfehler, Transliteration    | oft **schwer** nur mit Regeln           |

**Merke:** Normalisierung ist **kein** Allheilmittel. Jedes Verfahren kann **Information löschen** (z. B. Großschreibung bei Eigennamen).

---

## 9. Stemming und Lemmatisierung im Detail

### 9.1 Gemeinsames Ziel

Beide Verfahren wollen **Wortvarianten zusammenführen**, damit z. B. _running_, _runs_, _ran_ in einer Suchmaschine **nicht** als drei völlig getrennte Begriffe ohne Bezug erscheinen müssen — je nach Anwendung.

### 9.2 Stemming

**Stemming** arbeitet meist **regelbasiert** und **heuristisch**: Es **kürzt** Affixe (Suffixe/Präfixe) nach Mustern.

- **Vorteil:** oft **sehr schnell**, einfach.
- **Nachteil:** Ergebnis ist oft **kein echtes Wort** (bekanntes Beispiel: _computing_ → _comput_ beim Porter-Stemmer).
- **Sprache:** Regeln sind **pro Sprache** (englischer Porter ≠ deutscher Snowball).

**Einsatz:** Information Retrieval, große Datenmengen, „grobe“ Indexierung.

### 9.3 Lemmatisierung

**Lemmatisierung** führt auf das **Lemma** zurück — die **Wörterbuch-Grundform** (je nach Definition und POS).

- **Vorteil:** linguistisch **sinnvollere** Ergebnisse, oft besser für **Analyseaufgaben**.
- **Nachteil:** braucht **mehr Ressourcen** (Lexika, POS-Tagging) und ist **langsamer**.

**Merke:** „Lemma“ für **Deutsch** ist nicht immer trivial (_sein_, _bin_, _war_ → Lemma _sein_).

### 9.4 Stemming vs. Lemmatisierung — didaktische Kurzregel

|                               | Stemming                  | Lemmatisierung            |
| ----------------------------- | ------------------------- | ------------------------- |
| **Geschwindigkeit**           | meist schneller           | meist langsamer           |
| **Linguistische Korrektheit** | oft grob                  | meist höher               |
| **Typische Fehler**           | überkürzt, falsche Stämme | braucht gutes POS/Lexikon |

**Klassische Einführung (englisch, aber Standardreferenz):**  
Manning, Raghavan, Schütze — _Introduction to Information Retrieval_, Abschnitt zu Stemming und Lemmatisierung:  
[Stemming and lemmatization](https://nlp.stanford.edu/IR-book/html/htmledition/stemming-and-lemmatization-1.html)

### 9.5 Was Stemming/Lemma **nicht** leisten

- **Keine** automatische Erkennung, dass _Auto_ und _Fahrzeug_ „dasselbe meinen“ (das ist **Semantik**).
- **Keine** Zuordnung von **Übersetzungen** (_climate_ vs. _Klima_) ohne **mehrsprachige** Ressource oder **Modell**.

---

## 10. Orthographie: Schreibweisen, Tippfehler, Varianten

**Orthographie** = Schreibregeln / Buchstabierung.

**Orthographische Variation** entsteht z. B. durch:

- Tippfehler (_Verantowrtung_)
- Groß-/Kleinschreibung (_iphone_ vs. _iPhone_)
- **Transliteration** (Namen aus anderen Schriftsystemen)
- Dialekt oder Umgangssprache (_„isch“_ vs. _„ich“_ — Beispiel ideell)
- **Historische** Schreibungen (für euer Projekt meist Randfall)

**Typische Hilfen:**

- **Edit-Distanz** (z. B. **Levenshtein**): minimal viele Einfügungen/Löschungen/Ersetzungen, um String A in B zu verwandeln — gut für **ähnliche Schreibungen**.
- **Clustering** von ähnlichen Strings (z. B. charakterbasierte Embeddings + Clustering) — siehe z. B. didaktische Posts wie [Graphext zu ähnlichen Schreibungen](https://www.graphext.com/post/graphext-graphtex-graphnext-grouping-similar-spellings-using-chars2vec-and-agglomerative-clustering).

**Achtung:** Zwei Strings können **orthographisch nah** und **semantisch weit** sein (_Haus_ vs. _Maus_) — deshalb **Schwellenwerte** und ggf. **zusätzliche** semantische Prüfung.

**Forschungsbeispiel** (Namens-/Schreibvarianten):  
[arXiv: Clustering of Spell Variations for Proper Nouns](https://arxiv.org/abs/2310.07962)

---

## 11. Semantische Nähe: Synonyme, Paraphrase, Embeddings

### 11.1 Synonyme und Paraphrase

- **Synonyme:** Wörter mit **ähnlicher Bedeutung** (selten 100 % austauschbar).
- **Paraphrase:** **anderer Satz**, **gleiche Aussage** („Es regnet.“ ↔ „Der Himmel schüttet Wasser.“).

Für **Wortwolken** willst du oft: **Themencluster** statt **gleiche Schreibung**.

### 11.2 Embeddings (ganz kurz, aber wichtig)

Ein **Embedding** ist ein **Vektor** (Liste von Zahlen), der einen Text so abbildet, dass **semantisch ähnliche** Texte im Vektorraum **näher** liegen können als **semantisch verschiedene**.

**Nutzen:** Ähnlichkeit messen, Clustering, Suche.

**Grenzen:** Qualität hängt vom **Modell** und der **Sprache** ab; **Bias** und **Fehler** sind möglich.

### 11.3 LLMs und „semantische Kongruenz“

Wenn ihr ein **LLM** nutzt, um Freitexte **zu labeln** oder **zu gruppieren**, sprecht ihr oft **nicht** mehr von klassischem Stemming, sondern von:

- **Interpretation** des Textes durch das Modell,
- **Ausgabe** in einem **strukturierten Format** (z. B. JSON mit Gruppen-IDs — bei euch **Zod-validiert**!).

**Wichtig:** Formuliert im Konzept, **welche semantische Granularität** ihr wollt:

- nur **Oberbegriffe** (_Mobilität_ für _Fahrrad_, _Bus_, …) — **grober**
- feine **Themen** — **detaillierter**, fehleranfälliger

---

## 12. Mehrsprachigkeit und cross-lingual

In Lehrveranstaltungen kommen Freitexte oft **gemischt** vor (Deutsch, Englisch, Fachbegriffe).

**Cross-lingual** bedeutet: **Über Sprachgrenzen hinweg** dieselbe **Bedeutung** erkennen oder **Ähnlichkeit** messen.

Ansätze (Überblick):

- **Mehrsprachige Satz-Encoder** (z. B. Anwendungen rund um **Multilingual Universal Sentence Encoder** — [Google Research Blog](https://blog.research.google/2019/07/multilingual-universal-sentence-encoder.html))
- **Mehrsprachige Transformer-Modelle** (mBERT, XLM, …) in der Forschung zu **cross-lingual semantic similarity** (Beispielpaper: [ACL Anthology K19-1020](https://aclanthology.org/K19-1020/))
- **Lexikalische** multilingual Benchmarks wie **Multi-SimLex** ([ACL Anthology](https://aclanthology.org/2020.cl-4.5/)) — eher für **Wortebene** und Evaluation

**Merke:** „Mehrsprachig“ ist **kein** binärer Schalter: Manche Modelle sind für viele Sprachen **mittelmäßig** und für Englisch **besonders gut** — das solltet ihr **testen** und im Konzept **ehrlich** benennen.

---

## 13. Welche Methode löst welches Problem? — Übersicht

Diese Tabelle ist eine **Orientierung** für eure **Konzeptionsphase** — keine harte Regel.

| Problem                             | Typische Werkzeuge           | Was es **gut** kann                            | Typische **Grenzen**                              |
| ----------------------------------- | ---------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Gleiche Wortformen (Flexion)        | Stemming, Lemma              | _laufen_ / _lief_ angleichen (je nach Sprache) | Synonyme, Sprachenmix                             |
| Gleiche Schreibung trotz Tippfehler | Edit-Distanz, Normalisierung | Tippfehler nah am Original                     | weit entfernte Tippfehler, Bedeutungsverwechslung |
| Gleiche Idee, andere Wörter         | Embeddings, LLM, Thesauri    | semantische Nähe                               | Halluzinationen, Bias, Kosten                     |
| Übersetzungsgleiche Antworten       | Mehrsprachige Modelle        | cross-lingual Ähnlichkeit                      | Qualität variiert stark                           |
| Verständliche Zusammenfassung       | LLM + strikte Ausgabeform    | Kompakte Texte                                 | muss **gegen** Schema validiert werden            |

**Bezug arsnova.eu (heute):** Die **lexikalische** Wolke in `word-cloud.util.ts` löst vor allem **Tokenisierung + Zählen** — das ist **bewusst einfach** und **schnell**. Eure **intelligente** Variante soll **andere** Ziele explizit machen und **Fallbacks** definieren (siehe Praktikumsbeschreibung).

---

## 14. Literatur und weiterführende Links

### Einstieg (englisch, Standard)

- Manning, Raghavan, Schütze — _Introduction to Information Retrieval_, Kapitel zu **Stemming and lemmatization**:  
  [nlp.stanford.edu — Stemming and lemmatization](https://nlp.stanford.edu/IR-book/html/htmledition/stemming-and-lemmatization-1.html)

### Lexikon, Morphologie, Semantik (englisch, Wikipedia als Startpunkt)

- [Lexicon](https://en.wikipedia.org/wiki/Lexicon)
- [Morphology (linguistics)](<https://en.wikipedia.org/wiki/Morphology_(linguistics)>)
- [Lexical semantics](https://en.wikipedia.org/wiki/Lexical_semantics)

### Mehrsprachige Semantik / Forschung

- [Multilingual Universal Sentence Encoder (Google Research)](https://blog.research.google/2019/07/multilingual-universal-sentence-encoder.html)
- [Cross-lingual STS / BERT (ACL Anthology)](https://aclanthology.org/K19-1020/)
- [Multi-SimLex (ACL Anthology)](https://aclanthology.org/2020.cl-4.5/)

### Orthographie / Schreibvarianten

- [Clustering of Spell Variations (arXiv)](https://arxiv.org/abs/2310.07962)
- [Graphext — ähnliche Schreibungen gruppieren](https://www.graphext.com/post/graphext-graphtex-graphnext-grouping-similar-spellings-using-chars2vec-and-agglomerative-clustering)

---

## 15. Übungsaufgaben

**So arbeitest du damit:** Lies zuerst die Aufgaben **ohne** die Musterlösungen. Schreibe Stichpunkte oder einen kurzen Absatz pro Aufgabe — so merkst du, was noch **unklar** ist. Erst dann vergleichst du mit den **Musterlösungen** (unten). Die Lösungen sind **didaktisch** formuliert; in der Prüfung oder im Konzept zählen **eigene** Formulierungen, solange sie **fachlich stimmig** sind.

### Aufgabe 1 — Begriffe zuordnen

Ordne jedem der folgenden vier Beispiele **genau eine** der Schichten zu: **Morphologie**, **Syntax**, **Semantik**, **Pragmatik**. Begründe in **einem Satz** pro Zeile.

| #   | Beispiel                                                                             |
| --- | ------------------------------------------------------------------------------------ |
| (a) | Im Satz „*Der Hund bell*t\*“ steht das Verb an Position 2 (Aussagesatz).             |
| (b) | _Hund_ und _Säugetier_ stehen in einer Ober-/Unterbegriffs-Beziehung.                |
| (c) | _ge-lauf-en_ besteht aus mehreren Morphemen.                                         |
| (d) | „**Schön**, dass das geklappt hat!“ — je nach Tonfall kann das Lob oder Ironie sein. |

---

### Aufgabe 2 — Stemming und Erwartungen

Jemand behauptet: „Wir haben **Stemming** eingebaut — damit sind **Synonyme** wie _schnell_ und _rasch_ jetzt in **einer** Wortwolken-Kategorie.“

**Aufgabe:** Erkläre **freundlich aber fachlich korrekt**, warum diese Erwartung **so pauschal** nicht haltbar ist. Nenne mindestens **zwei** Aspekte (z. B. was Stemming **tatsächlich** gut kann vs. was **nicht**).

---

### Aufgabe 3 — Orthographie vs. Semantik (Falle)

Zwei Token aus Freitextantworten: **„Haus“** und **„Maus“**.

**Aufgabe:**

1. Sind sie **orthographisch** (Schreibung) ähnlich? (kurz: ja/nein + warum)
2. Sind sie **semantisch** nah? (kurz)
3. Warum reicht eine **reine Edit-Distanz** (z. B. **eine** Ersetzung) **allein nicht**, um zu entscheiden, ob zwei Antworten „dieselbe Idee“ ausdrücken?

---

### Aufgabe 4 — Mehrsprachigkeit

Eine Antwort lautet: „**Das Klima ist wichtig.**“ Eine andere: „**Climate matters.**“

**Aufgabe:**

1. Sind die **lexikalischen** Oberflächen (Wortlisten) **gleich**? (Ja/Nein)
2. Können die Sätze **semantisch** trotzdem **nah** sein? (Ja/Nein + kurze Begründung)
3. Nenne **eine** Klasse von Verfahren (kein Produktname nötig), mit der man **cross-lingual** Ähnlichkeit **annähern** kann — und **eine** praktische Einschränkung (z. B. Qualität, Bias, Kosten).

---

### Aufgabe 5 — Designentscheidung für das Praktikum

Ihr wollt Freitexte **bündeln** und eine **semantische Wortwolke** anzeigen.

**Aufgabe:** Erstelle eine **kleine Entscheidungstabelle** (mind. **drei Zeilen**) mit folgenden Spalten:

- **Teilproblem** (z. B. Tippfehler, Flexion, Synonyme, verschiedene Sprachen)
- **Möglicher Ansatz** (Regeln / klassisches NLP / Embeddings / LLM — gern kombiniert)
- **Ein kurzer Grund** (warum sinnvoll oder riskant)

_Hinweis:_ Es gibt nicht **eine** richtige Tabelle — wichtig ist **nachvollziehbare** Abwägung.

---

### Aufgabe 6 — Lemma vs. Stemming (Vertiefung)

**Gegeben:** englische Formen _running_, _runs_, _ran_ (Verb _to run_).

**Aufgabe:**

1. Was würde ein typisches **Stemming**-Verfahren **ideal** für diese Formen erreichen? (qualitativ beschreiben)
2. Was ist ein typisches **Lemma**-Ergebnis für **running** als Verb-Form?
3. Nenne **ein** typisches Problem von Stemming (z. B. „überkürzt“, „kein echtes Wort“) — **ein** kurzes Beispiel reicht (gern auf Englisch).

---

## Musterlösungen

_Hier die **Orientierung** — deine Antwort kann anders formuliert sein, sollte aber dieselben **fachlichen Punkte** treffen._

### Zu Aufgabe 1

- **(a) Syntax** — Es geht um **Wortstellung** im Satz (Struktur der Wortfolge).
- **(b) Semantik** (lexikalische Semantik / Begriffsbeziehung) — _Hund_ ist ein \*_Hypersäugetier_ unter _Säugetier_ (Hyperonymie).
- **(c) Morphologie** — Zerlegung in **Morpheme** / Wortinterne Struktur.
- **(d) Pragmatik** — Bedeutung hängt von **Situation, Tonfall, Kontext** ab (nicht nur vom Wortlaut).

---

### Zu Aufgabe 2

**Kernpunkte:** Stemming (und Lemmatisierung) fassen **Wortformen** eines **Lexems** oder **Wortfamilien** zusammen — **nicht** automatisch **verschiedene Lexeme** mit ähnlicher Bedeutung (_schnell_ / _rasch_ sind zwei **verschiedene** Wörter im Lexikon). Synonymie ist **semantisch**; Stemming arbeitet **morphologisch**-heuristisch. Zusätzlich: Stemming kann **Fehlschnitte** produzieren und ist **sprachspezifisch** — ohne Semantik „weiß“ der Stemmer nicht, _welche_ Wörter gleichbedeutend sind.

---

### Zu Aufgabe 3

1. **Orthographisch:** Ja, **relativ** ähnlich — gleiche Länge, **eine** Buchstabenänderung an derselben Position (häufig messbar mit Edit-Distanz).
2. **Semantisch:** **Nein** — _Haus_ und _Maus_ bezeichnen **völlig verschiedene** Dinge.
3. **Edit-Distanz allein:** Sie misst nur **Oberflächen-Ähnlichkeit**, **keine** Bedeutung. **Haus/Maus** zeigt: **kleine** Schreibdistanz **≠** semantische Nähe. Deshalb braucht man für „gleiche Idee“ **semantische** Verfahren oder **zusätzliche** Prüfungen — nicht nur String-Metriken.

---

### Zu Aufgabe 4

1. **Lexikalisch gleich?** **Nein** — andere Sprachen, andere Wörter.
2. **Semantisch nah?** **Ja, kann** — Inhalt kann **gleich** sein (Klima als Thema).
3. **Verfahren + Einschränkung (Beispiel):** **Mehrsprachige Satz-Embeddings** oder **mehrsprachliche Transformer** können semantische Nähe messen — **Einschränkung:** Qualität und **Bias** variieren je Sprache und Domäne; **Kosten** und **Datenschutz** bei externen APIs (bei euch: **selbst gehostet** beachten).

---

### Zu Aufgabe 5

**Beispieltabelle (Muster):**

| Teilproblem                     | Ansatz                                                         | Kurzgrund                                                                                            |
| ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Flexion** (_laufen_ / _lief_) | Lemmatisierung/Stemming **oder** LLM-Gruppierung               | Regeln/NLP gut für **eine** Sprache; LLM kann mehr, ist aber **teurer** und braucht **Validierung**. |
| **Tippfehler**                  | Edit-Distanz + Schwellenwert, ggf. Clustering                  | Schnell, **ohne** Semantik; falsch positiv bei _Haus_/_Maus_ möglich.                                |
| **Synonyme / Paraphrase**       | Embeddings oder LLM mit **JSON-Schema**                        | Semantik nötig; **Zod**-Pflicht für LLM-Ausgaben im Projekt.                                         |
| **Sprachenmix**                 | Mehrsprachiges Modell oder LLM mit klarer Prompt-Spezifikation | Ohne mehrsprachige Logik **keine** faire Zusammenführung.                                            |

**Merke:** Deine Tabelle darf **andere** Zeilen haben — wichtig sind **Abwägung** und **Fallback** (z. B. lexikalische Wolke).

---

### Zu Aufgabe 6

1. **Stemming:** Ziel ist oft ein **gemeinsamer Stamm** (z. B. _run_), auch wenn das Ergebnis **kein** Wörterbuch-Wort ist (je nach Stemmer).
2. **Lemma (Verb):** typischerweise **run** als Infinitiv (POS = Verb).
3. **Stemming-Problem (Beispiel):** _studies_ → _studi_ (Porter) — **kein** normales englisches Wort; oder **Übergeneralisierung** bei unterschiedlichen Wortarten (gleicher Stamm, andere Bedeutung).

---

## Schlusswort

Wenn du **Syntax, Semantik, Lexik und Stemming** auseinanderhältst, kannst du dein Praktikum **klar beschreiben**: Wo nutzt ihr **regelbasierte** Normalisierung, wo **statistische** oder **neuronale** Verfahren, und wo ein **LLM** — und **warum** das für Lehrende einen Mehrwert hat, ohne Daten zu gefährden.

Bei Fragen zur **Umsetzung in der Codebasis** siehe [`PRAKTIKUM.md`](./PRAKTIKUM.md) und die dort verlinkten Pfade.

---

_Stand: 2026-03-23 · Übungsaufgaben mit Musterlösungen ergänzt · Ergänzungen willkommen (Pull Request oder Absprache mit der Betreuung)._
