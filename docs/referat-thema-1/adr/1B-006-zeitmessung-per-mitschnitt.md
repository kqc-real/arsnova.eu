# 1B-006: Zeitmessung per Paketmitschnitt auf beiden Hosts

- **Status:** methodisch (2026-11-12)
- **Kategorie:** Methodik

## Kontext

1B Schritt 2 verlangt Netz-, Adapter- und Inferenzzeit getrennt. Der Client verwirft seine Telemetrie für Summary V2, und in 1C maß ein aufzeichnender Proxy. Der lauscht aber fest auf `127.0.0.1` im Vitest-Prozess (`startRecordingProxy` in `apps/backend/src/__tests__/lib/recording-proxy.ts`); der App-Container erreicht ihn nicht, ohne den Pfad zu ändern.

## Entscheidung

Gemessen wird ohne Eingriff in den Release-Pfad: `tcpdump` auf beiden VMs, `timings` aus der Antwort der Runtime, `latencyMs` aus der App-Logzeile `qa_summary:completed`.

| Größe                | Rechnung                                                                       |
| -------------------- | ------------------------------------------------------------------------------ |
| Netz                 | Drahtzeit am App-Host − Drahtzeit am Inferenz-Host, über `GET /slots` und POST |
| Inferenz             | `timings.prompt_ms + timings.predicted_ms`                                     |
| Server ohne Inferenz | Drahtzeit des POST am Inferenz-Host − Inferenz                                 |
| Adapter              | `latencyMs` − Drahtzeit am App-Host                                            |

Drahtzeit heißt: erstes Anfragesegment mit Nutzdaten bis zur vollständigen Antwort. Jede Differenz stammt aus Zeitpunkten eines Rechners; ein Uhrenabgleich der VMs ist nicht nötig. Kontrolle C0: derselbe POST-Body einmal direkt im Inferenz-Host. Die Auswertung hat einen eigenen Test (`evidenz/1B/messung/zeitzerlegung.test.mjs`).

_Ergänzt 2026-11-14 (Docs-Audit):_ Nach der Vollständigkeitsprüfung kam eine zweite Kontrolle nach Dossier 10.3 dazu (M2: kurze Anfrage, je n = 30, Hypothese H_C0; [Design-Nachtrag 2026-11-13](../specs/2026-11-12-1b-zwei-host-design.md#nachtrag-2026-11-13-ergänzende-messungen-nach-der-vollständigkeitsprüfung), Ergebnis im [Laufprotokoll](../evidenz/1B/2026-11-13-lauf.md#nachtrag-2026-11-13-abends-ergänzende-messungen-m1m4)). Zur Unterscheidung der beiden C0-Messungen siehe [ADR 1B-011](1B-011-zeitbegriffe-und-leitfrage.md).

## Alternativen

- **Proxy aus 1C als eigenständiger Server:** verworfen; er läge als zusätzlicher Hop im Pfad und müsste an eine Netzschnittstelle binden.
- **Instrumentierter Laborbuild des Clients:** verworfen; ändert Produktionscode.
- **Zeitstempel beider Hosts direkt vergleichen:** verworfen; braucht einen Uhrenabgleich mit Genauigkeit unter einer Millisekunde.

## Belege

- [1B-Design, Abschnitt 5](../specs/2026-11-12-1b-zwei-host-design.md#5-zeitmessung-ki-vorschlag).
- Ein Summary-Auftrag schickt genau zwei Anfragen (`GET /slots?fail_on_no_slot=1`, `POST /v1/chat/completions`, `runOpenWeightLlm` in `apps/backend/src/lib/openWeightLlmClient.ts`); die Statusprobe läuft im Summary-Pfad nicht mit.

## Folgen

- Mitschnitte enthalten den Bearer-Token; sie bleiben außerhalb des Repos, eingecheckt werden nur abgeleitete Zeiten, Größen und Statuscodes.
- Die Adapterzeit enthält beide `prepare`-Läufe und die Queue-Logik der App.
