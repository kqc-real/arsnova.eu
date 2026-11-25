# 1C-019: Endstatus auf dem echten Pfad ohne Datenänderung beibehalten (L4)

- **Status:** angenommen (2026-11-05) für `9f230abc`; _aktualisiert 2026-11-09:_ auf upstream `def56700` nicht übertragbar, dort gilt [1C-018](1C-018-quality-gate-verwirft-echte-antworten.md); _präzisiert 2026-11-12:_ teilweise, denn „kein `source_changed` ohne Datenänderung“ ist dort bestätigt (N4, 0 von 20)
- **Kategorie:** Beibehaltung

## Kontext

Auftragsschritte 3 und 4: Welche Endstatus liefert der Pfad mit der ausgelieferten Runtime, wenn sich die Daten nicht ändern? Zu erwarten ist kein `source_changed` (sonst wäre der Hash zeitabhängig wie in T3.1) und ein hoher Anteil `full-context`. Fall L4 mit vorab festgelegter Regel ([Labor-Design 5 und 6](../specs/2026-10-25-1c-labor-design.md#6-entscheidungsregeln)): k(`source_changed`) > 0 → Befund „Hash ändert sich ohne Datenänderung“; Anteil `full-context` < 80 % → häufigsten Grund als Verbesserungskandidat benennen (Ausgabegrenzen oder Timeout); sonst Beibehaltung. L1 ist die Kontrolle dazu ([1C-013](1C-013-vorschau-gleich-nutzlast-beibehalten.md)).

## Entscheidung

Beibehaltung des Endstatus- und Fallbackpfads ohne Datenänderung (L4-Regel): kein Befund „Hash ändert sich ohne Datenänderung“, kein Verbesserungskandidat für Ausgabegrenzen. Die Hashgrenze ist hier nur ohne Datenänderung geprüft (siehe [1C-016](1C-016-zeitabhaengiger-hash-blitzlicht.md), [1C-017](1C-017-m7-empfehlung-zurueckgehalten.md)). Das gilt für den Timeout von 300 s, nicht für den Release-Wert von 90 s.

## Alternativen

- **Abgleich der Ausgabegrenzen** (bei `invalid_response` mit Prüfstufe `output_schema`) oder **Timeout-Grenze** als Verbesserungskandidat: nach der Regel nur bei einem Anteil `full-context` unter 80 %; nicht ausgelöst, es gab weder `invalid_response` noch `timeout`.
- **Befund wie T3.1:** nicht ausgelöst, k(`source_changed`) = 0 auf beiden Rechnern.

## Belege

- **Laptop:** 19 × `ready/full-context` (Prüfstufe `ok`), 1 × `ready/extractive/unavailable` (`no_response`); k(`source_changed`) = 0 von 20 (Wilson 0–16,1 %), Anteil `full-context` 95 % (Wilson 76,4–99,1 %) ([L4 Laptop](../evidenz/1C/2026-11-05-labor.md#l4-endstatus)).
- **PC:** identische Verteilung und Intervalle ([L4 PC](../evidenz/1C/2026-11-05-labor-pc.md#l4-endstatus)).
- **Der eine Ausfall** ist auf beiden Rechnern Messlauf 20, getroffen vom OOM-Kill der Runtime; das Produkt schaltete korrekt auf den extraktiven Fallback ([Laptop, Abweichung 1](../evidenz/1C/2026-11-05-labor.md#abweichungen-vom-ablauf), [PC, L6](../evidenz/1C/2026-11-05-labor-pc.md#l6-speicher-mit-produktionslimits-design-144)). Die Ursache des OOM ist Gegenstand der Labor-ADRs (1C-020 bis 1C-024). _Korrigiert 2026-11-12:_ Den OOM behandeln nur [1C-021](1C-021-zusatzlauf-produktionslimits-zweiter-rechner.md) und [1C-024](1C-024-prompt-cache-ram-begrenzen.md).
- **Modellausgabe:** `finish_reason` 19-mal `stop` auf beiden Rechnern ([L2 Laptop](../evidenz/1C/2026-11-05-labor.md#l2-tokens), [L2 PC](../evidenz/1C/2026-11-05-labor-pc.md#l2-tokens)).

## Folgen

- **Kosten:** keine. **Risiko:** keines neu. **Rückweg:** entfällt.
- **Gültigkeitsgrenze:** Timeout 300 s statt 90 s, die L4-Anteile gelten für 300 s; der Release-Timeout von 90 s reicht auf keinem der beiden Rechner, die Inferenz lag im Median bei 163,4 s (Laptop) bzw. 98,8 s (PC) ([Laptop, Befund zu A4](../evidenz/1C/2026-11-05-labor.md#entscheidungen-nach-design-abschnitt-6), [PC, Kalibrierung](../evidenz/1C/2026-11-05-labor-pc.md#kalibrierung-und-wahl-des-timeouts-design-143)). Ruhige Session ohne Voting, eine Fixture, n = 20; `ready` heißt vertrags- und quellengültig, nicht inhaltlich gut ([Labor-Design 7](../specs/2026-10-25-1c-labor-design.md#7-gültigkeitsgrenzen)). Unter Voting gilt [1C-017](1C-017-m7-empfehlung-zurueckgehalten.md), bei live Nicht-TEMPO-Blitzlicht-Runde [1C-016](1C-016-zeitabhaengiger-hash-blitzlicht.md).
- _Aktualisiert 2026-11-09:_ Im Nachlauf auf `def56700` (Instruktion v5, Quality-Gate) ist k(`source_changed`) weiter 0 von 20, der Anteil `full-context` aber **0 von 20** (Wilson 0–16,1 %): 17 × `invalid_response`, 3 × `unavailable` nach OOM ([N4](../evidenz/1C/2026-11-09-labor-nachlauf.md#n4-endstatus)). Nach der Regel ist das ein Befund, keine Beibehaltung; er steht in [1C-018](1C-018-quality-gate-verwirft-echte-antworten.md). Diese ADR gilt nur für den Stand `9f230abc`.
