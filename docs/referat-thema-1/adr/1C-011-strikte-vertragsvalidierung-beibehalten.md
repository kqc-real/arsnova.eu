# 1C-011: Strikte Vertragsvalidierung beibehalten

- **Status:** angenommen (2026-11-05)
- **Kategorie:** Beibehaltung

## Kontext

Auftragsschritt 3 verlangt den Nachweis, dass inkompatible Vertragsversionen nicht still durchrutschen, und die Kosten der Validierung. Der Pfad prüft an jeder Grenze mit Zod-Schemas und exakten Versionsliteralen: `assemblePreparedModerationSummaryContext` (Anfrage- und Vorschau-Schema), die Client-Prüfung der Anfrage und zwei Schichten für die Modellausgabe ([Dossier 3.3](../1C/1C-kontext-und-adapterpfad.md#33-wie-versionen-geprüft-werden)). Der Autor hat am 2026-10-24 entschieden ([Teil 2, Entscheidung 2](../evidenz/1C/2026-10-24-teil2.md#entscheidung-und-empfehlung-1c)).

## Entscheidung

Die strikte Vertragsvalidierung bleibt unverändert (`assemblePreparedModerationSummaryContext` und Client-Prüfungen).

## Alternativen

- **Validierung lockern oder Schichten zusammenlegen:** verworfen. Jede Grenze fängt inkompatible Versionen ab (T1.1–T1.6, E4), und die beiden Prüfschichten der Ausgabe sind unabhängig wirksam: Erst wenn beide entfernt sind, wird der Test rot ([T1.6](../evidenz/1C/2026-10-24-tests.md#t16--client-verwirft-antwort-mit-fremder-ausgabe-version), [E4](../evidenz/1C/2026-10-24-teil2.md#e4--gekennzeichnete-negativprobe-vertrag)). Eine Einsparung wäre bei den gemessenen Kosten (unten) unwesentlich.
  - _Aktualisiert 2026-11-10:_ An `def56700` folgt auf die beiden Prüfschichten der Ausgabe im Client eine weitere Stufe: das Quality-Gate im Adapter (`hasAcceptableQaSummaryQuality`, upstream `12f1d8e4`, in `a998ada0` auf `uncertain` mit Aussagen ausgeweitet, gemergt mit `96b2e46e`, PR #643; [Diagramme, Befund 9](../1C/1C-diagrams.md#kernbefunde)). Es prüft die Form der Aussagen, nicht die Vertragsversion, und verwirft im Nachlauf alle 28 aufgezeichneten echten Antworten ([ADR 1C-018](1C-018-quality-gate-verwirft-echte-antworten.md)). T1.6 und E4 liefen auf `248029dc` ohne Gate. E4 ist im [Trockenlauf](../evidenz/1C/2026-11-06-trockenlauf-upstream.md#ergebnisse) auf `44c0a796` grün; die Mutationsprobe, nach der beide Schichten unabhängig wirksam sind, ist auf dem neuen Stand nicht wiederholt. Die Entscheidung oben bleibt unverändert.
- **Kandidatenvalidierung im Packer billiger machen** (Option E4 im [Dossier 12.3](../1C/1C-kontext-und-adapterpfad.md#123-empfehlungsoptionen-zur-eigenen-entscheidung-im-referat)): Das Dossier nennt sie einen Sicherheitsabwägungsfall, nur mit Messung zu empfehlen. Die Validierung je Packkandidat ist nicht getrennt gemessen, sie steckt im ganzen Kontextaufbau. Der kostet kalt mit vollem Kontext im Median 243,8 ms ([M6](../evidenz/1C/2026-10-24-teil3.md#m6--kosten-mit-vollem-kontext)) gegen eine Inferenz von 98,8 s (PC) bis 163,4 s (Laptop) ([Kennzahlen](../evidenz/1C/2026-11-05-labor-pc.md#laufrechner-pc-gegen-laptop)). Nicht weiter verfolgt.

## Belege

- **Wirksamkeit:** T1.1–T1.6 bestätigt, jeweils mit Mutationsprobe rot → grün ([Zusammenfassung Tests](../evidenz/1C/2026-10-24-tests.md#zusammenfassung)); E4 Ende zu Ende: rot nur bei Wegfall beider Schichten ([Abweichungen Teil 2](../evidenz/1C/2026-10-24-teil2.md#abweichungen-und-offene-punkte)).
- **Kosten (Kriterium: Anteil < 20 % eines Kontextaufbaus):**
  - M4, Referenzfixture: 1,2 ms je Aufbau, Anteil 1,6 % (Primärlauf) bzw. 1,8 % (Robustheitslauf) ([M4](../evidenz/1C/2026-10-24-teil2.md#m4--kosten-der-validierung-n--200-auf-dem-promptcontext-aus-m3)).
  - M6, voller Kontext: Validierungsanteil 0,5 % ([M6](../evidenz/1C/2026-10-24-teil3.md#m6--kosten-mit-vollem-kontext)).

## Folgen

- **Kosten:** unverändert, je Kontextaufbau ≈ 1,2 ms für die in Design 5 benannten Prüfungen, bei vier Aufbauten je Auftrag mit erstem Abruf (drei im Auftrag, prepare (1)–(3), plus einer je Runtime-Lesezugriff, [Kernbefunde 2](../1C/1C-diagrams.md#kernbefunde)) ≈ 5 ms ([Teil 2, Entscheidung 2](../evidenz/1C/2026-10-24-teil2.md#entscheidung-und-empfehlung-1c)).
- **Risiko:** keines neu. **Rückweg:** entfällt.
- **Gültigkeitsgrenze:** gemessen lokal mit Test-Runtime. M4 misst genau die in Design 5 benannten Prüfungen; nicht gemessen sind unter anderem `ModerationAnalysisContextV1Schema.parse`, `ChatCompletionResponseSchema` im Client und die Ausgabevalidierung des tRPC-Routers ([M4, Abdeckung](../evidenz/1C/2026-10-24-teil2.md#m4--kosten-der-validierung-n--200-auf-dem-promptcontext-aus-m3)). Inkompatible Versionen enden ohne eigenen Grund als `context_unavailable` bzw. `invalid_response` (Befund B3, [Dossier 14](../1C/1C-kontext-und-adapterpfad.md#14-befundliste-kurzfassung-für-handout)); daran ändert diese Entscheidung nichts.
