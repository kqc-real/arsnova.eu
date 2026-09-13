# P0-03 – Barrierefreiheit: Materialalternativen und praktische Probe

**Version:** 1.1.0 · **Stand:** 13.09.2026<br>
**Status:** verbindliche Materialanforderung; operative Probe vor Pilotstart offen

**Bezugsdokumente:** [Lehrenden-Runbook](./P0-03_Lehrenden_Runbook.md) · [Materialpaket](./P0-03_Materialpaket_Pilotlauf.md) · [Produkt-A11y-Audit](../../praktikum/ACCESSIBILITY-AUDIT-WCAG-2.2-AA.md)

## 1. Geltungsbereich und Aussagegrenze

Dieses Dokument operationalisiert den barrierearmen Zugang zu den **Lehrmaterialien und Lehrabläufen** des Statistikpiloten. Es ersetzt weder einen individuellen Nachteilsausgleich noch eine vollständige WCAG-2.2-AA- oder PDF/UA-Zertifizierung der beteiligten Produkte.

Gleichwertig bedeutet:

- dasselbe Lernziel und derselbe fachliche Anspruch,
- dieselben Informationen, Zahlen, Lösungen und Aussagegrenzen,
- keine Noten- oder Teilnahmenachteile durch den gewählten Zugang,
- ausreichend Zeit ohne technischen Countdown,
- eine Antwortmöglichkeit ohne persönliches Gerät.

Ein Fallback ist nicht gleichwertig, wenn entscheidende Informationen nur über Farbe, Position, Animation, ein Bild oder eine nicht vorgelesene Formel zugänglich sind.

## 2. Materialübergreifende Mindestregeln

1. Digitale Texte verwenden echte Überschriften, Listen und beschriftete Tabellen statt visueller Leerzeichenstrukturen.
2. Jede Tabelle besitzt eindeutige Spalten- und Zeilenbezeichnungen. Vor dem Lesen werden Beobachtungseinheit, Nenner und Einheit genannt.
3. Jede Grafik besitzt Titel, Achsenbezeichnungen, Einheiten, Legende und eine textliche Kernaussage. Farbe ist nie der einzige Bedeutungsträger.
4. Formeln werden zusätzlich in linearer Lesereihenfolge erläutert, beispielsweise: »Standardfehler gleich Stichprobenstandardabweichung geteilt durch Quadratwurzel aus n«.
5. Die Druckfassung verwendet mindestens 12 pt, gut unterscheidbare Zeichen, sichtbare Fokus- beziehungsweise Auswahlmarkierungen und eine auch in Graustufen verständliche Gestaltung.
6. Inhalte bleiben bei 200 % Vergrößerung und auf schmalem Bildschirm ohne Verlust der Aufgabeninformation nutzbar; horizontales Scrollen komplexer Tabellen wird durch eine lineare Textalternative vermieden.
7. Es gibt in ARSnova und MC-Test keinen technischen Timer. Notwendige individuelle Pausen oder institutionell genehmigte Zeitverlängerungen werden nicht durch die Werkzeuge verhindert.
8. Links werden mit aussagekräftigem Text bezeichnet. Dateiname, Version und Quellenstatus sind im Dokument selbst lesbar.

## 3. Matrix gleichwertiger Alternativen

| Materialklasse        | Regulärer Zugang                           | Gleichwertige Alternative                                                                                                                          | Verbindliche Gleichheitskontrolle                                                                        | Rolle  |
| --------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| ARSnova-Livefrage     | browserbasierte Einzelabgabe               | gedruckte Frage, Vorlesen, anonyme A–D-/Mehrfachwahlkarten oder unbeschrifteter Zahlenzettel, aggregierter Zählbogen                               | identischer Wortlaut/Optionen; gleiche Denkzeit; keine öffentliche Handzeichenabfrage; Runden getrennt   | LD     |
| MC-Test               | Streamlit im Modus `practice`              | gedruckte Fragenansicht mit getrenntem Lösungs-/Erklärungsblatt oder zugängliches Dokument im institutionellen Lernraum                            | alle 30 Items, Optionen, Erklärungen und Glossare; kein Timer; keine Rangliste; Selbstkontrolle möglich  | MP, IR |
| Kursorientierung      | strukturierte Studierendenbeschreibung     | zugängliche HTML-/Dokumentfassung oder kontrastreiche 12-pt-Papierfassung                                                                          | Umfang, Ziele, Toolrollen, Prüfung, Datenverwendung, Links und Unterstützungswege inhaltlich vollständig | MV, LD |
| Repository-Ausschnitt | kuratierter öffentlicher GitHub-Direktlink | strukturierter lokaler HTML-/PDF-/Druckauszug mit Kontext und linearer Lesereihenfolge                                                             | Referenzcommit, Pfad, Definition, Kennzahl und Aussagegrenze entsprechen dem verlinkten Nachweis         | DJ, MV |
| Mathematikdiagnostik  | digitale Markdown-/HTML-Ansicht            | identische Papierfassung mit Lösungs- und Brückenpfadblatt                                                                                         | 12 Aufgabenpunkte, sechs Diagnoseblöcke und Selbstzuordnung unverändert; keine Ergebnisabgabe            | LD     |
| JASP-Arbeit           | Bedienung von JASP 0.98.1                  | vorab mit derselben Version erzeugter HTML-/PDF-Auszug plus linear gesetzte Kerntabelle und textliche Grafikaussage                                | Dateiname, `source_ref`, \(n\), Kennwert, Einheit, Rundung und Grenze stimmen mit Referenzoutput überein | DJ     |
| Lehrdaten/Tabellen    | CSV in JASP oder Tabellenansicht           | UTF-8-CSV plus beschriftete lineare Tabelle oder zeilenweise Textfassung der aufgabenrelevanten Werte                                              | keine ausgelassene Zeile/Zelle; fehlende Werte ausdrücklich bezeichnet; Zeilen-/Spaltenlogik vorgelesen  | DJ     |
| Formelsammlung        | digitale Markdown-/Druckansicht            | identische kontrastreiche Druckfassung sowie lineare Vorlesefassung der benötigten Formel                                                          | gleiche Formeln, kritische Werte, Konventionen, Warnungen und Rundungsregeln                             | MV     |
| Transferaufgaben      | Kurzblatt, Projektion oder Partnerarbeit   | vorgelesene und gedruckte BWL-/WI-Variante                                                                                                         | Zahlen, Kernhandlung, Schwierigkeit und Erwartungshorizont des Aufgabenpaars bleiben gleich              | IR, QE |
| Statistikbefund       | digitale Vorlage und JASP-Anhang           | zugängliche Textvorlage; Kerntabellen und Grafikaussagen als strukturierter Text                                                                   | Rubrikkriterien, Seitenumfang und fachliche Evidenz gleich; Darstellungsform selbst wird nicht bewertet  | QE     |
| Probeklausur          | schriftliche Standardfassung               | institutionell genehmigte, inhaltlich und zeitlich äquivalente Fassung, z. B. vergrößert, digital zugänglich oder mit linearisierten JASP-Tabellen | identische Aufgaben, Daten, Punkte und Hilfsmittel; individueller Nachteilsausgleich hat Vorrang         | MV     |
| Blitzlicht/SURVEY     | freiwillige browserbasierte Eingabe        | anonymer Papierzettel, mündliche private Rückmeldung oder Auslassung ohne Nachteil                                                                 | keine richtige Lösung, kein Gruppendruck, kein Personenbezug                                             | LD     |

Die papierbasierte Alternative wird vor der Sitzung erzeugt und nicht erst bei einer Störung improvisiert. Bei mehreren zugänglichen Wegen entscheiden Lernende selbst, ohne die Wahl begründen zu müssen.

## 4. Spezifische Anforderungen

### 4.1 Formeln und Formelsammlung

- Formelname und Zweck stehen vor dem Ausdruck.
- Alle Zeichen werden unmittelbar definiert.
- Bruchstrich, Wurzel, Hochstellung und Indizes werden in einer linearen Lesefassung erklärt.
- Tabellenköpfe wiederholen sich bei Seitenumbrüchen.
- Ein Seitenumbruch trennt keine Formel von ihren Größen, Voraussetzungen, Einheiten oder Warnungen.

### 4.2 JASP-Ausgaben

Für jede in Lehre, Befund oder Probeklausur verwendete Ausgabe liegen vor:

1. Tabellenname und Analyseart,
2. Variablen und deren Reihenfolge,
3. \(n\), fehlende beziehungsweise ausgeschlossene Fälle,
4. die für die Aufgabe erforderlichen Zellen in linearer Textform,
5. Einheit und Rundung,
6. eine textliche Kernaussage jeder Grafik,
7. mindestens eine Aussagegrenze.

Eine farbige Markierung, ein Sternsymbol oder die räumliche Lage einer Zelle darf nie die einzige Quelle der fachlichen Information sein.

### 4.3 Live- und MC-Fragen

- Frage, Optionen und Formel sind vollständig vorlesbar.
- Abkürzungen werden beim ersten Auftreten ausgeschrieben.
- Antwortoptionen unterscheiden sich nicht nur durch Farbe oder Position.
- Lange Tabellen werden vor der Abstimmung erklärt oder als Handout ausgegeben.
- Sofortfeedback umfasst Lösung **und** Begründung; die Papierfassung stellt beides auf einem getrennten Blatt bereit.

### 4.4 Probeklausur und Nachteilsausgleich

Die Probeklausur ist ein Materialtest, kein Ersatz für die Entscheidung der zuständigen Prüfungsstelle. Genehmigte individuelle Maßnahmen können unter anderem vergrößerte Darstellung, zugängliches digitales Dokument, assistive Technik, zusätzlichen Raum oder Zeitverlängerung umfassen. Fachlicher Anspruch, Punktzahl und prüfbare Lernziele bleiben unverändert.

## 5. Praktische A11y-Materialprobe vor Pilotstart

Die Probe wird mit der tatsächlich vorgesehenen Paketversion, Hardware, Projektion, ARSnova-Instanz, MC-Test-Instanz und JASP-Ausgabe durchgeführt. Mindestens LD und QE nehmen teil; DJ prüft die JASP-/Tabellenpunkte, MV die Probeklausur.

| ID      | Praktischer Prüfschritt                                                                       | Bestanden, wenn                                                                    | Ergebnis/Datum/Nachweis |
| ------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| A11Y-01 | Eine Livefrage vollständig nur mit Papierkarten und Zählbogen durchführen                     | gleiche Optionen, Denkzeit, anonyme Abgabe und Rundenlogik wie digital             | offen                   |
| A11Y-02 | Eine MC-Frage ohne Gerät bearbeiten und Feedback prüfen                                       | Frage, Lösung, Erklärung und Glossar vollständig; kein Timer/Rang                  | offen                   |
| A11Y-03 | Tastatur- und 200-%-Zoom-Stichprobe in ARSnova und MC-Test                                    | Fokus sichtbar; Frage, Optionen und Feedback erreichbar; kein Informationsverlust  | offen                   |
| A11Y-04 | VoiceOver- oder gleichwertige Screenreader-Stichprobe mit je einer Live-, MC- und Formelfrage | Lesereihenfolge, Bezeichnungen und Formelerläuterung verständlich                  | offen                   |
| A11Y-05 | Projektion aus der hinteren Sitzposition sowie Graustufen-Druck prüfen                        | Schrift/Formeln lesbar; Bedeutung ohne Farbe; keine abgeschnittene Information     | offen                   |
| A11Y-06 | Einen JASP-Plot und eine Tabelle ohne Bild beziehungsweise Farbe erklären                     | lineare Kerntabelle und textliche Grafikaussage erlauben dieselbe Lösung           | offen                   |
| A11Y-07 | Formelsammlung in 12-pt-Druck und bei 200 % lesen                                             | Formel, Größen, Voraussetzungen, Einheit und Warnung bleiben zusammen verständlich | offen                   |
| A11Y-08 | Probeklausur-Aufgaben 3–6 in der Alternativfassung lösen lassen                               | alle Daten und JASP-Werte vorhanden; identische Punkte und Richtzeit plausibel     | offen                   |
| A11Y-09 | W01-Mathematikdiagnostik digital und auf Papier vergleichen                                   | identische Aufgaben, Lösungen, Blockzuordnung und Brückenpfade                     | offen                   |
| A11Y-10 | Offline-Fallback mit einer Person in alternativer Teilnahme durchführen                       | Wechsel ohne öffentliche Identifikation oder Verlust der Lernhandlung              | offen                   |

### 5.1 Freigabeentscheidung

Die A11y-Materialprobe ist bestanden, wenn:

- alle zehn Prüfschritte mit Datum, Paketversion und prüfender Rolle dokumentiert sind,
- kein Unterschied in Lernziel, Zahlen, Lösung oder Punktwert besteht,
- kein Zugang einen persönlichen Gerätebesitz, Farberkennung oder öffentlichen Antwortzwang voraussetzt,
- festgestellte Barrieren vor Pilotstart korrigiert und erneut geprüft wurden.

| Angabe               | Eintrag                             |
| -------------------- | ----------------------------------- |
| Paketversion         |                                     |
| Datum und Raum/Setup |                                     |
| LD                   |                                     |
| QE                   |                                     |
| DJ                   |                                     |
| MV                   |                                     |
| offene Abweichungen  |                                     |
| Gesamtstatus         | offen / bestanden / nicht bestanden |

Ein leerer oder nur dokumentarisch ausgefüllter Prüfpunkt gilt nicht als bestanden. Das [QA-Protokoll](./P0-03_QA_Freigabeprotokoll.md) darf das A11y-Gate erst nach diesem praktischen Nachweis schließen.
