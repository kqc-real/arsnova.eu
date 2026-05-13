# Kontroversitäts- und Best-Score für das Q&A-Forum (Story 8.6 / 8.7)

> **Zielgruppe:** Product Owner, Entwickler, QA  
> **Verknüpfung:** User-Stories in Kurzform siehe [`Backlog.md`](../../Backlog.md) — **8.6** Kontroversitäts-Score, **8.7** „Beste Fragen“ (Wilson-Score). Dieses Dokument enthält Spezifikation **und** den aktuellen Implementierungsstand zu beiden Themen.

## Hintergrund

Eine einfache Differenz (Upvotes minus Downvotes) rutscht bei **ausgeglichener Polarität** nach unten: z. B. 50 Up- und 50 Downvotes ergeben Differenz 0, obwohl die Frage für die Diskussion im Raum zentral sein kann.

Live-Events haben eine **begrenzte Teilnehmerzahl** (typisch 10–200). Gesucht ist ein Score, der **„Reibung“** (hohe, ausgeglichene Up-/Down-Beteiligung) misst und sich **an die Raumgröße anpasst**, damit vereinzelte Gegenstimmen in großen Räumen nicht als künstliche Kontroverse gelten.

## Produktionsabgleich (Stand 2026-05-13)

Die aktuelle Q&A-Implementierung in arsnova.eu hat bereits **bidirektionales Voting** (`UP` / `DOWN`) und speichert pro Frage einen **Netto-Score** in `QaQuestion.upvoteCount`; die einzelnen Stimmen liegen in `QaUpvote.direction`. Daraus folgen für Story 8.6 und 8.7 verbindliche Produktentscheidungen:

1. **8.6 und 8.7 sind im heutigen Produkt optionale Sortiermodi für den Host; später können sie auf Moderator:innen erweitert werden.** Sie sind keine neuen globalen Standardsortierungen für alle Clients.
2. **Teilnehmende behalten die heutige, leicht verständliche Standardsortierung**; die neuen Modi sind ein Werkzeug für Moderation, nicht das neue Default-Ranking der Teilnehmendenansicht.
3. **Statusgruppen bleiben führend.** `PINNED`-Fragen bleiben oberhalb aller Scorings; danach folgen die übrigen sichtbaren Fragen ihrer Statuslogik entsprechend. Score-basierte Sortierung wirkt nur **innerhalb** einer Statusgruppe.
4. **`QaQuestion.upvoteCount` ist im Ist-Stand ein Netto-Score, nicht die Zahl der Upvotes.** Für 8.6 und 8.7 müssen `U` und `D` aus den Einzelstimmen (`QaUpvote.direction`) aggregiert werden; der Netto-Score allein reicht fachlich nicht.
5. **Die Q&A-UI braucht einen expliziten Sortiermodus**, z. B. `Top`, `Umstritten`, `Beste Fragen`. Ohne sichtbaren Moduswechsel wären 8.6/8.7 für den Host und später auch Moderator:innen nicht nachvollziehbar.

## Implementierungsstand (Stand 2026-05-13)

Der heutige Produktstand deckt die Storys 8.6 und 8.7 in der Host-Ansicht bereits ab:

- Die Host-Q&A-Liste bietet die Sortiermodi `Top`, `Beste Fragen` und `Umstritten`.
- Die Router-/DTO-Schicht liefert neben dem bisherigen Nettofeld auch getrennte `UP`-/`DOWN`-Aggregate sowie `score`, `voteCount`, `bestScore`, `controversyScore` und `isControversial`.
- `PINNED` bleibt oberhalb jeder Score-Sortierung; Score-Logik wirkt nur innerhalb der sichtbaren Statusgruppen.
- Die Teilnehmendenansicht bleibt auf der einfachen Standardsortierung.
- Die Q&A-Wortwolke im Host folgt demselben Sortiermodus und wechselt Gewichtung, Titel, Hint und Tooltip-Metrik entsprechend mit.
- In der maximierten Host-Vollansicht bleibt der Sortierumschalter oberhalb der Wolke sichtbar.

## Datenmodell und API-Stand

Die Umsetzung nutzt die heutigen Q&A-Tabellen weiterhin, erweitert aber die DTO-/Router-Schicht bereits um:

- `score`: aktueller Netto-Score (`UP = +1`, `DOWN = -1`)
- `upvoteCount`: Zahl positiver Stimmen `U`
- `downvoteCount`: Zahl negativer Stimmen `D`
- `voteCount`: Gesamtzahl `U + D`
- optional `controversyScore` und `bestScore` im Host-Kontext; bei späterer 8.5-Erweiterung auch im Moderator-Kontext

Die Einführung erfolgte **kompatibel**: Bestehende Clients brechen nicht implizit. Das Feld `upvoteCount` bleibt aus Kompatibilitätsgründen erhalten, ist aber im heutigen Produkt semantisch weiter ein **Score**. Mittelfristig ist ein API-Feldname wie `score` die sauberere Wahl.

## Berechnung

Für jede Frage (Post) wird ein `controversy_score` berechnet. Wertebereich: **0,0** (eindeutige Stimmung) bis **1,0** (hohe Kontroverse bei vielen Stimmen im Verhältnis zur Glättung).

### Formel

$$
S = \frac{2 \cdot \min(U, D)}{U + D + C}
$$

| Symbol | Bedeutung                                                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U      | Anzahl Upvotes                                                                                                                                                        |
| D      | Anzahl Downvotes                                                                                                                                                      |
| N      | Bezugsgröße für die Raumgröße (bei Implementierung **eindeutig** wählen, z. B. Maximalteilnehmerzahl der Session oder aktuell gezählte Teilnehmende — nicht mischen). |
| C      | Glättungs-/Prior-Term im Nenner: `max(1, 0.1 * N)` (siehe technische Regeln).                                                                                         |

Der Term \(C\) wirkt wie ein **Prior**: wenige Stimmen in einem großen Raum erhöhen den Score nur moderat; viele ausgeglichene Stimmen erhöhen ihn stark.

### Technische Regeln

1. **Gleitkomma:** Der Score wird als Float/Decimal berechnet (keine Ganzzahl-Division).
2. **Untergrenze für C:** \(C = \max(1,\, 0.1 \cdot N)\) verhindert einen Nenner von 0 und stabilisiert den Fall \(N = 0\).

## Sortierung (Tie-Breaker)

Die folgenden Regeln gelten **innerhalb derselben sichtbaren Statusgruppe**. Die Statuslogik selbst bleibt vorgelagert.

Bei gleichem `controversy_score` (häufig in kleinen Gruppen) gilt strikt:

1. `controversy_score` **DESC**
2. `U` **DESC**
3. `score` **DESC**
4. `created_at` **ASC** (ältere Frage zuerst — konsistent mit der heutigen stabilen Q&A-Reihenfolge)

## UI und Copy (Referenz Deutsch)

Damit Host/Moderation **nachvollziehen**, warum eine Frage oben steht, kann ein Kontroversitäts-Sortiermodus durch die UI unterstützt werden.

### Badge und Kennzeichnung

Für Story 8.6 ist eine bloße Umsortierung ohne sichtbare Erklärung im heutigen Produkt **nicht ausreichend**. Mindestens in der Host-Ansicht muss erkennbar sein, warum eine Frage trotz mittlerem oder neutralem Netto-Score weit oben steht. Bei späterer 8.5-Erweiterung gilt dasselbe für Moderator:innen.

Anzeige nur wenn **beides** gilt:

- `controversy_score > 0.5`
- \((U + D) \geq C\) (genug Gesamtstimmen im Verhältnis zur Raumgröße)

**Deutsche Referenzbegriffe** für Labels (Übersetzungen nach ADR-0008 in alle UI-Sprachen): z. B. „Umstritten“, „Polarisierend“, „Diskussionslage“ — keine festen englischen UI-Strings in der Produktions-UI.

**Icons** (Auswahl bei Umsetzung): z. B. Blitz, gekreuzte Schwerter, Waage — konsistent zum bestehenden Designsystem.

**Visualisierung:** Falls eine Voting-Anzeige existiert, kann ein Verlauf von neutral zu „warnend“ den steigenden Score andeuten (`prefers-reduced-motion` beachten).

Die aktuelle Host-UI ergänzt diese Kennzeichnung durch eine sortierabhaengige Q&A-Wortwolke. Deren Tooltip zeigt den gewichteten Wolkenwert, die zugrunde liegende Basis (`Netto-Score`, `Wilson-Score`, `Kontroversitaet`) sowie zugehoerige Fragen, damit Sortierung und Themenraum zusammen lesbar bleiben.

### Sortier-UI

Die Sortierauswahl sitzt im heutigen Produkt in der Host-Ansicht in unmittelbarer Nähe zur Q&A-Liste, nicht in der Teilnehmeransicht. Bei späterer 8.5-Erweiterung kann dieselbe Steuerung auch im Moderatorzugang erscheinen. Referenzoptionen:

- `Top` — heutige Standardsortierung
- `Umstritten` — Story 8.6
- `Beste Fragen` — Story 8.7

Der aktive Modus bleibt während einer Session stabil, bis der Host ihn bewusst ändert. Bei späterer Moderator-Erweiterung ist ein konsistentes Berechtigungsmodell mit dem Host festzulegen.

Die Host-Q&A-Wortwolke nutzt denselben Modus: `Top` gewichtet nach Netto-Score, `Beste Fragen` nach Wilson-Score und `Umstritten` nach Kontroversität. In der maximierten Vollansicht sitzt die Sortierauswahl oberhalb der Wolke, damit der Kontext beim Wechsel sichtbar bleibt.

## Akzeptanzkriterien

- [x] **AC 1:** Sortierung bevorzugt stark **ausgeglichene** Up-/Down-Beteiligung gegenüber einseitiger Zustimmung.
- [x] **AC 2:** \(C\) wird **pro Event/Session** aus der gewählten Definition von \(N\) abgeleitet (kleinerer Raum → kleineres \(C\) als bei großem Raum, bei gleicher Formel).
- [x] **AC 3:** Gleicher Score → eindeutige Reihenfolge über `U`, dann Netto-Score, dann `created_at`.
- [x] **AC 4:** Kein Absturz bei 0 Stimmen oder \(N = 0\); keine Division durch Null.
- [x] **AC 5:** Fragen oberhalb der Badge-Schwellen werden in der Host-Ansicht sichtbar als kontrovers/umstritten gekennzeichnet (siehe Abschnitt UI); bei späterer 8.5-Erweiterung gilt dies ebenso für Moderator:innen.
- [x] **AC 6:** `PINNED`-Fragen bleiben unabhängig vom Sortiermodus oberhalb des regulären Rankings.
- [x] **AC 7:** Teilnehmende behalten die Standardsortierung; Story 8.6 ist kein globaler Default-Wechsel.

## Beispiel SQL (Kontroversität)

Illustration für das heutige arsnova.eu-Schema (`QaQuestion`, `QaUpvote`) — Aggregation aus Einzelstimmen, nicht aus dem Netto-Feld allein.

```sql
WITH vote_counts AS (
    SELECT
        q.id,
        q.text,
        q.status,
        q.created_at,
        SUM(CASE WHEN v.direction = 'UP' THEN 1 ELSE 0 END) AS upvotes,
        SUM(CASE WHEN v.direction = 'DOWN' THEN 1 ELSE 0 END) AS downvotes
    FROM qa_question q
    LEFT JOIN qa_upvote v ON v.qa_question_id = q.id
    WHERE q.session_id = :current_session_id
    GROUP BY q.id, q.text, q.status, q.created_at
)
SELECT
    id,
    text,
    status,
    upvotes,
    downvotes,
    created_at,
    (2.0 * LEAST(upvotes, downvotes))
    / (upvotes + downvotes + GREATEST(1.0, 0.1 * :N)) AS controversy_score
FROM vote_counts
ORDER BY
    controversy_score DESC,
    upvotes DESC,
    (upvotes - downvotes) DESC,
    created_at ASC;
```

## Testfälle und QA

### Voraussetzungen (Szenario 1–3)

\(N = 100\) → \(C = \max(1, 10) = 10\).

### 1. Keine Interaktion / einseitige Stimmung

| Post | U   | D   | Erwarteter Score | Kurz           |
| ---- | --- | --- | ---------------- | -------------- |
| A    | 0   | 0   | 0,000            | Keine Stimmen  |
| B    | 50  | 0   | 0,000            | Nur Zustimmung |
| C    | 0   | 50  | 0,000            | Nur Ablehnung  |

### 2. Einfluss von C (kleine vs. große ausgeglichene Masse)

| Post | U   | D   | Erwarteter Score | Kurz                          |
| ---- | --- | --- | ---------------- | ----------------------------- |
| D    | 1   | 1   | 0,166            | 2/(2+10) — stark gedämpft     |
| E    | 40  | 40  | 0,888            | 80/(80+10) — hohe Kontroverse |

Reihenfolge: E vor D (gleiche Balance, mehr Masse → höherer Score).

### 3. Tie-Breaker

| Post | U   | D   | Zeit  | Score        |
| ---- | --- | --- | ----- | ------------ |
| F    | 2   | 1   | 10:00 | 2/13 ≈ 0,153 |
| G    | 1   | 2   | 10:05 | 2/13 ≈ 0,153 |
| H    | 2   | 1   | 10:10 | 2/13 ≈ 0,153 |

Erwartete Reihenfolge: F, dann H, dann G — zuerst mehr Upvotes als G; bei F vs. H gewinnt die ältere Frage für ein stabileres Live-Ranking.

### 4. Randfälle N

| N   | U   | D   | C    | Erwarteter Score | Kurz                                       |
| --- | --- | --- | ---- | ---------------- | ------------------------------------------ |
| 0   | 1   | 1   | 1,0  | 0,666            | Fallback max(1, …)                         |
| 10  | 2   | 2   | 1,0  | 0,800            | kleiner Raum                               |
| 200 | 2   | 2   | 20,0 | 0,166            | großer Raum, wenige Stimmen = wenig Signal |

---

## Exkurs: Alternative Sortieralgorithmen (Reddit-Vergleich)

Zur Einordnung der Architekturentscheidung: Wie lösen große Plattformen (insbesondere Reddit) ähnliche Fragestellungen, und was passt zu unserem Live-Event mit begrenzter Teilnehmerzahl?

### Reddits „Controversial“-Score

Reddit modelliert Kontroversität nicht über eine gewichtete Differenz, sondern über eine **Potenz**: Masse (Summe der Stimmen) und Balance (Verhältnis Up zu Down) werden kombiniert.

**Formel (vereinfacht notiert):**

$$
S_{\text{reddit}} = (U + D)^{\left(\frac{\min(U, D)}{\max(U, D)}\right)}
$$

Wenn \(U = 0\) oder \(D = 0\), setzt Reddit den Score typischerweise auf 0, damit der Exponent nicht divergiert.

**Eigenschaften:**

- Der Exponent (Balance) liegt zwischen 0 (einseitig) und 1 (50/50).
- Bei 100 Up und 100 Down ist der Exponent 1; der Wert entspricht der Stimmzahl \(200^1\).
- Bei 100 Up und 50 Down ist der Exponent 0,5; der Wert wird gedämpft (z. B. \(150^{0,5} \approx 12{,}2\)).

### Warum wir diesen Reddit-Ansatz nicht übernehmen

Die Reddit-Formel skaliert über sehr große Stimmzahlen hinweg stabil. Für **arsnova.eu** mit **harter Obergrenze** (z. B. \(N \le 200\)) und Fokus auf **einfache, auditierbare** Berechnung im Backend gilt:

1. **Aufwand in SQL:** Potenzen mit nicht trivialen Exponenten sind auf Datenbankebene teurer als unsere Formel (Addition, Multiplikation, `min`).
2. **Komplexität vs. Nutzen:** Sehr große Stimmzahlen sind bei uns nicht das Kernproblem; der dynamische Term \(C\) adressiert Kleinstichproben vorhersehbar, ohne globale Skalierungslogik aus dem Social-Web zu übernehmen.

### „Best Questions“ und das Wilson-Score-Intervall

Sollte später ein Reiter bzw. Sortiermodus **„Beste Fragen“** ergänzt werden, reicht **nicht** die Sortierung nach \(\frac{U}{U+D}\): Ein Post mit 1 Up und 0 Down wäre „100 %“, ein Post mit 100 Up und 2 Down „nur“ 98 % — die eine Stimme würde fälschlich gewinnen.

**Ansatz (wie Reddit „Best“):** Untere Grenze des **Wilson-Konfidenzintervalls** für den Anteil positiver Stimmen (Bernoulli). Intuition: _Bei gegebenen Stimmen: Wie niedrig kann der „wahre“ Up-Anteil plausibel noch sein (z. B. 95 %-Konfidenz)?_

**Formel:**

$$
S_{\text{wilson}} = \frac{\hat{p} + \frac{z^2}{2n} - z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}
$$

- \(n = U + D\) — Gesamtstimmen
- \(\hat{p} = U/n\) — beobachteter Anteil Upvotes
- \(z \approx 1{,}96\) — z. B. für 95 %-Konfidenzniveau

Kleine Stichproben werden **stark** abgestraft (hohe Unsicherheit); große, fast einhellige Stimmungen liefern eine stabile untere Grenze.

**Beispiel (typische Größenordnungen):**

- Post A: 1 Up, 0 Down — beobachtet 100 %, untere Wilson-Grenze etwa **20,6 %**.
- Post B: 100 Up, 2 Down — beobachtet 98 %, untere Grenze etwa **93,1 %**.

Post B gewinnt zu Recht gegen Post A.

**Hinweis:** Abgrenzung zu Story **8.6** (Kontroversität). Story 8.7 ist im aktuellen Produkt ebenfalls als **optionaler Host-Sortiermodus** zu verstehen, nicht als Ersatz der Standardsortierung für Teilnehmende. Eine spätere Erweiterung auf Moderator:innen bleibt möglich.

---

## Leseempfehlungen und theoretischer Hintergrund

### Evan Miller (Artikel)

1. **[How Not To Sort By Average Rating](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)** (2009) — warum einfache Durchschnitte und naive Sortierungen scheitern.
2. **[Deriving the Reddit Formula](https://www.evanmiller.org/deriving-the-reddit-formula.html)** — Herleitung und Diskussion von Reddits Ranking-Ideen („Hot“, „Controversial“).

### Zusammenfassung (nach Miller): typische Fehlbilder und Wilson

Miller zeigt, warum zwei naheliegende „Best“-Sortierungen problematisch sind und führt zum Wilson-Score.

#### Falscher Ansatz 1 — absolute Differenz (Positiv − Negativ)

- **Problem:** Hohe Gesamtmasse dominiert, ohne den Anteil zu honorieren.
- **Beispiel:** Post A: 600 Up, 400 Down → Differenz 200 (60 % Zustimmung). Post B: 5 500 Up, 4 500 Down → Differenz 1 000 (55 % Zustimmung). Nach Differenz gewinnt B, obwohl A prozentual stärker ist.
- **Fazit:** Differenz allein ist für „Qualität“ ungeeignet (historisch u. a. bei ähnlichen naive Sortierungen problematisch).

#### Falscher Ansatz 2 — reiner Anteil (Positiv / Gesamt)

- **Problem:** Sehr kleine Stichproben können 100 % erreichen und gewinnen.
- **Beispiel:** Post A: 2 Up, 0 Down → 100 %. Post B: 100 Up, 1 Down → 99 %. Nach Anteil gewinnt A, obwohl B viel mehr Evidenz hat.
- **Fazit:** Ohne Berücksichtigung der Unsicherheit bei kleinem \(n\) entsteht ein systematischer Bias.

#### Lösung — Wilson-Score-Intervall (untere Grenze)

Votings werden als **Stichprobe** behandelt, nicht als endgültige Wahrheit. Der Wilson-Algorithmus liefert eine konservative untere Schranke für den echten Up-Anteil.

> Gegeben die bisherigen Stimmen: Wie niedrig kann der Anteil Upvotes im plausibel schlechtesten Fall noch sein (z. B. 95 %-Konfidenz)?

$$
S = \frac{\hat{p} + \frac{z^2}{2n} - z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}
$$

(\(\hat{p}\): Anteil Upvotes, \(n\): Gesamtstimmen, \(z\): z. B. 1,96 für 95 %.)

**Praxis:** 2/0 Stimmen messen 100 %, die untere Grenze fällt stark (Größenordnung ~20 %). 100/1 Stimmen messen hohe Zustimmung mit geringer Unsicherheit; die untere Grenze bleibt hoch (Größenordnung >90 %). Das Ranking folgt **statistisch belastbarer** Qualität, nicht nur dem rohen Prozentsatz.

### Entwicklernotizen — Wilson-Score in SQL (Story 8.7)

Untere Grenze des Wilson-Intervalls mit **\(z = 1{,}96\)** (95 %). Konstanten für die Implementierung:

- \(z^2 = 3{,}8416\)
- \(\frac{z^2}{2n}\)-Term in der Literaturform entspricht hier der numerischen Auswertung mit **1,9208** im Zähleranteil und **0,9604** unter der Wurzel (siehe Query).

```sql
WITH stats AS (
    SELECT
        id,
        text,
        status,
        upvotes,
        downvotes,
        created_at,
        CAST(upvotes AS FLOAT) AS u,
        CAST(upvotes + downvotes AS FLOAT) AS n
    FROM qa_question_vote_stats
    WHERE session_id = :current_session_id
),
probabilities AS (
    SELECT
        *,
        CASE WHEN n > 0 THEN u / n ELSE 0.0 END AS p
    FROM stats
)
SELECT
    id,
    text,
    status,
    upvotes,
    downvotes,
    created_at,
    CASE
        WHEN n = 0 THEN 0.0
        ELSE (
            (p + 1.9208 / n - 1.96 * SQRT((p * (1.0 - p) / n) + (0.9604 / (n * n))))
            / (1.0 + 3.8416 / n)
        )
    END AS best_score
FROM probabilities
ORDER BY
    best_score DESC,
    upvotes DESC,
    (upvotes - downvotes) DESC,
    created_at ASC;
```

`qa_question_vote_stats` steht hier für eine Query/CTE/View, die `U` und `D` aus `QaUpvote.direction` aggregiert. Die bestehende Spalte `QaQuestion.upvoteCount` bleibt für den Netto-Score bzw. als Kompatibilitätsfeld nutzbar, ist aber **nicht** die Primärquelle für Wilson.

## Umsetzungsreihenfolge

Für das heutige Produkt ist diese Reihenfolge sinnvoll:

1. **Story 8.7 zuerst:** statistisch robuste „Beste Fragen“ als optionaler Sortiermodus in der Host-Ansicht
2. **Story 8.6 danach:** Kontroversitätsmodus mit sichtbarer Kennzeichnung und klarer Erklärung

Begründung:

- 8.7 stärkt direkt das bestehende Produktziel „relevante Fragen nach oben“.
- 8.6 ist fachlich plausibel, braucht aber mehr UI-Erklärung und wirkt schneller kontraintuitiv, wenn nur der Netto-Score sichtbar bleibt.
