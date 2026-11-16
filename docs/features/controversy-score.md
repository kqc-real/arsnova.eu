# Kontroversitäts- und Best-Score für das Q&A-Forum (Story 8.6 / 8.7)

> **Zielgruppe:** Product Owner, Entwickler, QA  
> **Verknüpfung:** User-Stories in Kurzform siehe [`Backlog.md`](../../Backlog.md) — **8.6** Kontroversitäts-Score, **8.7** »Klare Zustimmung« (Wilson-Score). Dieses Dokument enthält Spezifikation **und** den aktuellen Implementierungsstand zu beiden Themen.

## Hintergrund

Eine einfache Differenz (Upvotes minus Downvotes) rutscht bei **ausgeglichener Polarität** nach unten: z. B. 50 Up- und 50 Downvotes ergeben Differenz 0, obwohl die Frage für die Diskussion im Raum zentral sein kann.

Der Score misst, wie geteilt die Stimmen zu einer Frage sind. Ein fester Zuschlag im Nenner dämpft kleine Stimmzahlen. Identische Stimmenverteilungen ergeben denselben Score in jeder Session.

## Produktverhalten

Die aktuelle Q&A-Implementierung in arsnova.eu hat bereits **bidirektionales Voting** (`UP` / `DOWN`) und speichert pro Frage einen **Netto-Score** in `QaQuestion.upvoteCount`; die einzelnen Stimmen liegen in `QaUpvote.direction`. Daraus folgen für Story 8.6 und 8.7 verbindliche Produktentscheidungen:

1. **»Geteilte Stimmen« und »Klare Zustimmung« stehen als Sortiermodi in der Host- und in der Teilnehmendenansicht zur Auswahl.**
2. **Teilnehmende starten mit »Stimmensaldo«.**
3. **Hervorgehobene Fragen bleiben Forum- und Presenter-Anker.** In allen Sortiermodi stehen `PINNED`-Fragen zuerst (Host: vor `PENDING` und `ACTIVE`); innerhalb jeder Statusgruppe gilt die gewählte Metrik. Die Host-Liste rotiert ab dem Navigator-Cursor (Position 1 = Hero, 2 = nächster Kandidat); der Hero ist nur per Primary-Rand markiert (gleiche Kartenfläche wie die übrigen Fragen). Die Hörsaalbühne zeigt zusätzlich Erstellungszeit und nur die aktive Sortier-Metrik (bei BEST Dafür-Anteil und Stimmenzahl, bei CONTROVERSIAL die Einordnung der Stimmenverteilung); `qa.presentProjection` liefert die Scores deshalb immer mit. `PENDING`, `ARCHIVED` und `DELETED` folgen als eigene Statusgruppen.
4. **`QaQuestion.upvoteCount` ist im Ist-Stand ein Netto-Score, nicht die Zahl der Upvotes.** Für 8.6 und 8.7 müssen `U` und `D` aus den Einzelstimmen (`QaUpvote.direction`) aggregiert werden; der Netto-Score allein reicht fachlich nicht.
5. **Die Q&A-UI braucht einen expliziten Sortiermodus**, z. B. `Stimmensaldo`, `Geteilte Stimmen`, `Klare Zustimmung`, `Zeit`. Ohne sichtbaren Moduswechsel wären 8.6/8.7 nicht nachvollziehbar.

## Implementierungsstand

Der heutige Produktstand deckt die Storys 8.6 und 8.7 in der Host-Ansicht bereits ab:

- Host- und Teilnehmer-Q&A-Liste bieten die Sortiermodi `Stimmensaldo`, `Klare Zustimmung`, `Geteilte Stimmen` und `Zeit`. `Zeit` sortiert serverseitig nach `createdAt` (neueste zuerst); die Seite bleibt eine DB-Seite, ohne Client-Neusortierung der vollen Liste. Die Teilnehmeransicht erhält die für die Sortiermodi verwendeten Stimmenaggregate und Bewertungsmetriken.
- Die Router-/DTO-Schicht liefert neben dem bisherigen Nettofeld auch getrennte `UP`-/`DOWN`-Aggregate sowie `score`, `voteCount`, `bestScore`, `controversyScore` und `isControversial`.
- Die Host-Liste aggregiert `QaUpvote.direction` serverseitig per DB-Gruppierung statt alle Einzelvotes in den Host-Poll zu laden; `QaQuestion.updatedAt` und ein Revisionsschluessel vermeiden volle Rebuilds, wenn sich seit dem letzten Poll nichts geaendert hat.
- Die Teilnehmendenansicht startet bei `Stimmensaldo` und kann dieselben vier Sortiermodi anfordern. In allen Sortiermodi stehen hervorgehobene Fragen zuerst; danach sortieren `Klare Zustimmung`, `Geteilte Stimmen` und `Zeit` nach Metrik bzw. Erstellungszeit. Die Fragen-Suche läuft wie beim Host entprellt (300 ms) über `qa.list` und durchsucht nicht die geladene Seite lokal. Der Host filtert in »Teilnahmen durchsuchen« eine Identität über `qa.list` (`authorNickname`) in PostgreSQL, nicht über die geladene Seite; die Liste und die Fragenkarten zeigen eine vorhandene Teamzugehörigkeit.
- Die Q&A-Wortwolke im Host folgt demselben Sortiermodus, kann im Dialog eingefroren werden und zeigt im Tooltip neben dem Groessenwert auch die Zahl der zugehoerigen Fragen.
- In der maximierten Host-Vollansicht bleibt der Sortierumschalter oberhalb der Wolke sichtbar.

## Datenmodell und API-Stand

Die Umsetzung nutzt die heutigen Q&A-Tabellen weiterhin, erweitert aber die DTO-/Router-Schicht bereits um:

- `score`: aktueller Netto-Score (`UP = +1`, `DOWN = -1`)
- `upvoteCount`: kompatibles Legacy-Feld fuer den Netto-Score
- `positiveVoteCount`: Zahl positiver Stimmen `U`
- `negativeVoteCount`: Zahl negativer Stimmen `D`
- `voteCount`: Gesamtzahl `U + D`
- optional `controversyScore` und `bestScore` im Host-Kontext

Die Einführung erfolgte **kompatibel**: Bestehende Clients brechen nicht implizit. Das Feld `upvoteCount` bleibt aus Kompatibilitätsgründen erhalten, ist aber im heutigen Produkt semantisch weiter ein **Score**. Mittelfristig ist ein API-Feldname wie `score` die sauberere Wahl.

## Berechnung

Für jede Frage (Post) wird ein `controversy_score` berechnet. Wertebereich: **0,0** (eindeutige Stimmung) bis **1,0** (hohe Kontroverse bei vielen Stimmen im Verhältnis zur Glättung).

### Formel

$$
S = \frac{2 \cdot \min(U, D)}{U + D + 4}
$$

\(U\) steht für die Dafür-Stimmen und \(D\) für die Dagegen-Stimmen dieser Frage. Der Zuschlag 4 verhindert eine Division durch null. Bei gleicher Stimmenzahl erhöht eine ausgewogenere Verteilung den Sortierwert. Wenn beide Seiten Stimmen erhalten, steigt der Wert bei gleichem Stimmenverhältnis mit der Zahl der abgegebenen Stimmen. Ohne Stimmen oder bei einer einseitigen Verteilung ist der Sortierwert 0.

## Sortierung (Tie-Breaker)

Die gewählte Metrik sortiert innerhalb der jeweiligen Statusgruppe. Im Host-Ranking hat `PINNED` Vorrang, gefolgt von `PENDING`, `ACTIVE` und `ARCHIVED`.

Bei gleichem `controversy_score` (häufig in kleinen Gruppen) gilt strikt:

1. `controversy_score` **DESC**
2. `U` **DESC**
3. `score` **DESC**
4. `created_at` **ASC** (ältere Frage zuerst — konsistent mit der heutigen stabilen Q&A-Reihenfolge)
5. `id` **ASC** als finaler technischer Tie-Breaker gegen Jitter

## UI und Copy (Referenz Deutsch)

Damit Host/Moderation **nachvollziehen**, warum eine Frage oben steht, kann ein Kontroversitäts-Sortiermodus durch die UI unterstützt werden.

### Badge und Kennzeichnung

Für Story 8.6 ist eine bloße Umsortierung ohne sichtbare Erklärung im heutigen Produkt **nicht ausreichend**. In der Host-Ansicht muss erkennbar sein, warum eine Frage trotz mittlerem oder neutralem Netto-Score weit oben steht.

Die Karte zeigt »Geteilte Stimmen«, wenn **beides** gilt:

- `controversy_score > 0.5`
- \((U + D) \geq 6\)

Bei weniger als sechs Stimmen zeigt die Karte »Zu wenige Stimmen«.

Ab sechs Stimmen zeigt die Karte »Einseitig«, wenn der Sortierwert höchstens 0,5 beträgt.

**Icons** (Auswahl bei Umsetzung): z. B. Blitz, gekreuzte Schwerter, Waage — konsistent zum bestehenden Designsystem.

**Visualisierung:** Falls eine Voting-Anzeige existiert, kann ein Verlauf von neutral zu „warnend“ den steigenden Score andeuten (`prefers-reduced-motion` beachten).

Die aktuelle Host-UI ergänzt diese Kennzeichnung durch eine sortierabhaengige Q&A-Wortwolke. Deren Termliste basiert auf bereinigter Document-Frequency pro Frage: Ein Begriff zaehlt je Frage maximal einmal, die aktive Sortiermetrik steuert das Dokumentgewicht. Der Tooltip zeigt den Groessenwert, die Zahl der zugehoerigen Fragen, die Gewichtungsbasis (`Stimmensaldo`, `Klare Zustimmung`, `Geteilte Stimmen`) sowie konkrete Fragen, damit Sortierung und Themenraum zusammen lesbar bleiben.

### Sortier-UI

Die Sortierauswahl sitzt in der Host- und Teilnehmendenansicht bei der Q&A-Liste. Ein Paired Host verwendet dieselbe Steuerung.

- `Stimmensaldo` — heutige Standardsortierung nach dem Saldo aus Stimmen dafür und dagegen
- `Geteilte Stimmen` — Story 8.6, derselbe `controversyScore` in Liste und Wortwolke
- `Klare Zustimmung` — Story 8.7
- `Zeit` — neueste zuerst; die Datenbank sortiert nach `createdAt DESC` (Index `sessionId, status, createdAt`)

Bei `Klare Zustimmung` zeigen Host-, Teilnehmenden- und Bühnenansicht den beobachteten Dafür-Anteil (auf höchstens eine Nachkommastelle gerundet) mit der Gesamtzahl der Stimmen, etwa »100 % dafür · 1 Stimme«. Bei null Stimmen erscheint »Noch keine Stimmen«. Der Wilson-Score bestimmt die Reihenfolge. Bei `Geteilte Stimmen` bleiben die Dafür- und Dagegen-Stimmen an der Karte ablesbar. Die Einordnung lautet `Geteilte Stimmen`, `Zu wenige Stimmen` oder `Einseitig`. Die Formel und ihre Beispielwerte stehen in der Sortierhilfe.

Der aktive Modus bleibt während einer Session stabil, bis ein autorisierter Host ihn bewusst ändert.

Die Host-Q&A-Wortwolke nutzt denselben Modus: `Stimmensaldo` gewichtet nach dem Saldo aus Stimmen dafür und dagegen, `Klare Zustimmung` nach Wilson-Score und `Geteilte Stimmen` nach `controversyScore`. `Vorkommen in Fragen` zählt, in wie vielen sichtbaren Fragen ein Wort steht, jede Frage einmal; die Fragenliste bleibt nach Eingangszeit sortiert. Die Visualisierung bekommt bereits gewichtete Terme und analysiert keine Rohtexte selbst. In der maximierten Vollansicht sitzt die Sortierauswahl oberhalb der Wolke, damit der Kontext beim Wechsel sichtbar bleibt; ein Freeze-Schalter haelt die aktuell dargestellte Wolke fuer die Auditoriumssituation fest.

Bei »Klare Zustimmung« und »Geteilte Stimmen« wird das Wortwolkengewicht aus dem Sortierwert berechnet, gerundet und auf 28 begrenzt. Beispielsweise ergeben 20:20 und 30:30 die Sortierwerte 0,909 und 0,938. Beide erhalten das Wortwolkengewicht 28.

## Akzeptanzkriterien

- [x] **AC 1:** Sortierung bevorzugt stark **ausgeglichene** Up-/Down-Beteiligung gegenüber einseitiger Zustimmung.
- [x] **AC 2:** Gleiche Stimmenzahlen ergeben sessionübergreifend denselben Score. Der feste Zuschlag 4 dämpft kleine Stimmzahlen.
- [x] **AC 3:** Gleicher Score → eindeutige Reihenfolge über `U`, dann Netto-Score, dann `created_at`, dann `id`.
- [x] **AC 4:** Ohne Stimmen ergibt sich Score 0.
- [x] **AC 5:** Fragen oberhalb der Badge-Schwellen werden in der Host-Ansicht sichtbar als kontrovers/umstritten gekennzeichnet (siehe Abschnitt UI).
- [x] **AC 6:** `PINNED`-Fragen bleiben sichtbar markiert und stehen in allen Sortiermodi zuerst (Host: vor `PENDING` und `ACTIVE`); innerhalb der Statusgruppe gilt die gewählte Metrik.
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
    / (upvotes + downvotes + 4) AS controversy_score
FROM vote_counts
ORDER BY
    controversy_score DESC,
    upvotes DESC,
    (upvotes - downvotes) DESC,
    created_at ASC;
```

## Testfälle und QA

### 1. Keine Interaktion / einseitige Stimmung

| Post | U   | D   | Erwarteter Score | Kurz           |
| ---- | --- | --- | ---------------- | -------------- |
| A    | 0   | 0   | 0,000            | Keine Stimmen  |
| B    | 50  | 0   | 0,000            | Nur Zustimmung |
| C    | 0   | 50  | 0,000            | Nur Ablehnung  |

### 2. Verschiedene Stimmzahlen bei gleichem Verhältnis

| Post | U   | D   | Erwarteter Score | Kurz      |
| ---- | --- | --- | ---------------- | --------- |
| D    | 1   | 1   | 0,333            | 2/(2+4)   |
| E    | 40  | 40  | 0,952            | 80/(80+4) |

Reihenfolge: E vor D (gleiche Balance, mehr Masse → höherer Score).

### 3. Tie-Breaker

| Post | U   | D   | Zeit  | Score       |
| ---- | --- | --- | ----- | ----------- |
| F    | 2   | 1   | 10:00 | 2/7 ≈ 0,286 |
| G    | 1   | 2   | 10:05 | 2/7 ≈ 0,286 |
| H    | 2   | 1   | 10:10 | 2/7 ≈ 0,286 |

Erwartete Reihenfolge: F, dann H, dann G — zuerst mehr Upvotes als G; bei F vs. H gewinnt die ältere Frage für ein stabileres Live-Ranking.

### 4. Kennzeichnung an der Stimmgrenze

| U   | D   | Score | Kennzeichnung     |
| --- | --- | ----- | ----------------- |
| 2   | 2   | 0,50  | Zu wenige Stimmen |
| 3   | 2   | 0,44  | Zu wenige Stimmen |
| 3   | 3   | 0,60  | Geteilte Stimmen  |
| 5   | 1   | 0,20  | Einseitig         |

---

## Exkurs: Alternative Sortieralgorithmen (Reddit-Vergleich)

Zur Einordnung der Architekturentscheidung: Wie lösen große Plattformen (insbesondere Reddit) ähnliche Fragestellungen, und was passt zu unserem Live-Event mit begrenzter Teilnehmerzahl?

### Reddits historischer »Controversial«-Score

Der Hilfedialog »Geteilte Stimmen« verweist zum Vergleich auf den historischen »Controversial«-Modus von Reddit. Dieser kombiniert die Summe der Stimmen und ihr Verhältnis über eine **Potenz**. [Archivierter Reddit-Quellcode](https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx)

**Formel (vereinfacht notiert):**

$$
S_{\text{reddit}} = (U + D)^{\left(\frac{\min(U, D)}{\max(U, D)}\right)}
$$

Wenn \(U = 0\) oder \(D = 0\), setzt der historische Reddit-Code den Wert auf 0.

**Eigenschaften:**

- Der Exponent (Balance) liegt zwischen 0 (einseitig) und 1 (50/50).
- Bei 100 Up und 100 Down ist der Exponent 1; der Wert entspricht der Stimmzahl \(200^1\).
- Bei 100 Up und 50 Down ist der Exponent 0,5; der Wert wird gedämpft (z. B. \(150^{0,5} \approx 12{,}2\)).

### Warum arsnova.eu die Stimmenzahl dämpft

Der Zuschlag 4 dämpft den Wert bei wenigen Stimmen. Bei größeren Stimmenzahlen nähert sich der Wert der Ausgeglichenheit der abgegebenen Stimmen an. arsnova.eu sortiert 2:2 (0,500) hinter 60:30 (0,638) und 4:4 (0,667) vor 60:30. Die historische Reddit-Formel gewichtet die höhere Stimmenzahl stärker und sortiert 60:30 (9,49) vor 4:4 (8,00).

### Klare Zustimmung und das Wilson-Intervall

Die Sortierung »Klare Zustimmung« berücksichtigt den Dafür-Anteil und die Zahl der abgegebenen Stimmen. Bei einer Sortierung allein nach Anteil käme eine Frage mit 1 Dafür-Stimme (100 %) vor einer Frage mit 100 Dafür- und 2 Dagegen-Stimmen (rund 98 %).

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

**Hinweis:** Abgrenzung zu Story **8.6** (Kontroversität). Story 8.7 ist ebenfalls als **optionaler Host-Sortiermodus** zu verstehen, nicht als Ersatz der Standardsortierung für Teilnehmende. Vertrauenswürdige Co-Hosts erhalten ihn über Story 2.10.

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

Der Hilfedialog »Klare Zustimmung« nennt die abgegebenen Stimmen als Grundlage der Sortierung und verlinkt die [NIST-Dokumentation zum Wilson-Intervall](https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/propconf.htm).

**Praxis:** Bei 1 Dafür- und 0 Dagegen-Stimmen liegt der beobachtete Anteil bei 100 % und die Wilson-Untergrenze bei rund 21 %. Bei 10 Dafür- und 0 Dagegen-Stimmen liegt der beobachtete Anteil ebenfalls bei 100 %, die Wilson-Untergrenze steigt auf rund 72 %.

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

1. **Story 8.7 zuerst:** »Klare Zustimmung« als optionaler Sortiermodus in der Host-Ansicht
2. **Story 8.6 danach:** Kontroversitätsmodus mit sichtbarer Kennzeichnung und klarer Erklärung

Begründung:

- 8.7 stärkt direkt das bestehende Produktziel „relevante Fragen nach oben“.
- 8.6 ist fachlich plausibel, braucht aber mehr UI-Erklärung und wirkt schneller kontraintuitiv, wenn nur der Netto-Score sichtbar bleibt.
