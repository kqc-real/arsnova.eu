# Issue-Entwurf: Themen-Snapshot mit fremder Version wird still wie „keine Daten“ behandelt

> **Status:** _Aktualisiert 2026-11-09:_ angelegt als [#15](https://github.com/NiklasSkulll/arsnova.eu/issues/15) im Fork (Unter-Issue von #10; ursprünglich englisch, seit 2026-11-10 deutsch und überarbeitet, maßgeblich ist das Issue). Ursprünglich: Entwurf, nicht angelegt. Angelegt wird erst nach Freigabe durch den Autor; Ort (kqc-real oder Fork) entscheidet er. Grundlage: Befund T2.3 im [Protokoll Teil 1](2026-10-24-tests.md). Entworfen mit Claude Code (Modell Claude Opus 5.5).

**Vorgeschlagener Titel:** `Moderationskontext: unbrauchbarer semantischer Themen-Snapshot ist nicht von fehlenden Daten unterscheidbar`

---

## Beobachtung

Liegt in Redis unter `nlp:wc:snapshot:v2:{session}:value:latest-qa-semantic` ein strukturell gültiger Themen-Snapshot mit einer anderen Version, behandelt der Moderationskontext ihn wie fehlende Daten:

- `getLatestQaSemanticTopicSnapshot` (`apps/backend/src/lib/wordCloudAnalysisCache.ts`, Stand `248029dc` Z. 614–628) liefert bei fehlgeschlagenem `QaSemanticTopicSnapshotSchema.safeParse` `null` und protokolliert nichts.
- Die Projektion meldet daraufhin `topics: { state: 'unavailable', reason: 'no-data' }`, also exakt dasselbe wie ohne Snapshot.

Ein Versionskonflikt zwischen Prozessen ist damit weder für die Lehrperson (Vorschau, Zusammenfassung) noch im Betrieb (Logs) erkennbar. Das kann z. B. nach einem Deployment passieren, solange noch Snapshots des vorherigen Releases in Redis liegen, oder wenn eine ältere Instanz schreibt.

## Reproduktion

Die Charakterisierungstests halten das Ist-Verhalten fest. Sie liegen auf dem Branch `feature-1C-context-path`, nicht in `main` `248029dc`: hinzugefügt in Commit `3f6e2f85`, in der heutigen Form (`it.todo` statt des vorherigen `it.fails`) seit Commit `14d26d15`.

- `apps/backend/src/lib/wordCloudAnalysisCache.test.ts`: „Negativprobe: liefert für einen strukturell gültigen Latest-Snapshot mit fremder Version still null wie bei fehlenden Daten“ (Versionen `qa-semantic-topic-snapshot-v0` und `-v2`; kein `warn`).
- `apps/backend/src/lib/moderationQaContext.test.ts`: „negative probe: projects a structurally valid snapshot with a foreign version exactly like no data“ (Projektion gleich der ohne Snapshot), daneben `it.todo('distinguishes a stale snapshot from no data')`.

## Erwartetes Verhalten

Laut #456 (Abschnitt 11: „Versionierte Adapterfähigkeit statt stiller Feldverluste“) sollte ein vorhandener, aber unbrauchbarer Snapshot unterscheidbar sein, z. B.:

- eigener Grund in der Projektion (_korrigiert 2026-11-10:_ neuer Wert in `ExplicitUnavailableReasonSchema`, etwa `incompatible-version`) oder, ohne Vertragsänderung, eine Limitation mit dem bestehenden Code `analysis-stale` bzw. `analysis-failed`,
- und mindestens ein `logger.warn` mit Schlüsselbereich und gefundener Version (ohne Inhalte).

## Vorschlag

1. Im Cache-Getter zwischen „kein Wert“ und „Wert nicht parsebar“ unterscheiden (Rückgabe mit Status statt nur `null`) und den zweiten Fall protokollieren.
2. In `collectQaTopicContext` den zweiten Fall als eigenen Grund bzw. eigene Limitation ausweisen.
3. Die beiden Charakterisierungstests umstellen und das `it.todo` als Test ausführen.

**Kosten:** gering (ein zusätzlicher Zweig im Getter und in der Projektion, Schema-Erweiterung um einen Grund). **Risiko:** gering; neue Grundwerte müssen in Vorschau-UI und Locales (`de`, `en`, `fr`, `es`, `it`) ergänzt werden. **Rückweg:** Revert.

## Gültigkeitsgrenze

Produktivcode `248029dc`, _Aktualisiert 2026-11-10:_ mit dem Produktivcode von `def56700` (HEAD des Branches) erneut grün (`wordCloudAnalysisCache.test.ts`, `moderationQaContext.test.ts`: 55 bestanden, 1 todo); geprüft mit den Unit-Tests auf dem Branch `feature-1C-context-path` (Redis gemockt). Wie häufig solche Snapshots im Betrieb vorkommen, ist nicht untersucht.

> **Aktualisiert 2026-11-05:** Die beiden Laborläufe ([Laptop](2026-11-05-labor.md#l4-endstatus), [PC](2026-11-05-labor-pc.md#l4-endstatus)) haben diesen Befund nicht untersucht: Sie lieferten weder einen Snapshot mit fremder Version noch Redis-Zustände aus einem Deployment. L4 zeigt nur, dass in den Läufen keine `source_changed`-Endstatus auftraten. Es gibt aus dem Labor daher keinen zusätzlichen Beleg für T2.3; die Gültigkeitsgrenze oben bleibt unverändert.
