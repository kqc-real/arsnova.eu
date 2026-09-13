# Formelsammlung – Angewandte Statistik

- **Geltungsbereich:** Pflichtkern des 48-UE-Moduls für BWL, Management,
  Wirtschaftsinformatik und Informatik
- **Arbeitsmittel in der Klausur:** diese Formelsammlung und ein nicht
  programmierbarer Taschenrechner
- **Analyseumgebung in Lehrveranstaltung und Fallstudie:** JASP

## 0. So wird die Formelsammlung benutzt

Zu jedem Formelblock stehen:

- **Größen:** Bedeutung der Zeichen,
- **Voraussetzungen:** wann die Formel passt,
- **Einheit:** Einheit des Ergebnisses,
- **Warnung:** häufigster Anwendungs- oder Interpretationsfehler.

Alle benötigten kritischen \(z\)- und \(t\)-Werte werden in der jeweiligen
Aufgabe angegeben. Zur Orientierung:

| Zweiseitiges Konfidenzniveau | \(z_{1-\alpha/2}\) |
| ---------------------------- | -----------------: |
| 90 %                         |              1,645 |
| 95 %                         |              1,960 |
| 99 %                         |              2,576 |

Für \(t\)-Werte müssen zusätzlich die Freiheitsgrade bekannt sein. Es ist keine
Tabelle auswendig zu lernen.

### Notation und Rundung

- \(n\): Zahl der tatsächlich ausgewerteten Beobachtungen; bei gepaarten
  Analysen Zahl der **vollständigen Paare**.
- \(x_i,y_i\): beobachtete Werte; \(\bar x,\bar y\): Stichprobenmittelwerte.
- \(\mu,\sigma\): Mittelwert und Standardabweichung einer Grundgesamtheit bzw.
  eines ausdrücklich vorgegebenen Modells.
- \(s\): mit \(n-1\) geschätzte Stichprobenstandardabweichung.
- \(\hat p\): beobachteter Stichprobenanteil.
- Zwischenwerte ungerundet weiterverwenden. Endergebnisse, sofern nicht anders
  verlangt: Anteile auf drei Dezimalen, Prozente auf eine Dezimalstelle,
  Messwerte auf zwei Dezimalstellen, \(t\), \(r\) und Regressionswerte auf drei
  Dezimalen. Ein \(p\)-Wert unter 0,001 wird als \(p<0{,}001\) berichtet.
- Jede Zahl erhält ihren Nenner, ihre Einheit und – bei gerundeten Ergebnissen –
  ein Näherungszeichen.

---

## 1. Häufigkeiten, Lage und Streuung

### 1.1 Absolute und relative Häufigkeit

$$
h_i=\frac{n_i}{n},
\qquad
h_i(\%)=100\cdot h_i
$$

- **Größen:** \(n_i\) = Zahl der Beobachtungen in Kategorie \(i\);
  \(n\) = Bezugsgröße; \(h_i\) = relativer Anteil.
- **Voraussetzungen:** Zähler und Nenner beziehen sich auf dieselbe
  Beobachtungseinheit und Auswahl.
- **Einheit:** \(h_i\) ist einheitenlos; \(h_i(\%)\) wird in Prozent angegeben.
- **Warnung:** Bei Multiple Choice können Personen mehrere Optionen nennen;
  Optionsanteile müssen dann nicht 100 % ergeben. Immer den tatsächlichen
  Nenner nennen.

### 1.2 Arithmetisches Mittel

$$
\bar x=\frac{1}{n}\sum_{i=1}^{n}x_i
$$

- **Größen:** \(x_i\) = metrischer Einzelwert; \(n\) = Zahl gültiger Werte;
  \(\sum\) = alle angegebenen Werte addieren.
- **Voraussetzungen:** metrische Werte; der Mittelwert ist für die Fragestellung
  inhaltlich sinnvoll.
- **Einheit:** dieselbe Einheit wie \(x\).
- **Warnung:** Ausreißer und Schiefe können \(\bar x\) stark beeinflussen.
  Fehlende Werte werden nicht als null eingesetzt.

### 1.3 Median und Modalwert

Für sortierte Werte \(x_{(1)}\le \dots\le x_{(n)}\):

$$
\widetilde x=
\begin{cases}
x_{\left(\frac{n+1}{2}\right)}, & n\text{ ungerade},\\[4pt]
\dfrac{x_{\left(\frac n2\right)}+x_{\left(\frac n2+1\right)}}{2},
& n\text{ gerade}.
\end{cases}
$$

Der Modalwert ist die am häufigsten beobachtete Ausprägung.

- **Größen:** \(x_{(j)}\) = Wert an sortierter Position \(j\);
  \(\widetilde x=Q_2\) = Median.
- **Voraussetzungen:** Median mindestens ordinales Skalenniveau; Mittelung der
  beiden mittleren Werte nur bei metrischen Werten. Modalwert ab nominalem
  Skalenniveau.
- **Einheit:** Median und Modalwert haben die Einheit bzw. Kategorie von \(x\).
- **Warnung:** Vor der Medianbestimmung sortieren. Es kann keinen, einen oder
  mehrere Modalwerte geben.

### 1.4 Spannweite

$$
R=x_{\max}-x_{\min}
$$

- **Größen:** \(x_{\max}\) = größter, \(x_{\min}\) = kleinster gültiger Wert.
- **Voraussetzungen:** metrische Daten.
- **Einheit:** dieselbe Einheit wie \(x\).
- **Warnung:** \(R\) verwendet nur zwei Werte und reagiert sehr stark auf
  Ausreißer.

### 1.5 Quartile und Interquartilsabstand

$$
IQR=Q_3-Q_1
$$

- **Größen:** \(Q_1\) = 25-%-Quantil; \(Q_3\) = 75-%-Quantil;
  \(IQR\) = Breite der mittleren 50 %.
- **Voraussetzungen:** mindestens ordinale Daten; die Quartilskonvention stammt
  aus der Aufgabe oder aus der benannten JASP-Ausgabe.
- **Einheit:** dieselbe Einheit wie \(x\).
- **Warnung:** Es existieren mehrere korrekte Quartilskonventionen. Nicht
  unbemerkt Werte aus verschiedenen Konventionen mischen.

Explorative Boxplot-Grenzen:

$$
G_{\mathrm{unten}}=Q_1-1{,}5\cdot IQR,
\qquad
G_{\mathrm{oben}}=Q_3+1{,}5\cdot IQR
$$

- **Größen:** \(G_{\mathrm{unten}},G_{\mathrm{oben}}\) = rechnerische
  Prüfgrenzen.
- **Voraussetzungen:** Quartile und \(IQR\) wurden mit derselben Konvention
  bestimmt.
- **Einheit:** dieselbe Einheit wie \(x\).
- **Warnung:** Ein Wert außerhalb der Grenzen ist ein Prüfsignal, kein
  automatischer Löschgrund.

### 1.6 Deskriptive Varianz und Standardabweichung: Division durch \(n\)

$$
s_{\mathrm{des}}^2
=\frac{1}{n}\sum_{i=1}^{n}(x_i-\bar x)^2,
\qquad
s_{\mathrm{des}}=\sqrt{s_{\mathrm{des}}^2}
$$

- **Größen:** \(s_{\mathrm{des}}^2\) = Varianz der vollständig beschriebenen
  vorliegenden Werte; \(s_{\mathrm{des}}\) = zugehörige Standardabweichung.
- **Voraussetzungen:** metrische Daten; Ziel ist die reine Beschreibung genau
  dieser beobachteten Wertemenge.
- **Einheit:** Varianz in \((\text{Einheit von }x)^2\);
  Standardabweichung in der Einheit von \(x\).
- **Warnung:** Dieser Nenner ist nicht der übliche unverzerrte Schätzer für
  eine unbekannte Populationsvarianz. Die ARSnova-Zusammenfassung numerischer
  Schätzungen verwendet für die deskriptive Varianz \(n\).

### 1.7 Stichprobenvarianz und -standardabweichung: Division durch \(n-1\)

$$
s^2=\frac{1}{n-1}\sum_{i=1}^{n}(x_i-\bar x)^2,
\qquad
s=\sqrt{s^2}
$$

- **Größen:** \(s^2\) = Stichprobenschätzer der Varianz; \(s\) = geschätzte
  Standardabweichung; \(n-1\) = Freiheitsgrade.
- **Voraussetzungen:** metrische Daten, \(n>1\); die vorliegenden Werte werden
  als Stichprobe für eine größere Population bzw. für Inferenz behandelt.
- **Einheit:** \(s^2\) in \((\text{Einheit von }x)^2\); \(s\) in der Einheit
  von \(x\).
- **Warnung:** Nicht mit \(s_{\mathrm{des}}\) verwechseln. Für
  Standardfehler, Mittelwertintervalle und \(t\)-Tests wird in diesem Modul
  \(s\) mit \(n-1\) verwendet.

Für dieselben ungerundeten Werte gilt:

$$
s^2=s_{\mathrm{des}}^2\frac{n}{n-1},
\qquad
s=s_{\mathrm{des}}\sqrt{\frac{n}{n-1}}
$$

- **Größen:** wie oben.
- **Voraussetzungen:** Beide Kennzahlen beruhen auf exakt denselben gültigen
  Einzelwerten und demselben Mittelwert; \(n>1\).
- **Einheit:** links und rechts jeweils dieselbe Varianz- bzw. Maßeinheit.
- **Warnung:** Bereits gerundete Softwarewerte erzeugen kleine
  Rundungsabweichungen.

---

## 2. Wahrscheinlichkeit und Verteilungen

Für jedes Ereignis \(A\) gilt \(0\le P(A)\le1\).

### 2.1 Additionsregel

$$
P(A\cup B)=P(A)+P(B)-P(A\cap B)
$$

- **Größen:** \(A\cup B\) = „\(A\) oder \(B\) oder beide“;
  \(A\cap B\) = „\(A\) und \(B\)“.
- **Voraussetzungen:** \(A\) und \(B\) gehören zum selben Zufallsexperiment.
- **Einheit:** einheitenlose Wahrscheinlichkeit bzw. Prozent.
- **Warnung:** Die Überschneidung wird sonst doppelt gezählt.

Für disjunkte Ereignisse mit \(A\cap B=\varnothing\):

$$
P(A\cup B)=P(A)+P(B)
$$

- **Größen:** wie oben.
- **Voraussetzungen:** \(A\) und \(B\) können nicht gleichzeitig eintreten.
- **Einheit:** einheitenlos.
- **Warnung:** „Disjunkt“ ist nicht dasselbe wie „unabhängig“.

### 2.2 Gegenereignis

$$
P(\overline A)=1-P(A)
$$

- **Größen:** \(\overline A\) = „\(A\) tritt nicht ein“.
- **Voraussetzungen:** \(A\) und \(\overline A\) decken alle möglichen
  Ergebnisse ab.
- **Einheit:** einheitenlos.
- **Warnung:** Das Gegenereignis muss vollständig formuliert sein; zu
  „mindestens eins“ gehört „kein einziges“.

### 2.3 Bedingte Wahrscheinlichkeit

$$
P(A\mid B)=\frac{P(A\cap B)}{P(B)}
\qquad\text{für }P(B)>0
$$

- **Größen:** \(P(A\mid B)\) = Wahrscheinlichkeit von \(A\) innerhalb der
  Bezugsgruppe \(B\).
- **Voraussetzungen:** \(P(B)>0\); Zähler und Nenner beziehen sich auf dieselbe
  bedingte Bezugsgruppe.
- **Einheit:** einheitenlos.
- **Warnung:** Im Allgemeinen gilt
  \(P(A\mid B)\ne P(B\mid A)\). Der Nenner steht rechts vom Strich.

### 2.4 Multiplikationsregel und Unabhängigkeit

$$
P(A\cap B)=P(A\mid B)\cdot P(B)
$$

- **Größen:** wie in Abschnitt 2.3.
- **Voraussetzungen:** \(P(B)>0\).
- **Einheit:** einheitenlos.
- **Warnung:** \(P(A\mid B)\) darf nur bei nachgewiesener oder modellhaft
  gesetzter Unabhängigkeit durch \(P(A)\) ersetzt werden.

Bei unabhängigen Ereignissen:

$$
P(A\cap B)=P(A)\cdot P(B)
$$

- **Größen:** \(A,B\) = unabhängige Ereignisse.
- **Voraussetzungen:** Das Eintreten des einen Ereignisses verändert die
  Wahrscheinlichkeit des anderen nicht.
- **Einheit:** einheitenlos.
- **Warnung:** Gleiche Randwahrscheinlichkeiten beweisen keine
  Unabhängigkeit.

### 2.5 Satz der totalen Wahrscheinlichkeit und Bayes

Für die Aufteilung \(A,\overline A\):

$$
P(B)=P(B\mid A)P(A)+P(B\mid\overline A)P(\overline A)
$$

- **Größen:** Die beiden Summanden sind die disjunkten Wege zu \(B\).
- **Voraussetzungen:** \(A\) und \(\overline A\) bilden eine vollständige
  Aufteilung; die verwendeten Bedingungen sind definiert.
- **Einheit:** einheitenlos.
- **Warnung:** Basisraten \(P(A)\) und \(P(\overline A)\) nicht weglassen.

Bayes-Regel:

$$
P(A\mid B)
=\frac{P(B\mid A)P(A)}{P(B)}
=\frac{P(B\mid A)P(A)}
{P(B\mid A)P(A)+P(B\mid\overline A)P(\overline A)}
$$

- **Größen:** \(P(A)\) = Basisrate; \(P(B\mid A)\) = Trefferwahrscheinlichkeit;
  \(P(A\mid B)\) = gesuchte umgekehrte Bedingung.
- **Voraussetzungen:** \(P(B)>0\); die Aufteilung und Wahrscheinlichkeiten
  beziehen sich auf dieselbe Population.
- **Einheit:** einheitenlos.
- **Warnung:** Eine hohe Trefferwahrscheinlichkeit
  \(P(B\mid A)\) garantiert bei seltener Basisrate keine hohe
  \(P(A\mid B)\). Eine Vierfeldertafel mit absoluten Häufigkeiten ist oft der
  sicherste Rechenweg.

### 2.6 Binomialverteilung

Binomialkoeffizient:

$$
\binom nk=\frac{n!}{k!(n-k)!}
$$

- **Größen:** \(n\) = feste Versuchszahl; \(k\) = Zahl der Erfolge,
  \(k\in\{0,\dots,n\}\).
- **Voraussetzungen:** \(n,k\) sind nichtnegative ganze Zahlen und \(k\le n\).
- **Einheit:** einheitenlose Anzahl möglicher Anordnungen.
- **Warnung:** \(0!=1\). Der Binomialkoeffizient allein ist noch keine
  Wahrscheinlichkeit.

Für \(X\sim Bin(n,p)\):

$$
P(X=k)=\binom nk p^k(1-p)^{n-k}
$$

- **Größen:** \(X\) = Anzahl der Erfolge; \(p\) = konstante
  Erfolgswahrscheinlichkeit je Versuch.
- **Voraussetzungen:** feste Zahl \(n\), genau zwei Ausgänge je Versuch,
  konstantes \(p\), unabhängige Versuche.
- **Einheit:** einheitenlose Wahrscheinlichkeit.
- **Warnung:** Unterschiedlich schwierige MC-Aufgaben oder wiederholte
  Antworten derselben Person können konstantes \(p\) bzw. Unabhängigkeit
  verletzen.

Erwartungswert und Standardabweichung:

$$
E(X)=np,
\qquad
\sigma_X=\sqrt{np(1-p)}
$$

- **Größen:** \(E(X)\) = langfristig erwartete Erfolgszahl;
  \(\sigma_X\) = Streuung der Erfolgszahl.
- **Voraussetzungen:** dasselbe Binomialmodell wie oben.
- **Einheit:** Anzahl Erfolge.
- **Warnung:** \(E(X)\) muss keine mögliche ganze Beobachtung sein.

Mindestens ein Erfolg:

$$
P(X\ge1)=1-P(X=0)=1-(1-p)^n
$$

- **Größen:** wie oben.
- **Voraussetzungen:** dasselbe Binomialmodell wie oben.
- **Einheit:** einheitenlose Wahrscheinlichkeit.
- **Warnung:** Das Gegenereignis zu „mindestens ein Erfolg“ ist „kein Erfolg“,
  nicht „genau ein Misserfolg“.

### 2.7 Standardisierung

$$
z=\frac{x-\mu}{\sigma}
$$

- **Größen:** \(x\) = Beobachtung; \(\mu,\sigma\) = Mittelwert und positive
  Standardabweichung der angegebenen Referenzverteilung.
- **Voraussetzungen:** metrische Daten; \(\sigma>0\). Wahrscheinlichkeiten aus
  \(z\) nur dann ableiten, wenn das Verteilungsmodell dies erlaubt.
- **Einheit:** \(z\) ist einheitenlos.
- **Warnung:** Standardisieren macht eine schiefe Verteilung nicht normal.

---

## 3. Standardfehler, Konfidenzintervalle und Testen

Ein Standardfehler beschreibt die modellbedingte Streuung eines
**Stichprobenschätzers**, nicht die Streuung der Einzelwerte.

### 3.1 Geschätzter Standardfehler des Mittelwerts

$$
SE(\bar x)=\frac{s}{\sqrt n}
$$

- **Größen:** \(s\) = Stichprobenstandardabweichung mit \(n-1\);
  \(n\) = Zahl unabhängiger gültiger Beobachtungen.
- **Voraussetzungen:** metrische Daten; Beobachtungen im verwendeten
  Stichprobenmodell unabhängig.
- **Einheit:** dieselbe Einheit wie \(x\).
- **Warnung:** Nicht \(s_{\mathrm{des}}\) aus einer durch \(n\) geteilten
  ARSnova-Anzeige ungeprüft einsetzen. Größeres \(n\) verringert den
  Standardfehler, beseitigt aber keine Auswahlverzerrung.

### 3.2 Geschätzter Standardfehler eines Anteils

$$
SE(\hat p)=\sqrt{\frac{\hat p(1-\hat p)}{n}}
$$

- **Größen:** \(\hat p=x/n\) = beobachteter Anteil; \(x\) = Erfolgszahl.
- **Voraussetzungen:** binäres Merkmal und modellhaft unabhängige
  Beobachtungen.
- **Einheit:** einheitenloser Anteil.
- **Warnung:** Der Standardfehler ist keine Fehlerrate und kein
  Konfidenzintervall.

### 3.3 Wald-Konfidenzintervall für einen Anteil

$$
KI_{\mathrm{Wald}}
=\hat p\pm z_{1-\alpha/2}\sqrt{\frac{\hat p(1-\hat p)}{n}}
$$

- **Größen:** \(\alpha\) = Irrtumsniveau;
  \(z_{1-\alpha/2}\) = in der Aufgabe angegebener kritischer Wert.
- **Voraussetzungen:** binäre, modellhaft unabhängige Beobachtungen; Lehrregel
  für die Näherung: \(n\hat p\ge10\) und \(n(1-\hat p)\ge10\).
- **Einheit:** einheitenloser Anteil bzw. nach Multiplikation mit 100 Prozent.
- **Warnung:** **Wald** ausdrücklich benennen. Bei kleinem \(n\) oder Anteilen
  nahe 0 bzw. 1 kann es unzuverlässig sein und sogar Grenzen außerhalb
  \([0;1]\) liefern. Dann nicht willkürlich abschneiden, sondern ein
  bereitgestelltes Wilson-Intervall lesen.

### 3.4 Wilson-Konfidenzintervall – ausdrücklich nur als Leseintervall

In Aufgaben erscheint beispielsweise:

$$
\text{95-%-Wilson-KI für }p=[L_W;U_W]
$$

- **Größen:** \(L_W\) = Wilson-Untergrenze; \(U_W\) = Wilson-Obergrenze;
  \(\hat p=x/n\) bleibt der beobachtete Punktwert.
- **Voraussetzungen:** Die Ausgabe bezeichnet das Intervall ausdrücklich als
  **Wilson-Konfidenzintervall** und nennt Zähler, Nenner und Konfidenzniveau.
- **Einheit:** einheitenloser Anteil bzw. Prozent.
- **Warnung:** In diesem Modul wird Wilson **abgelesen, nicht mit der
  Wald-Formel nachgerechnet**. Eine einzelne Wilson-Untergrenze aus einem
  Ranking ist weder \(\hat p\) noch ein vollständiges Intervall. Ein Intervall
  korrigiert keine Selbstselektion.

Sichere Interpretation eines 95-%-Intervalls:

> Das Verfahren erzeugt bei sehr vielen gleichartigen Stichproben in ungefähr
> 95 % der Fälle Intervalle, die den festen Populationsparameter enthalten.
> Für die vorliegenden Daten reichen die mit dem Modell vereinbaren
> Parameterwerte von der Unter- bis zur Obergrenze.

Nicht korrekt ist: „Mit 95 % Wahrscheinlichkeit liegt dieser bereits feste
Parameter in genau diesem berechneten Intervall.“

### 3.5 \(t\)-Konfidenzintervall für einen Mittelwert

$$
KI_\mu
=\bar x\pm t_{1-\alpha/2;\,n-1}\frac{s}{\sqrt n}
$$

- **Größen:** \(\bar x\) = Stichprobenmittelwert; \(s\) =
  Stichprobenstandardabweichung mit \(n-1\);
  \(t_{1-\alpha/2;\,n-1}\) = in der Aufgabe angegebener kritischer Wert.
- **Voraussetzungen:** metrische Daten, unabhängige Beobachtungen; bei kleinem
  \(n\) annähernd verträgliche Normalform ohne dominierende Ausreißer.
- **Einheit:** dieselbe Einheit wie \(x\).
- **Warnung:** Das Intervall betrifft den Populationsmittelwert, nicht 95 % der
  Einzelwerte. Repräsentativität folgt nicht aus einer schmalen Intervallbreite.

### 3.6 Gepaarter \(t\)-Test

Zuerst je vollständigem Paar:

$$
d_i=x_{i,\mathrm{vor}}-x_{i,\mathrm{nach}}
$$

Dann:

$$
\bar d=\frac1n\sum_{i=1}^{n}d_i,
\qquad
s_d=\sqrt{\frac{1}{n-1}\sum_{i=1}^{n}(d_i-\bar d)^2}
$$

$$
SE(\bar d)=\frac{s_d}{\sqrt n},
\qquad
t=\frac{\bar d-0}{s_d/\sqrt n},
\qquad
df=n-1
$$

- **Größen:** \(d_i\) = Differenz des Paares; \(\bar d\) = mittlere
  Differenz; \(s_d\) = Stichprobenstandardabweichung der Differenzen;
  \(n\) = Zahl vollständiger Paare.
- **Voraussetzungen:** echte Zuordnung vor/nach je Einheit; unabhängige Paare;
  metrische Differenzen; bei kleinem \(n\) annähernd normalverträgliche
  Differenzen ohne dominierende Ausreißer.
- **Einheit:** \(d_i,\bar d,s_d,SE(\bar d)\) in der Einheit der Messgröße;
  \(t\) und \(df\) einheitenlos.
- **Warnung:** Nicht die Standardabweichungen zweier Runden voneinander
  abziehen. Unvollständige Fälle sind keine Paare. Die Richtung von \(d_i\)
  vorab festlegen und beim Vorzeichen interpretieren.

Im ARSnova-Lehrfall gilt für absolute Schätzfehler:

$$
d_i=\lvert Fehler_{i,R1}\rvert-\lvert Fehler_{i,R2}\rvert
$$

- **Größen:** \(Fehler_{i,R1},Fehler_{i,R2}\) = Abstände der beiden
  Schätzungen derselben Person vom vorab festgelegten Referenzwert.
- **Voraussetzungen:** vollständige Paare und in beiden Runden dieselbe
  Referenz sowie dieselbe Maßeinheit.
- **Einheit:** dieselbe Einheit wie die Schätzwerte.
- **Warnung:** Durch die festgelegte Reihenfolge bedeutet ein positiver Wert
  eine Verringerung des absoluten Fehlers; das Vorzeichen nicht umgekehrt
  deuten.

Zweiseitige Hypothesen und Entscheidung:

$$
H_0:\mu_d=0,
\qquad
H_1:\mu_d\ne0
$$

$$
p\le\alpha\Rightarrow H_0\text{ verwerfen};
\qquad
p>\alpha\Rightarrow H_0\text{ nicht verwerfen}
$$

- **Größen:** \(\mu_d\) = Populationsmittel der Differenzen;
  \(p\) = unter \(H_0\) berechnete Wahrscheinlichkeit für mindestens so
  extreme Daten; \(\alpha\) = vorab gesetztes Signifikanzniveau.
- **Voraussetzungen:** Testart und Richtung wurden vor Ergebnisbetrachtung
  festgelegt.
- **Einheit:** \(p,\alpha\) einheitenlos.
- **Warnung:** \(p\) ist nicht die Wahrscheinlichkeit, dass \(H_0\) wahr ist.
  „Nicht verwerfen“ beweist \(H_0\) nicht. Signifikanz ist weder Effektgröße
  noch Kausalitätsnachweis.

---

## 4. Korrelation, lineare Regression und Residuen

### 4.1 Pearson-Korrelation

$$
r=
\frac{\sum_{i=1}^{n}(x_i-\bar x)(y_i-\bar y)}
{\sqrt{\sum_{i=1}^{n}(x_i-\bar x)^2
\cdot\sum_{i=1}^{n}(y_i-\bar y)^2}}
$$

- **Größen:** \(x_i,y_i\) = gepaarte metrische Werte;
  \(-1\le r\le1\).
- **Voraussetzungen:** gepaarte Beobachtungen, Variation in beiden Variablen;
  für sinnvolle Interpretation annähernd linearer Zusammenhang ohne
  dominierende Ausreißer.
- **Einheit:** \(r\) ist einheitenlos.
- **Warnung:** \(r=0\) schließt einen nichtlinearen Zusammenhang nicht aus.
  Korrelation beweist keine Kausalität und ist ausreißerempfindlich.

### 4.2 Steigung und Achsenabschnitt der einfachen Regression

$$
b_1=
\frac{\sum_{i=1}^{n}(x_i-\bar x)(y_i-\bar y)}
{\sum_{i=1}^{n}(x_i-\bar x)^2},
\qquad
b_0=\bar y-b_1\bar x
$$

- **Größen:** \(b_1\) = geschätzte Änderung von \(y\) je zusätzlicher Einheit
  \(x\); \(b_0\) = geschätztes \(y\) bei \(x=0\).
- **Voraussetzungen:** metrische gepaarte Daten und Variation in \(x\);
  lineares Modell ist für den betrachteten Bereich plausibel.
- **Einheit:** \(b_1\) in „Einheiten \(y\) je Einheit \(x\)“;
  \(b_0\) in der Einheit von \(y\).
- **Warnung:** \(b_0\) hat keine sinnvolle Sachinterpretation, wenn \(x=0\)
  außerhalb des beobachteten oder sachlich möglichen Bereichs liegt.

### 4.3 Regressionsgerade und Vorhersage

$$
\hat y=b_0+b_1x
$$

- **Größen:** \(\hat y\) = vom Modell vorhergesagter Wert für ein gegebenes
  \(x\).
- **Voraussetzungen:** dieselbe lineare Modellannahme wie oben; Vorhersage
  möglichst innerhalb des beobachteten \(x\)-Bereichs.
- **Einheit:** dieselbe Einheit wie \(y\).
- **Warnung:** \(\hat y\) ist keine sichere Einzelwertprognose. Extrapolation
  kann unplausibel sein.

### 4.4 Residuum

$$
e_i=y_i-\hat y_i
$$

- **Größen:** \(y_i\) = beobachteter Wert; \(\hat y_i\) = Vorhersage;
  \(e_i\) = Vorhersagefehler mit Vorzeichen.
- **Voraussetzungen:** Beobachtung und Vorhersage gehören zum selben Fall.
- **Einheit:** dieselbe Einheit wie \(y\).
- **Warnung:** Positives Residuum bedeutet: Beobachtung liegt über der
  Vorhersage. Die Reihenfolge nicht vertauschen.

### 4.5 Bestimmtheitsmaß bei einfacher Regression mit Achsenabschnitt

$$
R^2=r^2
$$

- **Größen:** \(R^2\) = Anteil der im linearen Stichprobenmodell erklärten
  Variation von \(y\).
- **Voraussetzungen:** einfache lineare Regression mit genau einem Prädiktor
  und Achsenabschnitt.
- **Einheit:** einheitenlos, häufig in Prozent.
- **Warnung:** Hohes \(R^2\) beweist weder Kausalität noch gute Vorhersage auf
  neuen Daten.

---

## 5. Binäre Klassifikation

| Tatsächliche Klasse | als positiv vorhergesagt | als negativ vorhergesagt |
| ------------------- | -----------------------: | -----------------------: |
| positiv             |    \(TP\): True Positive |   \(FN\): False Negative |
| negativ             |   \(FP\): False Positive |    \(TN\): True Negative |

„Positiv“ bezeichnet die vorab festgelegte Zielklasse, nicht automatisch ein
gutes Ergebnis.

### 5.1 Accuracy

$$
Accuracy=\frac{TP+TN}{TP+TN+FP+FN}
$$

- **Größen:** Zähler = alle korrekten Klassifikationen; Nenner = alle
  ausgewerteten Fälle.
- **Voraussetzungen:** Jeder Fall steht genau einmal in der Matrix.
- **Einheit:** einheitenloser Anteil bzw. Prozent.
- **Warnung:** Bei stark ungleichen Klassen kann hohe Accuracy trotz schlechter
  Erkennung der seltenen Zielklasse entstehen.

### 5.2 Precision

$$
Precision=\frac{TP}{TP+FP}
$$

- **Größen:** Nenner = alle als positiv vorhergesagten Fälle.
- **Voraussetzungen:** \(TP+FP>0\).
- **Einheit:** einheitenloser Anteil bzw. Prozent.
- **Warnung:** Precision beantwortet „Wie viele positive Vorhersagen waren
  richtig?“, nicht „Wie viele tatsächliche Positive wurden gefunden?“

### 5.3 Recall

$$
Recall=\frac{TP}{TP+FN}
$$

- **Größen:** Nenner = alle tatsächlich positiven Fälle.
- **Voraussetzungen:** \(TP+FN>0\).
- **Einheit:** einheitenloser Anteil bzw. Prozent.
- **Warnung:** Recall beantwortet „Wie viele tatsächliche Positive wurden
  gefunden?“, berücksichtigt aber \(FP\) nicht.

### 5.4 F1-Score

$$
F1=\frac{2TP}{2TP+FP+FN}
$$

Sind Precision und Recall definiert und ist ihre Summe positiv, gilt
gleichwertig:

$$
F1=2\cdot
\frac{Precision\cdot Recall}{Precision+Recall}
$$

- **Größen:** harmonische Zusammenfassung von Precision und Recall.
- **Voraussetzungen:** Für die Zählform gilt \(2TP+FP+FN>0\); für die
  harmonische Form müssen zusätzlich Precision und Recall definiert sowie
  \(Precision+Recall>0\) sein.
- **Einheit:** einheitenlos zwischen 0 und 1 bzw. Prozent.
- **Warnung:** F1 ignoriert \(TN\) und ist nur passend, wenn Precision und
  Recall gemeinsam wichtig sind. Klassenverteilung und Fehlkosten zusätzlich
  nennen.

### 5.5 Verbindliche Nullnenner-Konvention dieser Materialien

- Ist der Nenner einer Metrik null, wird das Ergebnis als **nicht definiert
  (n. d.)** berichtet.
- Es wird nicht eigenmächtig 0 oder 1 eingesetzt.
- Accuracy ist bei null ausgewerteten Fällen n. d.
- Precision ist ohne positive Vorhersage n. d.
- Recall ist ohne tatsächlich positiven Fall n. d.
- F1 wird über \(2TP/(2TP+FP+FN)\) bestimmt. Es ist nur dann n. d., wenn
  \(2TP+FP+FN=0\). Ist \(TP=0\), aber \(FP+FN>0\), beträgt F1 gemäß dieser
  Konvention 0.
- Gibt eine Aufgabe ausdrücklich eine andere Softwarekonvention vor, wird
  diese benannt und getrennt von der mathematischen Definition berichtet.

---

## 6. Auswahl- und Ergebniskontrolle

Vor dem Rechnen:

1. Was ist die Beobachtungseinheit?
2. Welches Skalenniveau und welche Einheit haben die Variablen?
3. Welcher Zähler und welcher Nenner gehören zur Frage?
4. Sind Beobachtungen unabhängig oder gepaart?
5. Wird nur die vorliegende Wertemenge beschrieben (\(n\)) oder aus einer
   Stichprobe geschlossen (\(n-1\))?
6. Sind die Voraussetzungen des gewählten Verfahrens plausibel?

Nach dem Rechnen:

1. Liegt eine Wahrscheinlichkeit bzw. Metrik zwischen 0 und 1?
2. Liegen Anteilsintervallgrenzen zwischen 0 und 1?
3. Stimmen Einheit, Vorzeichen und Größenordnung?
4. Wurde Wald oder Wilson eindeutig bezeichnet?
5. Wurden ungerundete Zwischenwerte verwendet?
6. Trennt der Ergebnissatz Beschreibung, Unsicherheit, praktische Bedeutung,
   Generalisierung und Kausalität?
