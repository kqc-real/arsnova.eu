# Musterlösung zur Probeklausur – Angewandte Statistik

- **Gesamt:** 60 Punkte
- **Bezugsdokument:** `P0-03_Probeklausur_90_Minuten.md`

## Bewertungs- und Rundungsregeln

- Volle Punkte setzen einen nachvollziehbaren Rechenweg oder – bei
  Interpretationsaufgaben – einen vollständigen kontextbezogenen Satz voraus.
- Gleichwertige fachlich korrekte Formulierungen werden anerkannt.
- Mit ungerundeten Zwischenwerten rechnen; erst das Endergebnis runden.
- Anteile: drei Dezimalstellen; Prozente: eine Dezimalstelle; Messwerte:
  zwei Dezimalstellen; Test- und Modellkennzahlen: drei Dezimalstellen.
- Rechnerbedingte Abweichungen in der letzten angegebenen Stelle werden
  anerkannt.
- Ein richtiger Folgeweg wird nicht erneut für denselben übernommenen
  Rechenfehler bestraft, sofern das Folgeergebnis plausibel interpretiert wird.
- Pro Teilaufgabe werden höchstens die angegebenen Punkte vergeben; es gibt
  keine Minuspunkte.

## Punkteübersicht

| Aufgabe |   a |   b |   c |   d |          e |  Summe |
| ------: | --: | --: | --: | --: | ---------: | -----: |
|       1 |   3 |   2 |   2 |   3 |          2 |     12 |
|       2 |   2 |   3 |   2 |   2 |          – |      9 |
|       3 |   2 |   2 |   2 |   3 |          – |      9 |
|       4 |   2 |   2 |   2 |   2 |          1 |      9 |
|       5 |   2 |   2 |   3 |   2 |          – |      9 |
|       6 |   2 |   4 |   2 |   2 |          2 |     12 |
|         |     |     |     |     | **Gesamt** | **60** |

---

## Lösung zu Aufgabe 1 – ARSnova-Daten beschreiben

### a) Beobachtungseinheit, Skalenniveau und \(n\) – 3 Punkte

- **Beobachtungseinheit:** eine gültige abgegebene Antwort einer antwortenden
  Person. (1 Punkt)
- **Variable und Skalenniveau:** gewählte Antwortoption; nominal. (1 Punkt)
- **Stichprobengröße:** \(n=48\) gültige Antworten. (1 Punkt)

Die Zahl eingeschriebener oder anwesender Personen wäre ohne weitere Angabe
nicht der richtige Nenner.

### b) Relative Häufigkeit von B – 2 Punkte

$$
h_B=\frac{n_B}{n}=\frac{24}{48}=0{,}500
$$

$$
h_B(\%)=100\cdot0{,}500=50{,}0\,\%
$$

- passender Zähler und Nenner: 1 Punkt
- Anteil und Prozent korrekt: 1 Punkt

### c) Diagrammwahl und Achse – 2 Punkte

Ein **Balkendiagramm** ist passend, weil die Antwortoptionen nominale
Kategorien sind. Ein Histogramm setzt eine metrische Zahlenachse mit
zusammenhängenden Klassen voraus. (1 Punkt)

Eine bei 20 beginnende Häufigkeitsachse schneidet den unteren Teil der Balken
ab. Option A mit 12 Antworten wäre sogar außerhalb des sichtbaren
Achsenbereichs, und der Unterschied zu B würde optisch übertrieben bzw.
unvollständig dargestellt. Für diesen Häufigkeitsvergleich muss die
Längenachse bei null beginnen. (1 Punkt)

### d) Stichprobenvarianz und Stichprobenstandardabweichung – 3 Punkte

Der Mittelwert ist \(\bar x=120\) s. Die Abweichungen und Quadrate sind:

| \(x_i\) in s | \(x_i-\bar x\) in s | \((x_i-\bar x)^2\) in s² |
| -----------: | ------------------: | -----------------------: |
|          100 |                 -20 |                      400 |
|          110 |                 -10 |                      100 |
|          120 |                   0 |                        0 |
|          130 |                  10 |                      100 |
|          140 |                  20 |                      400 |
|    **Summe** |               **0** |                **1.000** |

Für die Stichprobenschätzung wird durch \(n-1=4\) geteilt:

$$
s^2=\frac{1.000}{5-1}=250{,}00\ \mathrm{s}^2
$$

$$
s=\sqrt{250}=15{,}811\ldots\ \mathrm{s}
\approx15{,}81\ \mathrm{s}
$$

Die ARSnova-Anzeige beschreibt dagegen genau die fünf Werte mit Division durch
\(n\):

$$
s_{\mathrm{des}}^2=\frac{1.000}{5}=200{,}00\ \mathrm{s}^2,
\qquad
s_{\mathrm{des}}=\sqrt{200}\approx14{,}14\ \mathrm{s}.
$$

Die beiden Angaben widersprechen sich nicht; sie verwenden verschiedene
Nenner für verschiedene Ziele.

- Quadratsumme und Nenner \(n-1\) korrekt: 1 Punkt
- \(s^2=250{,}00\ \mathrm{s}^2\): 1 Punkt
- \(s\approx15{,}81\ \mathrm{s}\) und Unterschied zu Division durch \(n\)
  erklärt: 1 Punkt

### e) Interpretation von \(s\) – 2 Punkte

Musterformulierung:

> Die fünf Schätzwerte streuen nach der Stichprobenkonvention typischerweise
> um etwa 15,81 Sekunden um ihren Mittelwert von 120,00 Sekunden.

- Kontext, Kennzahl und Größenordnung: 1 Punkt
- korrekte Einheit und keine Behauptung über den exakten Abstand jedes Werts:
  1 Punkt

„Jeder Wert ist 15,81 Sekunden vom Mittelwert entfernt“ ist falsch.

---

## Lösung zu Aufgabe 2 – MC-Test, Bayes und Binomialmodell

### a) \(P(W\cup F)\) – 2 Punkte

Aus der Tabelle:

$$
P(W)=\frac{20}{100}=0{,}20,\qquad
P(F)=\frac{24}{100}=0{,}24,\qquad
P(W\cap F)=\frac{16}{100}=0{,}16.
$$

Mit der Additionsregel:

$$
P(W\cup F)
=P(W)+P(F)-P(W\cap F)
=0{,}20+0{,}24-0{,}16
=0{,}280.
$$

Kontrolle über absolute Häufigkeiten:
\((20+24-16)/100=28/100\).

- Additionsregel einschließlich Überschneidung: 1 Punkt
- Ergebnis \(0{,}280=28{,}0\,\%\): 1 Punkt

### b) Zwei bedingte Wahrscheinlichkeiten – 3 Punkte

Innerhalb der 24 markierten Antworten waren 16 falsch:

$$
P(W\mid F)=\frac{16}{24}
=0{,}666\ldots\approx0{,}667.
$$

Innerhalb der 20 falschen Antworten waren 16 markiert:

$$
P(F\mid W)=\frac{16}{20}=0{,}800.
$$

Interpretation:

> \(P(W\mid F)\) fragt nach dem Anteil falscher Antworten unter den markierten
> Fällen; \(P(F\mid W)\) fragt umgekehrt nach dem Anteil markierter Fälle unter
> den falschen Antworten. Wegen verschiedener Bezugsgruppen 24 und 20 sind
> die Werte nicht austauschbar.

- \(P(W\mid F)\approx0{,}667\): 1 Punkt
- \(P(F\mid W)=0{,}800\): 1 Punkt
- verschiedene Bedingungen und Nenner korrekt erklärt: 1 Punkt

### c) Genau zwei richtige Antworten – 2 Punkte

Für \(X\sim Bin(3;0{,}70)\):

$$
\begin{aligned}
P(X=2)
&=\binom32(0{,}70)^2(1-0{,}70)^{3-2}\\
&=3\cdot0{,}49\cdot0{,}30\\
&=0{,}441.
\end{aligned}
$$

- richtige Binomialformel und Einsetzung: 1 Punkt
- Ergebnis \(0{,}441=44{,}1\,\%\): 1 Punkt

### d) Bedingungen des Binomialmodells – 2 Punkte

Zwei begründete Probleme:

1. **Konstantes \(p\) ist fraglich:** Lösungsquoten von 0,42 bis 0,90 zeigen,
   dass Items unterschiedlich schwierig sind. (1 Punkt)
2. **Unabhängigkeit ist fraglich:** Mehrere Antworten derselben Person können
   durch Wissen, Ermüdung oder Lerneffekte zusammenhängen. (1 Punkt)

Die feste Itemzahl und die zwei Ausgänge „richtig/falsch“ sind dagegen
grundsätzlich erfüllbar.

---

## Lösung zu Aufgabe 3 – Unsicherheit und Konfidenzintervalle

### a) Anteil und Standardfehler – 2 Punkte

$$
\hat p=\frac{37}{52}
=0{,}711538\ldots
\approx0{,}712.
$$

$$
\begin{aligned}
SE(\hat p)
&=\sqrt{\frac{\hat p(1-\hat p)}{n}}\\
&=\sqrt{\frac{(37/52)(15/52)}{52}}\\
&=0{,}062826\ldots\\
&\approx0{,}063.
\end{aligned}
$$

- \(\hat p\approx0{,}712\): 1 Punkt
- \(SE(\hat p)\approx0{,}063\): 1 Punkt

Der Standardfehler wird berechnet; die bereitgestellten Wilson-Grenzen werden
nicht durch ein Wald-Intervall ersetzt.

### b) Wilson-Intervall interpretieren – 2 Punkte

Musterformulierung:

> Auf Grundlage der 52 Antworten reicht das ausdrücklich mit dem
> Wilson-Verfahren bestimmte 95-%-Konfidenzintervall für den modellierten
> zugrunde liegenden Anteil korrekter Antworten von 0,577 bis 0,817, also von
> 57,7 % bis 81,7 %.

Ergänzend korrekt:

> Bei sehr vielen gleichartigen Stichproben würden ungefähr 95 % der nach
> diesem Verfahren gebildeten Intervalle den festen Populationsanteil
> enthalten.

- Parameter, Kontext und Grenzen: 1 Punkt
- Unsicherheit als Verfahrensaussage, nicht als Personenanteil oder sichere
  Behauptung: 1 Punkt

### c) Zwei Fehler der Aussage – 2 Punkte

Je ein Punkt für zwei fachlich getrennte Einwände:

1. Das Intervall beschreibt plausible Werte **eines Anteilsparameters**. Es
   sagt nicht, dass 95 % einzelner Studierender zwischen zwei Prozentwerten
   liegen.
2. Die 52 freiwillig bzw. gelegenheitsbedingt Antwortenden sind nicht
   automatisch repräsentativ für alle BWL-Studierenden. Das Wilson-Verfahren
   behandelt Stichprobenunsicherheit, nicht Selbstselektion,
   Nonresponse oder unklare Zielpopulationen.

Ebenfalls anerkennbar ist der präzise Hinweis, dass die Daten nur eine konkrete
Frage bzw. Erhebung betreffen und keinen individuellen Anteil „der Fragen“
über einen nicht definierten Test bestimmen.

### d) \(t\)-Konfidenzintervall für die mittlere Servicezeit – 3 Punkte

Zunächst der Standardfehler:

$$
SE(\bar x)=\frac{s}{\sqrt n}
=\frac{15}{\sqrt{12}}
=4{,}330127\ldots\ \mathrm{s}.
$$

Fehlerspanne:

$$
t_{0{,}975;11}\cdot SE(\bar x)
=2{,}201\cdot4{,}330127\ldots
=9{,}530610\ldots\ \mathrm{s}.
$$

Intervall:

$$
\begin{aligned}
KI_\mu
&=120{,}00\pm9{,}530610\\
&=[110{,}469390;\ 129{,}530610]\ \mathrm{s}\\
&\approx[110{,}47;\ 129{,}53]\ \mathrm{s}.
\end{aligned}
$$

Musterinterpretation:

> Unter den Modellvoraussetzungen reichen die mit diesen Lehrdaten
> vereinbaren Werte für die mittlere Servicezeit der betrachteten Population
> bei 95-%-Konfidenzniveau von 110,47 bis 129,53 Sekunden.

- Standardfehler bzw. Fehlerspanne korrekt: 1 Punkt
- beide Intervallgrenzen mit Einheit korrekt: 1 Punkt
- Interpretation bezieht sich auf den Populationsmittelwert: 1 Punkt

---

## Lösung zu Aufgabe 4 – Gepaarter \(t\)-Test

### a) Paarung und Vorzeichen – 2 Punkte

Die beiden Fehlerwerte gehören jeweils zur **gleichen Person** vor und nach
der Diskussion; diese Zuordnung erzeugt die Paare. (1 Punkt)

Weil \(d_i=\lvert Fehler_{i,R1}\rvert-\lvert Fehler_{i,R2}\rvert\) definiert
ist, bedeutet \(d_i>0\), dass der absolute Fehler in Runde 2 kleiner war:
Die Schätzung hat sich nach dieser Fehlerdefinition verbessert. (1 Punkt)

### b) Hypothesen – 2 Punkte

$$
H_0:\mu_d=0
$$

$$
H_1:\mu_d\ne0
$$

- Nullhypothese einschließlich Parameter: 1 Punkt
- zweiseitige Alternativhypothese: 1 Punkt

Eine einseitige Hypothese erhält hier nicht die volle Punktzahl, weil die
Aufgabe und die JASP-Ausgabe ausdrücklich zweiseitig sind.

### c) Standardfehler und Teststatistik – 2 Punkte

$$
SE(\bar d)=\frac{s_d}{\sqrt n}
=\frac{5}{\sqrt{10}}
=1{,}581138\ldots
\approx1{,}581.
$$

$$
t=\frac{\bar d-0}{SE(\bar d)}
=\frac{4}{1{,}581138\ldots}
=2{,}529822\ldots
\approx2{,}530.
$$

Beide Werte stimmen bis auf Rundung mit JASP überein.

- \(SE(\bar d)\approx1{,}581\): 1 Punkt
- \(t\approx2{,}530\) und Vergleich: 1 Punkt

### d) Entscheidung und Interpretation – 2 Punkte

Beide zulässigen Entscheidungswege führen zum selben Ergebnis:

$$
p=0{,}032<\alpha=0{,}05
$$

oder

$$
\lvert t\rvert=2{,}530>t_{0{,}975;9}=2{,}262.
$$

Damit wird \(H_0\) auf dem 5-%-Niveau verworfen. (1 Punkt)

Musterinterpretation:

> In den zehn vollständigen Paaren war der absolute Schätzfehler in Runde 2
> im Mittel um 4,00 Sekunden kleiner als in Runde 1; der zweiseitige Test
> liefert mit \(t(9)=2{,}530\) und \(p=0{,}032\) Evidenz gegen eine mittlere
> Differenz von null.

(1 Punkt)

Der \(p\)-Wert ist nicht die Wahrscheinlichkeit, dass \(H_0\) wahr ist.

### e) Grenze der Kausalaussage – 1 Punkt

Ein konkreter Grund genügt, beispielsweise:

- Es gibt keine Kontrollgruppe; Übung oder Wiederholung könnten die Änderung
  mitverursacht haben.
- Personen derselben Diskussionsgruppe können abhängig sein, obwohl der
  einfache Test unabhängige Paare voraussetzt.
- Ausfälle zwischen den Runden können die vollständigen Paare selektiv machen.
- Referenzkenntnis oder andere zeitgleiche Einflüsse wurden nicht
  kontrolliert.

Der Test zeigt eine statistisch auffällige mittlere Differenz unter seinem
Modell, isoliert aber keine Ursache.

---

## Lösung zu Aufgabe 5 – Korrelation, Regression und Transfer

### a) Pearson-Korrelation – 2 Punkte

Mit \(r=0{,}840\) liegt in diesen zwölf synthetischen Läufen ein starker
positiver linearer Stichprobenzusammenhang vor: Höhere Werte gleichzeitiger
Nutzungen gehen tendenziell mit höheren Medianlatenzen einher. (1 Punkt)

Die Kennzahl allein beweist nicht, dass eine höhere Nutzung die Latenz
verursacht. Störgrößen, Messdesign und die synthetische Datenherkunft bleiben
zu berücksichtigen. (1 Punkt)

### b) Koeffizienten – 2 Punkte

Die Steigung \(b_1=0{,}180\) bedeutet:

> Innerhalb des linearen Lehrmodells steigt die vorhergesagte Medianlatenz je
> zusätzlicher gleichzeitiger Nutzung um 0,180 Millisekunden.

(1 Punkt)

Der Achsenabschnitt \(b_0=40{,}000\) ms ist die rechnerische Vorhersage bei
\(x=0\). Der beobachtete Bereich beginnt aber bei \(x=100\); daher muss
\(b_0\) keine beobachtete oder sachlich sinnvolle Betriebssituation
beschreiben. (1 Punkt)

### c) Vorhersage und Residuum – 3 Punkte

Regressionsgerade:

$$
\hat y=40+0{,}180x.
$$

Für \(x=300\):

$$
\hat y=40+0{,}180\cdot300
=40+54
=94{,}00\ \mathrm{ms}.
$$

Residuum:

$$
e=y-\hat y
=100-94
=+6{,}00\ \mathrm{ms}.
$$

Das positive Residuum bedeutet, dass die beobachtete Medianlatenz 6,00 ms
**über** der Modellvorhersage liegt.

- richtige Gerade und Vorhersage \(94{,}00\) ms: 1 Punkt
- Residuum \(+6{,}00\) ms mit richtiger Reihenfolge: 1 Punkt
- Vorzeichen korrekt interpretiert: 1 Punkt

### d) Einwände gegen die Produktionsprognose – 2 Punkte

Je ein Punkt für zwei fachlich unterschiedliche Einwände:

1. \(x=900\) liegt außerhalb des beobachteten Bereichs 100 bis 500. Das ist
   eine ungesicherte Extrapolation; der Zusammenhang muss dort nicht linear
   bleiben.
2. Es handelt sich um zwölf synthetische Lehrläufe, nicht um eine validierte
   Produktionsmessung.
3. Eine Regressionsgerade liefert eine Punktschätzung, keine sichere
   Einzelvorhersage; Residualstreuung und Vorhersageintervall fehlen.
4. Veränderte Hardware, Requestmischung oder andere Lastbedingungen können
   die Übertragung verhindern.

Das bloße Einsetzen in eine Gerade beseitigt keine Modell- und
Generaliserungsunsicherheit.

---

## Lösung zu Aufgabe 6 – Klassifikationsmetriken und Managementbefund

### a) Zellen der Confusion Matrix – 2 Punkte

Da „Technik“ die positive Klasse ist:

| tatsächliche Klasse | vorhergesagt: Technik | vorhergesagt: Nicht-Technik |
| ------------------- | --------------------: | --------------------------: |
| Technik             |             \(TP=36\) |                    \(FN=4\) |
| Nicht-Technik       |              \(FP=9\) |                   \(TN=51\) |

Je 0,5 Punkte pro korrekt zugeordneter Zelle.

### b) Vier Metriken – 4 Punkte

**Accuracy**

$$
Accuracy
=\frac{TP+TN}{TP+TN+FP+FN}
=\frac{36+51}{100}
=0{,}870.
$$

**Precision**

$$
Precision
=\frac{TP}{TP+FP}
=\frac{36}{36+9}
=\frac{36}{45}
=0{,}800.
$$

**Recall**

$$
Recall
=\frac{TP}{TP+FN}
=\frac{36}{36+4}
=\frac{36}{40}
=0{,}900.
$$

**F1**

$$
\begin{aligned}
F1
&=2\cdot\frac{Precision\cdot Recall}{Precision+Recall}\\
&=2\cdot\frac{0{,}800\cdot0{,}900}{0{,}800+0{,}900}\\
&=\frac{1{,}440}{1{,}700}\\
&=0{,}847058\ldots\\
&\approx0{,}847.
\end{aligned}
$$

Äquivalente Kontrolle:

$$
F1=\frac{2TP}{2TP+FP+FN}
=\frac{72}{72+9+4}
=\frac{72}{85}
\approx0{,}847.
$$

Je 1 Punkt für Formel, korrekten Nenner und richtiges Ergebnis jeder Metrik.

### c) Zielmetrik bei teuren False Negatives – 2 Punkte

Vorrangig ist **Recall**, weil

$$
Recall=\frac{TP}{TP+FN}
$$

direkt misst, welcher Anteil der tatsächlich technischen Fälle erkannt wird.
Ein höherer Recall reduziert bei sonst vergleichbaren Bedingungen den Anteil
übersehener technischer Fälle \(FN\). (1 Punkt für Auswahl, 1 Punkt für
Begründung)

Precision bleibt als Nebenbedingung relevant, weil unnötige Prüfungen durch
\(FP\) ebenfalls Aufwand verursachen; sie ist laut Aufgabe aber nicht die
vorrangige Fehlkostenperspektive.

### d) Training gegenüber Test – 2 Punkte

Die Accuracy sinkt von 0,98 auf 0,87:

$$
0{,}98-0{,}87=0{,}11
$$

also um 11 Prozentpunkte. Das ist mit **Overfitting** vereinbar: Das Modell
passt sich möglicherweise stärker an Trainingsdaten an, als es auf neue Fälle
generalisiert. (1 Punkt)

Der Unterschied beweist Overfitting jedoch nicht. Stichprobenschwankung,
unterschiedliche Klassenanteile oder Domain Shift können ebenfalls beitragen;
zudem ist nur eine Teststichprobe gezeigt. (1 Punkt)

### e) Managementbefund – 2 Punkte

Eine mögliche Zwei-Satz-Lösung:

> Auf den 100 synthetischen Testfällen erreicht das Modell 87,0 % Accuracy und
> 90,0 % Recall für technische Fälle; bei hohen Kosten übersehener Technikfälle
> sollte deshalb Recall vorrangig überwacht und die Schwelle gegen den
> Prüfaufwand abgewogen werden. Die kleine synthetische Testauswertung belegt
> keine Produktionsqualität und muss vor einem realen Einsatz mit
> repräsentativen neuen Fällen wiederholt werden.

- mindestens eine korrekte Testmetrik und daraus abgeleitete, bedingte
  Handlung: 1 Punkt
- konkrete Daten- oder Übertragungsgrenze ohne Produktionsversprechen:
  1 Punkt

---

## Rechnerische Kontrollwerte

Diese Werte dienen der Korrekturkontrolle und sind nicht zusätzlich zu
bepunkten:

| Größe                                             | ungerundeter bzw. kontrollierter Wert |
| ------------------------------------------------- | ------------------------------------: |
| Wilson-Intervall zu \(37/52\), \(z=1{,}96\)       |                [0,5772695; 0,8167020] |
| \(SE(\bar x)\) bei \(s=15,n=12\)                  |                             4,3301270 |
| \(t\)-KI-Fehlerspanne bei \(t=2{,}201\)           |                             9,5306096 |
| gepaarter Test \(t\) bei \(\bar d=4,s_d=5,n=10\)  |                             2,5298221 |
| zweiseitiger \(p\)-Wert zu \(t=2{,}5298221,df=9\) |                             0,0322448 |
| \(0{,}840^2\)                                     |                                0,7056 |
| F1 bei \(TP=36,FP=9,FN=4\)                        |                             0,8470588 |
