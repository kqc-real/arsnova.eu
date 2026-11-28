# Ergebnisse · Quellenbelege mit bekannten Fehlern

## Validierung am 8. November 2026

| Eingespeister Fall                                                     | Backend-Entscheidung       |
| ---------------------------------------------------------------------- | -------------------------- |
| Zwei korrekte Aussagen (`korrekt`)                                     | Modelltext angenommen.     |
| Unbekannte ID (`unbekannte-id`)                                        | Extraktiver Ersatz.        |
| Bekannte und unbekannte ID (`gemischte-ids`)                           | Extraktiver Ersatz.        |
| Keine ID (`fehlende-id`)                                               | Extraktiver Ersatz.        |
| Echte ID zur falschen Frage (`falscher-beleg`)                         | Falschen Beleg angenommen. |
| Erfundenes Ergebnis von 73 Personen (`erfundene-statistik`)            | Falschaussage angenommen.  |
| Unbelegte Aussage zum Lernstand (`lernstandsdiagnose`)                 | Falschaussage angenommen.  |
| Ungeprüften Beitrag als abgelehnt gedeutet (`pending-fehldeutung`)     | Falschaussage angenommen.  |
| Geteilte Stimmen als Gleichgültigkeit gedeutet (`stimmen-fehldeutung`) | Falschaussage angenommen.  |
| Nur eine Aussage (`nur-ein-anliegen`)                                  | Extraktiver Ersatz.        |

Alle zehn Endergebnisse erhielten den Status `ready`, darunter die vier Ersatzantworten. Die fünf angenommenen fachlichen Fehler zeigen, welche Aussagen der Filter durchlässt. Ihre Anzahl ist keine Fehlerrate von Qwen. [Alle zehn Eingaben und Entscheidungen](../../extended_experiments/kontrollantworten.json) · [Audit der 56 archivierten Aufrufe](../../extended_experiments/pruefstufen.json) · [Anleitung](anleitung.md)
