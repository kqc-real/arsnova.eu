# Issue-Entwurf: Ablehnung durch das Qualitätstor der Zusammenfassung schreibt keine Logzeile

> **Status:** _Aktualisiert 2026-11-13:_ angelegt als [#20](https://github.com/NiklasSkulll/arsnova.eu/issues/20) im Fork (Unter-Issue von #8); maßgeblich ist das Issue. Ursprünglich: Entwurf, nicht angelegt. Angelegt wird erst nach Freigabe durch den Autor; Ort (kqc-real oder Fork) entscheidet er. Ergänzt [#13](https://github.com/NiklasSkulll/arsnova.eu/issues/13) (Qualitätstor verwirft echte Antworten, [ADR 1C-018](../../adr/1C-018-quality-gate-verwirft-echte-antworten.md)) um die Beobachtbarkeit. Grundlage: [Laufprotokoll, Befund](2026-11-13-lauf.md#befund-jede-modellantwort-verworfen). Entworfen mit Claude Code (Modell Claude Opus 5.5). _Korrigiert 2026-11-13:_ Quellen von `invalid_response` vollständig aufgezählt (Branch-Review).

**Vorgeschlagener Titel:** `Q&A-Zusammenfassung: Grund eines Fallbacks mit invalid_response protokollieren`

---

## Beobachtung

Im Zwei-Host-Lauf endeten alle Aufträge mit `effectiveMode: extractive` und `fallbackReason: invalid_response`, obwohl die Runtime vollständig antwortete (`finish_reason: stop`). Den Grund fand erst die Auswertung des Mitschnitts: Keine Aussage hatte die Form „Stichwort: Text“ (`qaSummaryQuality.ts` Z. 20: Doppelpunkt oder ein von Leerzeichen umgebener Strich `-`, `–` oder `—` in den ersten 48 Zeichen), geprüft von `hasAcceptableQaSummaryQuality` (Z. 59–83).

`fallbackReason: invalid_response` fasst im Summary-Pfad fünf Ursachen zusammen; nur eine davon schreibt eine Logzeile (Stand `a19ca70f`, Zeilen in `apps/backend/src/lib/`):

| Ursache                                                                                                       | Stelle                                                          | Logzeile                                         |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| Anfrage verletzt das Request-Schema                                                                           | `openWeightLlmClient.ts` Z. 485                                 | keine                                            |
| Antwort nicht parsebar oder ungültig (HTTP-JSON, Hülle, Modell-JSON, Ausgabeschema, Aufgabentyp, Fragebezüge) | `openWeightLlmClient.ts` Z. 444–462, über `reject` (Z. 427–443) | `qa_summary:invalid_model_response` mit `reason` |
| Ausgabe hat einen anderen Aufgabentyp oder eine andere Schema-Version als Summary V2                          | `openWeightLlmClient.ts` Z. 710–717                             | keine                                            |
| Modell meldet `status: 'failed'`                                                                              | `qaSummaryRuntimeAdapter.ts` Z. 132                             | keine                                            |
| Qualitätstor lehnt die Ausgabe ab                                                                             | `qaSummaryRuntimeAdapter.ts` Z. 133–136, Fallback Z. 147–150    | keine                                            |

Die drei Fälle nach einer vollständigen Antwort (Tabellenzeilen 3–5) sind im Log also nicht voneinander und nicht von einer fehlerhaften Anfrage zu unterscheiden. Im Labor traf es den letzten Fall bei jedem Auftrag. _Ergänzt 2026-11-14:_ Belegt an allen 10 Antworten des gewerteten Laufs: Die Funktion des Qualitätstors lehnt jede ab, keine der 40 Aussagen hat die Form „Stichwort: Text“, und das Log enthält keine Warnung `qa_summary:invalid_model_response` ([Laufprotokoll](2026-11-13-lauf.md#befund-jede-modellantwort-verworfen)).

## Vorschlag

1. `hasAcceptableQaSummaryQuality` liefert statt `boolean` den Grund der Ablehnung, passend zu seinen Prüfungen (Z. 65–82): `too_few_statements`, `missing_label_form`, `incomplete_statement`, `duplicate_lead`, `generic_lead`.
2. Der Adapter schreibt vor dem Fallback eine Warnung mit der Ursache (Qualitätstor mit Grund, `status: 'failed'`, Versionskonflikt) und der Zahl der betroffenen Aussagen, ohne Text.
3. Optional ein eigener `fallbackReason` (etwa `quality_rejected`) im Schema in `libs/shared-types`.

**Kosten:** gering. **Risiko:** gering. _Korrigiert 2026-11-14:_ Das Frontend zeigt Fallback-Gründe der Q&A-Zusammenfassung heute nicht einzeln an; ein neuer `fallbackReason` betrifft Schema, Backend und Tests, Oberfläche und die fünf Locales nur, wenn er sichtbar werden soll. Vorher stand hier, er müsse in Vorschau-UI und allen fünf Locales ergänzt werden. **Rückweg:** Revert.

## Gültigkeitsgrenze

Produktionscode `a19ca70f`, Zeilen am Branch-Stand `e2e9c701` geprüft (Produktionscode dort unverändert). Modell Qwen3-4B nach ADR-0035; mit anderen Modellen nicht geprüft.
