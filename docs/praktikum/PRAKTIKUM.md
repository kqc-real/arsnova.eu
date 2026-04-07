<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Praktikum an der Codebasis arsnova.eu

**Für Studierende** · begleitendes Studienobjekt · **Umfang:** 10 Termine à 4 Stunden (40 Stunden Gesamtzeit, Planungsgröße)

Willkommen. Dieses Dokument erklärt **Ziele**, **Ablauf**, **bewertete Leistung** und **praktische Tipps**, damit du dich schnell zurechtfindest und realistisch planen kannst. Die App ist ein **fortlaufendes Forschungs- und Lehrprojekt**; deine Arbeit soll **nachvollziehbar**, **testbar** und **zur Architektur passend** sein.

**Du kennst Git, VS Code, npm oder Begriffe wie tRPC oder Prisma noch nicht?** Dann starte mit **[`EINSTIEG-TOOLS-UND-STACK.md`](./EINSTIEG-TOOLS-UND-STACK.md)** (Landkarte + Links) und lies danach [`docs/onboarding.md`](../onboarding.md) zum Aufsetzen der Umgebung.

**Einstieg in die Fallstudie:** Die erste Sitzung beginnt mit einer **Greenfield-Demo** zu [**Story 1.7a**](../../Backlog.md) (Markdown-Bilder: URL + Lightbox) in **3×45 Minuten** — Leitfaden [`docs/didaktik/greenfield-demo-1-7a-vorlesung.md`](../didaktik/greenfield-demo-1-7a-vorlesung.md). Dabei setzt die Lehrperson mit **KI-Agent** live einen überschaubaren Feature-Strang um und ordnet parallel Werkzeuge und Projektstruktur ein. **1.7a** dient damit als gemeinsame Referenz und gehört **nicht** zur regulären studentischen Ticketstrecke (siehe [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md), Abschnitt 0).

**Wichtig für das Verständnis dieses Dokuments:** Das FSE-Praktikum ist **kein einzelnes Pflichtfeature**, sondern ein **allgemeines Software-Engineering-Praktikum** an der Codebasis **arsnova.eu**. Es gibt **keine Teamaufteilung in unterschiedliche Aufgabenpakete**. Jede studierende Person bearbeitet **individuell die gesamte offene Ticketstrecke** in der **verbindlichen Reihenfolge** aus [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md). Nach der Umsetzungsphase folgt zusätzlich **pro Person ein eigener Abschlussvortrag**; im aktuellen Kurs sind das **sechs Einzelvorträge**.

## Kurz gesagt

Wenn du gerade nur den praktischen Rahmen brauchst:

- Du arbeitest an **arsnova.eu** als **Software-Engineering-Fallstudie**, nicht an einem frei gewählten Einzelthema.
- Du bearbeitest **individuell alle offenen Stories** der verbindlichen Ticketstrecke aus [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md).
- Es gibt **keine Teams**, die Stories untereinander aufteilen.
- Am Ende des Kurses hält **jede der sechs Personen** einen **eigenen Abschlussvortrag**.

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
- **Reflexion KI-gestützter Implementierung:** Du arbeitest mit **KI-Agenten** (z. B. Cursor, Copilot), dokumentierst aber, **wo** sie geholfen haben und **wo** Nacharbeit nötig war.

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

Eine **fachlich klare** Ausarbeitung (ca. **3–6 Seiten** plus Abbildungen oder Schema reichen in der Regel aus):

1. **Problem und Relevanz:** Welche Story oder welcher Abschnitt der Ticketstrecke ist gerade dran und warum ist das für **arsnova.eu** als Produkt und für **Software Engineering** relevant?
2. **Betroffene Schichten:** Welche Teile des Systems sind berührt, z. B. Frontend, Backend, `shared-types`, Datenmodell, Tests, Doku?
3. **Entscheidungen und Regeln:** Welche Architektur-, Qualitäts-, Sicherheits-, Rollen- oder i18n-Regeln musst du beachten?
4. **Absicherung:** Woran zeigt sich, dass deine Lösung tragfähig ist, z. B. Tests, manuelle Checks, Review-Kriterien, Demo-Szenario?
5. **Abgrenzung:** Was ist im aktuellen Bearbeitungsschritt realistisch und was gehört bewusst **nicht** mehr in diesen konkreten Abschnitt?

### 4.2 Umsetzung (Code)

#### Verbindlicher Umfang: die gesamte offene Ticketstrecke

Jede studierende Person bearbeitet die **gesamte offene Story-Reihenfolge** aus [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md) **selbst** und in der dort festgelegten Reihenfolge. Eine Aufteilung auf Teams gibt es nicht.

Entscheidend ist nicht die Größe einzelner Diffs, sondern ob du die Stories **fachlich verstanden**, **technisch sauber umgesetzt**, **architekturgerecht abgesichert** und **nachvollziehbar dokumentiert** hast.

**Qualitätsanforderungen:**

- **Architekturgerecht:** `shared-types`, Paketgrenzen, Rollen- und Projektregeln einhalten, wenn dein Beitrag diese Bereiche berührt.
- **Tests und Checks:** sinnvolle technische Absicherung ergänzen; nicht jede Story braucht dieselbe Tiefe, aber „funktioniert bei mir“ reicht nicht.
- **Berechtigung und Sicherheit:** Keine Secrets im Frontend, keine unnötigen Daten am Client, Host-/Admin-Logik sauber beachten.
- **i18n und UI-Regeln:** alle **neuen** UI-Strings in **fünf** Sprachen (XLF-Pipeline), sofern du sichtbare Oberflächen baust.
- **Dokumentierbarkeit:** Der Weg von Problem → Entscheidung → Umsetzung → Prüfung muss für andere nachvollziehbar bleiben.

### 4.3 KI-Agenten (Reflexion)

Kurzer Abschnitt (1–2 Seiten) oder Anhang:

- Welche **Tools** (z. B. Cursor-Agent)?
- Typische **Prompts** / Arbeitsablauf (Spec → Schema → Code → Tests)?
- **Fehler**, die die KI produziert hat, und wie du sie **erkannt** hast (Review, Tests, Typecheck).

### 4.4 Abschlussvortrag

Am Ende des Kurses hält **jede der sechs studierenden Personen** einen **eigenen Abschlussvortrag**. Das sind **sechs getrennte Einzelvorträge**, nicht ein gemeinsamer Gruppenblock. Der Vortrag ordnet deine Arbeit an der Ticketstrecke in ein größeres Software-Engineering-Thema ein. Details zu Format, Themenzuschnitt und Handout stehen in [`Fallstudie-Software-Engineering-Beschreibung-6-Abschlussvortraege.md`](./Fallstudie-Software-Engineering-Beschreibung-6-Abschlussvortraege.md).

---

## 5. Bewertung

Die **genaue Gewichtung** legt die Betreuung in der Veranstaltung fest. Für dieses Dokument ist vor allem wichtig: Sowohl die **praktische Arbeit an der verbindlichen Ticketstrecke** als auch der **eigene Abschlussvortrag mit Handout** sind **verpflichtende Bestandteile** der bewerteten Leistung.

| Kriterium               | Was geprüft wird                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| **Konzept**             | Problemverständnis, Scope, betroffene Schichten, sinnvolle Begründung im Produktkontext              |
| **Umsetzung**           | Funktioniert in der Demo oder im nachvollziehbaren Testszenario, sinnvoll in `arsnova.eu` integriert |
| **Technische Qualität** | Architekturtreue, Tests, Rollen/Sicherheit, keine unnötigen Seiteneffekte, saubere Fehlerbehandlung  |
| **Produkt- und UX-Fit** | Verständlich für Nutzende oder Lehrende, mobile Nutzbarkeit, i18n und UI-Regeln bei Bedarf           |
| **KI-Reflexion**        | Ehrlich, konkret, nachvollziehbar                                                                    |

---

## 6. Häufige Stolpersteine (FAQ)

Die folgenden Fragen betreffen **vor allem** Freitext-, Q&A- und Semantik-Themen innerhalb der verbindlichen Ticketstrecke.

**Muss ich alles alleine programmieren?**  
Nein — **KI-Agenten** sind erwünscht. Du bleibst **verantwortlich** für Architektur, Sicherheit und Korrektheit.

**Warum so viel Zod?**  
Damit **halluzinierte** oder kaputte LLM-Antworten die App nicht zerstören — gleiches Prinzip wie beim KI-Quiz-Import (`Backlog` Story **1.9a**).

**Muss die Wolke „schön“ wie bei Mentimeter sein?**  
Nein, nicht als Pflicht. **Lesbarkeit** und **korrekte Aggregation** zählen mehr als Pixel-Perfektion. Ein Ausbau (z. B. D3-Layout) ist **Story 1.14a** im Backlog — gerne als Ausblick erwähnen, nicht als Pflicht des Praktikums.

**Sprachen — wirklich alle fünf?**  
Ja, sobald **neue** UI-Texte dazukommen (**ADR-0008**). Reine Fehlermeldungen vom Server ggf. als i18n-fähige Codes + Übersetzung im Client — im Konzept kurz festlegen.

**Wo frage ich nach?**  
Bei der **Betreuung** vor Ort; im Repo bei inhaltlichen Regeln zusätzlich [`Backlog.md`](../../Backlog.md) und das [Architektur-Handbuch](../architecture/handbook.md).

---

## 7. Abgabe-Checkliste

- [ ] Konzeptdokument (PDF oder Markdown im Repo nach Absprache)
- [ ] Code als **Merge Request / PR** gegen das vereinbarte Ziel-Branch-Modell
- [ ] Verbindliche offene Story-Strecke individuell bearbeitet
- [ ] Tests grün (`npm test` bzw. wie in [`docs/TESTING.md`](../TESTING.md) beschrieben)
- [ ] Kurze **Demo** (Live oder Video): Freitext + Q&A-Szenario
- [ ] Reflexion **KI-Einsatz**
- [ ] Eigenen **Abschlussvortrag** vorbereitet
- [ ] Bei UI-Änderungen: **Übersetzungen** en/fr/es/it nachgezogen

---

## 8. Literatur / Links im Repo

- [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](./BEGRIFFE-FREITEXT-UND-SEMANTIK.md) — **Langtext:** Sprachebenen, Normalisierung, Semantik, Mehrsprachigkeit (für das Konzept)
- [`Backlog.md`](../../Backlog.md) — Stories **1.14**, **1.14a** (Word Cloud), **8.x** (Q&A)
- [`docs/ui/STYLEGUIDE.md`](../ui/STYLEGUIDE.md) — Markdown/KaTeX-Styling-Hinweise (falls du gerenderten Text berührst)
- [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)
- [`docs/vibe-coding/`](../vibe-coding/) — Beispiele für arbeitsorientierte Prompts (optional)

**Viel Erfolg bei der individuellen Bearbeitung der Ticketstrecke und bei deinem Abschlussvortrag.**

---

_Stand: 2026-04-07 · Pflege: bei Änderungen am Praktikumsauftrag dieses Dokument und die Verweise in `docs/README.md` anpassen._
