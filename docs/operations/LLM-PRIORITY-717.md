# Messung der LLM-Slot-Übergabe auf dem CPU-Zielhost

23. November 2026 · [Issue #717](https://github.com/kqc-real/arsnova.eu/issues/717)

Ein getrennter Container auf dem vorgesehenen Linux-Inferenzhost nutzte
acht Neoverse-N1-CPU-Threads, ein Limit von 6 GiB RAM und geringere CPU-Gewichtung als
der Produktivcontainer. Das Modellverzeichnis war nur lesend eingebunden.
Zwei getrennte Backend-Prozesse teilten einen isolierten Redis 7.4 und
sprachen mit dem Testcontainer über einen privaten SSH-Tunnel. Die
Anfragen enthielten synthetische Daten.

- Modell `Qwen3-4B-Instruct-2507-Q4_K_M.gguf`, SHA-256 `3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597`
- Runtime `llama.cpp b10524` mit gezieltem Abbruch, Image-Digest `sha256:5874f27b7fa9872707d1b530c97b0bf4843709fb868fc64425ddaeaaa46009f7`

Alle Zeiten in Millisekunden ab Start des höher priorisierten Inferenzclients.
Jede Zeitspalte gibt p50 / p95 / Maximum an. Das p95 verwendet den Nearest
Rank und fällt bei drei Läufen mit dem Maximum zusammen. Die Zeiten
enthalten den Transport über den Tunnel. Die Annahme wurde am Wechsel zu
einer laufenden Aufgabe in der abgefragten Slot-Anzeige gemessen, die
Freigabe am ersten erfolgreichen Slot-Probe-Response vor dem neuen POST.

| Szenario                                                 | Läufe | Abbruch gesendet | Slot frei bestätigt | POST angenommen |       Ergebnis fertig |
| -------------------------------------------------------- | ----: | ---------------: | ------------------: | --------------: | --------------------: |
| Themenlabel bei freiem Slot                              |     3 |                – |      54 / 102 / 102 | 173 / 180 / 180 |    2285 / 6178 / 6178 |
| Themenlabel verdrängt Lernziel im Prefill                |     3 |     13 / 24 / 24 |     151 / 323 / 323 | 323 / 441 / 441 |    2418 / 2752 / 2752 |
| Themenlabel verdrängt Lernziel bei der Token-Generierung |     3 |     18 / 33 / 33 |     153 / 182 / 182 | 298 / 363 / 363 |    2425 / 2505 / 2505 |
| Themenlabel verdrängt Zusammenfassung                    |     3 |     18 / 19 / 19 |     160 / 160 / 160 | 297 / 300 / 300 |    2396 / 2454 / 2454 |
| Zusammenfassung verdrängt Lernziel                       |     3 |     22 / 24 / 24 |     306 / 311 / 311 | 422 / 424 / 424 | 27863 / 30934 / 30934 |

Beispiel mit Lernziel-Batch im Prefill. Der Label-Anfragebeginn war
`2026-11-23T11:18:30.682+00:00`. Nach 24 ms ging das
Abbruchsignal ab, nach 116 ms lag die Antwort
auf dieses Signal vor und nach 323 ms meldete
die Runtime den Slot frei. Der Label-POST wurde nach
334 ms gesendet, nach 441 ms
war die laufende Label-Aufgabe sichtbar und nach 2752 ms
lag das validierte Label vor.

Die Runtime protokollierte zwölf abgebrochene Berechnungen (`llama_decode … ret = 2`). In allen zwölf Konkurrenzläufen lieferte der verdrängte Auftrag
`preempted`. Die höher priorisierten Aufträge lieferten validierte
Modellausgaben. Der langsamste gemessene Wechsel lag bei
441 ms
und damit unter 2,5 s. Der Vergleich bei freiem Slot enthielt einen
kalten Start. Ein unterbrochener SSH-Zugang beendete den Versuch eines
vierten Durchlaufs vor der nächsten aufgezeichneten Anfrage. Die
Messung beschreibt die Übergabe unter synthetischer Konkurrenz. Für
regelmäßigen Durchsatz und stärker ausgelastete Produktionsfenster sind
gesonderte Lastmessungen erforderlich.

[Reproduktionsschritte](../TESTING.md#gemeinsame-llm-prioritätsübergabe-717)
