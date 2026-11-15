# A1 – Aktueller Prüfstand

Stand: 15.11.2026. Bezug: aktuelle Messreihe auf main `a19ca70f` und ihre
anschließende Bereinigung. Diese Unterlage ersetzt die entfernten alten Prüfprotokolle.
Die gemessene Anwendungsrevision bleibt von späteren Werkzeug-/Dokumentationsänderungen getrennt.

## Messdaten und Integrität

Die einzige Reihe ist im [Evidenzindex](./evidenz/1A/README.md) verlinkt.
Nach Commit-Formatierung passten JSON-Dateibytes nicht mehr zu ihren gespeicherten
Hashes. Bei 95 Hauptreihendateien und zehn Compose-Aufnahmen des Vorlaufs wurden
ausschließlich die bereits durch vorhandene SHA-256 belegten Originalbytes wiederhergestellt.
Messwerte und Manifestprüfsummen wurden nicht verändert. Roh-JSON ist jetzt von Prettier ausgenommen.

Vor der Umstellung des Evaluator-Standards wurde die aktuelle Reihe mit ihrer
expliziten Definition nach `/tmp/a1-cleanup-referenz-20261115` erneut ausgewertet.
`diff -q` der gespeicherten und neu erzeugten `auswertung.json` meldete keinen Unterschied.
Nach Änderungen am Auswertungscode darf dessen eigener Hash abweichen;
Identitäten, Eingabehashes, Zahlen, Vergleichs- und Entscheidungsregeln müssen gleich bleiben.

## Abschließende Werkzeugprüfungen

Alle sechs A1-Suiten bestanden unter Node 24.18.0: **108 Tests**, aufgeteilt in
9 Fixture-, 12 Live-Metrik-, 20 Analyse-, 22 Infrastruktur-, 17 Experiment-
und 28 Auswertungs-/Vorlagen-/Compose-Tests. Der Wechsel des Evaluator-Standards
wurde zuvor durch fehlschlagende Tests gegen die aktuelle Reihe nachgewiesen.

| Prüfung                                     | Tatsächlich ausgeführtes Ergebnis                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Alle sechs nachstehenden A1-Testbefehle     | Exit 0; 108 bestanden, keine fehlgeschlagen                                                                                    |
| Aktuelle Neuauswertung mit neuem Standard   | Exit 0; alle Identitäten, Eingabehashes, Messzahlen und Entscheidungen identisch; ausschließlich Auswertungscode-Hash geändert |
| `npm run lint`                              | Exit 0; ohne Fehler/Warnungen, mit temporärem Git-Index für entfernte/umbenannte Skripte                                       |
| `npm run load:resource-isolation:documents` | Exit 0; Handout vier Seiten/1179 Wörter, Folien neun Seiten/615 Wörter; keine Seitenüberläufe                                  |
| Eingabedateien und Dokumentmanifest         | Alle 154 Eingabehashes sowie Quelle, Vorlagen und sieben Dokumentartefakte stimmen                                             |

Das Lintinventar liest getrackte Pfade aus dem Git-Index. Der erste Lauf vor
Übernahme der Löschungen in einen Index scheiterte am bereits entfernten
Rekonstruktionsskript. Die Abschlussprüfung verwendete deshalb eine Kopie des
Index unter `/tmp`, in der ausschließlich diese Skriptlöschungen und der
umbenannte Compose-Test berücksichtigt wurden. Niklas' echter Staging-Bereich
blieb unverändert; nach `git add` ist der gewöhnliche Befehl direkt verwendbar.

```bash
npm run load:resource-isolation:fixture:test
npm run load:artillery:metrics:test
npm run load:resource-isolation:analysis:test
npm run load:resource-isolation:infrastructure:test
npm run load:resource-isolation:experiment:test
npm run load:resource-isolation:evaluation:test
npm run lint
npm run load:resource-isolation:documents
```

Zusätzlich bestanden Prettier der geänderten Quellen/Dokumente und
`git diff --check`. Alle geprüften lokalen A1-Dateiverweise haben vorhandene Ziele.
Alle 127 eingefrorenen JSON-Dateien werden durch die Prettier-Ausnahmeregel geschützt.
Der abschließende Hashabgleich bestätigt sämtliche 154 Eingaben der Auswertung
sowie Renderer und erzeugte Dokumentartefakte.

## Allgemeine Projektprüfungen und bekannte Grenze

Nach dem main-Merge hat Niklas im Chat erfolgreiche Installation mit Node 24.18.0,
Prisma-Generierung, Typecheck, Lint, Produktionsbuild sowie fünf spaCy-Unit- und
zwei Compose-Vertragstests mitgeteilt. Der vollständige Frontend-Lauf meldete
2872 bestandene Tests und einen Fehler im ursprünglichen Test
`apps/frontend/src/app/features/session/session-host/session-host.component.spec.ts`:
Die Erwartung »viel Zustimmung« passt nicht mehr zum aktuellen Hinweistext.
Dieser sachfremde Test bleibt auf ausdrücklichen Wunsch unverändert.

Diese Angaben sind mitgeteilte Ergebnisse, keine bei dieser Bereinigung erneut
selbst ausgeführten vollständigen Projektprüfungen. Ein grüner Gesamttest oder
CI-Status wird nicht behauptet. Produktivcode, Compilerkonfigurationen und
Deploymentdateien werden für die Bereinigung nicht geändert.

## Freigabegrenzen

Keine neue Docker-Lastmessung, kein Commit, Push, PR-Merge oder Nachrichtenversand
bei dieser Bereinigung. Persönliche Gegenprüfung, institutionelle KI-/Abgabevorgaben,
gemeinsame Abstimmung und unabhängige Prüfung des endgültigen Branch-Diffs bleiben
Punkte der [Übergabe](./1A-abschluss-und-uebergabe.md).
