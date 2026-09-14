<!-- markdownlint-disable MD013 MD060 -->

# MC-Test-Blueprint für 12 Themenblöcke

**Kürzel und Fachkürzungen vorab:** **MC** bezeichnet Multiple Choice, **A11y** Barrierefreiheit (Accessibility), **ADR** einen Architecture Decision Record, **AWS** Amazon Web Services, **FinOps** Financial Operations, **GCP** Google Cloud Platform, **IAM** Identity and Access Management, **IaC** Infrastructure as Code, **ID** eine eindeutige Kennung, **JSON** JavaScript Object Notation, **LE** eine 90-minütige Lerneinheit aus zwei **UE**, **ML** maschinelles Lernen, **QA** Qualitätssicherung, **SLI/SLO** Service Level Indicator und Service Level Objective, **SRE** Site Reliability Engineering, **TB01–TB12** die zwölf stabilen Themenblöcke, **TCO** Total Cost of Ownership, **UE** eine 45-minütige Unterrichtseinheit und **I01–I30** die 30 Items einer Themenblockdatei. **6R** bezeichnet Rehost, Replatform, Repurchase, Refactor, Retire und Retain.

**Version:** 1.0.0 · **Stand:** 14.09.2026 · **Status:** normative Spezifikation für 360 anspruchsvolle formative Items

**Kanonischer Paketindex:** [Materialindex](./Materialindex.md) · **Lernzielbezug:** [Lernziel-Alignment-Matrix](./Lernziel_Alignment_Matrix.md) · **Betrieb:** [Lehrenden-Runbook](./Lehrenden_Runbook.md)

**Fixierte MC-Test-Referenz:** [Commit `b6b159555e8a228dad73dd75fd66c154a1088e28`](https://github.com/kqc-real/streamlit/tree/b6b159555e8a228dad73dd75fd66c154a1088e28) mit [`validate_sets.py`](https://github.com/kqc-real/streamlit/blob/b6b159555e8a228dad73dd75fd66c154a1088e28/validate_sets.py). Der zusätzliche, für dieses Paket strengere Vertrag wird durch [validate_module.mjs](./validate_module.mjs) geprüft.

## 1. Verbindlicher Auslieferungs- und Laufzeitvertrag

- Die Zielgruppe besteht ausschließlich aus Bachelorstudierenden der Informatik.
- Es gibt zwölf Themenblockdateien mit genau 30 Items je Datei, zusammen genau 360 Items.
- Der erste Durchlauf findet vollständig in UE 3 des jeweiligen Themenblocks statt: drei Minuten Übergang, 32 Minuten Bearbeitung und zehn Minuten aggregierte Ergebnis- und Lösungsbesprechung.
- Laufzeitmodus ist `practice` mit Sofortfeedback nach jeder Antwort und ohne technischen Countdown.
- `meta.test_duration_minutes=32` ist ausschließlich der organisatorische Planwert für die Bearbeitungsphase. Er ist weder Deadline noch technische Versuchsbegrenzung.
- In der Deployment-Konfiguration gilt `show_top5_public=false`; eine öffentliche Top-5-Anzeige ist ausgeschlossen.
- Jede Themenblockdatei enthält null leichte, zwölf mittlere und 18 schwere Items. Das entspricht `weight=2` für mittel und `weight=3` für schwer; `weight=1` kommt in keinem Item vor.
- Ein weiterer vollständiger Abruf kann ohne kalendarische Vorgabe bereitgestellt werden. Kernkonzepte werden in späteren Themenblöcken in neuen Kontexten erneut abgerufen.
- Die Durchführung verwendet unabhängig von Ort oder Medium denselben freigegebenen Fragensatz, dieselben Erklärungen, Glossare und Zeitbudgets.
- Ergebnisse dienen ausschließlich der Lehre und internen Qualitätssicherung. Sie werden nicht individuell bewertet, nicht als Prüfungszulassung genutzt, nicht zu personenbezogenen Profilen verknüpft und nicht für Forschung oder Publikation verwendet.

`practice`, Sofortfeedback, Countdown-Verhalten und `show_top5_public` sind Laufzeitkonfigurationen der Plattform und keine zusätzlichen Felder der Themenblock-JSONs. Sie müssen deshalb durch einen realen Import- und Laufzeittest bestätigt werden.

## 2. Dateien und curriculare Schwerpunkte

| Themenblock | Datei                                                                | Verbindlicher fachlicher Schwerpunkt                  |
| ----------: | -------------------------------------------------------------------- | ----------------------------------------------------- |
|        TB01 | [MC-Test_Themenblock_01.json](./MC-Test/MC-Test_Themenblock_01.json) | Grundlagen, Cloudmodelle und Shared Responsibility    |
|        TB02 | [MC-Test_Themenblock_02.json](./MC-Test/MC-Test_Themenblock_02.json) | Virtualisierung, Container, IaC und Netzwerk          |
|        TB03 | [MC-Test_Themenblock_03.json](./MC-Test/MC-Test_Themenblock_03.json) | arsnova.eu-Deployment, Härtung und Zustand            |
|        TB04 | [MC-Test_Themenblock_04.json](./MC-Test/MC-Test_Themenblock_04.json) | Serverless Computing                                  |
|        TB05 | [MC-Test_Themenblock_05.json](./MC-Test/MC-Test_Themenblock_05.json) | GCP, AWS und Azure                                    |
|        TB06 | [MC-Test_Themenblock_06.json](./MC-Test/MC-Test_Themenblock_06.json) | Daten und ML in der Cloud                             |
|        TB07 | [MC-Test_Themenblock_07.json](./MC-Test/MC-Test_Themenblock_07.json) | Storage, Datenbanken, Backup und Recovery             |
|        TB08 | [MC-Test_Themenblock_08.json](./MC-Test/MC-Test_Themenblock_08.json) | Elastizität, Skalierung und verteilte Systeme         |
|        TB09 | [MC-Test_Themenblock_09.json](./MC-Test/MC-Test_Themenblock_09.json) | IAM, Security, Observability, SRE und Resilienz       |
|        TB10 | [MC-Test_Themenblock_10.json](./MC-Test/MC-Test_Themenblock_10.json) | FinOps, Nachhaltigkeit und 6R                         |
|        TB11 | [MC-Test_Themenblock_11.json](./MC-Test/MC-Test_Themenblock_11.json) | Evidenz, ADR, Quellenkritik und Referatsargumentation |
|        TB12 | [MC-Test_Themenblock_12.json](./MC-Test/MC-Test_Themenblock_12.json) | Kumulative Synthese und Verteidigung                  |
|             | **12 Dateien mit 360 Items**                                         | **12 Themenblöcke mit insgesamt 36 UE**               |

Die Kennung eines Items wird aus Dateiname und einsbasierter Arrayposition abgeleitet. Position 7 in `MC-Test_Themenblock_04.json` entspricht `MC-TB04-I07`. Diese Kennung wird nicht als zusätzliches Feld gespeichert. Nach der Freigabe darf die Arrayreihenfolge nicht ohne neue Prüfung, neues `meta.updated` und neue Prüfsumme geändert werden.

## 3. Exakter JSON-Vertrag

### 3.1 Wurzel und Metadaten

Das Wurzelobjekt enthält ausschließlich `meta` und `questions`. `questions` ist ein Array mit genau 30 Objekten. `meta` enthält ausschließlich diese neun Felder:

```json
{
  "title": "nicht leerer Themenblocktitel",
  "target_audience": "Bachelorstudierende der Informatik im Modul Cloud Computing",
  "question_count": 30,
  "difficulty_profile": {
    "leicht": 0,
    "mittel": 12,
    "schwer": 18
  },
  "time_per_weight_minutes": {
    "1": 0.5,
    "2": 0.75,
    "3": 1.0
  },
  "additional_buffer_minutes": 5,
  "test_duration_minutes": 32,
  "language": "de",
  "updated": "JJJJ-MM-TT"
}
```

Die 32 Minuten ergeben sich als redaktioneller Planwert aus zwölf mittleren Items zu je 0,75 Minuten, 18 schweren Items zu je einer Minute und fünf zusätzlichen Minuten Puffer. Die Plattform darf daraus keinen Countdown ableiten.

### 3.2 Fragenobjekt

Jedes Item enthält ausschließlich diese neun Felder:

| Feld              | Verbindliche Regel                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `question`        | Nicht leerer, eigenständig verständlicher Fragenstamm ohne Lösungshinweis                                      |
| `options`         | Array aus genau vier eindeutigen, plausiblen und formal parallelen Antworttexten                               |
| `answer`          | Nullbasierter Ganzzahlindex `0`, `1`, `2` oder `3` der genau einen richtigen Option                            |
| `explanation`     | Eigenständige, positionsunabhängige Erklärung mit Lösung, Fehlerabgrenzung und Transfer; mindestens 80 Zeichen |
| `weight`          | Ganzzahl `2` oder `3`; je Datei genau zwölfmal `2` und 18-mal `3`                                              |
| `topic`           | Nicht leere, redaktionell verständliche Themenbezeichnung                                                      |
| `concept`         | Nicht leeres Kernkonzept oder präzise bezeichnete Fehlvorstellung                                              |
| `cognitive_level` | Ausschließlich `Verständnis`, `Anwendung` oder `Analyse`                                                       |
| `mini_glossary`   | Objekt mit zwei bis vier nicht leeren Begriff-Definitions-Paaren                                               |

Lernzielcodes, Wiederholungsmarker, Quellen, redaktionelle IDs, Laufzeitoptionen und Freigabevermerke sind keine Fragenfelder. Sie werden in Alignment, Runbook, Quellen- und QA-Dokumentation geführt.

## 4. Anspruchs-, Distraktor- und Erklärungsvertrag

### 4.1 Echte Schwierigkeit

- Mittlere Items verlangen mindestens zwei verknüpfte Schritte, die Übertragung einer Regel auf ein konkretes Cloud-Szenario oder die Interpretation konkurrierender Aussagen.
- Schwere Items verlangen mehrstufige Architektur-, Fehler-, Sicherheits-, Daten-, Performance- oder Kostenanalyse mit einer begründeten Betriebsfolge.
- Ein Gewicht wird nicht durch Umdeklaration erzeugt. Frage, nötige Denkoperation, Daten, Distraktoren und Erklärung müssen das Niveau tragen.
- Reine Produktnamensabfragen, isolierte Akronymdefinitionen und offensichtlich eliminierbare Optionen erfüllen den Vertrag nicht.
- Bei arsnova.eu werden implementierter Zustand, lokale Verifikation, produktive Beobachtung und ungetestetes Zielbild getrennt. Lehrprofile sind keine Kapazitätszusagen.

### 4.2 Vier parallele Optionen

1. Alle Optionen vervollständigen den Stamm grammatisch gleich oder bilden vier Aussagen derselben Form.
2. Wortart, Zeitform, Person, Numerus, Einheit, Rundung, Präzision und Detailtiefe sind vergleichbar.
3. Jeder Distraktor steht für ein realistisches Fehlkonzept, eine plausible Fehlkonfiguration, eine falsche Verantwortungsgrenze oder eine nachvollziehbare Kosten-, Latenz-, Security- oder Betriebsfehlannahme.
4. Die Lösung fällt weder durch Länge noch durch zusätzliche Einschränkungen, ungewöhnliche Fachsprache oder exaktere Zahlen auf.
5. Wörter wie »immer«, »nie«, »nur« und »zwingend« werden nur verwendet, wenn die Absolutheit selbst in allen vier Optionen fachlich geprüft wird.
6. Scherzoptionen, überlappende Optionen, Synonyme ohne Bedeutungsunterschied und bloßer Unsinn sind unzulässig.

### 4.3 Erklärung und Glossar

`explanation` ist ohne Kenntnis der Optionsreihenfolge verständlich. Formulierungen wie »erste Option«, »Antwort B« oder »die dritte Antwort« sind unzulässig, weil die Plattform Optionen umordnen kann. Eine Erklärung enthält knapp:

1. warum die fachlich richtige Aussage trägt,
2. warum der plausibelste Irrweg nicht trägt,
3. welche Architektur-, Daten-, Sicherheits-, Performance- oder Kostenregel einschlägig ist,
4. welche stärkere Schlussfolgerung nicht zulässig ist oder wie der Grundsatz übertragen wird.

`mini_glossary` enthält zwei bis vier itemnahe Begriffe. Definitionen bleiben knapp, fachlich konsistent und grenzen leicht verwechselbare Konzepte ausdrücklich ab. Der fixierte MC-Test-Validator lässt technisch bis zu sechs Einträge zu; für dieses Paket gilt die strengere Obergrenze vier.

### 4.4 Eindeutigkeit und Lösungsschutz

- Normalisierte Fragenstämme sind innerhalb einer Datei und paketweit eindeutig.
- Bloße Umformulierungen desselben Falls oder derselben Rechenlogik gelten als Wiederholung.
- Kein Item verrät durch Stamm, Optionen, Erklärung oder Glossar die Lösung eines anderen Items.
- Erklärungen und Glossare erscheinen erst im Sofortfeedback nach der jeweiligen Antwort, nicht vor der Antwort.
- Eine statische Optionsfolge darf auch ohne Laufzeit-Shuffling keinen systematischen Lösungshinweis geben.

## 5. Schwierigkeit, Kognition und Lösungspositionen

### 5.1 Profil je Datei

| Merkmal         | Verbindlicher Wert                        |
| --------------- | ----------------------------------------- |
| leichte Items   | `0`; `weight=1` ist ausgeschlossen        |
| mittlere Items  | `12`; jeweils `weight=2`                  |
| schwere Items   | `18`; jeweils `weight=3`                  |
| kognitive Werte | nur `Verständnis`, `Anwendung`, `Analyse` |
| Antwortoptionen | genau vier je Item                        |
| Glossareinträge | zwei bis vier je Item                     |
| Fragen je Datei | genau 30                                  |

Schwierigkeit und kognitive Stufe sind getrennte Dimensionen. Ein schweres Item kann etwa eine anspruchsvolle Anwendung sein; `Analyse` ist nicht automatisch gleichbedeutend mit `weight=3`.

### 5.2 Positionsvertrag

Für die nullbasierten Lösungsindizes `0` bis `3` gilt je Themenblockdatei:

- Jede der vier Positionen kommt sieben- oder achtmal vor; bei 30 Items sind damit zwei Positionen siebenmal und zwei Positionen achtmal richtig.
- Es gibt höchstens drei identische Lösungspositionen in unmittelbarer Folge.
- Die vollständige Sequenz bildet kein periodisch wiederholtes Muster.
- Die redaktionelle Position ist unabhängig von Optionslänge, Formulierung und Erklärung.
- Eine spätere Umordnung im Quelldokument erfordert erneute Positions-, Inhalts- und Prüfsummenprüfung.

## 6. Programmgesteuerte Verteilungen

Die tatsächlichen Häufigkeiten von `topic`, `cognitive_level` und `weight` werden nicht von Hand in diesem Blueprint gezählt oder geschätzt. Ihre einzige paketinterne Zählquelle ist [MC-Test_Verteilungen.json](./MC-Test/MC-Test_Verteilungen.json). Diese Datei wird nach der letzten inhaltlichen Änderung durch `validate_module.mjs --write` direkt aus allen zwölf Themenblock-JSONs erzeugt und durch den normalen Validatorlauf erneut gegen diese Dateien geprüft.

Das feste `0/12/18`-Gewichtsprofil ist ein Sollvertrag. Ob die Dateien es tatsächlich erfüllen, wird ebenfalls programmgesteuert gezählt. Für Topic- und Kognitionsprofile gibt es keine manuell behaupteten Blockzahlen; Item-Redaktion und Qualitätsverantwortung beurteilen stattdessen die generierte Verteilung zusammen mit der fachlichen Abdeckung.

## 7. Themenblockprogression und Wiederabruf

| Themenblock | Neuer Schwerpunkt                                                  | Kumulativer Abruf ohne manuell behauptete Itemzahlen                                |
| ----------: | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
|        TB01 | Cloud-Merkmale, Service-/Deployment-Modelle, Shared Responsibility | Einordnung von Hosting, Cloud und sicherem Agentenauftrag                           |
|        TB02 | Virtualisierung, Container, Images, Orchestrierung, IaC, Netzwerk  | Verantwortungsgrenzen und Cloud-Merkmale aus TB01                                   |
|        TB03 | reproduzierbares arsnova.eu-Deployment, Härtung, Zustand           | IaC-, Container- und Netzwerkentscheidungen aus TB02                                |
|        TB04 | Serverless, Trigger, Zustandslosigkeit, Cold Starts, Kosten        | Zustands- und Betriebsgrenzen aus TB02–TB03                                         |
|        TB05 | GCP, AWS und Azure nach gleichen Fähigkeiten und Verantwortungen   | Service- und Serverless-Modelle aus TB01 und TB04                                   |
|        TB06 | Datenpipelines, ML-Angebote, private Inferenz, Datenschutz         | Provider- und Shared-Responsibility-Entscheidungen aus TB01 und TB05                |
|        TB07 | Storage, Datenbanken, Backup, Restore, Recovery                    | Zustand, Datenfluss und Verantwortungsgrenzen aus TB03 und TB06                     |
|        TB08 | Elastizität, Skalierung, Performance, verteilte Systeme            | Netzwerk-, Zustands- und Recoveryfolgen aus TB02, TB03 und TB07                     |
|        TB09 | IAM, Security, Observability, SLI/SLO, SRE, Resilienz              | Härtung, Datenminimierung, Recovery und Skalierungsgrenzen aus TB03 sowie TB06–TB08 |
|        TB10 | FinOps, Nachhaltigkeit, TCO, Sensitivität und 6R                   | Provider-, Performance-, Security- und Betriebsdaten aus TB05 sowie TB08–TB09       |
|        TB11 | Evidenz, Quellenkritik, ADR und Referatsargumentation              | Entscheidungen aus TB01–TB10 mit stärkster Gegenalternative und Gültigkeitsgrenze   |
|        TB12 | Synthese und Verteidigung                                          | integrierter Abruf aller offiziellen Inhaltsblöcke und zentralen Betriebsfolgen     |

Ein späterer vollständiger Abruf verwendet den unveränderten freigegebenen Themenblocksatz. Kumulative Items verwenden Kernkonzepte früherer Themenblöcke in einem neuen Fall, ohne den alten Fragenstamm bloß umzuformulieren. Das Modulpaket legt dafür keine kalendarischen Abstände fest; die Plattform begrenzt die Zahl freiwilliger Lernversuche nicht.

## 8. Feedback, A11y und Datenverwendung

- Sofortfeedback erklärt das Konzept und den wichtigsten Irrweg; es beschämt keine Person und deutet Antwortzeit nicht als Kompetenz.
- Die Abschlussbesprechung betrachtet ausschließlich Aggregate, häufige Distraktoren und Lösungswege. Einzelverläufe werden weder angezeigt noch exportübergreifend verknüpft.
- Fragen, Optionen, Erklärungen und Glossare sind vollständig textlich zugänglich. Farbe, Position, Animation oder Sound transportieren keine exklusive Fachinformation.
- Der Modus ist technisch untimiert. Die 32 Minuten sind eine Gruppenplanung; institutionelle Zeitunterstützung und eine gleichwertige, ebenfalls untimierte Alternative bleiben möglich.
- Tablet und Laptop eignen sich zur Bearbeitung; tiefe Repository-, Architektur- und Konfigurationsarbeit innerhalb der LE erfolgt am Laptop oder über einen gleichwertigen bereitgestellten Zugang.
- ARSnova-, MC-Test-, Dossier- und Labordaten werden nicht personenübergreifend oder werkzeugübergreifend zu Leistungsprofilen verbunden.

## 9. Validatoren und Freigabereihenfolge

Eine Themenblockdatei ist erst freigabefähig, wenn:

1. das Wurzelobjekt, `meta` und jedes Item exakt die zulässigen Feldmengen besitzen;
2. `question_count` und Arraylänge jeweils 30 betragen;
3. je Datei exakt zwölf Items mit `weight=2` und 18 mit `weight=3` vorliegen;
4. alle kognitiven Werte zur Dreier-Allowlist gehören;
5. jedes Item vier eindeutige, plausible und parallele Optionen sowie genau einen gültigen Lösungsindex besitzt;
6. die Positionsverteilung sieben/sieben/acht/acht, die maximale Dreierserie und die Nichtperiodizität erfüllt sind;
7. jede Erklärung eigenständig, mindestens 80 Zeichen lang und positionsunabhängig ist;
8. jedes Glossar zwei bis vier vollständige Einträge besitzt;
9. keine Dubletten, nahen Wiederholungen, gegenseitigen Lösungshinweise oder bloßen Definitionsfragen bestehen;
10. Rechnungen, Architekturbehauptungen, Produktangaben und Quellen von einer zweiten Person geprüft wurden;
11. der fixierte `validate_sets.py` mit Exit-Code 0 endet und jede Warnung fachlich entschieden und protokolliert ist;
12. der strengere `validate_module.mjs` ohne Fehler endet;
13. [MC-Test_Verteilungen.json](./MC-Test/MC-Test_Verteilungen.json) nach der letzten Inhaltsänderung programmgesteuert neu erzeugt und im normalen Lauf bestätigt wurde;
14. ein realer Plattformtest `practice`, Sofortfeedback, fehlenden technischen Countdown, `show_top5_public=false` und 30 von 30 Items bestätigt;
15. Wiederholungsfenster, aggregierte Besprechung, A11y-Zugang, Zweckbindung und Löschhandoff operativ geklärt sind.

Ausgeführte Befehle, Warnungsentscheidungen, konkrete Resultate und noch offene Gates stehen ausschließlich im [QA-Freigabeprotokoll](./QA_Freigabeprotokoll.md).
