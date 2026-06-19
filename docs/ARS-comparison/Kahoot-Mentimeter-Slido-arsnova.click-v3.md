<!-- markdownlint-disable MD013 -->

# Kahoot!, Mentimeter, Slido und arsnova.eu im Vergleich

> **Stand:** 2026-06-19
> **Zielgruppe:** Lehrende, Vortragende, Hochschulen, Schulen, Weiterbildung, Workshops und Organisationen
> **Einordnung:** arsnova.eu ist keine Kopie eines einzelnen Marktführers. Die App kombiniert Quiz, Live-Q&A, Blitzlicht, Word Cloud und didaktische Steuerung in einer offenen, datensparsamen Plattform.

## Kurzfazit

**Kahoot!** ist stark, wenn ein Live-Quiz vor allem Energie, Wettbewerb und Tempo erzeugen soll.

**Mentimeter** ist stark, wenn interaktive Präsentationen, Word Clouds, Umfragen und schnelle Visualisierung im Vordergrund stehen.

**Slido** ist stark, wenn Q&A, Moderation, Upvoting, Event-Workflows und Integrationen in Meeting- oder Konferenztools zentral sind.

**arsnova.eu** ist stark, wenn Lehrende und Vortragende eine **kostenlose, offene, self-hostbare und didaktisch kontrollierbare** Plattform brauchen: ohne Pflichtkonto, mit local-first Quiz-Erstellung, Markdown/KaTeX, Lesephase, Presets, Q&A-Fragenwand, bidirektionalem Voting, gewichteter Wortwolke und numerischen Schätzfragen mit optionaler zweiter Runde.

Der wichtigste Unterschied liegt nicht in einer einzelnen Funktion, sondern im **Betriebs- und Didaktikmodell**: arsnova.eu priorisiert Datensparsamkeit, institutionelle Souveränität, MINT-taugliche Inhalte und Live-Moderation statt Abo-, Creator-Account- und Cloud-KI-Logik.

## Vergleich auf einen Blick

Legende:

- **Stark:** Kernkompetenz oder klar ausgereiftes Produktmerkmal
- **Gut:** verfügbar und für viele Standardszenarien geeignet
- **Teilweise:** verfügbar, aber mit Einschränkungen, anderer Schwerpunktsetzung oder plan-/kontextabhängig
- **Nein:** nicht erkennbarer Schwerpunkt oder nicht als selbst betreibbare Funktion verfügbar

| Bereich                              | Kahoot!                                          | Mentimeter                                        | Slido                                                        | arsnova.eu                                                                                                                              |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Primärer Fokus**                   | Gamifiziertes Quiz, Training, Wettbewerbsenergie | Interaktive Präsentationen, Umfragen, Word Clouds | Live-Q&A, Event-Moderation, Polls, Integrationen             | Didaktische Live-Session für Lehre, Training und Vortrag                                                                                |
| **Teilnehmende ohne Account**        | Gut, Teilnahme per Code                          | Gut, Teilnahme per Code                           | Stark, Q&A/Polls ohne Login                                  | Stark, Teilnahme per Code/QR                                                                                                            |
| **Hosts ohne Pflichtkonto**          | Nein                                             | Nein                                              | Nein                                                         | **Stark: Host-Start kontoarm über Tokens**                                                                                              |
| **Kostenloser Kernbetrieb**          | Teilweise, kommerzielle Pläne und Limits         | Teilweise, kommerzielle Pläne und Limits          | Teilweise, kommerzielle Pläne und Limits                     | **Stark: kostenlos im Repo, institutionell self-hostbar**                                                                               |
| **Open Source / Self-Hosting**       | Nein                                             | Nein                                              | Nein                                                         | **Stark: offenes Repo, Docker-orientierter Betrieb**                                                                                    |
| **Datensparsame Quiz-Erstellung**    | Teilweise, SaaS-zentriert                        | Teilweise, SaaS-zentriert                         | Teilweise, SaaS-zentriert                                    | **Stark: local-first Quiz-Sammlung, Serverkopie erst für Live-Session**                                                                 |
| **Quiz und Gamification**            | **Stark**                                        | Gut                                               | Teilweise                                                    | **Stark: Quiz, Teams, Leaderboard, Streak, Bonus-Codes, Scorecards**                                                                    |
| **Interaktive Präsentation**         | Gut                                              | **Stark**                                         | Gut über Integrationen                                       | Teilweise, Fokus auf Host/Present/Vote statt Foliendesign                                                                               |
| **Q&A**                              | Gut in Kahoot! 360-Kontexten                     | Gut mit Live-Q&A und Upvoting                     | **Stark: Q&A, Upvoting, Moderation, Export, Sentiment-Beta** | **Stark: Q&A-Fragenwand, Vorab-Moderation, Pin/Archiv, Up- und Downvotes, Sortierung nach Unterstützung, Wilson-Score und Kontroverse** |
| **Word Cloud**                       | Gut, planabhängig                                | **Stark: Live-Word-Cloud als Kernformat**         | Gut: Live-Word-Cloud mit Extra-Features                      | **Stark: Freitext- und Q&A-Wortwolke, Phrasen, Document-Frequency, Gewichtung, Freeze, CSV/PNG bei Freitext**                           |
| **Numerische Schätzfragen**          | Teilweise, z. B. Slider-Logik                    | Teilweise, Skalen/Umfragen                        | Teilweise, Polls                                             | **Stark: eigener Fragetyp mit Plausibilitätsband, Toleranzband, Statistik, Histogramm, Nähe-Scoring und optionaler zweiter Runde**      |
| **Markdown und KaTeX**               | Nein als didaktischer Kern                       | Nein als didaktischer Kern                        | Nein als didaktischer Kern                                   | **Stark: Markdown und KaTeX in Fragen und Beschreibungen**                                                                              |
| **Lesephase / Peer Instruction**     | Teilweise über Ablaufgestaltung                  | Teilweise über Ablaufgestaltung                   | Teilweise über Ablaufgestaltung                              | **Stark: Lesephase, Diskussions-/zweite Runde, Ergebniszurückhaltung**                                                                  |
| **Seriöser vs. spielerischer Modus** | Teilweise über manuelle Gestaltung               | Teilweise über manuelle Gestaltung                | Teilweise über manuelle Gestaltung                           | **Stark: Presets für seriöse und spielerische Settings**                                                                                |
| **KI-Erstellung**                    | Gut: plattformeigene KI-Funktionen               | **Stark: AI Presentation / AI Quiz Generator**    | Gut: Slido AI für Vorschläge/Formulierungen                  | **Anders: externer oder lokaler LLM-Workflow, kein automatischer Upload von Lehrmaterial an arsnova.eu**                                |
| **Barrierearmut und Mobile-First**   | Gut, produktabhängig                             | Gut, produktabhängig                              | Gut, produktabhängig                                         | **Stark als DoD-Prinzip: Mobile Host, Vote und Present, PWA, Dark Mode, i18n**                                                          |
| **Export und Nachbereitung**         | Gut, planabhängig                                | Gut, planabhängig                                 | Gut, insbesondere Q&A/Analytics                              | Gut: Session-/Q&A-/Bonus-Code-/Admin-Exporte, Word-Cloud-Export                                                                         |

## Didaktische Lesart

### Kahoot!: Energie und Wettbewerb

Kahoot! bleibt der starke Referenzpunkt für spielerisches Live-Quizzen: schnelle Fragen, Leaderboard, Musik, Wettbewerb und hohe Wiedererkennbarkeit. Für Seminare, Workshops und Trainings ist das wirkungsvoll, wenn Aktivierung und Wiederholung im Vordergrund stehen.

Für Hochschullehre, Prüfungsvorbereitung oder MINT-Settings entsteht aber schnell Bedarf an mehr fachlicher Steuerung: Formeln, Markdown, bewusstes Ergebnis-Zurückhalten, zweite Runden, robuste Schätzfragen und datensparsame Vorbereitung sind nicht der Kern des Kahoot!-Modells.

### Mentimeter: Präsentieren und sichtbar machen

Mentimeter ist sehr stark, wenn eine Präsentation zum Interaktionsraum werden soll: Umfragen, Word Cloud, Q&A, AI-gestützte Erstellung und ein visuell flüssiger Präsentationsflow. Das ist vor allem für Workshops, Meetings und große Veranstaltungen attraktiv.

arsnova.eu setzt bewusst anders an: nicht als Folienwerkzeug, sondern als didaktische Live-Schicht neben oder vor der Präsentation. Die App legt mehr Gewicht auf Fragetypen, Steuerung, Datenschutz, MINT-Inhalte, lokale Quiz-Sammlung und nachvollziehbare Auswertung.

### Slido: Q&A und Event-Moderation

Slido ist der stärkste Vergleichspunkt für Q&A: anonyme Fragen, Upvoting, Moderation, Präsentationsmodus, Export und Sentimentanalyse sind öffentlich kommunizierte Kernfunktionen. Für große Events, All-Hands, Webinare und Konferenzen ist das sehr passend.

arsnova.eu übernimmt die didaktisch wichtigen Teile dieses Musters, geht aber in zwei Punkten anders vor:

1. Die Fragenwand ist in denselben Lehr-/Quiz-Flow integriert, nicht nur ein Event-Q&A neben dem Inhalt.
2. Die Q&A-Wortwolke ist nicht nur eine häufigkeitsbasierte Visualisierung, sondern folgt den Moderationsmetriken: meist unterstützt, beste Fragen oder umstritten.

## arsnova.eu: Was heute besonders ist

### 1. Ein didaktischer Live-Flow statt einzelner Tools

arsnova.eu bündelt Quiz, Q&A und Blitzlicht in einer Session. Lehrende können:

- ein Quiz vorbereiten oder importieren,
- Q&A und Blitzlicht als eigene Live-Kanäle starten,
- Teilnehmende per Code oder QR einbinden,
- Fragen freigeben, zurückhalten, diskutieren und auswerten,
- Ergebnis-, Q&A- und Bonus-Code-Daten exportieren.

Der entscheidende Punkt: Die Live-Session ist nicht nur ein Abstimmungsmoment, sondern eine steuerbare Unterrichts- oder Vortragssituation.

### 2. Q&A-Fragenwand als Moderationsinstrument

Die Q&A-Fragenwand unterstützt eine klare Moderationslogik:

- Fragen können vor der Veröffentlichung moderiert werden.
- Hosts können Fragen anheften, archivieren oder entfernen.
- Teilnehmende stimmen mit **Up- und Downvotes** ab.
- Hosts sortieren nach **meist unterstützt**, **beste Fragen** oder **umstritten**.
- Die Kontroversitätslogik macht Reibung sichtbar, auch wenn der Netto-Score neutral wirkt.

Das ist didaktisch relevant: Nicht nur die lauteste oder früheste Frage gewinnt. Sichtbar werden auch Fragen, die den Raum spalten, Missverständnisse anzeigen oder eine Diskussion brauchen.

### 3. Word Cloud auf höherem Analyse-Niveau

arsnova.eu behandelt Word Clouds nicht nur als dekoratives Live-Bild:

- **Freitext-Wortwolken** verdichten Antworten mit Termgewichtung, Freeze und Export.
- **Q&A-Wortwolken** entstehen aus sichtbaren Fragen und übernehmen die gewählte Q&A-Sortiermetrik.
- Wörter und Phrasen werden termbasiert extrahiert; technische und didaktische Begriffe können geschützt werden.
- Tooltips machen nachvollziehbar, aus welchen Fragen und Gewichtungen Begriffe stammen.

Der nächste fachliche Schritt ist die **semantische Tendenz- und Sentimentauswertung mit selbst gehostetem LLM**. Wichtig bleibt dabei: Das LLM soll Moderation unterstützen, nicht Beiträge intransparent bewerten.

### 4. Numerische Schätzfrage mit zwei Runden

Die numerische Schätzfrage ist ein eigener Fragetyp für Lehrsituationen, in denen ein bloßer Slider nicht reicht. Sie trennt:

- **Plausibilitätsband:** Welche Werte dürfen eingegeben werden?
- **Toleranzband:** Welche Werte gelten fachlich als akzeptabel?
- **Referenzwert:** Woran werden Statistik, Nähe und Punkte gemessen?

Optional läuft die Frage in zwei Runden: erst schätzen, dann diskutieren, dann erneut schätzen. Die Auswertung zeigt Histogramm, Statistik und Rundenvergleich. Damit wird Peer Instruction für quantitative Fragen greifbar.

### 5. Local-first, Open Source und institutionell betreibbar

arsnova.eu ist für Einrichtungen interessant, die nicht nur eine SaaS-Funktion suchen, sondern Kontrolle über Betrieb, Datenfluss und Weiterentwicklung benötigen:

- Quiz-Sammlungen entstehen zunächst im Browser.
- Live-Serverdaten sind auf den Sessionbetrieb ausgerichtet.
- Der Betrieb kann institutionell self-hosted erfolgen.
- Die Plattform ist Open Source und anpassbar.
- KI-Workflows sind so angelegt, dass Lehrmaterial nicht automatisch an arsnova.eu oder einen proprietären Plattformdienst hochgeladen wird.

## Quellen und Abgleich

### Offizielle Produktquellen der Vergleichswerkzeuge

- Kahoot! 360 Pricing und Feature-Vergleich: [kahoot360.com/pricing](https://kahoot360.com/pricing/)
- Mentimeter Word Cloud: [mentimeter.com/features/word-cloud](https://www.mentimeter.com/features/word-cloud)
- Mentimeter Live Q&A: [mentimeter.com/features/live-questions-and-answers](https://www.mentimeter.com/features/live-questions-and-answers)
- Mentimeter AI Quiz Generator: [mentimeter.com/features/ai-quiz-generator](https://www.mentimeter.com/features/ai-quiz-generator)
- Slido Live Q&A: [slido.com/features-live-qa](https://www.slido.com/features-live-qa)
- Slido Word Cloud: [slido.com/features-word-cloud](https://www.slido.com/features-word-cloud)
- Slido Pricing: [slido.com/pricing](https://www.slido.com/pricing)

### arsnova.eu-Quellen im Repo

- Produkt- und Funktionsübersicht: [docs/APP-FUNKTIONSUEBERSICHT.md](../APP-FUNKTIONSUEBERSICHT.md)
- ARSnova-Ökosystem und arsnova.click-Hintergrund: [docs/background-arsnova-ecosystem.md](../background-arsnova-ecosystem.md)
- Numerische Schätzfrage: [docs/features/numeric-estimate.md](../features/numeric-estimate.md)
- Q&A-Kontroversität und Best-Score: [docs/features/controversy-score.md](../features/controversy-score.md)
- KI-Promptarchitektur: [docs/architecture/decisions/0007-prompt-architecture-ki-quiz.md](../architecture/decisions/0007-prompt-architecture-ki-quiz.md)
- Deep Research zur ARSnova-Genealogie: [docs/deep-research-arsnova.click/ARSnova-Recherche.pdf](../deep-research-arsnova.click/ARSnova-Recherche.pdf)

## Redaktionelle Hinweise

- Preis- und Planlimits der kommerziellen Dienste ändern sich häufig. Diese Seite bewertet deshalb nicht einzelne Abo-Stufen, sondern stabile Produktmuster und didaktische Passung.
- Bei externen KI-Funktionen zählt nicht nur, ob ein Tool Fragen generiert, sondern wohin Lehrmaterial, Prompts und Kontextdaten fließen.
- Für arsnova.eu ist die relevante Vergleichsfrage nicht: „Hat es dieselbe Oberfläche wie X?“, sondern: „Kann eine Lehrperson eine Live-Situation didaktisch souverän, datensparsam und ohne Account-Hürde steuern?“
