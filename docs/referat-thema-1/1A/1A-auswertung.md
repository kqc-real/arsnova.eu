# A1-Auswertung und Betriebsentscheidung

Stand: 15.11.2026. Auftrag: [Issue #6](https://github.com/NiklasSkulll/arsnova.eu/issues/6).
Maßgeblich ist ausschließlich die [vollständige aktuelle Reihe](../evidenz/1A/reihe-main-a19ca70f-20261115-122547/).
Der [Versuchsvertrag](./1A-experiment-contract.md) legt die Methodik fest;
[Vorabnachtrag](../specs/2026-11-14-1a-messreihe-main-a19ca70f.md) und
[Reihendefinition](../specs/2026-11-14-1a-messreihe-main-a19ca70f.json) binden die aktuelle Baseline.

## Entscheidung

**Für dieses Lastprofil bleibt `NLP_ENABLED=false` die begründete Gegenalternative.**
H1 und H2 werden nach den vorab festgelegten Regeln nicht bestätigt.
V2 erfüllt Analyseverfügbarkeit, Drosselungs-, Speicher- und OOM-Regeln,
verfehlt aber einen relativen Live-Vergleich. Unter CPU-Drosselung V3 werden
in Block 5 zusätzlich drei absolute 50-ms-Grenzen verletzt.
Eine nachträgliche Lockerung der Kriterien oder Entfernung dieses Blocks ist nicht zulässig.
Das Ergebnis ist keine allgemeine Aussage gegen spaCy und keine Freigabe zusätzlicher LLM-Last.

## Nachweiskette und Reproduktion

- **Anwendung:** unveränderter Fork-main-Commit `a19ca70ff37dcb5510a77ab2745c06b70ccc3565`, Version 1.4.0.
- **Werkzeuge:** im Manifest gespeicherter Werkzeug-HEAD `e3b27b328ffc94c148e4a35b2645396786f26bd9`
  und gesonderter Quellenhash `99d5c23c6a1d3b6b9e4f254e5ddea066a42bbe3d70722fb3bbd51b2efecd10a0`.
  Der Anwendungscommit, der Werkzeug-HEAD und spätere Dokumentationscommits sind verschiedene Größen.
- **Eingaben:** Fixture-Seed `438314513`; Vertrags-, Definitions-, Fixture- und Image-Identitäten im
  [Abschluss](../evidenz/1A/reihe-main-a19ca70f-20261115-122547/abschluss.json). Fünf Analysesessions mit je 500 zulässigen Fragen,
  drei Ausschlusskontrollen und 200 Bezugsteilnehmenden; getrennte Live-Session.
- **Ausführung:** fünf randomisierte Blöcke V0–V4, 25 vollständige Läufe;
  je 60 Sekunden Aufwärmung und 300 Sekunden Messfenster. Eigener erfolgreicher Vorlauf unter `vorlauf/`.
- **Aufnahmen:** 50 Ressourcenartefakte mit 151 Mess- beziehungsweise 31 Aufwärmstichproben
  und 50 tatsächlich aufgelöste, bereinigte Compose-Dateien für die Hauptreihe.
  Je Phase stehen Dateiname und SHA-256 im Manifest; die Auswertung prüft zusätzlich Images, Limits und Flags.
- **Ausgabe:** [JSON](../evidenz/1A/reihe-main-a19ca70f-20261115-122547/auswertung/auswertung.json),
  [vollständige Tabellen](../evidenz/1A/reihe-main-a19ca70f-20261115-122547/auswertung/auswertung.md),
  [80 Aktionsvergleiche als CSV](../evidenz/1A/reihe-main-a19ca70f-20261115-122547/auswertung/live-vergleiche.csv).

```bash
npm run load:resource-isolation:evaluate -- --validate
npm run load:resource-isolation:evaluation:test
npm run load:resource-isolation:evaluate -- \
  --run \
  --evidence-root docs/referat-thema-1/evidenz/1A/reihe-main-a19ca70f-20261115-122547 \
  --output-dir /tmp/arsnova-1a-auswertung-gegenpruefung
```

Der Ausgabeordner muss neu sein. Der Evaluator arbeitet lesend und startet keine Last.
Er verwendet standardmäßig die aktuelle Reihendefinition; `--series-file` kann als letztes
Argumentpaar ausdrücklich dieselbe Definition angeben. Eingabefehler liefern Exitcode 1;
ordnungsgemäß erfasste Grenzverletzungen sind reguläre Ergebnisse mit Exitcode 0.
Ändert sich nur Auswertungscode, ändert sich dessen Quellenhash; die eingefrorene Ausgabe wird nicht überschrieben.

## Systemgrenzen und Labor

| Bestandteil             | Einordnung im untersuchten Aufbau                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| App                     | Backend mit Datenzugriff, Aggregation und Kontextaufbau; keine zusätzlichen CPU-/RAM-/PID-Limits                                  |
| PostgreSQL / Redis      | Eigene Container; keine zusätzlichen CPU-/RAM-/PID-Limits                                                                         |
| PDF-Worker              | Aktiv, 1 CPU, 1 GiB, **256 PIDs**; keine gezielte PDF-Last                                                                        |
| spaCy                   | Unix-Socket-Sidecar, kein eigenes Netzwerk; regulär 1 CPU, 1 GiB, 64 PIDs                                                         |
| 8.9b                    | In-Process-Klassifikation; `QA_NLP_ENABLED=false`                                                                                 |
| Encoder / Summary / LLM | Im Versuch abgeschaltet beziehungsweise nicht gestartet; generative Inferenz bleibt eine eigene private Serverrolle nach ADR-0035 |

Hardware laut Manifest: Ubuntu 24.04.5 LTS unter WSL2,
Kernel `6.18.58.1-microsoft-standard-WSL2`, 16 logische CPUs,
16.720.453.632 Byte RAM, Docker **29.9.3**, cgroup v2 und Node **24.18.0**.
Generator und Container teilen denselben Rechner. Ports sind an Loopback gebunden;
Projektname, Volumes und Netzwerk gehören zum isolierten Labor `arsnova-1a`.
Ein Containerlimit reserviert weder CPU-Zeit für die App noch freie Hostkapazität.

## Live-Aktionen und Hypothesen

Alle **40.000 geplanten Live-Aktionen** wurden im Messfenster erfolgreich erfasst:
je 12.500 Beitritte, Quiz- und Tempostimmen und 2.500 Q&A-Einreichungen.
Es gab keine fehlgeschlagenen Versuche oder fehlende geplante Arbeit.
Der höchste Quiz-p95 beträgt **167,37 ms** und liegt unter dem 1000-ms-Ziel.

| Vergleich               | Vergleiche | Verfehlungen | Betroffene Fälle                                    |
| ----------------------- | ---------- | ------------ | --------------------------------------------------- |
| V0 → V1                 | 20         | 4            | Beitritt Block 2 und 4; Q&A und Tempo Block 3       |
| V1 → V2, H1             | 20         | **1**        | Q&A Block 4                                         |
| V1 → V3 und V1 → V4, H2 | 40         | **6**        | V3 alle vier Aktionen Block 5; V4 Q&A Block 4 und 5 |

Alle elf Verfehlungen verletzen die relative 10-%-Regel.
**Drei verletzen zugleich die absolute 50-ms-Regel:** V3 in Block 5 bei
Beitritt (+164,54 ms), Quiz (+119,75 ms) und Q&A (+214,45 ms).
Die Fehler- und Abdeckungsregeln bestehen. Grenzwerte werden vor Rundung geprüft.

H1-Beispiel: Q&A in Block 4 steigt von **18,97 ms** in V1 auf **22,95 ms**
in V2, also um **3,98 ms beziehungsweise 20,96 %**. Die absolute Regel besteht,
die relative nicht. Auch die V0→V1-Schwankungen und der auffällige V3-Block 5
bleiben vollständig erhalten. Weder die einzelne Ursache einer Latenzdifferenz
noch ein bestimmter störender Hostprozess ist durch die Messung identifiziert.

## Analyseverfügbarkeit und Störungsinterpretation

Verfügbarkeit bedeutet erfolgreicher LEMMA-Abschluss **im Messfenster**.
Ein lexikalischer Fallback kann weiterhin eine nutzbare Wortwolke liefern,
gilt aber nicht als erfolgreiche Lemmatisierung.

| Variante | Geplant | LEMMA-Erfolg | Fallback | Am Ende offen | p95-Spannweite              |
| -------- | ------- | ------------ | -------- | ------------- | --------------------------- |
| V1       | 750     | 0            | 750      | 0             | Fallback 37,27–43,45 ms     |
| V2       | 750     | 750          | 0        | 0             | Erfolg 463,91–498,38 ms     |
| V3       | 750     | **741**      | **6**    | **3**         | Erfolg 2202,60–3178,87 ms   |
| V4       | 750     | 0            | 745      | 5             | Fallback 5044,01–5063,11 ms |

V2 hält höchstens 1 % unverfügbare geplante Analysen in jeder Wiederholung ein.
V3-Fallbacks bestehen aus drei `TIMEOUT` und drei `SIDECAR_UNAVAILABLE`;
ihr p95 im betroffenen Lauf beträgt 5182,38 ms.
V4-Fallbacks bestehen aus 495 `TIMEOUT` und 250 `SIDECAR_UNAVAILABLE`.
Späte Abschlüsse machen `IN_FLIGHT_AT_END` nicht rückwirkend verfügbar.

V4 verzögert die **Weiterleitung** um 6000 ms bei 5000 ms Client-Timeout.
Alle fünf Proxy-Lebenszeitzähler melden `forwarded: 0`; sie umfassen die Aufwärmung.
Damit untersucht V4 Timeout, Rückstau und Ersatzpfad, keine tatsächlich langsam
rechnende spaCy-Inferenz. `SIDECAR_UNAVAILABLE` kann im geprüften Client auch
Rückstau an seiner Zwei-Anfragen-Grenze bedeuten und beweist keinen Sidecar-Ausfall.

## Ressourcenbudget

| spaCy-Messwert            | V2 normal     | V3 0,25 CPU   | V4 Verzögerung |
| ------------------------- | ------------- | ------------- | -------------- |
| Mittlere CPU, % einer CPU | 18,29–18,63   | 20,03–24,01   | 0,53–0,55      |
| Gedrosselte Perioden, %   | 0,53–0,84     | 88,47–95,88   | 0              |
| Lebenszeit-RAM-Peak, MiB  | 479,53–480,53 | 490,04–505,11 | 463,21–464,27  |
| OOM-Zuwachs               | 0             | 0             | 0              |

V2 hält das Budget von 819,20 MiB (80 % von 1 GiB) und höchstens 5 %
gedrosselten Perioden ein. Kein gemessener Dienst weist einen OOM-Zuwachs auf.
CPU und Drosselung sind Zählerdifferenzen derselben Generation im Messfenster.
`memory.peak` ist ein Lebenszeitwert einschließlich Aufwärmung; er wird nicht subtrahiert.
Die vollständigen Ressourcenwerte aller Dienste und der Aufwärmung stehen im JSON.
Dienstpeaks werden nicht als gleichzeitig gemessene Hostspitze addiert.

## Einsatzgrenze, Aufwand und Rückweg

- **Aktivierung:** Lexikalische Alternative beibehalten; keine Änderung der Produktionsflags durch A1.
- **Weiteres Laborbudget:** Untersucht sind 1 CPU, 1 GiB und 64 PIDs.
  0,25 CPU verursacht hohe Drosselung, schlechtere Analyseverfügbarkeit und
  Live-Grenzverletzungen; keine belegte gleichwertige Einsparung.
  Ein kleineres RAM-Limit wurde nicht getestet.
- **Aufwand:** Image-/Modellpflege, Start, Healthchecks, Socket-Zuordnung,
  Limits sowie Überwachung von Timeouts, Fallbacks und Ressourcen.
  Deaktivierung spart Sidecar-Betrieb, verzichtet aber auf Zusammenführung von Flexionsformen.
  Eurokosten und didaktischer Nutzen wurden nicht gemessen.
- **Rückweg:** Last und Proxy beenden, direkten Socket und spaCy-Limit wiederherstellen,
  `NLP_ENABLED=false`, App neu erzeugen, spaCy stoppen, Basisdienste,
  lexikalischen Pfad und Live-Beitritt prüfen; anschließend eigenes Labor entfernen.

## Gültigkeitsgrenzen und Abschluss

Generator und Dienste konkurrieren auf demselben WSL2-Rechner. Die Beitrittswelle
belegt weder dauerhaft 500 aktive Clients noch Browser-Rendering, vollständige
Kompassaktualität, allgemeine Modellgüte, eine 8-vCPU-Produktionskapazität oder zusätzliche LLM-Tragfähigkeit.
Die Fixture enthält unterschiedliche Rohtexte mit bewusst kleinem wiederholtem Wortschatz.
Eine neue Untersuchung mit externem Generator und dokumentierter Zielhardware
wäre eine eigene Reihe, kein Ersatz einzelner ungünstiger Blöcke.

[Abgabeentwürfe](archiv/entwurf/README.md), [Eigenanteil](./1A-eigenanteil.md),
[Prüfungen](./archiv/1A-pruefstand.md) und [Übergabe](./archiv/1A-abschluss-und-uebergabe.md)
trennen technische Befunde von persönlicher Abgabe und GitHub-Abschluss.
