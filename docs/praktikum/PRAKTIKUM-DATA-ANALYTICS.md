<!-- markdownlint-disable MD013 MD022 MD032 -->

# Praktikum Data Analytics und NLP — Intelligente Moderationshilfe

**Für Studierende** · **Umfang:** in der Regel **10 Termine à 4 Stunden** (ca. **40 Stunden** Planungsgröße — exakte Vorgabe gibt die **Betreuung** in der Veranstaltung)

**Programmiergrundlagen ohne Erfahrung mit dem arsnova.eu-Stack?** Für die **Einordnung** von Monorepo, tRPC und Zod genügt **[`EINSTIEG-TOOLS-UND-STACK.md`](./EINSTIEG-TOOLS-UND-STACK.md)** — dein Schwerpunkt bleibt NLP/Analytics (siehe Abschnitt 8 in diesem Dokument).

## Inhaltsverzeichnis

- [Praktikum Data Analytics und NLP — Intelligente Moderationshilfe](#praktikum-data-analytics-und-nlp--intelligente-moderationshilfe)
  - [Inhaltsverzeichnis](#inhaltsverzeichnis)
  - [1. Was ist das Ziel?](#1-was-ist-das-ziel)
  - [2. Deine Rolle](#2-deine-rolle)
  - [3. Lernziele](#3-lernziele)
  - [4. Zeitmodell](#4-zeitmodell)
  - [5. Bewertete Leistung](#5-bewertete-leistung)
    - [5.1 Konzeption (schriftlich)](#51-konzeption-schriftlich)
    - [5.2 Praktische Artefakte (Portfolio)](#52-praktische-artefakte-portfolio)
  - [6. Technische Landkarte: Baseline, Embeddings, Kaskade, lokale LLMs](#6-technische-landkarte-baseline-embeddings-kaskade-lokale-llms)
  - [7. Schwerpunkt: Modellvergleich und Evaluation nach ADR-0032](#7-schwerpunkt-modellvergleich-und-evaluation-nach-adr-0032)
    - [7.1 Modellwahl (Checkliste)](#71-modellwahl-checkliste)
    - [7.2 Prompting (Mindestanforderungen)](#72-prompting-mindestanforderungen)
    - [7.3 Validierung](#73-validierung)
  - [8. Bezug zur Codebasis](#8-bezug-zur-codebasis)
  - [9. Vorschlag: 10 Blöcke à 4 Stunden](#9-vorschlag-10-blöcke-à-4-stunden)
  - [10. Bewertung](#10-bewertung)
  - [11. FAQ](#11-faq)
  - [12. Abgabe-Checkliste](#12-abgabe-checkliste)
  - [13. Literatur / Links im Repo](#13-literatur--links-im-repo)

---

## 1. Was ist das Ziel?

In arsnova.eu sollen Lehrende bei der Auswertung von vielen Freitext- und Q&A-Eingaben durch eine **„Intelligente Moderationshilfe“** unterstützt werden. Ein zentraler Teil davon ist die **Wortwolke** (aktuell überwiegend **lexikalisch**: Stopwörter, Wortfamilien, Phrasen und Document-Frequency-Gewichtung, siehe `word-cloud-term.service.ts` und `word-cloud.util.ts`). **Geplant** ist eine intelligentere, aber bewusst gestufte Auswertung: zuerst ein deterministischer Moderationskompass (Backlog Story **8.9a**), danach optional eine asynchrone Q&A-NLP-Kaskade für Kategorien und Unsicherheiten (**8.9b**, [ADR-0032](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md)) und erst später eine optionale generative Zusammenfassung (**8.9c**).

**Dein Praktikum** fokussiert **Data Analytics und NLP**:

- Du bewertest **mehrere Schichten**: vorhandene deterministische/lexikalische Auswertung, klassische NLP-Baselines, leichte supervised Klassifikatoren, moderne mehrsprachige Embeddings und optional lokale generative Modelle.
- Du zeigst, welche Schicht für welche Produktstufe sinnvoll ist: **8.9a** ohne neue Inferenz, **8.9b** asynchron und abschaltbar für Q&A-Hilfssignale, **8.9c** nur als spätere quellengebundene Zusammenfassung.
- Falls ein selbst gehostetes Sprachmodell verwendet wird, behandelst du es als **optionale Komfortschicht** mit klarer Validierung, Timeout, Fallback und Datenschutzgrenzen, nicht als Pflichtantwort auf jedes NLP-Problem.

So lernst du, **wann** welche Schicht sinnvoll ist — statt „alles mit einem großen LLM“ zu lösen.

**Begriffsgrundlage (Pflichtlektüre für Konzept und Abgabe):**

**→ [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](./BEGRIFFE-FREITEXT-UND-SEMANTIK.md)**

---

## 2. Deine Rolle

Du bist **NLP-/Analytics-Verantwortliche:r** für das **Feature-Set „Intelligente Moderationshilfe“** (insbesondere Moderationskompass, Q&A-Kategorien, intelligente Wortwolke und optional Q&A-Zusammenfassung). Du lieferst **nachvollziehbare** Entscheidungen und **messbare** oder **argumentierte** Qualität — nicht nur „einmal prompten und hoffen“.

**Typische Outputs:**

- **Entscheidungsmatrix:** Welche Schicht oder welches Modell (Baseline, Gatekeeper, Embedding-Fallback, optional LLM) für welche Teilaufgabe?
- **Schema-/Prompt-Spezifikation:** Strukturierte Ausgabe (JSON), Validierungsideen (z. B. Angleichung an Zod-Schemas aus dem Produkt) und Prompts nur dort, wo eine generative Schicht wirklich genutzt wird.
- **Evaluierung:** Kleine **Gold- oder Silber-Testsets** (anonymisierte oder synthetische Freitext- und Q&A-Listen), Metriken oder **qualitative** Fehleranalyse (wo bricht welcher Kandidat?).
- Optional: **Notebook** oder **kleines CLI/Service-Skript**, das die Pipeline demonstriert (ohne Muss, volle Integration ins Monorepo zu bauen — Absprache mit Betreuung).

---

## 3. Lernziele

Nach dem Praktikum kannst du typischerweise:

- **Deterministische Baseline, NLP-Pipeline und generatives LLM** sauber **abgrenzen** und **kombinieren** (Vorverarbeitung, Klassifikation, Clustering, Zusammenfassung, Bündeln).
- **Kandidaten** auswählen und vergleichen (Kriterien: Latenz, CPU/RAM/VRAM, Sprachabdeckung, Lizenz, Modellpflege, Kalibrierbarkeit, Halluzinationsrisiko).
- **Ausgaben** so gestalten, dass sie **strukturiert** und **validierbar** sind (JSON-Schema, Kategorien, Konfidenz, Modellversion, Quellenbezug).
- **Risiken** benennen: Datenschutz (Freitext!), **keine** unnötige Speicherung sensibler Inhalte, Timeout und Fallback (z. B. Rückfall auf eine lexikalische Wolke).
- **Mehrsprachigkeit** einordnen: Deutsch/Englisch in der Lehre, gemischte Antworten, ob **ein** mehrsprachiges Modell reicht oder **pro Sprache** getrennte Pfade nötig sind.

---

## 4. Zeitmodell

Die **40 Stunden** sind eine Richtgröße; Zeit für **Lesen**, **Experimente**, **Fehleranalyse** und **Dokumentation** ist **Teil der Leistung**.

**Empfehlung:** Pro Block **3–5 Sätze Protokoll**: Hypothese, Experiment, Ergebnis, nächster Schritt.

---

## 5. Bewertete Leistung

Die Betreuung legt **Gewichtung** und **Mindesttiefe** fest. Orientierung:

### 5.1 Konzeption (schriftlich)

**4–8 Seiten** (inkl. Tabellen), studierendenverständlich, aber fachlich präzise:

1. **Problem:** Warum reicht **rein lexikalisch** nicht? Was soll „intelligent“ **konkret** heißen (Bündeln, Labels, Datenschutz)?
2. **Pipeline-Skizze:** Roh-Freitext/Q&A → vorhandene deterministische Signale → optional Gatekeeper → optional Embedding-/SetFit-Fallback → optional generative Zusammenfassung mit definiertem **Output-JSON**.
3. **Modellwahl:** Mindestens **zwei Kandidaten aus verschiedenen Schichten** vergleichen, z. B. klassische Baseline vs. Embedding-/SetFit-Variante. Generative Kandidaten sind nur Pflicht, wenn die Betreuung ausdrücklich 8.9c einschließt.
4. **Strukturierte Ausgabe / Prompt-Strategie:** Wie steuerst du **Konsistenz**, **Sprache**, **keine erfundenen Antworten** und Quellenbindung? Prompts sind nur dort zentral, wo eine generative Schicht genutzt wird.
5. **Baseline:** Was leisten vorhandene Wortwolkenlogik, spaCy, Hashing-/n-Gram-Modelle oder mehrsprachige Encoder **ohne** generatives LLM — und **wo** lohnt eine teurere Schicht?
6. **Evaluierung:** Wie prüfst du „gut genug“? (Beispiele, Fehlerklassen, ggf. einfache Kennzahl.)
7. **Abgrenzung:** Was ist in **40 h** realistisch, und was wäre ein sinnvoller Ausblick für eine spätere Produktintegration?

### 5.2 Praktische Artefakte (Portfolio)

**Mindestens zwei** der folgenden Bausteine (in **Absprache** mit der Betreuung):

| Baustein                      | Beispiel für ein „fertiges“ Artefakt                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Schema-/Prompt-Bibliothek** | Versionierte Markdown- oder YAML-Datei mit Output-Schema, Kategorien, Validierungsregeln und optional Prompts/Parametern |
| **Modellvergleich**           | Tabelle + Kurzprotokoll: gleiche Eingaben, Ausgaben, Laufzeit, Ressourcen, Fehlerklassen und Qualitätsbewertung          |
| **JSON-Schema-Vorschlag**     | Felder für Kanontoken, Alias-Liste, Gewicht, optional `confidence` — kompatibel mit dem Gedanken an **Zod** im Produkt   |
| **Notebook / Skript**         | Reproduzierbare Pipeline: Eingabe CSV/JSON → Ausgabe strukturiert; spaCy- und/oder Embedding-Schritt dokumentiert        |
| **Testkorpus**                | Kleine, **DSGVO-sichere** Liste (synthetisch oder stark anonymisiert) mit **erwarteten** Bündeln als Referenz            |

**Hinweis:** Vollständige **Produktintegration** (tRPC, Angular, 5 Sprachen) ist **nicht** Kern dieses Praktikums — es sei denn, die Betreuung vereinbart explizit eine Schnittstelle.

---

## 6. Technische Landkarte: Baseline, Embeddings, Kaskade, lokale LLMs

| Werkzeug / Modellklasse                | Typische Rolle im Praktikum                                                                                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Produkt-Baseline**                   | Vorhandene Wortwolken- und Session-Signale; wichtig für Story **8.9a**, weil der erste Moderationskompass ohne neue Inferenz belastbar bleiben soll                               |
| **spaCy / klassische NLP-Regeln**      | Schnelle **lokale** Pipeline: Tokenisierung, Lemmata, POS, NER; **Baseline** für Normalisierung; **kein** Ersatz für semantisches Bündeln großer Varianten                        |
| **Hashing-/n-Gram-Klassifikatoren**    | Sehr schnelle CPU-Baseline für kurze Texte; geeignet als Gatekeeper-Vergleich für Story **8.9b**                                                                                  |
| **Mehrsprachige Encoder / Embeddings** | **Dense Embeddings** für Ähnlichkeit, Clustering und semantische Nähe; Kandidaten sind z. B. moderne E5-/GTE-/BGE-Modelle statt nur mBERT/MiniLM                                  |
| **SetFit / linear probing**            | Few-shot- oder leicht trainierbare Klassifikation auf Embeddings; möglicher Mittelweg zwischen klassischer Baseline und teurem generativem Modell                                 |
| **Open-Weight-LLMs (lokal)**           | Optionale **generative** Zusammenfassung oder Label-Verbalisierung; nur mit Quellenbindung, Schema-Validierung, Timeout und Fallback, typisch eher Story **8.9c** als Q&A-Hotpath |

**Merke:** Die stärkste Lösung ist nicht automatisch die größte. ADR-0032 verlangt eine messbare, abschaltbare Kaskade: erst günstige Baselines, dann semantischer Fallback, generative Modelle nur, wenn sie fachlich und betrieblich gerechtfertigt sind.

---

## 7. Schwerpunkt: Modellvergleich und Evaluation nach ADR-0032

### 7.1 Modellwahl (Checkliste)

- **Lizenz** und **Nutzungsbedingungen** (auch für Hochschul-Einsatz).
- **Sprachen:** Deckt das Modell **Deutsch und Englisch** zuverlässig ab? Wie mit Code-Switching in Antworten?
- **Ressourcen:** CPU/RAM/VRAM, Batch, Startzeit, Containergröße, mögliche Quantisierung.
- **Pfadtyp:** Darf der Kandidat nur asynchron laufen? Welche Timeout- und Fallback-Regel braucht er?
- **Determinismus und Kalibrierung:** Sind Konfidenzen interpretierbar? Braucht ihr Schwellenwerte, Kalibrierkurven oder manuelle Review-Slices?
- **Sicherheit:** Kein Leaken von Session-IDs in Prompts; **Minimierung** der übermittelten Texte; Logging nur nach **Richtlinie**.

### 7.2 Strukturierte Ausgabe und Prompting (Mindestanforderungen)

- **Ausgabeformat** **strikt JSON** mit festen Schlüsseln — damit später **Zod**-Validierung denkbar ist.
- **Ergebnisvertrag:** Kategorie/Label, Konfidenz, Modellversion, Analysezeitpunkt, Status (`pending`, `classified`, `uncertain`, `disabled`, `failed`).
- **Quellenbindung:** Generative Zusammenfassungen dürfen nur aus sichtbaren oder aggregierten Eingangssignalen ableiten.
- **Fehlerfälle:** Zu viele Eingaben, leere Liste, unbekannte Sprache, Timeout, Modell nicht verfügbar — was soll die Pipeline tun?
- **Versionierung:** Modell-, Schema- und ggf. Promptversion in der Dokumentation festhalten (für Nachvollziehbarkeit).

### 7.3 Validierung

Beschreibe, wie ihr **kaputte** oder **halluzinierte** JSON-Antworten erkennt — analog zur Produktidee: **nie** blind parsen ohne Schema.

---

## 8. Bezug zur Codebasis

| Thema              | Wo im Repo (Orientierung)                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lexikalische Wolke | `apps/frontend/.../word-cloud-term.service.ts`, `word-cloud.util.ts`, `word-cloud.component.ts`                                                        |
| Architektur Wolke  | [`docs/architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md`](../architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md) |
| Produkt-Stories    | [`Backlog.md`](../../Backlog.md) — u. a. **1.14**, **1.14a**                                                                                           |
| Produktintegration | ggf. spätere Anbindung über tRPC, Zod und UI; in diesem Praktikum nur zur Einordnung relevant                                                          |
| Sicherheit         | [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)                                                                                                 |

---

## 9. Vorschlag: 10 Blöcke à 4 Stunden

| Block  | Schwerpunkt                     | Artefakte                                                                     |
| ------ | ------------------------------- | ----------------------------------------------------------------------------- |
| **1**  | Onboarding Produkt + Begriffe   | `BEGRIFFE-…` gelesen; 5 Beispiel-Freitextsätze für eigene Tests notiert       |
| **2**  | Anforderungen + JSON-Zielbild   | Grobes Output-JSON skizziert; Datenschutz-Notizen                             |
| **3**  | Deterministische/spaCy-Baseline | Kleines Skript oder Analyse: Lemmata/Stopwörter/Regeln; Grenzen dokumentieren |
| **4**  | Klassischer Gatekeeper          | Hashing-/n-Gram- oder ähnlichen Klassifikator gegen Testset messen            |
| **5**  | Embeddings / SetFit             | Ähnlichkeitsmatrix, Clustering oder Klassifikation; wann bricht es?           |
| **6**  | ADR-0032-Kaskade skizzieren     | Ergebnisvertrag, Timeout, Fallback, Statusfelder und Messpunkte beschreiben   |
| **7**  | Optional generative Schicht     | Nur falls vereinbart: strukturierte Zusammenfassung, Quellenbindung, Latenz   |
| **8**  | Fehleranalyse                   | Fehlerklassen (Überbündeln, Sprachmix, JSON-Bruch); Gegenmaßnahmen im Prompt  |
| **9**  | Hybrid-Idee                     | Skizze: Baseline + Gatekeeper + Fallback, generativ nur für passende Fälle    |
| **10** | Abgabe                          | Konzept final; Prompt-Bibliothek + Korpus/Notebook; Kurzvortrag oder Demo     |

---

## 10. Bewertung

| Kriterium            | Was geprüft wird                                                                     |
| -------------------- | ------------------------------------------------------------------------------------ |
| **Fachverständnis**  | Lexik vs. Semantik, sinnvolle Pipeline, realistische Erwartungen an Baseline/NLP/LLM |
| **Modellwahl**       | Begründet, vergleichend, ressourcenbewusst                                           |
| **Schema/Prompting** | Reproduzierbar, strukturierte Ausgabe, Fehlerfälle                                   |
| **Evaluierung**      | Nachvollziehbare Tests oder Fehleranalyse                                            |
| **Produktbezug**     | Klare Anbindung an die Intelligente Moderationshilfe + Datenschutz                   |
| **Darstellung**      | Klare Dokumentation, Teamfähigkeit (falls Gruppenpraktikum)                          |

---

## 11. FAQ

**Muss ich in Frontend oder Backend integrieren?** Nur wenn die Betreuung das **explizit** verlangt. Standard: **Analytics-Artefakte** + Konzept; vollständige Produktintegration ist **nicht** der Kern dieses Praktikums.

**Reicht nur eine Methode?**

Als **alleinige** Praktikumsleistung meistens **nein** — der Schwerpunkt ist der **Vergleich**. Eine starke deterministische Baseline ist für Story 8.9a wertvoll, für Story 8.9b braucht ihr zusätzlich mindestens einen NLP-/Embedding- oder Klassifikationskandidaten.

**Welches Modell ist „richtig“?**

Das hängt von **Aufgabe**, **Hardware** und **Richtlinien** ab. Ihr **begründet** eure Wahl anhand von Tests — nicht anhand von Marketing.

**DSGVO?**  
Nur **notwendige** Texte verarbeiten; **keine** personenbezogenen Zusatzinfos in Prompts; Aufbewahrung und Logs mit Betreuung klären.

---

## 12. Abgabe-Checkliste

- [ ] Konzeptdokument (PDF oder Markdown nach Absprache)
- [ ] Schema-/Prompt-Bibliothek (versioniert; Prompts nur falls generative Schicht genutzt wird)
- [ ] Modellvergleich (mindestens zwei Kandidaten aus verschiedenen Schichten)
- [ ] Baseline spaCy und/oder Embedding-Experiment dokumentiert
- [ ] Kleines **Testkorpus** (DSGVO-konform) oder synthetische Daten
- [ ] Optional: Notebook/Skript + README zum Nachlaufen
- [ ] Kurzpräsentation oder Demo (10–15 Min.)

---

## 13. Literatur / Links im Repo

- [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](./BEGRIFFE-FREITEXT-UND-SEMANTIK.md)
- [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)
- [`docs/vibe-coding/`](../vibe-coding/) — optional für Prompt-Stil und Arbeitsablauf

**Viel Erfolg — Daten sprechen lassen, mit klarem Kopf und sauberen Prompts.**

---

_Stand: 2026-04-01 · Pflege: bei Änderungen am Praktikumsmodell dieses Dokument und Verweise in `docs/README.md` anpassen._
