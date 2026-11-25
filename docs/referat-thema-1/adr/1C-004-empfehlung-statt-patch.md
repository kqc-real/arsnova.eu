# 1C-004: Ergebnisform ist eine Empfehlung, kein Produktivpatch

- **Status:** methodisch (2026-11-05)
- **Kategorie:** Methodik

## Kontext

Mehrere Befunde aus 1C legen eine Änderung nahe, etwa die Begrenzung des Prompt-Caches der Runtime, den zeitabhängigen Hash bei aktiver Blitzlicht-Runde (T3.1) oder den unterscheidbaren Zustand eines unbrauchbaren Themen-Snapshots (T2.3). Offen war, ob 1C solche Änderungen im Produktivcode umsetzen soll.

## Entscheidung

1C liefert Analyse, Gegenprüfung, Messung und begründete Empfehlungen, keinen Produktivpatch. Der Branch ändert außerhalb von `docs/referat-thema-1/` nur Testdateien, `.github/workflows/ci.yml` (Aufnahme der Suite) und `docs/TESTING.md`. Was nur empfohlen ist, trägt in den ADRs den Status `empfohlen` und wird nicht als umgesetzt dargestellt.

## Alternativen

- **Befunde im Produktivcode beheben, etwa `--cache-ram` setzen oder den Hash ändern.** Verworfen: Das Prüfungsdokument verlangt es nicht (siehe Belege), und eine Korrektur braucht eine eigene PR mit eigener Prüfung ([Tests-Design, Nicht-Ziele](../specs/2026-10-24-1c-tests-design.md#2-ziele-nicht-ziele-anti-ziele)).
- **Issues sofort anlegen.** Nicht getan: Die Issue-Entwürfe tragen den Status „Entwurf, nicht angelegt“; Anlegen und Ort entscheidet der Autor ([T2.3](../evidenz/1C/issue-t2-3-entwurf.md), [T3.1](../evidenz/1C/issue-t3-1-entwurf.md), [Cache-RAM](../evidenz/1C/issue-cache-ram-entwurf.md)). _Aktualisiert 2026-11-09:_ Nach Freigabe des Autors sind die Befunde als Issues im Fork angelegt ([#13](https://github.com/NiklasSkulll/arsnova.eu/issues/13)–[#18](https://github.com/NiklasSkulll/arsnova.eu/issues/18), Unter-Issues von #10); umgesetzt ist weiterhin nichts.

## Belege

- Prüfungsdokument [`CLOUD-COMPUTING-REFERAT-PRUEFUNG.md`](../../didaktik/CLOUD-COMPUTING-REFERAT-PRUEFUNG.md), Zeile 145 (Abschnitt 4.1.3): Ein vollständiger Produktivpatch, die erneute Umsetzung von #456 oder ein Modelltraining werden nicht verlangt. Die individuelle Leistung besteht in Analyse, Gegenprüfung, Messung und begründeter Beibehaltungs-, Konfigurations-, Betriebs- oder Verbesserungsempfehlung für Release 1.3; ein bestätigter guter Ist-Zustand ist ebenso ein Ergebnis wie ein nachgewiesener Änderungsbedarf.
- Dasselbe Dokument, Zeile 207 (Auftrag 1C): Das individuelle Ergebnis besteht aus Datenfluss am Releasecode, Ende-zu-Ende- und Vertragsnachweis und einer Beibehaltungs- oder Verbesserungsempfehlung einschließlich der Kosten der Validierung und Kontextbereitstellung. Als Gültigkeitsgrenze gilt, dass ein formal korrekter Releasepfad keine optimierten Prompts belegt. _Aktualisiert 2026-11-12:_ Daraus folgt die Abgrenzung in [1C-018](1C-018-quality-gate-verwirft-echte-antworten.md#folgen): Prompt-Optimierung ist Thema 2, nicht 1C.
- Dateiliste des Branches außerhalb der Dokumentation: `git diff --name-only main..HEAD` (Stand 2026-11-05) nennt neben `docs/` nur Testdateien unter `apps/backend/src`, `libs/shared-types/src`, `.github/workflows/ci.yml` und `docs/TESTING.md`.
- Statuswerte: [ADR-Index](README.md#statuswerte).

## Folgen

- Empfehlungen wie `--cache-ram` begrenzen, T2.3 und T3.1 sind nicht umgesetzt; ihre Umsetzung wäre eine getrennte Entscheidung des Autors und eine eigene PR.
- Die Tests im Branch sind Evidenz und Beitragskandidat, keine Produktänderung.
- Für experimentelle Varianten (V1, E15, Laborüberschreibungen) bleibt der Rückweg zur unveränderten Baseline dokumentiert: E15 liegt nur als Patchdatei vor ([`e15-widerlegt.patch`](../evidenz/1C/e15-widerlegt.patch)), die Laborüberschreibungen als eigene Dateien ([`labor-produktionslimits.override.yml`](../evidenz/1C/labor-produktionslimits.override.yml), [`labor-cache-aus.override.yml`](../evidenz/1C/labor-cache-aus.override.yml)); V1 ist im [Teil-2-Protokoll](../evidenz/1C/2026-10-24-teil2.md) beschrieben.
