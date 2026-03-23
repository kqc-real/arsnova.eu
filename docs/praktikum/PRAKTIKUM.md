<!-- markdownlint-disable MD013 MD022 MD032 -->

# Praktikum an der Codebasis arsnova.eu

**Für Studierende** · begleitendes Studienobjekt · **Umfang:** 10 Termine à 4 Stunden (40 Stunden Gesamtzeit, Planungsgröße)

Willkommen. Dieses Dokument erklärt **Ziele**, **Ablauf**, **bewertete Leistung** und **praktische Tipps**, damit du dich schnell zurechtfindest und realistisch planen kannst. Die App ist ein **fortlaufendes Forschungs- und Lehrprojekt**; dein Beitrag soll **nachvollziehbar**, **testbar** und **zur Architektur passend** sein.

**Parallel am selben Produkt:** Der **SQM-Praktikumsauftrag** (Qualität, Tests, Reviews, UX, Guidde) steht in **[`PRAKTIKUM-SQM.md`](./PRAKTIKUM-SQM.md)**; das didaktische **Zwei-Kurse-Modell** in [`docs/didaktik/zweiter-kurs-und-agentische-ki.md`](../didaktik/zweiter-kurs-und-agentische-ki.md).

### Ausführliche Begriffe (Konzept & „intelligente“ Wortwolke)

Für die **schriftliche Konzeption** und die Einordnung von **Syntax, Semantik, Lexik, Morphologie, Stemming, Lemmatisierung, Orthographie, Mehrsprachigkeit** und **semantischer Nähe** gibt es einen **eigenen, ausführlichen Leitfaden** (studierendenfreundlich, mit Beispielen, Tabellen und weiterführenden Links):

**→ [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](./BEGRIFFE-FREITEXT-UND-SEMANTIK.md)**

Dort findest du auch eine **Übersicht**, welche Methode **welches Problem** löst — und typische **Missverständnisse** (z. B. „Stemming = Synonyme erkennen“). Am Ende des Leitfadens gibt es **sechs Übungsaufgaben** mit **Musterlösungen** zum Selbsttest.

---

## 1. Was ist arsnova.eu?

Kurz: Eine **Web-App** für **Live-Quiz**, **Abstimmungen**, **Freitext** und **Q&A** in Lehrveranstaltungen — **Mobile-first**, **ohne** klassische Registrierungspflicht für Teilnehmende (Session-Code).

Technisch (für deine Orientierung):

| Bereich                  | Pfad / Technik                                                                   |
| ------------------------ | -------------------------------------------------------------------------------- |
| Frontend                 | `apps/frontend/` — **Angular** (Standalone, **Signals**), **Angular Material 3** |
| Backend                  | `apps/backend/` — **Node.js**, **tRPC**, **Prisma**, Redis                       |
| Gemeinsame API-Typen     | `libs/shared-types/` — **Zod**-Schemas (verbindlich für tRPC)                    |
| Architektur-Kurzreferenz | [`docs/cursor-context.md`](../cursor-context.md)                                 |
| Produkt-Backlog          | [`Backlog.md`](../../Backlog.md) im Repo-Root                                    |

**Erste Schritte:** [`docs/onboarding.md`](../onboarding.md), [`AGENT.md`](../../AGENT.md) (Arbeitsweise mit KI im Editor), [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

---

## 2. Lernziele des Praktikums

Du übst unter realistischen Bedingungen:

- **Full-Stack-Denken:** Daten fließen von UI → tRPC → Backend → ggf. externe Dienste; Typen kommen aus **Zod**, nicht aus „Bauchgefühl“.
- **Qualität:** Tests (Vitest), Fehlerbehandlung, **keine Geheimnisse im Browser**.
- **UX & Barrierefreiheit:** Bedienung auf dem Smartphone, sinnvolle Zustände (Laden, Fehler, leer).
- **Mehrsprachigkeit:** Neue sichtbare UI-Texte nach **ADR-0008** in **fünf Sprachen** (de, en, fr, es, it) — siehe [`docs/I18N-ANGULAR.md`](../I18N-ANGULAR.md).
- **Reflexion KI-gestützter Implementierung:** Du darfst **KI-Agenten** (z. B. Cursor, Copilot) nutzen — dokumentierst aber, **wo** sie geholfen haben und **wo** Nacharbeit nötig war.

---

## 3. Zeitmodell: 10 × 4 Stunden

Die **40 Stunden** sind eine **Richtgröße**. Nicht jede Stunde muss „Code schreiben“ sein: Lesen, Konzept, Review und Tests zählen genauso.

**Empfehlung:** Pro Block am Ende **kurz festhalten** (3–5 Sätze): Was ist fertig? Was blockiert? Was ist der Plan für den nächsten Block?

---

## 4. Bewertete Leistung (Pflicht)

### 4.1 Konzeption (schriftlich)

Eine **studentenfreundliche**, aber **fachlich klare** Ausarbeitung (ca. **3–6 Seiten** reichen, plus Abbildungen/Schema):

1. **Problem:** Warum reicht eine rein **lexikalische** Wortwolke (Token zählen) für Lehrkontexte oft nicht? Was soll durch **semantische / lexikonische Angleichung** besser werden?
2. **Zielbild:** Was ist ein **Kanontoken** / **Themenlabel**? Wie entstehen **Gewichte** (z. B. Anzahl zugrunde liegender Antworten)?
3. **Datenfluss:** Welche **Rohdaten** (Freitextantworten, Q&A-Fragentexte) gehen **wohin**? **Wer** darf die Funktion auslösen (typisch: **nur Host**)?
4. **Externes LLM:** Aufruf **serverseitig**; **kein API-Key im Frontend**. Timeout, Fehlerfälle, **keine unnötige Protokollierung** personenbezogener Inhalte (siehe auch [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)).
5. **Fallback:** Wenn das LLM nicht antwortet oder die Antwort **nicht valide** ist → Rückfall auf das **bestehende** lexikalische Verhalten (siehe Abschnitt 6).
6. **Abgrenzung:** Was ihr in 40 Stunden **nicht** liefern müsst (z. B. perfekte Layout-Wolke „wie Mentimeter-Premium“, mehrsprachige LLM-Prompts für alle Locales), damit der Scope stabil bleibt.

### 4.2 Umsetzung (Code)

**Mindestumfang:**

| Teil                                                   | Inhalt                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A) Intelligente / semantische Wortwolke (Freitext)** | Auf Basis der **Freitextantworten** einer laufenden Auswertung: Anbindung an eure **selbst gehostete LLM-API** zur **Bündelung** ähnlicher Aussagen (semantisch und/oder lexikonisch). Darstellung in der **Host-** (und ggf. **Present-**)Ansicht, **ohne** die bestehende einfache Wolke zwanghaft zu entfernen (z. B. Umschalter oder zweite Karte). |
| **B) Q&A: Zusammenfassung + semantische Aufbereitung** | Aus den **Q&A-Fragentexten** einer Session (serverseitig lesbar): **kurze Zusammenfassung** für die Lehrperson plus **thematische Schlagwörter** oder **kleine semantische Wolke** — Umfang im Konzept festlegen, damit es in 40 h realistisch bleibt.                                                                                                  |

**Qualitätsanforderungen:**

- **Zod-Validierung** der LLM-Antwort (`libs/shared-types`) — analog zum Denken beim KI-Quiz-Import: **Nie** blind `JSON.parse` ohne Schema.
- **tRPC**-Prozeduren mit klarer **Berechtigung** (nur Host/Session-Führung).
- **Tests:** sinnvolle **Unit-Tests** mit **Mock** der LLM-Antwort; mindestens ein Test für „ungültige LLM-Antwort → Fallback oder Fehlermeldung“.
- **i18n:** alle **neuen** UI-Strings in **fünf** Sprachen (XLF-Pipeline), sofern ihr neue Oberflächen baut.

### 4.3 KI-Agenten (Reflexion)

Kurzer Abschnitt (1–2 Seiten) oder Anhang:

- Welche **Tools** (z. B. Cursor-Agent)?
- Typische **Prompts** / Arbeitsablauf (Spec → Schema → Code → Tests)?
- **Fehler**, die die KI produziert hat, und wie du sie **erkannt** hast (Review, Tests, Typecheck).

---

## 5. Nutzung selbst gehosteter LLM-API

Die Hochschule stellt eine **API** bereit (Endpoint, Authentifizierung, Modellname — erhältst du von der Betreuung).

**Regeln:**

- Aufrufe erfolgen **vom Backend** (`apps/backend/`), nicht vom Browser.
- Konfiguration über **Umgebungsvariablen** (siehe Muster in [`docs/ENVIRONMENT.md`](../ENVIRONMENT.md) und `.env.example` im Root).
- **Antwortformat:** Fest vereinbartes **JSON**, das zu einem **Zod-Schema** passt (Versionierung im Schema-Kommentar erwähnen, wenn sich das Format ändert).

---

## 6. Wo im Code ansetzen? (Spickzettel)

### 6.1 Bestehende Wortwolke (lexikalisch)

- Logik: `apps/frontend/src/app/features/session/session-present/word-cloud.util.ts` (`tokenize`, `aggregateWords`, Stopwörter).
- Komponente: `word-cloud.component.ts` / `.html` / `.scss`.
- Einbindung u. a.: `session-host.component.html` (bei Freitext unter „Weitere Aktionen“), `session-present.component.html`.

**Idee:** Die neue „intelligente“ Ansicht **ergänzt** oder **schaltet** die alte — Fallback bleibt verständlich für Lehrende.

### 6.2 Q&A-Daten (Backend)

- Router: `apps/backend/src/routers/qa.ts` (Fragen u. a. als `QaQuestion` in Prisma).
- Für Zusammenfassungen brauchst du eine **kontrollierte** Leseschnittstelle (bestehend erweitern oder neue **Host-only**-Prozedur), die **nur** die für die Zusammenfassung nötigen Texte liefert.

### 6.3 Architektur-Entscheidungen (optional lesen)

- Word-Cloud-Richtung: [`docs/architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md`](../architecture/decisions/0012-use-d3-cloud-for-freetext-word-clouds.md) (langfristige Layout-Themen; euer Praktikum kann zunächst an der **bestehenden** Darstellung anknüpfen).
- i18n: [`docs/architecture/decisions/0008-i18n-internationalization.md`](../architecture/decisions/0008-i18n-internationalization.md).

---

## 7. Vorschlag für die 10 Blöcke à 4 Stunden

| Block  | Schwerpunkt                | Konkrete Artefakte                                                                                                                 |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | Onboarding                 | Repo läuft lokal; du hast **einen** End-to-End-Flow durchgespielt (z. B. Quiz → Session → Freitext). Kurznotiz: Risiken DSGVO/LLM. |
| **2**  | Konzept-Outline            | Gliederung der schriftlichen Ausarbeitung; **API-Skizze** Request/Response.                                                        |
| **3**  | Zod + tRPC-Skelett         | Schema(s) in `shared-types`; erste Prozedur mit **Mock**-LLM oder Stub.                                                            |
| **4**  | Backend → echtes LLM       | HTTP-Client, Timeout, Fehlerbehandlung, **kein** Key im Client.                                                                    |
| **5**  | Freitext-Pipeline          | Eingabe Liste Rohstrings → Ausgabe strukturiert für UI; Tests mit Mock.                                                            |
| **6**  | Frontend Freitext          | UI: Modus oder zweite Karte, Ladezustand, Fallback auf lexikalische Wolke.                                                         |
| **7**  | Q&A lesen + zusammenfassen | Server: Fragen sammeln; LLM-Prompt für Summary + Tags; Zod parse.                                                                  |
| **8**  | Host-UI Q&A                | Panel oder Erweiterung bestehender Q&A-Ansicht; i18n.                                                                              |
| **9**  | Härtung                    | Randfälle (0 Antworten, 200+ Zeichen, LLM-Timeout), Vitest ausbauen, kleine UX-Feinschliffe.                                       |
| **10** | Abgabe                     | Konzept PDF/Markdown, PR(s), Demo-Video oder Screenshots, Reflexion KI.                                                            |

Wenn die Zeit knapp wird: **Priorität** — (A) Freitext semantische Wolke mit Fallback, dann (B) Q&A **nur Kurz-Zusammenfassung** ohne zweite Wolke.

---

## 8. Bewertung (transparent)

Orientierungswerte (exakte Gewichtung gibt die Betreuung in der Veranstaltung vor):

| Kriterium               | Was geprüft wird                                                            |
| ----------------------- | --------------------------------------------------------------------------- |
| **Konzept**             | Verständnis Semantik vs. Lexik, Datenfluss, Datenschutz, Fallback           |
| **Umsetzung A + B**     | Funktioniert in der Demo, sinnvolle Integration in die App                  |
| **Technische Qualität** | Zod, tRPC, Tests, keine Secrets im Frontend, saubere Fehler                 |
| **UX / i18n**           | Verständlich für Lehrende, mobile Nutzbarkeit, 5 Sprachen bei neuen Strings |
| **KI-Reflexion**        | Ehrlich, konkret, nachvollziehbar                                           |

---

## 9. Häufige Stolpersteine (FAQ)

**Muss ich alles alleine programmieren?**  
Nein — **KI-Agenten** sind erwünscht. Du bleibst **verantwortlich** für Architektur, Sicherheit und Korrektheit.

**Warum so viel Zod?**  
Damit **halluzinierte** oder kaputte LLM-Antworten die App nicht zerstören — gleiches Prinzip wie beim KI-Quiz-Import (`Backlog` Story **1.9a**).

**Muss die Wolke „schön“ wie bei Mentimeter sein?**  
Nein als Pflicht. **Lesbarkeit** und **korrekte Aggregation** zählen mehr als Pixel-Perfektion. Ein Ausbau (z. B. D3-Layout) ist **Story 1.14a** im Backlog — gerne als Ausblick erwähnen, nicht als Pflicht des Praktikums.

**Sprachen — wirklich alle fünf?**  
Ja, sobald **neue** UI-Texte dazukommen (**ADR-0008**). Reine Fehlermeldungen vom Server ggf. als i18n-fähige Codes + Übersetzung im Client — im Konzept kurz festlegen.

**Wo frage ich nach?**  
Bei der **Betreuung** vor Ort; im Repo bei inhaltlichen Regeln zusätzlich `docs/cursor-context.md` und `Backlog.md`.

---

## 10. Abgabe-Checkliste

- [ ] Konzeptdokument (PDF oder Markdown im Repo nach Absprache)
- [ ] Code als **Merge Request / PR** gegen das vereinbarte Ziel-Branch-Modell
- [ ] Tests grün (`npm test` bzw. wie in [`docs/TESTING.md`](../TESTING.md) beschrieben)
- [ ] Kurze **Demo** (Live oder Video): Freitext + Q&A-Szenario
- [ ] Reflexion **KI-Einsatz**
- [ ] Bei UI-Änderungen: **Übersetzungen** en/fr/es/it nachgezogen

---

## 11. Literatur / Links im Repo

- [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](./BEGRIFFE-FREITEXT-UND-SEMANTIK.md) — **Langtext:** Sprachebenen, Normalisierung, Semantik, Mehrsprachigkeit (für das Konzept)
- [`Backlog.md`](../../Backlog.md) — Stories **1.14**, **1.14a** (Word Cloud), **8.x** (Q&A)
- [`docs/ui/STYLEGUIDE.md`](../ui/STYLEGUIDE.md) — Markdown/KaTeX-Styling-Hinweise (falls du gerenderten Text berührst)
- [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)
- [`docs/vibe-coding/`](../vibe-coding/) — Beispiele für arbeitsorientierte Prompts (optional)

**Viel Erfolg — und gutes Teamwork mit Mensch und Maschine.**

---

_Stand: 2026-03-23 · Pflege: bei Änderungen am Praktikumsauftrag dieses Dokument und die Verweise in `docs/README.md` anpassen._
