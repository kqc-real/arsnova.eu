# A1 – Neue Messreihe auf main a19ca70f ausführen

Stand: 15.11.2026. Diese Anleitung beschreibt das reproduzierbare Vorgehen.
Die aktuelle vollständige Messung liegt unter [reihe-main-a19ca70f-20261115-122547](../../evidenz/1A/reihe-main-a19ca70f-20261115-122547/).
Befunde stehen in der [Auswertung](../1A-auswertung.md), technische Prüfungen im
[Prüfstand](./1A-pruefstand.md). Verbindlich sind der unveränderte
[Vorabnachtrag](../../specs/2026-11-14-1a-messreihe-main-a19ca70f.md) und seine
[Reihendefinition](../../specs/2026-11-14-1a-messreihe-main-a19ca70f.json).
Für zusätzliche Messungen stets einen neuen Evidenzordner verwenden.

## Voraussetzungen

Alle folgenden Blöcke im Repository-Wurzelverzeichnis und im selben Terminal
mit Node 24.18.0 ausführen. `nvm use` ist nur bei einem neuen Terminal erneut
nötig. Die Änderungen an den Messwerkzeugen vor dem Vorlauf prüfen und selbst
committen; während Vorlauf und Hauptreihe die Werkzeuge und Reihendefinition
nicht ändern.

Docker Engine und Compose müssen erreichbar sein. Der Messrunner verwendet
explizit `unix:///var/run/docker.sock`, einen Linux-Dockerhost mit cgroup v2 und
lesbare echte Prozess-/cgroup-Zähler. Das geprüfte bisherige Labor verwendet
UID 1000; der Messprozess und die Container benötigen Zugriff auf die privaten
Socket-Verzeichnisse. Bereits bestehende Container des Projekts `arsnova-1a`
führen zum Abbruch und werden nicht ungeprüft gelöscht.

Auch gestoppte Laborcontainer zählen als vorhanden. Bei diesem Abbruch nennt
der Runner die bestehenden A1-Laborcontainer ausdrücklich als Ursache. Ihren
Zustand zunächst ausschließlich lesend prüfen:

```bash
docker --host unix:///var/run/docker.sock ps -a \
  --filter label=com.docker.compose.project=arsnova-1a \
  --format '{{.ID}} {{.Names}} {{.Status}}'
```

Nur geprüfte, nicht mehr benötigte Laborcontainer gezielt entfernen; keine
fremden Container oder Volumes löschen. Für ein frisches Labor auch die
ausschließlich diesem Projekt zugeordneten Daten-/Socket-Volumes entfernen:
Der Runner erzeugt neue Laborpasswörter, die nicht zum bestehenden
PostgreSQL-Datenverzeichnis passen. Dabei gehen die alten synthetischen
Labordaten verloren; gespeicherte Messnachweise bleiben erhalten.
Für den nächsten Vorlauf einen neuen
Evidenzordner in der privaten `labor.json` setzen. Bereits angelegte
Definitions- und Plandateien werden absichtlich nicht überschrieben.
`vorlauf/abschluss.json` entsteht ausschließlich nach erfolgreichem Vorlauf;
ein anschließendes `ENOENT` beim Lesen dieser Datei ist eine Folge des Abbruchs.
Kontrollierte Voraussetzungshinweise werden ohne rohe Docker-Ausgaben
angezeigt; Dateifehler enthalten nur einen freigegebenen Fehlercode.

Jeden Block nur fortsetzen, wenn die vorhergehenden Befehle erfolgreich waren.
Die bekannte Frontend-Testabweichung ist im Prüfstand dokumentiert; sie wird nicht
als Leistungsbefund der neuen Reihe behandelt. Während der mindestens
150 Minuten langen Hauptreihe keine weiteren Tests, Builds oder Lastversuche
auf dem Rechner ausführen. Vorlauf und Start-/Rückwegzeiten kommen hinzu.

## 1 Geänderte Werkzeuge und Definition prüfen

Die zwei gezielten Suiten prüfen die neue Auswahl und die bisherigen Pfade.
Sie ersetzen nicht die bereits bekannten Ergebnisse der allgemeinen Projektprüfungen.

```bash
npm run load:resource-isolation:evaluation:test
npm run load:resource-isolation:experiment:test
npm run load:resource-isolation:evaluate -- --validate \
  --series-file docs/referat-thema-1/specs/2026-11-14-1a-messreihe-main-a19ca70f.json
docker --host unix:///var/run/docker.sock info --format '{{.OSType}} {{.CgroupVersion}}'
docker compose version
```

Die Definitionsprüfung muss `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`
und einen `seriesDefinitionSha256` ausgeben. Docker muss `linux 2` melden.
Die automatisierten Prüfungen wurden bei der Vorbereitung bereits ausgeführt;
für die eigene erneute Prüfung sind die Befehle hier dokumentiert.

Die aktuell ausgeführten Prüfungen und ihre Ergebnisse stehen im
[Prüfstand](./1A-pruefstand.md).

## 2 Sauberen Anwendungsstand exportieren und neue Images bauen

```bash
a1_baseline=a19ca70ff37dcb5510a77ab2745c06b70ccc3565
a1_laborpfad="$(mktemp -d /tmp/arsnova-1a-a19ca70f.XXXXXX)"
a1_nachweise="$PWD/docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-$(date +%Y%m%d-%H%M%S)"

git cat-file -e "$a1_baseline^{commit}"
mkdir "$a1_laborpfad/baseline"
git archive --format=tar --output="$a1_laborpfad/baseline.tar" "$a1_baseline"
tar -xf "$a1_laborpfad/baseline.tar" -C "$a1_laborpfad/baseline"

docker --host unix:///var/run/docker.sock build \
  --label "org.opencontainers.image.revision=$a1_baseline" \
  -t arsnova-1a-app:a19ca70f "$a1_laborpfad/baseline"
docker --host unix:///var/run/docker.sock build \
  --label "org.opencontainers.image.revision=$a1_baseline" \
  -t arsnova-1a-spacy:a19ca70f "$a1_laborpfad/baseline/docker/spacy"

docker --host unix:///var/run/docker.sock pull postgres:16-alpine
docker --host unix:///var/run/docker.sock pull redis:7.4-alpine
```

PostgreSQL und Redis entsprechen den Image-Referenzen dieses Baseline-Commits.
Ihre lokalen Image-IDs werden vom Runner festgehalten. Während der Reihe
keine Images neu bauen oder unter denselben Tags austauschen. Die Anwendung
wird aus dem unveränderten main-Export gebaut, nicht aus dem Feature-Arbeitsbaum.

## 3 Private Laborkonfiguration erzeugen

Der folgende Block liest ausschließlich die neuen Image-IDs und schreibt die
Zuordnung außerhalb des Repositories. Er enthält keine Zugangsdaten; die
benötigten Laborsecrets erzeugt der Runner später selbst.

```bash
node --input-type=module - "$a1_laborpfad" "$a1_baseline" "$a1_nachweise" <<'JS'
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const [dir, baselineCommit, evidenceRoot] = process.argv.slice(2);
if (existsSync(evidenceRoot)) throw new Error('Neuen Evidenzordner verwenden.');
const imageId = (tag) => execFileSync('docker', [
  '--host', 'unix:///var/run/docker.sock', 'image', 'inspect', tag,
  '--format', '{{.Id}}',
], { encoding: 'utf8' }).trim();
const config = {
  labAlias: 'eigener-rechner',
  baselineCommit,
  baselineDirectory: join(dir, 'baseline'),
  applicationImage: imageId('arsnova-1a-app:a19ca70f'),
  spacyImage: imageId('arsnova-1a-spacy:a19ca70f'),
  generatorLocation: 'same-host',
  orderSeed: 438314513,
  evidenceRoot,
  seriesDefinitionFile: resolve('docs/referat-thema-1/specs/2026-11-14-1a-messreihe-main-a19ca70f.json'),
};
writeFileSync(join(dir, 'labor.json'), JSON.stringify(config, null, 2) + '\n', {
  mode: 0o600, flag: 'wx',
});
console.log('Konfiguration:', join(dir, 'labor.json'));
console.log('Neue Nachweise:', evidenceRoot);
JS
```

Die beiden ausgegebenen Pfade aufbewahren. Bei einem neuen Terminal müssen
`a1_laborpfad` und `a1_nachweise` wieder auf genau diese Pfade gesetzt werden;
keinen neuen Vorlauf in einen bereits begonnenen Ordner schreiben.

## 4 Neuen Vorlauf ausführen

```bash
npm run load:resource-isolation:experiment -- \
  --pilot --config-file "$a1_laborpfad/labor.json"

node --input-type=module - "$a1_nachweise/vorlauf/abschluss.json" <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const abschluss = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(abschluss.complete, true);
assert.equal(abschluss.baselineCommit, 'a19ca70ff37dcb5510a77ab2745c06b70ccc3565');
assert.match(abschluss.seriesDefinitionSha256, /^[a-f0-9]{64}$/);
console.log('Vorlauf vollständig; neue Baseline und Reihendefinition erfasst.');
JS
```

Nur nach erfolgreichem Abschluss fortfahren. Ein neuer Vorlauf ist notwendig,
weil Anwendung, Images und Werkzeuge gegenüber der alten Messreihe geändert
sind. Die alten Vorlaufdaten dürfen dafür nicht übernommen werden.

## 5 Vollständige neue Reihe messen

```bash
npm run load:resource-isolation:experiment -- \
  --run --config-file "$a1_laborpfad/labor.json"
```

Der Runner verlangt den vollständigen passenden Vorlauf. Bei Fehler oder
Unterbrechung bleiben Teildaten erhalten; es gibt keine automatische
Wiederaufnahme. Ursache prüfen und für einen erneuten vollständigen Beginn
einen neuen Evidenzordner samt neuem Vorlauf verwenden.

## 6 Neue Reihe prüfen und auswerten

```bash
npm run load:resource-isolation:evaluate -- \
  --run \
  --evidence-root "$a1_nachweise" \
  --output-dir "$a1_nachweise/auswertung" \
  --series-file docs/referat-thema-1/specs/2026-11-14-1a-messreihe-main-a19ca70f.json
```

Die Auswertung verlangt alle 25 Läufe, 50 Ressourcenartefakte und 50
Compose-Aufnahmen, die passende Reihendefinition und gleichbleibende Images,
Werkzeuge, Hardware und Datensätze. Sie prüft beide Phasen sowie Rückwege und
berechnet die Leistungsgrenzen nach dem bisherigen Vertrag. Grenzverletzungen
sind Ergebnisse; fehlende oder widersprüchliche Nachweise sind Fehler.

Ergebnisse stehen neu unter `$a1_nachweise/auswertung/`:
`auswertung.json`, `live-vergleiche.csv` und `auswertung.md`. Der Vorabnachtrag
und die Reihendefinition werden mit der Reihe gespeichert; pro Lauf liegen
zusätzlich `compose-aufwaermung.json` und `compose-messung.json` vor.

## 7 Dokumente aus der aktuellen eingefrorenen Auswertung bauen

```bash
npm run load:resource-isolation:documents
```

Der Dokumentbau verwendet die unter dieser Anleitung verlinkte aktuelle Reihe.
Er prüft den zum Text passenden Befund und erzeugt HTML, PDFs, Grafiken und Manifest.
Eine weitere neue Messreihe muss fachlich bewertet und als Dokumentquelle ausgewählt
werden; bloßes Umbenennen von Dateien ersetzt diese Prüfung nicht.
Persönliche Freigabe und gemeinsamer Abgleich stehen in der
[Übergabeunterlage](./1A-abschluss-und-uebergabe.md).
