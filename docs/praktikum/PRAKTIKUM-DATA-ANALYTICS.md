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
  - [6. Technische Landkarte: spaCy, mBERT, lokale LLMs](#6-technische-landkarte-spacy-mbert-lokale-llms)
  - [7. Schwerpunkt: Modellwahl und Prompting (selbst gehostet)](#7-schwerpunkt-modellwahl-und-prompting-selbst-gehostet)
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

In arsnova.eu sollen Lehrende bei der Auswertung von vielen Freitext- und Q&A-Eingaben durch eine **„Intelligente Moderationshilfe“** unterstützt werden. Ein zentraler Teil davon ist die **Wortwolke** (aktuell überwiegend **lexikalisch**: Token zählen, Stopwörter, siehe `word-cloud.util.ts`). **Geplant** ist eine **intelligentere** Auswertung: ähnliche **Bedeutungen** und **Formulierungen** sollen **sinnvoll gebündelt** werden (Kanontoken, Themenlabels, nachvollziehbare Gewichte).

**Dein Praktikum** fokussiert **Data Analytics und NLP**:

- Du arbeitest **primär** an **Auswahl**, **Konfiguration** und **Prompting** eines **selbst gehosteten** Sprachmodells (On-Prem, Hochschul-Infrastruktur — Endpoint und Richtlinien gibt die Betreuung vor).
- Du **vergleichst** das mit **leichtgewichtigen** Ansätzen: **spaCy** (Pipeline, Lemmata, Entitäten) und **mehrsprachige Encoder** wie **mBERT** bzw. gängige **multilingual Sentence-Transformer** (Embeddings für Ähnlichkeit und Clustering) — als **Baseline**, **Vorstufe** oder **Hybrid** (z. B. erst filtern/normalisieren, dann LLM).

So lernst du, **wann** welche Schicht sinnvoll ist — statt „alles mit einem großen LLM“ zu lösen.

**Begriffsgrundlage (Pflichtlektüre für Konzept und Abgabe):**

**→ [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](./BEGRIFFE-FREITEXT-UND-SEMANTIK.md)**

---

## 2. Deine Rolle

Du bist **NLP-/Analytics-Verantwortliche:r** für das **Feature-Set „Intelligente Moderationshilfe“** (insbesondere intelligente Wortwolke und Q&A-Zusammenfassung). Du lieferst **nachvollziehbare** Entscheidungen und **messbare** oder **argumentierte** Qualität — nicht nur „einmal prompten und hoffen“.

**Typische Outputs:**

- **Entscheidungsmatrix:** Welches Modell (Parametergröße, Latenz, Sprachen, Lizenz) für welche Teilaufgabe?
- **Prompt-Spezifikation:** System-/User-Prompts, Few-Shot-Beispiele, **strukturierte Ausgabe** (JSON), Validierungsideen (z. B. Angleichung an Zod-Schemas aus dem Produkt).
- **Evaluierung:** Kleine **Gold- oder Silber-Testsets** (anonymisierte oder synthetische Freitextlisten), Metriken oder **qualitative** Fehleranalyse (wo bricht das Modell?).
- Optional: **Notebook** oder **kleines CLI/Service-Skript**, das die Pipeline demonstriert (ohne Muss, volle Integration ins Monorepo zu bauen — Absprache mit Betreuung).

---

## 3. Lernziele

Nach dem Praktikum kannst du typischerweise:

- **NLP-Pipeline vs. generatives LLM** sauber **abgrenzen** und **kombinieren** (Vorverarbeitung, Clustering, Zusammenfassung, Bündeln).
- **Selbst gehostete** Open-Weight-Modelle **auswählen** (Kriterien: Latenz, RAM/VRAM, Sprachabdeckung, Lizenz, Halluzinationsrisiko).
- **Prompts** so gestalten, dass die Ausgabe **strukturiert** und **validierbar** ist (JSON-Schema, Felder für Kanontoken, Gewichte, Kurzbegründung).
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
2. **Pipeline-Skizze:** Roh-Freitext → (optional spaCy/Normalisierung) → (optional Embeddings/Clustering) → **LLM** mit definiertem **Output-JSON**.
3. **Modellwahl:** Mindestens **zwei** selbst gehostete **generative** Kandidaten **vergleichen** (z. B. unterschiedliche Größe oder Familie — konkrete Namen nennen, die **bei euch** lauffähig sind). Begründung mit **Latenz**, **Qualität** auf euren Testdaten, **Ressourcen**.
4. **Prompt-Strategie:** Wie steuerst du **Konsistenz**, **Sprache**, **keine erfundenen Antworten** (nur aus Eingabeliste bündeln)? Wie sieht ein **Few-Shot** aus?
5. **Baseline:** Was leisten **spaCy** und/oder **mBERT** (oder vergleichbarer multilingual Encoder) **ohne** generatives LLM — und **wo** lohnt das LLM?
6. **Evaluierung:** Wie prüfst du „gut genug“? (Beispiele, Fehlerklassen, ggf. einfache Kennzahl.)
7. **Abgrenzung:** Was ist in **40 h** realistisch, und was wäre ein sinnvoller Ausblick für eine spätere Produktintegration?

### 5.2 Praktische Artefakte (Portfolio)

**Mindestens zwei** der folgenden Bausteine (in **Absprache** mit der Betreuung):

| Baustein                  | Beispiel für ein „fertiges“ Artefakt                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Prompt-Bibliothek**     | Versionierte Markdown- oder YAML-Datei mit System/User-Prompts, Parametern (Temperatur, max tokens), Changelog         |
| **Modellvergleich**       | Tabelle + Kurzprotokoll: gleiche Eingaben, Ausgaben, Laufzeit, subjektive/feingranulare Bewertung                      |
| **JSON-Schema-Vorschlag** | Felder für Kanontoken, Alias-Liste, Gewicht, optional `confidence` — kompatibel mit dem Gedanken an **Zod** im Produkt |
| **Notebook / Skript**     | Reproduzierbare Pipeline: Eingabe CSV/JSON → Ausgabe strukturiert; spaCy- und/oder Embedding-Schritt dokumentiert      |
| **Testkorpus**            | Kleine, **DSGVO-sichere** Liste (synthetisch oder stark anonymisiert) mit **erwarteten** Bündeln als Referenz          |

**Hinweis:** Vollständige **Produktintegration** (tRPC, Angular, 5 Sprachen) ist **nicht** Kern dieses Praktikums — es sei denn, die Betreuung vereinbart explizit eine Schnittstelle.

---

## 6. Technische Landkarte: spaCy, mBERT, lokale LLMs

| Werkzeug / Modellklasse          | Typische Rolle im Praktikum                                                                                                                                                                                                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **spaCy**                        | Schnelle **lokale** Pipeline: Tokenisierung, Lemmata, POS, NER; **Baseline** für Normalisierung; **kein** Ersatz für semantisches Bündeln großer Varianten                                                                                                                                                  |
| **mBERT / multilingual Encoder** | **Dense Embeddings** für Ähnlichkeit, Clustering, „nahe“ Antworten finden; gut für **explizite** semantische Gruppen **ohne** generatives Sampling                                                                                                                                                          |
| **Open-Weight-LLMs (lokal)**     | **Generierung** strukturierter Bündel/Labels; stark abhängig von **Prompt** und **Größe**; typisch über **Ollama**, **vLLM**, **llama.cpp**, **Text Generation Inference** u. ä. — konkrete Modelle wählt ihr mit der Betreuung (z. B. kleinere 7B/8B-Klassen vs. stärkere Modelle, sofern Hardware reicht) |

**Merke:** spaCy und mBERT sind oft **erste Kandidaten** für **Analyse und Baseline**; der **Praktikumsschwerpunkt** liegt trotzdem auf **LLM-Auswahl und Prompting** auf **eurer** selbst gehosteten Infrastruktur.

---

## 7. Schwerpunkt: Modellwahl und Prompting (selbst gehostet)

### 7.1 Modellwahl (Checkliste)

- **Lizenz** und **Nutzungsbedingungen** (auch für Hochschul-Einsatz).
- **Sprachen:** Deckt das Modell **Deutsch und Englisch** zuverlässig ab? Wie mit Code-Switching in Antworten?
- **Ressourcen:** RAM/VRAM, Batch, **Streaming** vs. Einzelrequest.
- **Determinismus:** Braucht ihr **reproduzierbare** Läufe (Sampling-Parameter, Seeds)?
- **Sicherheit:** Kein Leaken von Session-IDs in Prompts; **Minimierung** der übermittelten Texte; Logging nur nach **Richtlinie**.

### 7.2 Prompting (Mindestanforderungen)

- **Klare Rolle** (z. B. „Du bündelst nur Formulierungen aus der Liste“).
- **Eingabeformat** (nummerierte Zeilen, JSON-Array).
- **Ausgabeformat** **strikt JSON** mit festen Schlüsseln — damit später **Zod**-Validierung denkbar ist.
- **Fehlerfälle:** Zu viele Eingaben, leere Liste, unbekannte Sprache — was soll das Modell tun?
- **Versionierung:** Prompt- und Modellversion in der Dokumentation festhalten (für Nachvollziehbarkeit).

### 7.3 Validierung

Beschreibe, wie ihr **kaputte** oder **halluzinierte** JSON-Antworten erkennt — analog zur Produktidee: **nie** blind parsen ohne Schema.

---

## 8. Bezug zur Codebasis

| Thema              | Wo im Repo (Orientierung)                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lexikalische Wolke | `apps/frontend/.../word-cloud.util.ts`, `word-cloud.component.ts`                                                                                      |
| Architektur Wolke  | [`docs/architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md`](../architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md) |
| Produkt-Stories    | [`Backlog.md`](../../Backlog.md) — u. a. **1.14**, **1.14a**                                                                                           |
| Produktintegration | ggf. spätere Anbindung über tRPC, Zod und UI; in diesem Praktikum nur zur Einordnung relevant                                                          |
| Sicherheit         | [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)                                                                                                 |

---

## 9. Vorschlag: 10 Blöcke à 4 Stunden

| Block  | Schwerpunkt                   | Artefakte                                                                    |
| ------ | ----------------------------- | ---------------------------------------------------------------------------- |
| **1**  | Onboarding Produkt + Begriffe | `BEGRIFFE-…` gelesen; 5 Beispiel-Freitextsätze für eigene Tests notiert      |
| **2**  | Anforderungen + JSON-Zielbild | Grobes Output-JSON skizziert; Datenschutz-Notizen                            |
| **3**  | spaCy-Baseline                | Kleines Skript: Lemmata/Stopwörter; Grenzen dokumentieren                    |
| **4**  | Embeddings (mBERT o. ä.)      | Ähnlichkeitsmatrix oder kleines Clustering; wann bricht es?                  |
| **5**  | LLM 1: Setup selbst gehostet  | Erster Lauf, Latenz messen, Rohausgabe sammeln                               |
| **6**  | Prompt-Design v1              | Strukturiertes JSON; 3 Iterationen mit denselben Eingaben                    |
| **7**  | LLM 2: zweites Modell         | Vergleichstabelle LLM1 vs. LLM2                                              |
| **8**  | Fehleranalyse                 | Fehlerklassen (Überbündeln, Sprachmix, JSON-Bruch); Gegenmaßnahmen im Prompt |
| **9**  | Hybrid-Idee                   | Skizze: spaCy/Embeddings + LLM nur für „schwierige“ Fälle (optional)         |
| **10** | Abgabe                        | Konzept final; Prompt-Bibliothek + Korpus/Notebook; Kurzvortrag oder Demo    |

---

## 10. Bewertung

| Kriterium           | Was geprüft wird                                                              |
| ------------------- | ----------------------------------------------------------------------------- |
| **Fachverständnis** | Lexik vs. Semantik, sinnvolle Pipeline, realistische Erwartungen an spaCy/LLM |
| **Modellwahl**      | Begründet, vergleichend, ressourcenbewusst                                    |
| **Prompting**       | Reproduzierbar, strukturierte Ausgabe, Fehlerfälle                            |
| **Evaluierung**     | Nachvollziehbare Tests oder Fehleranalyse                                     |
| **Produktbezug**    | Klare Anbindung an die Intelligente Moderationshilfe + Datenschutz            |
| **Darstellung**     | Klare Dokumentation, Teamfähigkeit (falls Gruppenpraktikum)                   |

---

## 11. FAQ

**Muss ich in Frontend oder Backend integrieren?** Nur wenn die Betreuung das **explizit** verlangt. Standard: **Analytics-Artefakte** + Konzept; vollständige Produktintegration ist **nicht** der Kern dieses Praktikums.

**Reicht nur spaCy ohne LLM?**  
Als **alleinige** Praktikumsleistung **nein** — der Schwerpunkt ist **LLM auf selbst gehosteter Infrastruktur**. spaCy (und ggf. mBERT) dienen dem **Vergleich** und der **Methodenkompetenz**.

**Welches LLM ist „richtig“?**  
Das hängt von **Hardware** und **Richtlinien** ab. Ihr **begründet** eure Wahl anhand von Tests — nicht anhand von Marketing.

**DSGVO?**  
Nur **notwendige** Texte verarbeiten; **keine** personenbezogenen Zusatzinfos in Prompts; Aufbewahrung und Logs mit Betreuung klären.

---

## 12. Abgabe-Checkliste

- [ ] Konzeptdokument (PDF oder Markdown nach Absprache)
- [ ] Prompt-Bibliothek (versioniert)
- [ ] Modellvergleich (mindestens zwei generative Konfigurationen)
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
