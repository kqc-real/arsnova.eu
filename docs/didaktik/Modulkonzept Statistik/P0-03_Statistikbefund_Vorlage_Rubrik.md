# Statistikbefund – ausfüllbare Vorlage und analytische Rubrik

**Kürzel vorab:** **S1–S6** bezeichnet die Fallstudienstränge, **W01–W10** die Kurswochen, **UE** eine 45-minütige Unterrichtseinheit, **LIVE/REPO/LEHRDATEN** Kursdaten, versionierte Repository-Nachweise und synthetische Lehrdaten, **MC** Multiple Choice sowie **`source_ref`** die Quellenkennung eines Datensatzes. **V1** bezeichnet in den Feldern zu Variablenkatalog und Analyseplan deren erste Arbeitsversion, nicht die curriculare Vertiefung V1.

- **Einsatz im Modul:** formatives Abschlussprodukt des 48-UE-Moduls, getrennt
  von der schriftlichen Einzelprüfung
- **Bewertungsstatus:** standardmäßig formative Rückmeldung mit der
  analytischen Rubrik
- **Analysesoftware:** JASP
- **Arbeitsform:** Gruppenanalyse mit individuell nachweisbarer Leistung

## Einsatz- und Datennutzungsrahmen

Im Modul werden Statistikbefund und analytische Rubrik standardmäßig
**formativ** genutzt. LIVE-Daten dürfen dabei für Lern- und Feedbackzwecke
analysiert werden; die Rubrikpunkte strukturieren die Rückmeldung und sind
keine Prüfungsnote. Die separate schriftliche Einzelprüfung prüft individuelle
Kompetenz unabhängig vom Gruppenbefund und verwendet ausschließlich die dafür
freigegebenen Klausur-Lehrdaten. Formative LIVE-Auswertungen werden nicht in
sie übernommen.

Falls eine Institution den Befund abweichend **summativ** nutzt, sind
ausschließlich institutionell freigegebene **LEHRDATEN** oder **REPO**-Daten
mit dokumentierter Quellenreferenz und Datenversion zulässig. Zusätzlich muss
jede bewertete Person eine eigenständige individuelle Evidenzkarte einreichen.
**ARSnova-Daten, MC-Test-Daten und sonstige LIVE-Daten sind für diese summative
Nutzung ausgeschlossen.**

## 1. Abgabeformat

Die Abgabe besteht aus drei getrennt erkennbaren Teilen:

1. **Gruppenbefund:** genau eine A4-Seite einschließlich Management Summary;
2. **Analyseanhang:** höchstens zwei Seiten mit lesbaren JASP-Auszügen,
   Rechennachweis und Datenprotokoll;
3. **individuelle Evidenzkarte:** höchstens eine Seite je Person.

Zusätzlich wird die zugehörige `.jasp`-Datei abgegeben. Personenbezogene
Rohdaten, Sessioncodes und Klarnamen aus Live-Daten gehören nicht in den
Befund.

### Identifikation der Abgabe

| Angabe                       | Eintrag            |
| ---------------------------- | ------------------ |
| Kurztitel des Befunds        |                    |
| Kurs und Semester            |                    |
| Gruppenkennung               |                    |
| gewählter Abschlussstrang    | S1 / S5 / S6       |
| verbindliche Strangwahl seit | W03                |
| Variablenkatalog V1 geprüft  | W01: ja / offen    |
| Analyseplan V1 dokumentiert  | W06: Datum/Version |
| vollständiger Befundentwurf  | W09: Datum/Version |
| Abgabedatum                  |                    |
| Datenstand/Version           |                    |
| `source_ref` der Kerndaten   |                    |
| JASP-Version                 |                    |
| Name der `.jasp`-Datei       |                    |

### Gruppen- und Individualzuordnung

| Person bzw. prüfungsgeeignetes Kürzel | verantworteter Analyseschritt | Kennung der individuellen Evidenzkarte |
| ------------------------------------- | ----------------------------- | -------------------------------------- |
|                                       |                               |                                        |
|                                       |                               |                                        |
|                                       |                               |                                        |
|                                       |                               |                                        |

---

## 2. Ausfüllbare Vorlage für den Gruppenbefund

### 2.1 Untersuchungsfrage und Aussageziel

**Untersuchungsfrage:**

---

---

**Zielparameter oder Zielkennzahl:**

---

**Art der beabsichtigten Aussage:**

- [ ] Beschreibung der vorliegenden Daten
- [ ] Schätzung eines Populationsparameters
- [ ] Vergleich gepaarter Messungen
- [ ] Untersuchung eines linearen Zusammenhangs
- [ ] Vorhersage mit einfacher linearer Regression
- [ ] Bewertung einer binären Klassifikation

**Eine stärkere Aussage, die das Design nicht erlaubt:**

---

### 2.2 Population, Stichprobe und Beobachtungseinheit

| Element                                         | präzise Festlegung |
| ----------------------------------------------- | ------------------ |
| Zielpopulation                                  |                    |
| tatsächlich untersuchte Stichprobe              |                    |
| Beobachtungseinheit einer Tabellenzeile         |                    |
| Erhebungs- oder Auswahlverfahren                |                    |
| ausgewertetes \(n\)                             |                    |
| davon vollständige Paare \(n_{\mathrm{Paare}}\) |                    |
| fehlende bzw. ausgeschlossene Fälle             |                    |

Eingeschriebene Personen, anwesende Personen, verbundene Geräte, abgegebene
Antworten und vollständige Paare werden nicht gleichgesetzt.

### 2.3 Datenherkunft und Variablen

**Quellenstatus:**

- [ ] **LIVE** – im Kurs erhoben; ausschließlich für formative Kursnutzung
- [ ] **REPO** – dokumentierter Repository-Messlauf
- [ ] **LEHRDATEN** – ausdrücklich konstruierter Datensatz

**Quellenreferenz, Erhebungsdatum und Aggregationsrunde:**

---

---

| Variable | Rolle                      | Skalenniveau | Einheit/Kategorien | zulässige Werte |
| -------- | -------------------------- | ------------ | ------------------ | --------------- |
|          | Zielvariable               |              |                    |                 |
|          | erklärende/Gruppenvariable |              |                    |                 |
|          | weitere relevante Variable |              |                    |                 |

**Datenschutz- und Minimierungsentscheidung:**

---

### 2.4 Datenprüfung und Aufbereitung

| Prüfung                      | Befund | transparente Entscheidung |
| ---------------------------- | ------ | ------------------------- |
| fehlende Werte               |        |                           |
| unplausible Werte            |        |                           |
| mögliche Ausreißer           |        |                           |
| Duplikate/Paarzuordnung      |        |                           |
| Filter und Ausschlüsse       |        |                           |
| Nenner und Aggregationsrunde |        |                           |

Keine Beobachtung wird allein wegen eines unerwünschten Ergebnisses entfernt.
Boxplot-Grenzen sind Prüfsignale und keine automatische Löschregel.

### 2.5 Analyseplan vor Ergebnisinterpretation

**Gewählte Darstellung:**

---

**Gewählte deskriptive Kennzahlen mit Begründung:**

---

---

**Gewähltes inferenzstatistisches oder modellbezogenes Verfahren:**

- [ ] ausdrücklich bezeichnetes Wilson-Leseintervall für einen Anteil
- [ ] Wald-Näherungsintervall für einen Anteil bei erfüllter Lehrregel
- [ ] \(t\)-Konfidenzintervall für einen Mittelwert
- [ ] gepaarter \(t\)-Test
- [ ] Pearson-Korrelation und einfache lineare Regression
- [ ] Confusion Matrix mit Accuracy, Precision, Recall und F1

**Warum passt das Verfahren zu Frage, Skalen und Design?**

---

---

**Geprüfte Voraussetzungen und Ergebnis der Prüfung:**

---

---

**Vorab festgelegte Entscheidungen:**

| Entscheidung              | Eintrag |
| ------------------------- | ------- |
| \(\alpha\)                |         |
| Konfidenzniveau           |         |
| positive Klasse           |         |
| Differenzrichtung \(d_i\) |         |

Nicht benötigte Einträge bleiben leer; die fachlich erforderlichen
Entscheidungen müssen vor der Ergebnisdeutung feststehen.

### 2.6 Ergebnisse

**Abbildung oder Tabelle mit Nummer und Titel:**

---

**Textliche Kernaussage der Darstellung:**

---

---

| Ergebnisart                  | Wert mit Rundung | Einheit | \(n\)/Nenner |
| ---------------------------- | ---------------: | ------- | -----------: |
| Lagekennzahl                 |                  |         |              |
| Streuungskennzahl            |                  |         |              |
| Anteil/Häufigkeit            |                  |         |              |
| weitere deskriptive Kennzahl |                  |         |              |

**Zentrales Inferenz- oder Modellergebnis:**

---

---

Dabei werden die Verfahren benannt, zum Beispiel:

- „95-%-**Wilson**-Konfidenzintervall \([L;U]\)“,
- „95-%-\(t\)-Konfidenzintervall für \(\mu\)“,
- „gepaarter \(t\)-Test: \(t(df)=\ldots,\ p=\ldots\)“,
- „Pearson-\(r\), Regressionsgerade und Residuum“,
- „Accuracy, Precision, Recall und F1 auf den Testdaten“.

**Manuelle Plausibilitätskontrolle eines Schlüsselwerts:**

---

---

### 2.7 Interpretation und Grenzen

**Antwort auf die Untersuchungsfrage in Alltagssprache:**

---

---

**Statistische und praktische Bedeutung getrennt:**

---

---

**Konkrete Einschränkung 1 und mögliche Auswirkung auf die Aussage:**

---

---

**Konkrete Einschränkung 2 und mögliche Auswirkung auf die Aussage:**

---

---

**Bedingte Handlungsempfehlung:**

---

---

### 2.8 Management Summary – höchstens fünf Sätze

Die fünf Satzfunktionen dürfen zusammengezogen werden, keine darf durch ein
Schlagwort ersetzt werden:

1. Fragestellung und Datenbasis:
   ***
2. wichtigstes deskriptives Ergebnis:
   ***
3. Unsicherheit, Test- oder Modellergebnis:
   ***
4. bedingte Handlungskonsequenz:
   ***
5. wichtigste Grenze:
   ***

### 2.9 Reproduzierbarkeit

| Nachweis                                | Eintrag |
| --------------------------------------- | ------- |
| Datenquelle und Datenversion            |         |
| JASP-Datei und Analysebezeichnung       |         |
| aktive Filter/Ausschlüsse               |         |
| Variablenrollen und positive Klasse     |         |
| Rundungsregel                           |         |
| Seiten-/Tabellenverweis auf JASP-Auszug |         |

---

## 3. Individuelle Evidenzkarte

Jede Person reicht eine **eigene** Evidenzkarte ein. Die drei Nachweise müssen
einen eindeutig zugeordneten Analyseschritt betreffen. Wortgleiche oder nur
umbenannte Karten mehrerer Personen gelten nicht als individuelle Evidenz.

### Kopf

| Angabe                                | Eintrag |
| ------------------------------------- | ------- |
| Person bzw. prüfungsgeeignetes Kürzel |         |
| Gruppenkennung                        |         |
| Evidenzkennung                        |         |
| eigener Analyseschritt                |         |

### Nachweis A – JASP-Ausgabe eigenständig lesen

**Ausgabe, Tabelle, Zeile und Zelle:**

---

**Abgelesener Wert einschließlich \(n\), Einheit oder Klasse:**

---

**Eigene Interpretation in zwei bis drei Sätzen:**

---

---

---

### Nachweis B – Schlüsselwert unabhängig prüfen

**Geprüfte Kennzahl und verwendete Formel:**

---

**Einsetzung mit Zähler, Nenner und ungerundeten Zwischenwerten:**

---

---

**Ergebnis und Vergleich mit JASP:**

---

### Nachweis C – Aussagegrenze beurteilen

**Eine mögliche Fehlinterpretation:**

---

**Fachliche Korrektur und konkrete Datengrenze:**

---

---

### Eigener Beitrag und Reflexion

**Nachvollziehbarer eigener Beitrag zum Gruppenbefund:**

---

---

**Eine Analyseentscheidung, die ich beibehalten oder ändern würde, mit
Begründung:**

---

---

---

---

## 4. Abgabecheck

### Fachlich

- [ ] Untersuchungsfrage, Zielpopulation, Stichprobe und Beobachtungseinheit sind
      eindeutig.
- [ ] Jede Variable hat Skalenniveau und Einheit bzw. Kategorien.
- [ ] Alle berichteten Anteile nennen Zähler und Nenner.
- [ ] \(n\), fehlende Fälle und bei Paaranalysen \(n_{\mathrm{Paare}}\) sind
      sichtbar.
- [ ] Deskriptive Division durch \(n\) und Stichprobenschätzung mit \(n-1\)
      werden nicht verwechselt.
- [ ] Darstellung, Kennzahlen und Verfahren passen zu Frage und Skalen.
- [ ] Voraussetzungen sind geprüft und nicht nur aufgezählt.
- [ ] Wilson und Wald sind eindeutig bezeichnet; ein Wilson-Leseintervall
      wurde nicht mit Wald nachgerechnet.
- [ ] Rundungen erfolgten erst nach der Rechnung mit ungerundeten Werten.
- [ ] Einheiten, Vorzeichen und Größenordnungen wurden geprüft.
- [ ] Korrelation wird nicht als Kausalität bezeichnet.
- [ ] Testsignifikanz, praktische Bedeutung und Übertragbarkeit sind getrennt.
- [ ] Bei Klassifikation sind positive Klasse und Nullnenner-Konvention klar.

### Reproduzierbarkeit und Kommunikation

- [ ] Quellenstatus LIVE, REPO oder LEHRDATEN ist angegeben; LIVE wird nur
      formativ genutzt.
- [ ] JASP-Datei, Datenstand, Filter und Variablenrollen sind dokumentiert.
- [ ] JASP-Auszüge sind lesbar und im Text eindeutig referenziert.
- [ ] Mindestens ein Schlüsselwert wurde manuell plausibilisiert.
- [ ] Abbildung und Tabelle haben Titel, Beschriftung, Einheit und textliche
      Kernaussage.
- [ ] Die Management Summary umfasst höchstens fünf vollständige Sätze.
- [ ] Mindestens zwei konkrete Einschränkungen samt Auswirkung sind genannt.
- [ ] Jede Person hat eine eigenständige Evidenzkarte.
- [ ] Es werden keine personenbezogenen Live-Rohdaten oder Zugangsdaten
      offengelegt.

---

## 5. Analytische Bewertungsrubrik

### 5.1 Bewertungslogik

- Im Modul dienen die Punktwerte der Rubrik der formativen Diagnose und
  Rückmeldung; sie sind keine Prüfungsnote.
- Bei institutionell geregelter summativer Nutzung gelten der Einsatz- und
  Datennutzungsrahmen sowie die Pflicht zur individuellen Evidenzkarte.
- Die Kategorien A bis H bewerten den Gruppenbefund und ergeben gemeinsam
  höchstens 90 Punkte.
- Kategorie I wird je Person getrennt bewertet und ergibt höchstens 10 Punkte.
- Innerhalb jedes Kriteriums werden Punkte in Schritten von 0,5 vergeben:
  **volle Punktzahl** bei vollständiger, korrekter und nachvollziehbarer
  Evidenz; **halbe Punktzahl** bei fachlich brauchbarer, aber wesentlich
  unvollständiger Evidenz; **0 Punkte** bei fehlender, nicht prüfbarer oder
  fachlich falscher Evidenz.
- Derselbe Mangel wird nicht mehrfach abgezogen. Bewertet wird dort, wo er
  fachlich hauptsächlich hingehört.

### A. Untersuchungsfrage und Untersuchungsdesign – 10 Punkte

| prüfbare Evidenz                                                                           | Punkte |
| ------------------------------------------------------------------------------------------ | -----: |
| präzise, mit den vorhandenen Daten beantwortbare Untersuchungsfrage und klare Zielkennzahl |      3 |
| Zielpopulation, tatsächliche Stichprobe und Erhebungs-/Auswahlweg korrekt getrennt         |      2 |
| Beobachtungseinheit, Variablen, Skalenniveaus und Einheiten korrekt                        |      2 |
| Aussageziel passt zum Design; eine unzulässige stärkere Aussage wird benannt               |      3 |
| **Maximum A**                                                                              | **10** |

### B. Datenherkunft, Qualität und Nenner – 12 Punkte

| prüfbare Evidenz                                                                                    | Punkte |
| --------------------------------------------------------------------------------------------------- | -----: |
| Quellenstatus LIVE (nur formativ), REPO/LEHRDATEN, Referenz, Datum und Datenversion nachvollziehbar |      3 |
| gültiges \(n\), fehlende Werte, Ausschlüsse und gegebenenfalls vollständige Paare transparent       |      3 |
| Prüf-, Bereinigungs- und Filterentscheidungen sind reproduzierbar und sachlich begründet            |      3 |
| Auswahlverzerrung, Datenschutz, Aggregationsrunde und Datenherkunft werden angemessen begrenzt      |      3 |
| **Maximum B**                                                                                       | **12** |

### C. Deskriptive Analyse und Darstellung – 12 Punkte

| prüfbare Evidenz                                                                       | Punkte |
| -------------------------------------------------------------------------------------- | -----: |
| Grafik oder Tabelle passt zu Skalenniveau und Fragestellung                            |      3 |
| Titel, Achsen, Kategorien, Einheit, Quelle und textliche Kernaussage vollständig       |      2 |
| Lage-, Streuungs- und Häufigkeitskennzahlen rechnerisch korrekt                        |      4 |
| Kennzahlenwahl, Nenner sowie robuste gegenüber ausreißerempfindlichen Größen begründet |      3 |
| **Maximum C**                                                                          | **12** |

### D. Verfahrenswahl und Voraussetzungen – 12 Punkte

| prüfbare Evidenz                                                                                     | Punkte |
| ---------------------------------------------------------------------------------------------------- | -----: |
| inferenzstatistisches oder modellbezogenes Verfahren passt zu Frage, Skalen und Design               |      4 |
| konkrete Voraussetzungen werden mit Daten oder Grafik geprüft und zutreffend beurteilt               |      4 |
| Konfidenzniveau, \(\alpha\), Hypothesen, Differenzrichtung oder positive Klasse sind vorab eindeutig |      2 |
| Grenzen des Verfahrens bzw. eine sachlich mögliche Alternative werden erklärt                        |      2 |
| **Maximum D**                                                                                        | **12** |

### E. JASP und Reproduzierbarkeit – 10 Punkte

| prüfbare Evidenz                                                                                            | Punkte |
| ----------------------------------------------------------------------------------------------------------- | -----: |
| lauffähige `.jasp`-Datei, JASP-Version, Datenstand und Analysebezeichnungen stimmen mit dem Bericht überein |      3 |
| Variablenrollen, Filter, Ausschlüsse und relevante Einstellungen sind reproduzierbar dokumentiert           |      3 |
| lesbarer JASP-Auszug ist eindeutig der berichteten Aussage zugeordnet                                       |      2 |
| mindestens ein Schlüsselwert wird unabhängig und korrekt plausibilisiert                                    |      2 |
| **Maximum E**                                                                                               | **10** |

### F. Ergebnisse, Unsicherheit und Rechengenauigkeit – 14 Punkte

| prüfbare Evidenz                                                                                                | Punkte |
| --------------------------------------------------------------------------------------------------------------- | -----: |
| Punktschätzer und deskriptive Ergebnisse enthalten \(n\), Nenner und Einheit                                    |      3 |
| Intervall, Test oder Modell ist vollständig berichtet; Wilson/Wald bzw. Testdatensatz sind eindeutig bezeichnet |      4 |
| Einsetzung, Vorzeichen, Nullnenner-Konvention und Rundung sind rechnerisch korrekt                              |      3 |
| Ergebnissatz deutet Größe und Richtung im Kontext und trennt statistische von praktischer Bedeutung             |      4 |
| **Maximum F**                                                                                                   | **14** |

### G. Schlussfolgerung, Grenzen und Handlung – 12 Punkte

| prüfbare Evidenz                                                                               | Punkte |
| ---------------------------------------------------------------------------------------------- | -----: |
| Schlussfolgerung beantwortet die Untersuchungsfrage direkt und datenbasiert                    |      3 |
| keine unzulässige Kausal-, Repräsentativitäts- oder Produktionsaussage                         |      3 |
| mindestens zwei konkrete Einschränkungen werden jeweils mit ihrer möglichen Auswirkung erklärt |      3 |
| Handlungsempfehlung ist bedingt, adressatengerecht und durch die Ergebnisse gedeckt            |      3 |
| **Maximum G**                                                                                  | **12** |

### H. Management Summary und Darstellung – 8 Punkte

| prüfbare Evidenz                                                                        | Punkte |
| --------------------------------------------------------------------------------------- | -----: |
| höchstens fünf Sätze decken Frage/Daten, Ergebnis, Unsicherheit, Handlung und Grenze ab |      4 |
| klare Struktur, knappe Sprache und erklärte Fachbegriffe                                |      2 |
| Abbildungen, Tabellen, Quellen und Anhänge sind eindeutig referenziert                  |      2 |
| **Maximum H**                                                                           |  **8** |

### I. Individuelle Evidenz – 10 Punkte je Person

| prüfbare Evidenz                                                                           | Punkte |
| ------------------------------------------------------------------------------------------ | -----: |
| eigener JASP-Ausschnitt wird mit Wert, Nenner/Einheit und korrekter Interpretation erklärt |      3 |
| ein Schlüsselwert wird mit Formel, Einsetzung und Vergleich eigenständig geprüft           |      3 |
| eine Fehlinterpretation wird erkannt und mit konkreter Datengrenze korrigiert              |      2 |
| eigener Beitrag und begründete Reflexion einer Analyseentscheidung sind nachvollziehbar    |      2 |
| **Maximum I**                                                                              | **10** |

### 5.2 Gesamtpunktzahl

$$
Gesamt=A+B+C+D+E+F+G+H+I
$$

|  Punkte | Leistungsbeschreibung                          |
| ------: | ---------------------------------------------- |
|  90–100 | sehr sicher, vollständig und adressatengerecht |
| 75–89,5 | fachlich tragfähig mit kleineren Lücken        |
| 60–74,5 | Mindeststandard insgesamt erreicht             |
|  0–59,5 | Mindeststandard insgesamt nicht erreicht       |

Im formativen Einsatz beschreiben die Bereiche den Lernstand und strukturieren
die Rückmeldung. Nur bei institutionell geregelter summativer Nutzung richtet
sich eine Umrechnung in Modulnoten nach der jeweils geltenden Prüfungsordnung
und dem oben festgelegten Datennutzungsrahmen.

### 5.3 Verbindlicher Mindeststandard

Der Mindeststandard ist nur erreicht, wenn **alle** folgenden Bedingungen
erfüllt sind:

1. mindestens **60 von 100 Punkten** insgesamt;
2. mindestens **6 von 12 Punkten** in Kategorie B
   „Datenherkunft, Qualität und Nenner“;
3. zusammen mindestens **20 von 36 Punkten** in den Kategorien D, E und F
   „Verfahren, JASP und Ergebnisse“;
4. mindestens **7 von 14 Punkten** in Kategorie F
   „Ergebnisse, Unsicherheit und Rechengenauigkeit“;
5. je Person mindestens **6 von 10 Punkten** in Kategorie I
   „Individuelle Evidenz“.

Damit kann ein sprachlich ansprechender Bericht keine methodisch unbrauchbare
Analyse ausgleichen, und eine starke Gruppenleistung ersetzt nicht den
individuellen Kompetenznachweis.

Nicht prüfbare oder falsch zugeordnete Datenherkunft sowie eine nicht
eigenständige Evidenzkarte müssen vor einer fachlichen Bewertung geklärt
werden. Die übrige Gruppenleistung wird dadurch nicht automatisch anderen
Personen zugerechnet.
