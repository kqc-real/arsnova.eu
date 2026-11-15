# 1B-008: Kernaussagen und Schwellen für die Schritte 1–2

- **Status:** methodisch (2026-11-12)
- **Kategorie:** Methodik

## Kontext

Die Pflicht-Nachweiskette verlangt Hypothese, Gegenalternative und Entscheidungsschwellen vor dem ersten Lauf ([Rahmendokument](../00-rahmen-und-pruefung.md#pflicht-nachweiskette-je-person)). Das Dossier schlug einen Transportanteil unter 5 % vor ([Dossier 10.5](../1B-private-inferenz-zweiter-host.md#105-entscheidungsschwellen-vorschlag-vorab-begründen)).

## Entscheidung

Kernaussagen (Autor, 2026-11-12):

- **B (Kern):** Die Zeit eines Summary-Auftrags steckt in der Inferenz, nicht im Netz und nicht im Adapter; der Hebel liegt am Inferenz-Host, nicht an der Topologie.
- **C (zweiter Punkt):** Im Betrieb sieht heute niemand, wohin die Zeit geht.
- **D (ein Satz Gültigkeitsgrenze):** Ein privates Netz belegt weder Autorisierung noch Datenschutz.

Schwellen für B, über n = 10 gewertete Aufträge:

| Hypothese | Schwelle                                                                 |
| --------- | ------------------------------------------------------------------------ |
| H_B1      | Netzzeit je Auftrag (beide Anfragen) im Median ≤ 50 ms, Maximum ≤ 200 ms |
| H_B2      | Adapterzeit je Auftrag im Median ≤ 2 s                                   |
| H_B3      | Inferenz ≥ 95 % der Job-Dauer im Median                                  |

**Gegenalternative:** Netz und Adapter zusammen kosten mehr als 5 % oder mehr als 2 s, etwa durch zwei Anfragen je Auftrag, doppelten Kontextaufbau oder Serveraufwand außerhalb der Inferenz.

**Regel:** H_B1 bis H_B3 erfüllt → Entscheidung „Konfiguration: Hebel am Inferenz-Host (Timeout je Host kalibrieren, Limits, Promptgröße); die Zwei-Host-Topologie kostet keine relevante Zeit“. Eine verfehlt → Befund mit Ursache, Entscheidung „Topologie bzw. Adapter genauer prüfen“, keine Beibehaltungsaussage.

**Hauptwert ist die Netzzeit in Millisekunden.** Auf langsamer Hardware dauert die Inferenz länger, der Prozentanteil des Netzes fällt dadurch zu klein aus; er wird nur mit diesem Hinweis genannt.

C wird aus dem Aufbau belegt: je Zeitkomponente, ob sie im Release-Betrieb ohne Laborwerkzeug sichtbar ist, dazu die Lücken des Nachbaus. Entscheidung für C: Empfehlung, kein Patch, Zeiten (`elapsedMs`, `timings`) für Summary und Label ins Log zu schreiben, ohne Prompttext ([Dossier, Lücken 1–3](../1B-private-inferenz-zweiter-host.md#12-lücken-und-pr-kandidaten)).

## Alternativen

- **Netzanteil in Prozent als Hauptwert:** verworfen (siehe oben).
- **Nur Aussage A „Netz kostet fast nichts“:** in B aufgegangen.
- **D als Hauptaussage:** verworfen; Sicherheit ist Schwerpunkt von Thema 5.

## Belege

- [1B-Design, Abschnitt 6](../specs/2026-11-12-1b-zwei-host-design.md#6-hypothesen-messgrößen-regeln-autor-aussagen-b-und-c-schwellen-ki-vorschlag).

## Folgen

- Änderungen an Schwellen oder Regeln nach diesem ADR nur als datierter Nachtrag vor dem gewerteten Lauf.

_Ergänzt 2026-11-14 (Docs-Audit):_ Zwei datierte Nachträge im Design ergänzen dieses ADR, die Schwellen oben bleiben unverändert: Auftrag 1 (kalt) und 2–10 (warm) werden getrennt berichtet (vom Autor bestätigt, [Nachtrag 2026-11-12](../specs/2026-11-12-1b-zwei-host-design.md#nachtrag-2026-11-12-beim-aufbau-dazugekommen)); die Hypothesen H_C0, H_B0 und H_B3 kalt standen vor den Läufen M2–M4 fest ([Nachtrag 2026-11-13](../specs/2026-11-12-1b-zwei-host-design.md#nachtrag-2026-11-13-ergänzende-messungen-nach-der-vollständigkeitsprüfung)). Ergebnisse im [Laufprotokoll](../evidenz/1B/2026-11-13-lauf.md#nachtrag-2026-11-13-abends-ergänzende-messungen-m1m4).
