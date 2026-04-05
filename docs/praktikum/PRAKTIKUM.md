<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Praktikum an der Codebasis arsnova.eu

**Für Studierende** · begleitendes Studienobjekt · **Umfang:** 10 Termine à 4 Stunden (40 Stunden Gesamtzeit, Planungsgröße)

Willkommen. Dieses Dokument erklärt **Ziele**, **Ablauf**, **bewertete Leistung** und **praktische Tipps**, damit du dich schnell zurechtfindest und realistisch planen kannst. Die App ist ein **fortlaufendes Forschungs- und Lehrprojekt**; dein Beitrag soll **nachvollziehbar**, **testbar** und **zur Architektur passend** sein.

**Du kennst Git, VS Code, npm oder Begriffe wie tRPC/Prisma noch nicht?** Start mit **[`EINSTIEG-TOOLS-UND-STACK.md`](./EINSTIEG-TOOLS-UND-STACK.md)** (Landkarte + Links), dann [`docs/onboarding.md`](../onboarding.md) zum Aufsetzen der Umgebung.

**Einstieg in die Fallstudie:** Die erste Sitzung beginnt mit einer **Greenfield-Demo** zu [**Story 1.7a**](../../Backlog.md) (Markdown-Bilder: URL + Lightbox) in **3×45 Minuten** — Leitfaden [`docs/didaktik/greenfield-demo-1-7a-vorlesung.md`](../didaktik/greenfield-demo-1-7a-vorlesung.md). Dabei setzt die Lehrperson mit **KI-Agent** live einen überschaubaren Feature-Strang um und ordnet parallel Werkzeuge und Projektstruktur ein. **Studierende** bearbeiten **1.7a** danach **nicht** zusätzlich als Praktikums-Ticket, sofern die Demo die Story inhaltlich abdeckt (siehe [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md), Abschnitt 0).

**Wichtig für das Verständnis dieses Dokuments:** Das FSE-Praktikum ist **kein einzelnes Pflichtfeature**, sondern ein **allgemeines Software-Engineering-Praktikum** an der Codebasis **arsnova.eu**. Der Regelfall ist die Arbeit entlang der **verbindlichen Ticket-Reihenfolge** aus [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md). Ein thematischer Schwerpunkt wie **Intelligente Moderationshilfe** ist **möglich**, aber nicht die einzige sinnvolle Form des Praktikums.

## Kurz gesagt

Wenn du gerade nur den praktischen Rahmen brauchst:

- Du arbeitest an **arsnova.eu** als **Software-Engineering-Fallstudie**, nicht nur an einem Spezialfeature.
- Der Standard ist: die **verbindliche Ticket-Reihenfolge** aus [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md).
- Du sollst lieber **einen kleineren Beitrag sauber** umsetzen und absichern als einen großen halbfertigen Strang abgeben.
- Wenn du einen **NLP-/LLM-Schwerpunkt** willst, ist das möglich, aber nur eine von mehreren sinnvollen Varianten.

## Ausführliche Begriffe für einen möglichen Schwerpunktpfad

Wenn du im Praktikum einen **Freitext-/NLP-/LLM-Schwerpunkt** wählst, gibt es für die **schriftliche Konzeption** und die Einordnung von **Syntax, Semantik, Lexik, Morphologie, Stemming, Lemmatisierung, Orthographie, Mehrsprachigkeit** und **semantischer Nähe** einen **eigenen, ausführlichen Leitfaden** (studierendenfreundlich, mit Beispielen, Tabellen und weiterführenden Links):

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
| Architektur-Kurzreferenz | [`docs/architecture/handbook.md`](../architecture/handbook.md)                   |
| Produkt-Backlog          | [`Backlog.md`](../../Backlog.md) im Repo-Root                                    |

**Erste Schritte:** [`docs/onboarding.md`](../onboarding.md), [`AGENT.md`](../../AGENT.md) (Arbeitsweise mit KI im Editor), [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

**Offene User Stories — didaktische Reihenfolge** als **verbindliche Ticketstrecke pro Person**: [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md).

---

## 2. Lernziele des Praktikums

Du übst unter realistischen Bedingungen:

- **Full-Stack-Denken:** Daten fließen von UI → tRPC → Backend → ggf. externe Dienste; Typen kommen aus **Zod**, nicht aus „Bauchgefühl“.
- **Software-Engineering-Entscheidungen begründen:** Paketgrenzen, Berechtigungen, Datenmodell, UI-Regeln, i18n und Tests gehören fachlich zusammen.
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

Bevor du die Details liest, gilt als einfache Faustregel:

- **Verstehen**, was du ändern willst.
- **Begründen**, warum das ins Produkt passt.
- **Sauber umsetzen**.
- **Nachvollziehbar prüfen**.

### 4.1 Konzeption (schriftlich)

Eine **studentenfreundliche**, aber **fachlich klare** Ausarbeitung (ca. **3–6 Seiten** reichen, plus Abbildungen/Schema):

1. **Problem und Relevanz:** Welches Problem oder welche Story bearbeitet ihr und warum ist das für **arsnova.eu** als Produkt und für **Software Engineering** relevant?
2. **Betroffene Schichten:** Welche Teile des Systems sind berührt, z. B. Frontend, Backend, `shared-types`, Datenmodell, Tests, Doku?
3. **Entscheidungen und Regeln:** Welche Architektur-, Qualitäts-, Sicherheits-, Rollen- oder i18n-Regeln müsst ihr beachten?
4. **Absicherung:** Woran zeigt sich, dass eure Lösung tragfähig ist, z. B. Tests, manuelle Checks, Review-Kriterien, Demo-Szenario?
5. **Abgrenzung:** Was ist in **40 Stunden** realistisch und was gehört bewusst **nicht** mehr in euren Scope?

Wenn euer Schwerpunkt **Intelligente Moderationshilfe** ist, gehören zusätzlich Fragen zu **Semantik vs. Lexik**, **LLM-Antwortformat**, **Fallback** und **Datenschutz** dazu. Dafür ist [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](./BEGRIFFE-FREITEXT-UND-SEMANTIK.md) die passende Vertiefung.

### 4.2 Umsetzung (Code)

#### Mindestumfang: ein klar abgegrenzter Produktbeitrag

| Profil                              | Inhalt                                                                                                                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A) Standardpfad über Stories**    | Umsetzung entlang der **verbindlichen Ticket-Reihenfolge** aus [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md), in didaktisch sinnvollen Teilstrecken mit passenden Änderungen an Code, Tests und bei Bedarf Doku. |
| **B) Thematischer Schwerpunktpfad** | Umsetzung eines fokussierten Strangs, z. B. **Intelligente Moderationshilfe**, wenn die Betreuung diesen Schwerpunkt freigibt und der Scope in 40 Stunden realistisch bleibt.                                                       |

Für beide Profile gilt: Nicht die Größe des Diffs zählt, sondern ob ihr einen Beitrag **fachlich verstanden**, **technisch sauber eingegrenzt**, **architekturgerecht umgesetzt** und **nachvollziehbar abgesichert** habt.

**Qualitätsanforderungen:**

- **Architekturgerecht:** `shared-types`, Paketgrenzen, Rollen- und Projektregeln einhalten, wenn euer Beitrag diese Bereiche berührt.
- **Tests und Checks:** sinnvolle technische Absicherung ergänzen; nicht jede Story braucht dieselbe Tiefe, aber „funktioniert bei mir“ reicht nicht.
- **Berechtigung und Sicherheit:** Keine Secrets im Frontend, keine unnötigen Daten am Client, Host-/Admin-Logik sauber beachten.
- **i18n und UI-Regeln:** alle **neuen** UI-Strings in **fünf** Sprachen (XLF-Pipeline), sofern ihr sichtbare Oberflächen baut.
- **Dokumentierbarkeit:** Der Weg von Problem → Entscheidung → Umsetzung → Prüfung muss für andere nachvollziehbar bleiben.

### 4.3 KI-Agenten (Reflexion)

Kurzer Abschnitt (1–2 Seiten) oder Anhang:

- Welche **Tools** (z. B. Cursor-Agent)?
- Typische **Prompts** / Arbeitsablauf (Spec → Schema → Code → Tests)?
- **Fehler**, die die KI produziert hat, und wie du sie **erkannt** hast (Review, Tests, Typecheck).

---

## 5. Zusatzhinweise, wenn ihr mit selbst gehosteter LLM-API arbeitet

Die Hochschule stellt eine **API** bereit (Endpoint, Authentifizierung, Modellname — erhältst du von der Betreuung).

**Regeln:**

- Aufrufe erfolgen **vom Backend** (`apps/backend/`), nicht vom Browser.
- Konfiguration über **Umgebungsvariablen** (siehe Muster in [`docs/ENVIRONMENT.md`](../ENVIRONMENT.md) und `.env.example` im Root).
- **Antwortformat:** Fest vereinbartes **JSON**, das zu einem **Zod-Schema** passt (Versionierung im Schema-Kommentar erwähnen, wenn sich das Format ändert).

---

## 6. Wo im Code ansetzen? Spickzettel für den Schwerpunkt Intelligente Moderationshilfe

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

| Block  | Schwerpunkt                   | Konkrete Artefakte                                                                                                          |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **1**  | Onboarding und Produktbild    | Repo läuft lokal; du hast **einen** End-to-End-Flow durchgespielt; kurze Notiz zu Produktziel, Risiken oder offenen Fragen. |
| **2**  | Story oder Schwerpunkt wählen | Ticket oder Themenpfad festgelegt; Scope und Nicht-Ziele mit der Betreuung grob abgestimmt.                                 |
| **3**  | Architektur und Vertrag       | Betroffene Schichten identifiziert; bei Bedarf Schema, Router, UI-Flüsse oder Doku-Anker markiert.                          |
| **4**  | Erster umsetzbarer Schnitt    | Kleine erste Änderung mit prüfbarem Zwischenstand, z. B. Test, UI-Skelett, Router-Anpassung oder Doku-Entwurf.              |
| **5**  | Kernumsetzung                 | Hauptlogik oder Hauptoberfläche umgesetzt; relevante Regeln zu Rollen, Daten, Paketgrenzen oder i18n mitgedacht.            |
| **6**  | Zweite Schicht anbinden       | Fehlende Gegenstücke ergänzen, z. B. Frontend zu Backend, Tests zu Implementierung oder Doku zu neuer Arbeitsweise.         |
| **7**  | Absicherung                   | Tests, manuelle Checks, Review-Notizen oder Demo-Szenarien ausbauen.                                                        |
| **8**  | Feinschliff                   | Randfälle, Fehlermeldungen, Zustände, i18n, UX oder Barrierefreiheit verbessern.                                            |
| **9**  | Abnahmevorbereitung           | Konzept, Screenshots, Demo-Pfad, offene Grenzen und KI-Reflexion zusammenziehen.                                            |
| **10** | Abgabe                        | Konzept PDF/Markdown, PR(s), Demo-Video oder Screenshots, Reflexion KI.                                                     |

Wenn die Zeit knapp wird, gilt generell: lieber **ein sauber abgegrenzter, gut abgesicherter Beitrag** als ein großer, halb fertiger Strang. Wenn du den Schwerpunkt **Intelligente Moderationshilfe** gewählt hast, ist als Priorität sinnvoll: **(A)** Freitext mit sauberem Fallback, dann **(B)** Q&A nur als kurze Zusammenfassung statt zweiter großer Oberfläche.

---

## 8. Bewertung (transparent)

Orientierungswerte (exakte Gewichtung gibt die Betreuung in der Veranstaltung vor):

| Kriterium               | Was geprüft wird                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| **Konzept**             | Problemverständnis, Scope, betroffene Schichten, sinnvolle Begründung im Produktkontext              |
| **Umsetzung**           | Funktioniert in der Demo oder im nachvollziehbaren Testszenario, sinnvoll in `arsnova.eu` integriert |
| **Technische Qualität** | Architekturtreue, Tests, Rollen/Sicherheit, keine unnötigen Seiteneffekte, saubere Fehlerbehandlung  |
| **Produkt- und UX-Fit** | Verständlich für Nutzende oder Lehrende, mobile Nutzbarkeit, i18n und UI-Regeln bei Bedarf           |
| **KI-Reflexion**        | Ehrlich, konkret, nachvollziehbar                                                                    |

---

## 9. Häufige Stolpersteine (FAQ)

Die folgenden Fragen betreffen **vor allem** den möglichen Schwerpunktpfad **Intelligente Moderationshilfe**.

**Muss ich alles alleine programmieren?**  
Nein — **KI-Agenten** sind erwünscht. Du bleibst **verantwortlich** für Architektur, Sicherheit und Korrektheit.

**Warum so viel Zod?**  
Damit **halluzinierte** oder kaputte LLM-Antworten die App nicht zerstören — gleiches Prinzip wie beim KI-Quiz-Import (`Backlog` Story **1.9a**).

**Muss die Wolke „schön“ wie bei Mentimeter sein?**  
Nein als Pflicht. **Lesbarkeit** und **korrekte Aggregation** zählen mehr als Pixel-Perfektion. Ein Ausbau (z. B. D3-Layout) ist **Story 1.14a** im Backlog — gerne als Ausblick erwähnen, nicht als Pflicht des Praktikums.

**Sprachen — wirklich alle fünf?**  
Ja, sobald **neue** UI-Texte dazukommen (**ADR-0008**). Reine Fehlermeldungen vom Server ggf. als i18n-fähige Codes + Übersetzung im Client — im Konzept kurz festlegen.

**Wo frage ich nach?**  
Bei der **Betreuung** vor Ort; im Repo bei inhaltlichen Regeln zusätzlich [`Backlog.md`](../../Backlog.md) und das [Architektur-Handbuch](../architecture/handbook.md).

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

_Stand: 2026-04-01 · Pflege: bei Änderungen am Praktikumsauftrag dieses Dokument und die Verweise in `docs/README.md` anpassen._
