<!-- markdownlint-disable MD013 MD060 -->

# Prüf- und Freigabeprotokoll Cloud Computing

**Kürzel und Fachkürzungen vorab:** **A11y** bezeichnet Barrierefreiheit (Accessibility), **AUTO** den Konfigurationswert für automatische Teambildung, **ID** eine eindeutige Kennung, **JSON** JavaScript Object Notation, **LE** eine 90-minütige Lerneinheit aus zwei **UE**, **LI** einen Learning Indicator, **MC** Multiple Choice, **MZ** ein operationalisiertes Modulziel, **QA** Qualitätssicherung, **QZ** ein offizielles Qualifikationsziel, **SHA-256** den Secure Hash Algorithm mit 256 Bit, **UE** eine 45-minütige Unterrichtseinheit, **WCAG** die Web Content Accessibility Guidelines und **W01–W12** die zwölf Kurswochen. **LIVE** bezeichnet im Kursbetrieb entstehende Interaktionsdaten und **REPO** versionierte Repository-Nachweise.

**Rollen vorab:** **MV** ist die Modulverantwortung, **LD** die Lehrdurchführung und der Session-Host, **IR** die Item-Redaktion, **QE** die Qualitäts- und Evaluationsverantwortung, **DK** die Datenkuratierung, **DS** die Datenschutz- und Informationssicherheitsrolle, **LB** der Lehrlaborbetrieb, **AP** der ARSnova-Plattformbetrieb und **MP** der MC-Test-Plattformbetrieb.

**Version:** 1.0.0 · **Vorlagenstand:** 13.09.2026

**Aktueller Status:** **AUSZUFÜLLEN – KEINE PAKETPRÜFUNG ALS BESTANDEN DOKUMENTIERT, OPERATIVE FREIGABE OFFEN**

**Bezugsdokumente:** [Materialindex](./Materialindex.md) · [Wochenlehrplan](./Wochenlehrplan_Cloud_Computing_12_Wochen.md) · [Referatsthemenkatalog](./Referatsthemen_Cloud_Computing_ARSnova.md) · [ARSnova-Blueprint](./ARSnova_Blueprint_12_Wochen.md) · [MC-Test-Blueprint](./MC-Test_Blueprint_12_Wochen.md) · [Lehrenden-Runbook](./Lehrenden_Runbook.md) · [Datenmanagement](./Datenmanagement_Datenschutz.md)

## 1. Zweck, Aussagegrenze und Statusregeln

Dieses Dokument ist zunächst eine reproduzierbare Prüfvorlage. Platzhalter werden erst nach einem realen Lauf durch Befehl, Umgebung, Exit-Code, beobachtetes Resultat, verantwortliche Person, Datum und Evidenz ersetzt. Eine erwartete Eigenschaft ist kein Prüfergebnis.

Zulässige Statuswerte:

| Status             | Bedeutung                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `NICHT AUSGEFÜHRT` | Es liegt kein reproduzierter Lauf vor. Dieser Status ist der Ausgangswert aller statischen Checks.                    |
| `BESTANDEN`        | Der dokumentierte Befehl oder operative Test wurde real ausgeführt und erfüllte den erwarteten Vertrag.               |
| `FEHLGESCHLAGEN`   | Der Lauf wurde ausgeführt und mindestens ein erwarteter Vertrag wurde verletzt.                                       |
| `BLOCKIERT`        | Der Lauf konnte wegen einer konkret benannten externen Voraussetzung nicht abgeschlossen werden.                      |
| `OFFEN`            | Das operative oder menschliche Gate wurde noch nicht mit datierter Evidenz geschlossen.                               |
| `NICHT ANWENDBAR`  | Nur mit fachlicher Begründung und Freigabe durch QE zulässig; nie als Ersatz für einen fehlgeschlagenen Pflichtcheck. |

Kein automatischer Validator ersetzt die fachliche Prüfung von Lösungen, tatsächlicher Schwierigkeit, Distraktorqualität, Quellenstatus, Datenweg, A11y oder Lehrdurchführung. Toolresultate dieses Moduls dienen ausschließlich Lehre und interner Qualitätssicherung; sie dürfen weder individuelle Leistungsbewertung noch Forschung oder Publikation begründen.

## 2. Laufkopf – vor jeder Prüfserie ausfüllen

| Feld                                        | Eintrag                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| Prüfserien-ID                               | `<JJJJ-MM-TT-Uhrzeit-Kürzel>`                                              |
| Datum und lokale Uhrzeit                    | `<eintragen>`                                                              |
| ausführende Person/Rolle                    | `<eintragen>`                                                              |
| Gegenprüfung durch Person/Rolle             | `<eintragen>`                                                              |
| Repository-Pfad                             | `<absolute Repository-Wurzel eintragen>`                                   |
| Branch                                      | `<eintragen>`                                                              |
| geprüfter Commit oder Working-Tree-Hash     | `<eintragen; bei uncommittetem Stand git status und Dateihashes beilegen>` |
| Betriebssystem                              | `<eintragen>`                                                              |
| Node.js-Version                             | `<node --version>`                                                         |
| npm-Version                                 | `<npm --version>`                                                          |
| Python-Version                              | `<python3 --version>`                                                      |
| MC-Test-Checkout-Pfad                       | `<absoluten Pfad eintragen>`                                               |
| MC-Test-Commit                              | `b6b159555e8a228dad73dd75fd66c154a1088e28`                                 |
| Zeitpunkt der letzten Inhaltsänderung       | `<eintragen>`                                                              |
| Zeitpunkt von `validate_module.mjs --write` | `<erst nach letzter Inhaltsänderung eintragen>`                            |
| Abweichungen oder bekannte Einschränkungen  | `<eintragen oder „keine“>`                                                 |

Vor Beginn:

```bash
cd "<absolute Repository-Wurzel>"
git status --short --branch
node --version
npm --version
python3 --version
```

**Tatsächliches Resultat:** `<Ausgabe oder Evidenzpfad eintragen>`  
**Exit-Code:** `<eintragen>`  
**Status:** `NICHT AUSGEFÜHRT`

## 3. Verbindliche Prüfreihenfolge

Die Reihenfolge ist Teil des Vertrags. `--write` darf erst nach der letzten inhaltlichen Änderung an den 24 Wochen-JSONs und den Kurztextfällen laufen. Jede spätere Inhaltsänderung macht `MC-Test_Verteilungen.json`, `SHA256SUMS` und alle darauf beruhenden Ergebnisse ungültig; ab diesem Schritt ist die Serie vollständig zu wiederholen.

### P01 – Shared-Types-Build

```bash
npm run build -w @arsnova/shared-types
```

**Erwarteter Vertrag:** Der Build endet mit Exit-Code 0 und stellt die von `validate_module.mjs` importierten Artefakte unter `libs/shared-types/dist/` bereit. Warnungen oder Fehler werden vollständig übernommen; ein vorhandenes `dist` ohne aktuellen Build ist kein Nachweis.

**Tatsächliches Resultat:** `<eintragen>`  
**Exit-Code:** `<eintragen>`  
**Status:** `NICHT AUSGEFÜHRT`

### P02 – Abschlussartefakte nach Inhaltsfreeze erzeugen

```bash
node "docs/didaktik/Modulkonzept Cloud Computing/validate_module.mjs" --write
```

**Vorbedingung:** `<Bestätigung mit Datum/Uhrzeit: Alle inhaltlichen Änderungen an ARSnova-, MC-Test- und Kurztextdateien sind abgeschlossen.>`

**Erwarteter Vertrag:** Der strenge Validator findet vor dem Schreiben keinen Fehler und erzeugt anschließend ausschließlich:

- [MC-Test_Verteilungen.json](./MC-Test_Verteilungen.json) aus den zwölf aktuellen MC-Test-Dateien;
- [SHA256SUMS](./SHA256SUMS) für zwölf ARSnova-Dateien, zwölf MC-Test-Dateien, die Kurztextfälle und die Verteilungsdatei.

Ein fehlgeschlagener Lauf erzeugt keine Freigabe. Inhaltliche Warnungen sind einzeln zu prüfen und in Abschnitt 6 zu entscheiden.

**Tatsächliches Resultat:** `<eintragen>`  
**Exit-Code:** `<eintragen>`  
**erzeugte Dateihashes:** `<eintragen>`  
**Status:** `NICHT AUSGEFÜHRT`

### P03 – Strenger Modulvalidator im Normalmodus

```bash
node "docs/didaktik/Modulkonzept Cloud Computing/validate_module.mjs"
```

**Erwarteter Vertrag:** Exit-Code 0. Der Lauf bestätigt die aktuellen Quelldateien und zusätzlich, dass Verteilungsbericht und SHA-256-Manifest exakt zum aktuellen Inhalt passen. Der Sollabschluss lautet 12 ARSnova-Dateien und 12 MC-Test-Dateien; Warnungen werden nicht stillschweigend als fachlich akzeptiert behandelt.

**Tatsächliches Resultat:** `<vollständige Ausgabe oder Evidenzpfad eintragen>`  
**Exit-Code:** `<eintragen>`  
**Warnungszahl:** `<eintragen>`  
**Status:** `NICHT AUSGEFÜHRT`

### P04 – Beide ARSnova-Shared-Types-Schemas unabhängig prüfen

```bash
node --input-type=module <<'NODE'
import { readFile, readdir } from 'node:fs/promises';
import {
  QuizImportSchema,
  QuizUploadInputSchema,
} from './libs/shared-types/dist/index.js';

const directory = 'docs/didaktik/Modulkonzept Cloud Computing';
const files = (await readdir(directory))
  .filter((name) => /^ARSnova_Woche_\d{2}\.json$/.test(name))
  .sort();
let failed = false;

for (const file of files) {
  const data = JSON.parse(await readFile(`${directory}/${file}`, 'utf8'));
  const importResult = QuizImportSchema.safeParse(data);
  const uploadResult = QuizUploadInputSchema.safeParse(data.quiz);
  console.log(
    `${file}: QuizImportSchema=${importResult.success ? 'OK' : 'FEHLER'} ` +
      `QuizUploadInputSchema=${uploadResult.success ? 'OK' : 'FEHLER'}`,
  );
  failed ||= !importResult.success || !uploadResult.success;
}

if (files.length !== 12) {
  console.error(`FEHLER: ${files.length} statt 12 ARSnova-Dateien.`);
  failed = true;
}
process.exitCode = failed ? 1 : 0;
NODE
```

**Erwarteter Vertrag:** Exakt zwölf Dateien; jede vollständige Exporthülle besteht `QuizImportSchema`, jedes innere `quiz`-Objekt besteht `QuizUploadInputSchema`; Exit-Code 0.

**Tatsächliches Resultat:** `<eintragen>`  
**Exit-Code:** `<eintragen>`  
**Status:** `NICHT AUSGEFÜHRT`

### P05 – Fixierten MC-Test-Validator ausführen

Der externe Checkout muss exakt auf dem fixierten Commit stehen. Ein anderer Commit, ein lokal verändertes Skript oder nur ein ähnlicher Validator ist kein gleichwertiger Nachweis.

```bash
export MC_TEST_ROOT="<absoluter Pfad zum MC-Test-Checkout>"
export MC_TEST_COMMIT="b6b159555e8a228dad73dd75fd66c154a1088e28"
export MODULE_DIR="docs/didaktik/Modulkonzept Cloud Computing"

test "$(git -C "$MC_TEST_ROOT" rev-parse HEAD)" = "$MC_TEST_COMMIT"
test -z "$(git -C "$MC_TEST_ROOT" status --porcelain)"
python3 "$MC_TEST_ROOT/validate_sets.py" "$MODULE_DIR"/MC-Test_Woche_*.json
```

**Erwarteter Vertrag:** Commitprüfung und Sauberkeitsprüfung enden mit Exit-Code 0; `validate_sets.py` prüft alle zwölf Dateien und endet ohne Fehler mit Exit-Code 0. Jede Warnung wird mit Datei, Wortlaut, fachlicher Entscheidung, Rolle und Datum in Abschnitt 6 erfasst. Eine Warnung wird nicht allein deshalb akzeptiert, weil der Validator sie nicht als Fehler klassifiziert.

**Tatsächliches Resultat:** `<vollständige Ausgabe oder Evidenzpfad eintragen>`  
**Exit-Code Commitprüfung:** `<eintragen>`  
**Exit-Code Validator:** `<eintragen>`  
**Fehler/Warnungen:** `<eintragen>`  
**Status:** `NICHT AUSGEFÜHRT`

### P06 – Formatierung und Whitespace

```bash
npx prettier --check "docs/didaktik/Modulkonzept Cloud Computing/**/*.{md,json,mjs}"
git diff --check -- "docs/didaktik/Modulkonzept Cloud Computing"
```

**Erwarteter Vertrag:** Beide Befehle enden mit Exit-Code 0. Der erste prüft alle Markdown-, JSON- und JavaScript-Moduldateien; der zweite meldet keine Whitespacefehler im Paketdiff.

**Tatsächliches Resultat:** `<eintragen>`  
**Exit-Codes:** `<eintragen>`  
**Status:** `NICHT AUSGEFÜHRT`

### P07 – Lokale Links

Der normale Lauf aus P03 führt die lokale Linkprüfung für alle Markdown-Dateien im Modulverzeichnis aus.

**Erwarteter Vertrag:** Jeder relative Link ohne reines Fragment verweist auf ein vorhandenes lokales Ziel. Externe Links sind von dieser Prüfung ausdrücklich nicht umfasst und werden redaktionell separat geprüft.

**Tatsächliches Resultat:** `<Zahl geprüfter lokaler Links, Fehler und externe Stichprobe eintragen>`  
**Exit-Code des maßgeblichen Laufs:** `<eintragen>`  
**Status:** `NICHT AUSGEFÜHRT`

### P08 – SHA-256 unabhängig bestätigen

```bash
(
  cd "docs/didaktik/Modulkonzept Cloud Computing"
  shasum -a 256 -c SHA256SUMS
)
```

**Erwarteter Vertrag:** Genau 26 gelistete Dateien werden mit `OK` bestätigt: zwölf ARSnova-Wochen, zwölf MC-Test-Wochen, `ARSnova_Kurztext_Testfaelle.json` und `MC-Test_Verteilungen.json`. Es fehlt keine Soll-Datei und es gibt keinen veralteten oder zusätzlichen Hash-Eintrag.

**Tatsächliches Resultat:** `<eintragen>`  
**Exit-Code:** `<eintragen>`  
**Status:** `NICHT AUSGEFÜHRT`

## 4. Statische Vertragsprotokolle

Die folgenden Tabellen werden aus den realen Läufen befüllt. Sollwerte stehen in der Spalte »Erwarteter Vertrag«; die Ergebnisfelder bleiben bis dahin leer.

### 4.1 ARSnova-Paket

| Prüffeld                          | Erwarteter Vertrag                                                                                                                                                     | Tatsächliches Resultat | Evidenz       | Status             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------- | ------------------ |
| Dateien und Gesamtzahl            | 12 Dateien, je 10 Fragen, zusammen 120                                                                                                                                 | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Reihenfolge                       | je Datei `order=0` bis `order=9`, lückenlos und eindeutig                                                                                                              | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Typen                             | je Datei jeder der zehn Enum-Typen genau einmal                                                                                                                        | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Schwierigkeit                     | ausschließlich `MEDIUM` und `HARD`; fachlicher Anspruch zusätzlich menschlich geprüft                                                                                  | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Timer                             | jede Frage `timer=null`                                                                                                                                                | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Paketweite Eindeutigkeit          | 120 normalisierte, nicht leere und unterschiedliche Fragenstämme                                                                                                       | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Quizkonfiguration                 | Kindergarten-Pseudonyme, keine freien Nicknames, Rangliste, vier `AUTO`-Obstteams, drei Boni, alle vier Effekte, 60 Sekunden, Skalierung, Zeitunterstützung, Lesephase | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Single/Multiple Choice und Survey | vier eindeutige Optionen; Single genau eine richtige, Multiple mindestens zwei richtige und eine falsche, Survey keine richtige                                        | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Strukturtypen                     | typgerechte eindeutige Matching-, Ordering- und Categorization-Strukturen; Referenzen und Zielkategorien existieren                                                    | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Numeric Estimate                  | Referenz, Toleranzmodus, Grenzen, Eingabeart und Wertebereich sind konsistent und unabhängig nachgerechnet                                                             | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Lösungsschutz                     | keine Lösung im Fragenstamm; Teilnehmeransicht zeigt Lösungen erst nach geschlossener Frage                                                                            | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Effective Vote                    | Runde 2 ersetzt für die ganze Frage Runde 1; keine Doppelzählung in Score, Rang, Team, Boni, Analyse oder Export                                                       | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |

### 4.2 Kurztext-Positiv- und Negativfälle

| Prüffeld                | Erwarteter Vertrag                                                                                                       | Tatsächliches Resultat | Evidenz       | Status             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------- | ------------------ |
| Testfalldatei           | `schemaVersion=1`, genau ein Fall je ARSnova-Woche                                                                       | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Bewertungsmodus         | alle zwölf Kurztextfragen `exact`/`none`, ohne Teilpunkte, nicht case-sensitiv, Trim und Whitespace-Normalisierung aktiv | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Positivfälle            | decken alle und nur die expliziten Modellvarianten ab; jeder Fall erhält 100 von 100 Punkten                             | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Negativfälle            | mindestens zwei fachlich falsche Fälle je Woche; jeder erhält 0 von 100 Punkten                                          | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Kritische Gegenbegriffe | falsche Zahl, Einheit, Richtung, Negation oder Gegenbegriff wird nicht durch Normalisierung oder Teiltreffer akzeptiert  | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |

### 4.3 MC-Test-Paket

| Prüffeld                 | Erwarteter Vertrag                                                                                                          | Tatsächliches Resultat | Evidenz       | Status             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------- | ------------------ |
| Dateien und Gesamtzahl   | 12 Dateien, je 30 Items, zusammen 360                                                                                       | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Wurzelschema             | ausschließlich `meta` und `questions`                                                                                       | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Meta-Schema              | exakt neun erlaubte Felder; feste Zielgruppe, 30, `0/12/18`, Zeitprofil, Puffer 5, Planwert 32, Sprache `de`, valides Datum | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Item-Schema              | exakt `question/options/answer/explanation/weight/topic/concept/cognitive_level/mini_glossary`                              | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Schwierigkeit/Gewicht    | je Datei zwölfmal `weight=2`, 18-mal `weight=3`, nie `weight=1`; tatsächlicher Anspruch menschlich geprüft                  | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Kognitive Werte          | ausschließlich `Verständnis`, `Anwendung`, `Analyse`                                                                        | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Optionen                 | genau vier nicht leere, eindeutige, plausible und formal parallele Optionen                                                 | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Lösungspositionen        | pro Datei zwei Positionen siebenmal, zwei achtmal; keine Periode; höchstens drei gleiche Positionen in Folge                | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Erklärungen              | nicht leer, mindestens 80 Zeichen, fachlich eigenständig, mit Fehlerabgrenzung und ohne Positionsbezug                      | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Mini-Glossare            | Objekt mit zwei bis vier nicht leeren Begriff-Definitions-Paaren je Item                                                    | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Paketweite Eindeutigkeit | 360 normalisierte, nicht leere und unterschiedliche Fragenstämme; keine nahen Wiederholungen oder Lösungshinweise           | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Fixierter Validator      | Commit exakt bestätigt, Exit-Code 0, jede Warnung einzeln entschieden                                                       | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |

### 4.4 Programmgesteuerte Verteilungen

Manuelle Schätzungen werden hier nicht eingetragen. Maßgeblich ist ausschließlich die nach Inhaltsfreeze generierte Datei [MC-Test_Verteilungen.json](./MC-Test_Verteilungen.json).

| Prüffeld          | Erwarteter Vertrag                                                                                                 | Tatsächliches Resultat | Evidenz       | Status             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------- | ------------------ |
| `generatedFrom`   | exakt die zwölf erwarteten MC-Test-Dateien                                                                         | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| Wochenblöcke      | genau W01–W12 mit richtigem Dateinamen und `questionCount=30`                                                      | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| `topic`           | Zählung wird direkt aus jeder aktuellen Wochen-Datei erzeugt und im Normalmodus inhaltlich exakt geprüft           | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| `cognitive_level` | Zählung wird direkt aus jeder aktuellen Wochen-Datei erzeugt und im Normalmodus inhaltlich exakt geprüft           | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |
| `weight`          | Zählung wird direkt aus jeder aktuellen Wochen-Datei erzeugt; jede Woche weist maschinell zwölf `2` und 18 `3` aus | `<eintragen>`          | `<eintragen>` | `NICHT AUSGEFÜHRT` |

## 5. Menschliche Inhalts- und Konsistenzprüfung

Automatisierbare Zählungen genügen nicht. IR und QE prüfen den vollständigen Bestand von 120 Livefragen und 360 MC-Test-Items mindestens auf:

- fachlich richtige und eindeutige Lösung einschließlich Rechnung, Einheit, Richtung und Rundung;
- tatsächliche mittlere oder schwere Denkoperation statt bloßem Schwierigkeitslabel;
- plausible, parallele Distraktoren mit identifizierbarer Fehlvorstellung;
- fehlende formale Lösungshinweise durch Länge, Einschränkungswort, Präzision oder Position;
- keine Dublette, nahe Umformulierung oder gegenseitige Lösungshilfe;
- korrekte Trennung von implementiertem Zustand, lokaler Verifikation, produktiver Beobachtung und Zielbild;
- belastbare Quelle und Gültigkeitsgrenze für Architektur-, Provider-, Security-, Performance-, Kosten- und Nachhaltigkeitsaussagen;
- Übereinstimmung von Frage, Antwort, Erklärung, Glossar und LI-Zuordnung;
- verständliche, nicht diskriminierende Sprache und fachlich identischen untimierten Zugang.

| Reviewumfang                      | prüfende Person/Rolle | Datum         | Befunde und Korrekturen | Gegenprüfung  | Status  |
| --------------------------------- | --------------------- | ------------- | ----------------------- | ------------- | ------- |
| 120 ARSnova-Fragen                | `<eintragen>`         | `<eintragen>` | `<eintragen>`           | `<eintragen>` | `OFFEN` |
| 360 MC-Test-Items                 | `<eintragen>`         | `<eintragen>` | `<eintragen>`           | `<eintragen>` | `OFFEN` |
| Rechnungen und technische Fakten  | `<eintragen>`         | `<eintragen>` | `<eintragen>`           | `<eintragen>` | `OFFEN` |
| Quellen, volatile Providerangaben | `<eintragen>`         | `<eintragen>` | `<eintragen>`           | `<eintragen>` | `OFFEN` |
| Alignment QZ/MZ/LI                | `<eintragen>`         | `<eintragen>` | `<eintragen>`           | `<eintragen>` | `OFFEN` |
| Toolgrenzen und Zweckbindung      | `<eintragen>`         | `<eintragen>` | `<eintragen>`           | `<eintragen>` | `OFFEN` |

## 6. Warnungs- und Befundregister

Jede Validatorwarnung und jeder menschliche Befund erhält eine eigene Zeile. »Akzeptiert« ist nur mit fachlicher Begründung, Rolle und Gegenprüfung zulässig.

| ID     | Quelle/Datei/Position | Wortlaut oder Befund | Entscheidung und Begründung | Korrektur oder akzeptiertes Restrisiko | Rolle/Datum   | Gegenprüfung  | Status  |
| ------ | --------------------- | -------------------- | --------------------------- | -------------------------------------- | ------------- | ------------- | ------- |
| `<ID>` | `<eintragen>`         | `<eintragen>`        | `<eintragen>`               | `<eintragen>`                          | `<eintragen>` | `<eintragen>` | `OFFEN` |

## 7. Offene operative Freigabe-Gates

Alle Gates beginnen offen. Ein Häkchen, eine mündliche Aussage oder ein automatischer Validator allein schließt kein Gate.

| Gate                                      | Zuständige Rollen      | Reproduzierbarer Nachweis vor Kurseinsatz                                                                                                                                                                                                                                                                                                                                                               | Ergebnisplatzhalter                                            | Status  |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------- |
| ARSnova-Import und Fragetypen             | AP, LD, IR             | Alle zwölf Dateien real importieren; je Woche 10/10 Fragen und alle zehn Typen in Host- und Teilnehmeransicht durchlaufen; Reihenfolge, strukturierte Interaktionen, Kurztext-Positiv/Negativ, Numeric Estimate und Export prüfen.                                                                                                                                                                      | `<Datum, App-Version, Gerät, Sitzung, Befunde, Evidenz>`       | `OFFEN` |
| ARSnova-Konfiguration und Lösungsschutz   | AP, LD, QE             | Kindergarten-Pseudonyme, gesperrte freie Nicknames, Rangliste, `AUTO`-Obstteams, drei Boni, Sound/Reward/Motivation/Emoji, 60-Sekunden-Skalierung, persönliche Zeitunterstützung, Lesephase, `timer=null`, Auflösung erst nach Schließen und Effective Vote praktisch bestätigen.                                                                                                                       | `<eintragen>`                                                  | `OFFEN` |
| MC-Test-Import und Laufzeitkonfiguration  | MP, LD, IR             | Alle zwölf Dateien am fixierten MC-Test-Stand importieren; jeweils 30/30 Items; `practice`, Sofortfeedback, kein technischer Countdown, `show_top5_public=false`, unveränderte Erklärung/Glossare und keine technische Versuchsbegrenzung bestätigen.                                                                                                                                                   | `<Commit, Konfiguration, Laufprotokoll, Befunde>`              | `OFFEN` |
| MC-Test-Zeit- und Wiederholungsablauf     | LD, QE                 | Drei Minuten Übergang, 32 Minuten organisatorische Bearbeitung und zehn Minuten aggregierte Besprechung proben; zweiten vollständigen Zugang nach 2–3 Tagen und Kernkonzeptabruf nach 2–4 Wochen terminieren und testen.                                                                                                                                                                                | `<eintragen>`                                                  | `OFFEN` |
| Reale Geräte: Tablet und Laptop           | LD, QE, AP, MP         | ARSnova.eu und MC-Test auf mindestens einem realen Tablet und Laptop prüfen; tiefe Repositoryarbeit am Laptop; Zoom-/Raumzugang, Eingabe, Rotation, Zoom/Reflow, Netzwechsel und gleichwertigen Geräteersatz dokumentieren.                                                                                                                                                                             | `<Geräte, Browser, Versionen, Resultate>`                      | `OFFEN` |
| Offline-, Netz- und Gerätefallback        | LD, AP, MP             | Vollständigen Wochenfallback mit lokal verfügbaren Fragen, zugänglicher untimierter Dokument-/Papierfassung, vorbereiteten Quellen-/Messauszügen, Partnerweg und späterem sicheren Handoff ohne Datenverlust proben.                                                                                                                                                                                    | `<Störungsszenario, Zeit, Resultat, Restlücke>`                | `OFFEN` |
| Praktische WCAG-/A11y-Prüfung             | QE, LD, AP, MP         | Tastaturbedienung, Fokus, Screenreader-Semantik, 400-Prozent-Zoom/Reflow, Kontrast, reduzierte Bewegung, Vorlesbarkeit, Lesephase, persönliche Zeitunterstützung, untimierte Alternative sowie nicht ausschließlich visuelle/akustische Gamification am realen Setup prüfen.                                                                                                                            | `<Prüfplan, Werkzeuge, Geräte, Befunde, Korrekturen>`          | `OFFEN` |
| Präsenz- und Zoom-Ablauf                  | LD, MV, QE             | Je einen vollständigen 90+45-Minuten-Probelauf durchführen; identische Ziele, Fragen, Nettozeiten, Feedback- und Prüfungsinformation; Raum-/Breakout-Moderation, Aggregatbesprechung, Störungs- und Wiedereintrittsweg dokumentieren.                                                                                                                                                                   | `<Termine, Teilnehmende, Zeiten, Abweichungen>`                | `OFFEN` |
| Datenweg, Schutzorte und Löschung         | DS, DK, AP, MP, LD, LB | ARSnova-, MC-Test-, Dossier- und Laborfluss Ende-zu-Ende prüfen; keine Cross-Tool-Profile; Small-Cell-Unterdrückung; Rollen/Zugriff; institutionell bestätigte Fristen; Löschung von Arbeitskopien und Plattformdaten mit Protokoll und Negativkontrolle nachweisen.                                                                                                                                    | `<Datenflussversion, Freigabe, Lösch-ID, Kontrolle>`           | `OFFEN` |
| Fachliche und curriculare Schlussfreigabe | MV, IR, QE             | Wochenlehrplan mit zwölf Leitfragen, 36 UE, 18/18-Bilanz, Fachwortschatz, Quellenankern und Lernprodukten sowie vollständige Lösungen, Distraktoren, Schwierigkeit, Wochenprogression, fünf QZ, neun MZ, LI01–LI24 und Referatsalignment menschlich freigeben; 8.9d nur mit aktualisiertem Kurs-Quellenblock lehren; Toolresultate von individueller Bewertung, Forschung und Publikation ausschließen. | `<Namen/Rollen, Datum, signierter Nachweis, Restabweichungen>` | `OFFEN` |

## 8. Zusammenfassendes statisches Prüfblatt

Dieses Blatt wird erst nach P01–P08 und den Vertragsprotokollen ausgefüllt.

| ID  | Prüfung                                        | Status             | Exit-Code | Datum | Evidenz/Notiz |
| --- | ---------------------------------------------- | ------------------ | --------- | ----- | ------------- |
| P01 | Shared-Types-Build                             | `NICHT AUSGEFÜHRT` | `<…>`     | `<…>` | `<…>`         |
| P02 | `validate_module.mjs --write` nach Freeze      | `NICHT AUSGEFÜHRT` | `<…>`     | `<…>` | `<…>`         |
| P03 | normaler strenger Validatorlauf                | `NICHT AUSGEFÜHRT` | `<…>`     | `<…>` | `<…>`         |
| P04 | `QuizImportSchema` und `QuizUploadInputSchema` | `NICHT AUSGEFÜHRT` | `<…>`     | `<…>` | `<…>`         |
| P05 | fixierter `validate_sets.py`                   | `NICHT AUSGEFÜHRT` | `<…>`     | `<…>` | `<…>`         |
| P06 | Prettier und `git diff --check`                | `NICHT AUSGEFÜHRT` | `<…>`     | `<…>` | `<…>`         |
| P07 | lokale Links                                   | `NICHT AUSGEFÜHRT` | `<…>`     | `<…>` | `<…>`         |
| P08 | unabhängige SHA-256-Prüfung                    | `NICHT AUSGEFÜHRT` | `<…>`     | `<…>` | `<…>`         |

## 9. Freigabeentscheidung

**Statische Paketprüfung:** `NICHT FREIGEGEBEN`  
**Operative Kursfreigabe:** `NICHT FREIGEGEBEN`

Eine Freigabe ist erst zulässig, wenn alle Pflichtchecks `BESTANDEN`, alle Warnungen entschieden, alle operativen Gates geschlossen und keine offene Abweichung zu Lösungsschutz, Kurztextbewertung, Laufzeitprofil, A11y, Zweckbindung, Datenlöschung oder fachlicher Richtigkeit vorhanden ist.

| Entscheidung                    | Name/Rolle   | Datum         | Signatur- oder Evidenzreferenz | Restabweichungen           |
| ------------------------------- | ------------ | ------------- | ------------------------------ | -------------------------- |
| technische Paketfreigabe        | `<QE/LB>`    | `<eintragen>` | `<eintragen>`                  | `<eintragen oder „keine“>` |
| Plattform- und Betriebsfreigabe | `<AP/MP/LD>` | `<eintragen>` | `<eintragen>`                  | `<eintragen oder „keine“>` |
| Datenschutz- und Löschfreigabe  | `<DS>`       | `<eintragen>` | `<eintragen>`                  | `<eintragen oder „keine“>` |
| fachlich-curriculare Freigabe   | `<IR/MV/QE>` | `<eintragen>` | `<eintragen>`                  | `<eintragen oder „keine“>` |

Bis diese Einträge auf realen Nachweisen beruhen, bleibt das Paket ein Review-Kandidat und ist nicht für einen regulären Kurslauf freigegeben.
