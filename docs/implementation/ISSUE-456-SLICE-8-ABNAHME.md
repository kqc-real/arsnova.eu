<!-- markdownlint-disable MD013 -->

# Issue #456 – Slice-8-Abnahme und offene Betriebsgrenzen

**Stand:** 2026-10-17

**Scope:** finaler Integrationsstand der Slices 5–8 auf Basis der bereits gemergten Runtime R inkl. realer Laufzeit- und Qualitätsmessungen für `learning_objectives`, `qa_summary` V2 und `topic_label` auf dem privaten 8-vCPU-Produktionshost (`arsnova-privat`)
**Produktivstatus:** Beide Flags sind im Repository standardmäßig aus (`false`). Auf dem Produktionssystem wurden `learning_objectives`, `qa_summary` V2 und `topic_label` real gegen `llama-server` (`10.0.0.2:8080`) verifiziert.

## Ergebnis

Die Slices 5–7 sind im Code als zusammenhängender, weiterhin abschaltbarer Pfad vorhanden:

- Die Lernzielableitung ist ein ausdrücklich gestarteter, abbrechbarer Vorbereitungsauftrag. Sie verwendet die private Runtime, nicht Join, Vote, Q&A-Submit oder WebSocket.
- N10–N12 bauen den frisch hostautorisierten, lösungsfreien Analysekontext, packen ihn deterministisch, schließen Quellenreferenzen und bilden Hash sowie begrenzten Cache.
- N13–N15 handeln `full-context` und `legacy-text` explizit aus, stellen einen lokalen extraktiven Fallback bereit und prüfen Hostrecht, Retention, Hash und Quellen vor sowie nach der Verarbeitung erneut.
- `qa.summaryContextPreview` ist hostgeschützt. Die Host-UI lädt die Diagnose nur nach einer eigenen Aktion und zeigt Verträge, Modus, Cache, Bereichszustände, Mengen, Budget und Kürzungsgründe. Instruktions-/Definitionstext und vollständige Rohinhalte werden dort nicht angezeigt.
- `QaSummaryRuntimeCompatibleDTOSchema` versucht V2 vor dem unveränderten Legacy-Vertrag. Inkompatible Adapter erhalten keinen scheinbar erfolgreichen, still gekürzten V2-Auftrag.

Das ist ein technischer Übergabenachweis, keine empirische Bestätigung eines endgültigen Moderationsprompts oder einer didaktischen Wirksamkeit.

## Reproduzierbares Demo-Quiz-Szenario

Der verbindliche Integrationsrunner verwendet das kanonische Demo-Quiz aus `apps/frontend/src/assets/demo/quiz-demo-showcase.<locale>.json`; die Produktquelle bleibt `getDemoQuizPayload(...)` in `apps/frontend/src/app/features/quiz/data/demo-quiz-payload.ts`. Er erzeugt kein verkürztes Ersatzquiz.

Netzwerkfreie Vertrags- und Korpusprüfung:

```bash
npm run load:issue-456:validate
```

`--validate` liest ausschließlich Repositorydateien. Es öffnet keine HTTP-, WebSocket-, Datenbank- oder Redis-Verbindung und prüft insbesondere:

- das kanonische Demo-Quiz und seine 13 Aufgaben;
- mindestens 250 Teilnahmen;
- mindestens zehn fachlich sinnvolle Q&A-Fragen je Teilnahme und damit mindestens 2.500 Einreichungen;
- den kuratierten Bezug der Fragen zum Demo-Quiz oder zu Funktionen, Nutzung, Barrierefreiheit und Datenschutz von arsnova.eu;
- Text- und Vertragsgrenzen ohne technische Platzhalterfragen.

Der netzwerkfreie Lauf vom 2026-10-05 bestand mit 14/14 Tests: 250 Teilnahmen, genau 2.500 Fragen, davon 1.250 zum Demo-Quiz und 1.250 zu arsnova.eu. Am 2026-10-13 wurde `npm run load:issue-456:validate` erneut mit 14/14 bestandenen Tests und denselben Korpusmengen ausgeführt. Der echte lokale `--run` wurde bei diesem Dokumentationsabgleich nicht ausgeführt.

Der echte Lauf ist absichtlich nur gegen Loopbackziele zugelassen:

```bash
# separates Terminal für den lokalen Backendprozess
QA_SUMMARY_ENABLED=true npm run dev:backend

# Lastgenerator erst nach erfolgreichem Backendstart
npm run load:issue-456:run
```

Der Runner verweigert kleinere Werte als 250 Teilnahmen beziehungsweise zehn Fragen je Teilnahme und verweigert Nicht-Loopback-Ziele. Alle Clients kommen aus demselben Lastgeneratornetz und bilden damit auch den zulässigen Shared-NAT-Fall ab. Der Ablauf erstellt eine lokale Session mit kanonischem Demo-Quiz, Q&A und Blitzlicht, speichert vor dem ersten Join ein bestätigtes manuelles quiz-weites Lernziel, lässt die Teilnehmenden beitreten, reicht die mindestens 2.500 Fragen capability-gebunden ein, übt Quiz und Feedback aus und ruft anschließend Kontextvorschau sowie versionierten Summary-Auftrag auf. Der persistierte Bericht übernimmt vom Lernziel nur Anzahl und Revision, nicht den Text. Er ist kein Produktionslasttest und darf nicht gegen `arsnova.eu` ausgeführt werden.

`QA_SUMMARY_ENABLED=true` muss am **Backendprozess** gesetzt sein; eine gleichnamige Variable nur am Lastgenerator ändert den bereits laufenden Server nicht. Der Runner prüft deshalb unmittelbar nach dem Erstellen der lokalen Session und noch vor Lernziel, Joins und 2.500 Q&A-Einreichungen, dass das Backend Summary V2 aktiviert meldet. Bei einem späteren Fehler beendet er die von ihm erstellte Session idempotent über `session.end`, damit der stabile Demo-History-Scope keinen Folgelauf blockiert.

Der netzwerkfreie Lauf belegt nur Testdaten und Harness-Vertrag. Ein erfolgreicher `--run` gegen eine lokale App belegt den Anwendungsfluss, ersetzt aber weder die reale Modellmessung noch eine Freigabe des Produktivflags.

## Festes Summary-V2-Budgetprofil

Der technische Übergabepfad verwendet derzeit dieses feste Profil:

| Anteil                                      |  Wert | Bedeutung                                                             |
| ------------------------------------------- | ----: | --------------------------------------------------------------------- |
| Kontextfenster                              | 8.192 | konservative UTF-8-Obergrenze des Packers für das feste Runtimeprofil |
| technische Instruktion                      |   314 | exakte UTF-8-Bytes                                                    |
| Bedeutungsdefinition                        |   203 | exakte UTF-8-Bytes                                                    |
| Antwortreserve                              |   640 | reservierte Ausgabetokens                                             |
| Sicherheitsmarge                            |   128 | nicht für Eingabedaten verwendbar                                     |
| verbleibende konservative Kontextobergrenze | 2.811 | kanonisches JSON des gepackten Fachkontexts                           |

Die llama.cpp-Übergabe besteht bei V2 aus genau drei Nachrichten:

1. System: die versionierte technische Instruktion;
2. System: die versionierte Bedeutungsdefinition;
3. User: ausschließlich das kanonische JSON von `promptContext.context`.

Transportfelder wie Hash, `packedAt` und der Budgetbericht werden nicht noch einmal als Userinhalt dupliziert. Untrusted Fragen-, Quiz- und Lernzieltexte bleiben dadurch strukturell von den beiden Systemnachrichten getrennt.

### Offener Blocker: Prefill-/RSS-Abnahme des 8.192-Profils

Das feste Profil liegt bei 8.192 (unter dem praxisnahen 8k-Arbeitsfenster von Qwen3-4B Q4). Bei zu großen Basismetadaten verschweigt die Implementierung das nicht: Sie packt kontrolliert eine Q&A-Textbaseline bzw. Force-Fit-Mindestbelege neu und weist ausgelassene Bereiche und `token-budget`-/`budget-truncated`-Gründe im Vertrag und in der Vorschau aus.

Damit sind V2-Vertrag, Quellenbindung, Vorschau und Fallback ausführbar. **Nicht belegt ist die Prefill-/RSS-Abnahme des reichhaltigen Vollkontexts auf dem vorgesehenen CPU-Profil mit 8.192 Kontexttokens.** Das darf weder als bestandene Full-context-Abnahme noch als Anlass für einen stillen Kontext-Hochsetzen auf Modelldefault (32k/128k), GPU-, Modell- oder SaaS-Wechsel dargestellt werden. Vor einer Produktivfreigabe braucht es eine ausdrückliche Messung.

## Reale Modell- und Betriebsmessung

Runtime R besitzt einen vollständig dokumentierten realen Kurzlauf für `topic_label`; Systemtext, Usernachricht, JSON-Schema, vollständige Antworten, Digests, Hardware und Laufzeiten stehen in [Private Open-Weight-LLM-Runtime](../features/open-weight-llm-runtime.md#vollständig-protokollierte-lokale-modellprüfung-vom-2026-10-05).

Seit dem ursprünglichen Integrationsstand liegt für `learning_objectives` ein realer Lauf auf dem privaten Produktionshost vor. Bei einem vollständigen Demo-Quiz-Versuch am 12.10.2026 waren zwei Batches erfolgreich; Batch 3 scheiterte zeitgleich mit einem Docker-OOM-Ereignis am damaligen 5-GiB-Containerlimit. Bereits erzeugte Teilresultate wurden nicht als Lernziele angewendet. Der Betreiber setzte den laufenden Container auf 8 GiB RAM und 10 GiB RAM plus Swap; [PR #566](https://github.com/kqc-real/arsnova.eu/pull/566) schreibt diese Grenze in `docker-compose.llm.yml` fest. Beim anschließenden vollständigen Demo-Quiz-Lauf wurden zehn Lernzielvorschläge als Entwürfe hinzugefügt. Der Container blieb gesund und sein Restart-Zähler bei 1; die aktuelle cgroup meldete `memory.peak=3825471488` Byte (ca. 3,56 GiB), `oom=0` und `oom_kill=0`. Das `memory.events`-Ergebnis betrifft die aktuelle cgroup und widerlegt das zuvor protokollierte Docker-OOM-Ereignis nicht.

Dieser Lauf war eine interaktive Lernzielableitung, **nicht** der lokale 250-Teilnahmen-/2.500-Q&A-Integrationsrunner aus dem vorigen Abschnitt.

Am 17.10.2026 wurden zusätzlich auf derselben Zwei-Host-Produktionsarchitektur (`arsnova` ↔ `arsnova-privat` unter `10.0.0.2:8080`) reale Ende-zu-Ende-Läufe für `qa_summary` V2 und `topic_label` (Einzel- und Multi-Cluster-Batch-Vertrag) durchgeführt:

- **`qa_summary` V2 (`qa-summary-technical-handoff-v2` + `qa-summary-model-output-v3`):** Mit geschärfter technischer Systeminstruktion (314 UTF-8-Bytes, einzeiliges JSON, ausschließliche Zusammenfassung von `included`-Quellen) und den auf 4 Aussagen / 2 nächste Schritte / 2 Hinweise begrenzten Modell-Arrays (`QaSummaryModelOutputV2BaseSchema`) schloss der Lauf auf dem privaten Produktionshost mit `status: "completed"`, `finish_reason: "stop"`, `completionTokens: 374` (vorher 496 bzw. 640-Token-Abbruch) in **56,9 Sekunden** ab.
- **`topic_label` (`schemaVersion: 2` Multi-Cluster-Batching + `clusterTopicLabelCache`):** Ein Sammelauftrag über 6 Themen-Cluster mit kompakten Quell-IDs (`s1`..`s6`) schloss mit `status: "completed"`, `promptTokens: 411`, `completionTokens: 179` in **22,9 Sekunden** ab. Durch `sessionClustersCache`, `sessionItemEmbeddingsCache`, Hintergrund-Pre-Warming (`scheduleWordCloudSemanticEmbeddingPrewarm`) und `clusterTopicLabelCache` sinkt die Antwortzeit bei Sortierwechseln auf 500 Q&A-Fragen auf **< 5 ms**.

Für die noch offene formale Abnahme müssen ohne Secrets dauerhaft in der Abnahmedokumentation festgehalten werden:

- Hardware, Containerlimits, Image-, llama.cpp- und Modelldigest;
- Kontextlimit, exakte Eingabe- und Antwortreserve, Prompt-/Completiontokens;
- vollständige Systemnachrichten, Usernachricht, angefordertes Schema und vollständiger Responsebody;
- Prefill/TTFT, Gesamtlaufzeit, Tokens pro Sekunde und Spitzen-/stabiler RSS;
- Kalt-/Warmlauf, Slotbelegung, Cachezustand, Timeout und Fallbackbedingung.

Bis diese Daten und die fachliche Prüfung für Lernziele sowie der reale Summary-V2-Nachweis auf der vorgesehenen CPU-Box vorliegen, bleibt der Betriebsanteil von Slice 8 ausdrücklich offen. Die Repository-Defaults bleiben aus; der vom Betreiber aktivierte Produktionswert ist eine getrennte Betriebsentscheidung.

## Zuordnung der Slice-8-Abnahme

| Abnahmepunkt                                                                    | Stand am 2026-10-13                                                                                                                                                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vorbereitung → Lernziele → Q&A/Quiz/Feedback → Vorschau → versionierter Auftrag | Realmodell-Lernziellauf mit vollständigem Demo-Quiz erfolgreich; lokaler Integrationsrunner und modellfreie Verträge vorhanden, aber sein echter `--run` hier nicht nachgewiesen                        |
| Vollständiger Kontext und Minimalfall nur Q&A-Texte                             | beide Vertragswege getestet; 8.192-Profil packt Referenzbelege, degradiert bei Shell-Überlauf auf Q&A-Baseline/Force-Fit                                                                                |
| Produktionsnahe CPU-/Prefill-/Speichermessung                                   | cgroup-Spitzenwert für erfolgreichen Lernziellauf gemeldet; CPU, Prefill/TTFT, Gesamtlaufzeit, Modell-RSS und reale Summary-V2-Messung weiterhin offen                                                  |
| Nutzbares Budgetprofil                                                          | Lernziel-Demo-Quiz lief mit dem bestehenden Profil durch; Prefill-/RSS des 8.192-Summaryprofils **nicht belegt**                                                                                        |
| Join, Vote, Q&A-Submit und WebSocket unabhängig vom Modell                      | Architektur und modellfreie Hotpath-/Slot-/Queue-Tests vorhanden; keine automatische Inferenz in diesen Pfaden                                                                                          |
| Telemetrie ohne Rohprompt, Texte oder Personenkennungen                         | Standardlogs der Lernziel-Batches enthalten Laufzeit und Tokenzahlen ohne Rohinhalt; vollständige Prompt-/Antwortdaten nur im ausdrücklich aktivierbaren Diagnosemodus; Summary-V2-Realtelemetrie offen |
| Berechtigung, Freigabe, Cache, Quellenintegrität, Fallback                      | fokussierte Shared-/Backend-/Frontendtests decken positive, negative und Änderungsfälle ab                                                                                                              |
| Fünf Locales und mobile Hostansicht                                             | XLF-Verträge und responsive UI sind implementiert; abschließende manuelle Fünf-Locale-/Mobile-Browserabnahme offen                                                                                      |
| Endgültiger Moderationsprompt und didaktische Wirksamkeit                       | ausdrücklich außerhalb von #456; nur technische, quellengebundene Übergabe                                                                                                                              |

## Verifikationspaket

```bash
npm run load:issue-456:validate
npm test -w @arsnova/shared-types -- --run \
  src/qa-summary-v2.test.ts \
  src/qa-summary-visibility.test.ts
npm test -w @arsnova/backend -- --run \
  src/lib/moderationSummaryContext.test.ts \
  src/lib/openWeightLlmClient.test.ts \
  src/lib/qaSummaryQueue.test.ts \
  src/__tests__/qa.summary.test.ts
npm run test -w @arsnova/frontend -- \
  src/app/features/session/session-host/moderation-compass-dialog.component.spec.ts \
  src/app/features/session/session-host/session-host.component.spec.ts
npm run check:i18n -w @arsnova/frontend
npm run typecheck
npm test
npm run lint
npm run build:prod
```

Ein Kommando gilt erst nach tatsächlicher Ausführung als bestanden. Der finale Pull Request muss die exakten Ergebnisse sowie nicht ausgeführte Browser-, Runtime- oder Hardwareprüfungen mit Risiko nennen. Issue #456 darf wegen der beiden offenen Betriebsnachweise nicht allein aufgrund der implementierten Verträge geschlossen werden.
