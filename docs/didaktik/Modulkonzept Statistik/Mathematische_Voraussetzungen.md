# Mathematische Voraussetzungen

**Geltung:** Erläuterung zu [Abschnitt 2.1 des Modulkonzepts](./Modulkonzept_48UE_BWL_Management_WI_Informatik.md#21-voraussetzungen). Dieselbe Darstellung nutzen die [Modulbeschreibung für Studierende](./Modulbeschreibung_Studierende.md) und [Abschnitt 1.2 des Kerncurriculums](./P0-01_Kerncurriculum_Lernzielmatrix.md#12-umgang-mit-heterogenen-mathematischen-vorkenntnissen).<br>
**Status:** Orientierung vor und in Woche 1. Keine benotete Leistung und keine Teilnahmebedingung.

Die kurze Liste in Abschnitt 2.1 nennt Grundrechenarten, Brüche, Prozente, Potenzen, Quadratwurzeln, Klammern, einfaches Umformen sowie das Lesen von Tabellen und Diagrammen. In den Formeln des Pflichtkerns greifen diese Fertigkeiten ineinander. Diese Datei rechnet dazu Beispiele aus dem Kurs vollständig durch. Der Kurs selbst führt die statistischen Begriffe ein, dazu das Summenzeichen als Schreibweise, die griechischen Parameter und die Auswahl der passenden Formel. Kritische $z$- und $t$-Werte stehen in der Aufgabe.

In der Klausur gelten die Rundungsregeln der [Formelsammlung](./P0-03_Formelsammlung_Statistik.md). Gerechnet wird mit einem nicht programmierbaren Taschenrechner. Zwischenwerte bleiben ungerundet. Anteile werden auf drei Dezimalen berichtet, Prozente auf eine Dezimalstelle, Messwerte auf zwei Dezimalstellen.

## 1. Brüche, Dezimalzahlen und Prozente

Dieselbe Anzahl ist je nach Nenner ein anderer Anteil. In einem Kursbeispiel stimmen $28$ von $40$ Antwortenden zu, und $50$ Personen sind anwesend:

$$
\frac{28}{40}=0{,}70=70{,}0\,\%,
\qquad
\frac{28}{50}=0{,}56=56{,}0\,\%.
$$

Beide Brüche verwenden den Zähler $28$. Der erste Nenner ist die Gruppe der Antwortenden, der zweite die Gruppe der Anwesenden. $70{,}0\,\%$ und $56{,}0\,\%$ beschreiben deshalb zwei verschiedene Bezugsgruppen.

Dieselbe Unterscheidung gilt bei einer bedingten Wahrscheinlichkeit. In der Transferaufgabe zu Modulziel 3 sieht die Vierfeldertafel so aus:

| tatsächlicher Zustand | Hinweis | kein Hinweis | Summe |
| --------------------- | ------: | -----------: | ----: |
| Qualitätsproblem      |      16 |            4 |    20 |
| kein Qualitätsproblem |       8 |           72 |    80 |

Die Spalte »Hinweis« summiert sich zu $16+8=24$, die Zeile »Qualitätsproblem« zu $20$. Damit gelten

$$
\frac{16}{24}=0{,}666\ldots\approx 0{,}667=66{,}7\,\%,
\qquad
\frac{16}{20}=0{,}800=80{,}0\,\%.
$$

Der erste Bruch ist der Anteil der tatsächlichen Ereignisse unter den markierten Fällen. Der zweite ist der Anteil der markierten Fälle unter den tatsächlichen Ereignissen. Dafür sind Zelle, Zeilensumme und Spaltensumme abzulesen. Welche der beiden Bedingungen die Frage verlangt, übt der Kurs.

## 2. Klammern, Quadrat und Quadratwurzel

Fünf Bearbeitungszeiten lauten $100$, $110$, $120$, $130$ und $140$ Sekunden. Der Mittelwert ist $120\,\mathrm{s}$. Für die Stichprobenstandardabweichung werden zuerst die Abweichungen vom Mittelwert gebildet, dann quadriert und addiert:

$$
\begin{aligned}
&(100-120)^2=400,\\
&(110-120)^2=100,\\
&(120-120)^2=0,\\
&(130-120)^2=100,\\
&(140-120)^2=400.
\end{aligned}
$$

Die Summe der Quadrate ist $1\,000$. Geteilt wird durch $n-1=4$. Die Wurzel bezieht sich auf diesen ganzen Bruch:

$$
s=\sqrt{\frac{1\,000}{4}}=\sqrt{250}=15{,}811\ldots\approx 15{,}81\,\mathrm{s}.
$$

Die Quadratsumme $1\,000$ hat die Einheit $\mathrm{s}^2$. Erst die Wurzel bringt das Ergebnis auf Sekunden zurück. Ob durch $n$ oder durch $n-1$ geteilt wird, entscheidet der Kurs je nach Frage. Beide Divisionen setzen dieselbe Quadratsumme voraus.

Der Standardfehler eines Anteils wird von innen nach außen gerechnet. In der Probeklausur erfüllen $37$ von $52$ Fällen ein Kriterium:

$$
\hat p=\frac{37}{52}=0{,}711538\ldots\approx 0{,}712.
$$

Zuerst entsteht das Produkt $\hat p(1-\hat p)=(37/52)\cdot(15/52)$, dann die Division durch $n=52$, danach die Wurzel:

$$
SE(\hat p)
=\sqrt{\frac{(37/52)\cdot(15/52)}{52}}
=0{,}062826\ldots
\approx 0{,}063.
$$

## 3. Vorzeichen, Betrag und einfaches Umformen

Beim gepaarten Vergleich ist jede Differenz in einer vorher festgelegten Richtung zu bilden. Sind die absoluten Fehler zweier Runden $4$ und $9$, gilt für die Richtung »Runde 1 minus Runde 2«:

$$
d=|4|-|9|=-5.
$$

Das negative Vorzeichen bleibt stehen. In dieser Richtung bedeutet es, dass der absolute Fehler größer geworden ist.

Eine Gerade wird eingesetzt und nach einer gesuchten Größe umgestellt. Im beobachteten Bereich von $100$ bis $500$ gilt in der Transferaufgabe

$$
\hat y=40+0{,}18x.
$$

Bei $x=300$ liegt die Vorhersage auf der Geraden:

$$
\hat y=40+0{,}18\cdot 300=40+54=94.
$$

Beobachtet wurden an dieser Stelle $y=100$. Das Residuum behält das Vorzeichen:

$$
e=y-\hat y=100-94=+6.
$$

Die Beobachtung liegt damit $6$ Einheiten über der Vorhersage. Ist umgekehrt die Vorhersage $94$ gegeben und die Stelle gesucht, wird die Gleichung umgestellt:

$$
40+0{,}18x=94,
\qquad
0{,}18x=54,
\qquad
x=\frac{54}{0{,}18}=300.
$$

## 4. Fakultät, Binomialkoeffizient und ganzzahlige Potenzen

Für $X\sim Bin(3;0{,}70)$ und genau zwei Erfolge lautet die eingesetzte Formel

$$
P(X=2)=\binom{3}{2}(0{,}70)^2(1-0{,}70)^{3-2}.
$$

Der Binomialkoeffizient wird über Fakultäten berechnet. Dabei gilt $0!=1$, und jede Fakultät einer positiven ganzen Zahl ist das Produkt der Zahlen von $1$ bis zu dieser Zahl:

$$
\binom{3}{2}=\frac{3!}{2!\,1!}=\frac{6}{2\cdot 1}=3.
$$

Danach kommen die Potenzen und zum Schluss das Produkt:

$$
(0{,}70)^2=0{,}49,
\qquad
(0{,}30)^1=0{,}30,
\qquad
3\cdot 0{,}49\cdot 0{,}30=0{,}441=44{,}1\,\%.
$$

Dieselbe Fakultätsregel gilt für den Fall ohne Erfolg. Wegen $0!=1$ und $(0{,}70)^0=1$ ist

$$
\binom{3}{0}=\frac{3!}{0!\,3!}=1,
\qquad
P(X=0)=1\cdot 1\cdot(0{,}30)^3=0{,}027.
$$

## 5. Summe, Index und eingesetzte Formel

Das Summenzeichen führt der Kurs als Anweisung ein: »Führe die Rechnung für jede Beobachtung aus und addiere die Ergebnisse.« Vorausgesetzt ist die Rechnung unter dem Zeichen. Für die fünf Zeiten aus Abschnitt 2 heißt das

$$
\sum_{i=1}^{5}(x_i-120)^2
=400+100+0+100+400
=1\,000.
$$

Der Index $i$ nummeriert die Beobachtungen. $x_1$ ist der erste Wert, $x_5$ der letzte. Sobald der Kurs einen griechischen Parameter definiert hat, wird er wie eine gegebene Zahl eingesetzt. Für eine Referenzverteilung mit Mittelwert $\mu=120$ und Standardabweichung $\sigma=16$ gehört zur Beobachtung $x=152$ der standardisierte Wert

$$
z=\frac{x-\mu}{\sigma}=\frac{152-120}{16}=\frac{32}{16}=2.
$$

Zuerst wird subtrahiert, danach dividiert. Die Bedeutung von $\mu$, $\sigma$ und $z$ erklärt der Kurs. Die kritischen Vergleichswerte, etwa $1{,}960$ für ein zweiseitiges $95\,\%$-Niveau, werden vorgegeben und sind nicht aus einer Tabelle herzuleiten.

## 6. Was der Kurs selbst einführt

Ab Woche 1 steht die Formelsammlung bereit. Sie benennt zu jeder Formel die Größen, die passende Verwendung und die Einheit. Der Kurs führt außerdem ein:

- die statistischen Begriffe, von der Bezugsgruppe über bedingte Wahrscheinlichkeit und Binomialmodell bis zu Intervall, gepaartem Vergleich, Korrelation und Gerade,
- die Entscheidung, ob eine Streuung durch $n$ oder durch $n-1$ geteilt wird,
- das Lesen eines bereitgestellten Wilson-Intervalls, ohne die Wilson-Formel nachzurechnen,
- kritische $z$- und $t$-Werte in der jeweiligen Aufgabe.

Analysis, lineare Algebra, Python, R und Programmierung gehören nicht zu diesen Voraussetzungen. Ableitungen, Integrale, Vektoren und Matrizen kommen in den Rechnungen des Pflichtkerns nicht vor.
