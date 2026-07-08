# Dozenten-Quickstart für die drei Kurse

**Zielgruppe:** Lehrende, die mit `arsnova.eu` einen oder mehrere Kurse planen  
**Zeitbudget:** 10 Minuten für die Grundentscheidung, 30 Minuten für die Detailplanung

Wenn du **nur kurz** Orientierung brauchst, triff zuerst diese vier Entscheidungen:

1. **Welche Kurse laufen dieses Semester wirklich?**
   Standard: **FSE + SQM parallel**, **DA/NLP separat** oder versetzt.
2. **Was ist im FSE-Praktikum realistisch Pflicht?**
   Standard im aktuellen Praktikumsmodell: die verbindliche offene Ticketstrecke aus [`STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md). Für kurze Formate daraus bewusst eine betreute Auswahl schneiden.
3. **Welche Tickets brauchen enge Betreuung?**
   Standard: **Security** und große **Querschnittsthemen** nur mit Pair-Review oder enger Lehrenden-Freigabe.
4. **Welchen didaktischen Modus möchtest du in der Lehre betonen?**
   Standard: **Seriös** für reflektierte Lehrsituationen, **Spielerisch** für Aktivierung und Motivation.

---

## 1. Empfohlenes Standardmodell

| Kurs         | Empfohlener Modus                  | Praktische Leitlinie                                                                                  |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **FSE**      | Greenfield + betreute Story-Arbeit | Woche 1-3: **Story 1.7a** live; danach die aktuelle Ticketstrecke oder eine bewusst gekürzte Auswahl. |
| **SQM**      | Parallel zum gleichen Produkt      | Nicht "hinterher testen", sondern ab Woche 4 Reviews, Tests, UX und Qualitätsartefakte mitführen.     |
| **DA / NLP** | Konzept- und evidenzlastig         | Produktbezug ja, volle Monorepo-Integration nur bei expliziter Kopplung an FSE.                       |

**Empfohlener Lehrsatz:**
FSE baut, SQM macht Qualität sichtbar und prüfbar, DA liefert Baselines, Modellvergleiche, strukturierte Ausgaben und Evidenz für die intelligente Moderationshilfe.

---

## 2. FSE in einem realistischen Zuschnitt

Für **eine einzelne Person** im Rahmen von ca. **40 Stunden** ist die vollständige offene Strecke meist zu groß. Der aktuelle Repo-Stand unterscheidet deshalb zwischen der **kanonischen Reihenfolge** und einem **kurzen Lehrzuschnitt**:

- **Kanonisch:** die Reihenfolge in [`STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md), aus der erledigte Stories entfernt sind.
- **Kurzformat:** Einstieg + eine klar spezifizierte Feature-/Q&A-Strecke.
- **Vertiefung:** zusätzliche Tickets je nach Vorwissen, Gruppengröße und Semesterdynamik.
- **Nur mit enger Betreuung:** Security- und breit streuende Querschnittsthemen.

Pragmatische Default-Regel:

- **Einstieg / sichtbarer Produktausbau:** `1.14a`, `8.5`
- **Vertiefung nach Betreuungsauswahl:** `1.2ec`, `1.2ed`, `1.2f–1.2i`, `2.9`, `6.6`; die abgeschlossene Schätzfrage `1.2d` eignet sich als Referenzbeispiel für End-to-End-Fragentypen, siehe [`docs/features/numeric-estimate.md`](../features/numeric-estimate.md).
- **Nur mit enger Betreuung / Pair-Review:** `0.7`, `0.8`, `1.6c`, `1.6d`, `6.5`

Wenn die Kohorte klein ist, kann eine Person mehr übernehmen. Wenn die Kohorte groß oder heterogen ist, sollte die **Kohorte gemeinsam** den Katalog abdecken, nicht zwingend jede Person einzeln.

---

## 3. Didaktische Standardeinstellungen für den Produkteinsatz

### Preset "Seriös"

Nutzen, wenn du möchtest, dass Studierende erst lesen, dann antworten, und wenn sozialer Druck eher reduziert werden soll.

- gut für: Verständnisfragen, sensible Themen, formatives Assessment
- kombinieren mit: **Lesephase**, Pseudonymen / wenig Druck, Q&A

### Preset "Spielerisch"

Nutzen, wenn Aktivierung, Tempo und Wettbewerbscharakter gewollt sind.

- gut für: Einstieg, Wiederholung, Energie im Raum
- kombinieren mit: kurzen Quizrunden, motivierenden Rückmeldungen

### Lesephase

Die Lesephase ist didaktisch dann stark, wenn nicht die schnellste Reaktion belohnt werden soll, sondern die ruhigere inhaltliche Auseinandersetzung.

### Bonus-Token

Geeignet für formelle Anerkennung oder kleine Leistungsanreize, ohne klassische Kontopflicht für Teilnehmende.

---

## 4. Datenschutz-Hinweis für die Lehrpraxis

`arsnova.eu` ist didaktisch gerade deshalb stark, weil Datenschutz nicht nur Randbedingung ist.

- keine unnötigen personenbezogenen Daten verlangen
- sensible Lehrsituationen eher mit anonymem oder druckarmem Setting fahren
- externe KI oder LLMs nur über freigegebene Dienste und mit geklärter Datenschutzlage nutzen; Lehrmaterial nicht ungeprüft an arsnova.eu oder fremde Dienste hochladen

Für die Lehrkommunikation reicht meist dieser kurze Satz:

> Wir nutzen ein selbst kontrolliertes, datensparsames System ohne klassische Pflichtregistrierung für Teilnehmende.

---

## 5. Erste Vorlesungswoche: Minimalplan

1. **Produktbild zeigen:** Was ist `arsnova.eu`, wofür ist es fachlich da?
2. **Greenfield-Demo ankündigen:** Story `1.7a` als Live-Strang über 3 × 45 Minuten.
3. **Toolangst senken:** VS Code, Git, GitHub und Monorepo nur so weit zeigen, wie für die ersten Schritte nötig.
4. **Kursrollen klären:** FSE entwickelt, SQM begleitet Qualität, DA arbeitet modell- und evidenzorientiert.
5. **Pflichtlektüre klein halten:** erst Einstieg und Onboarding, Architektur tiefer erst später.

---

## 6. Standard-Lesepfad für Lehrende

1. [FAHRPLAN-DREI-KURSE-UND-DOKU-REIHENFOLGE.md](./FAHRPLAN-DREI-KURSE-UND-DOKU-REIHENFOLGE.md)
2. [greenfield-demo-1-7a-vorlesung.md](./greenfield-demo-1-7a-vorlesung.md)
3. [zweiter-kurs-und-agentische-ki.md](./zweiter-kurs-und-agentische-ki.md)
4. [dritter-kurs-data-analytics-nlp.md](./dritter-kurs-data-analytics-nlp.md)
5. [../praktikum/STUDENT-STORY-REIHENFOLGE.md](../praktikum/STUDENT-STORY-REIHENFOLGE.md)

---

## 7. Wenn du nur drei Dinge mitnimmst

- Nicht zu viel auf einmal lesen lassen: erst lauffähiger Einstieg, dann Backlog und DoD, erst danach Architektur-Tiefe.
- Im FSE-Praktikum lieber **weniger Stories sauber** als einen Vollkatalog oberflächlich mit KI abarbeiten.
- DA ist standardmäßig **kein** dritter Implementierungskurs, sondern ein evidenz- und modellorientierter Ergänzungskurs.

---

**Vertiefung:** Der vollständige Plan steht in [FAHRPLAN-DREI-KURSE-UND-DOKU-REIHENFOLGE.md](./FAHRPLAN-DREI-KURSE-UND-DOKU-REIHENFOLGE.md).
