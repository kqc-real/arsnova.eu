# 1C-015: Unterscheidbarer Zustand für einen unbrauchbaren Themen-Snapshot (T2.3)

- **Status:** empfohlen (2026-11-05), nicht umgesetzt; Issue-Entwurf nicht angelegt, _aktualisiert 2026-11-09:_ Issue [#15](https://github.com/NiklasSkulll/arsnova.eu/issues/15) im Fork
- **Kategorie:** Verbesserung

## Kontext

Auftragsschritt 3 verlangt „kein stiller Feldverlust“. Liegt in Redis ein strukturell gültiger semantischer Themen-Snapshot mit fremder `version`, liefert `getLatestQaSemanticTopicSnapshot` still `null`, und `collectQaTopicContext` meldet `unavailable`/`no-data` wie ohne Snapshot; kein `logger.warn` ([T2.3](../evidenz/1C/2026-10-24-tests.md#t23--veralteter-themen-snapshot-in-redis-prozesskonflikt)). Das kann etwa nach einem Deployment auftreten, solange Snapshots des vorherigen Releases in Redis liegen ([Issue-Entwurf T2.3](../evidenz/1C/issue-t2-3-entwurf.md)). Der Autor hat am 2026-10-24 die Empfehlung beschlossen ([Teil 2, Entscheidung 4](../evidenz/1C/2026-10-24-teil2.md#entscheidung-und-empfehlung-1c)).

## Entscheidung

Empfohlen: ein eigener Grund oder eine eigene Limitation für einen vorhandenen, aber unbrauchbaren Snapshot und mindestens ein `logger.warn` mit Schlüsselbereich und gefundener Version, ohne Inhalte. Nicht umgesetzt (kein Produktivcode in 1C); Vorschlag als Issue, anzulegen nur mit Freigabe des Autors. _Aktualisiert 2026-11-09:_ angelegt als [#15](https://github.com/NiklasSkulll/arsnova.eu/issues/15).

## Alternativen

- **Beibehaltung des Ist-Verhaltens:** verworfen. Weder Host noch Modell noch Betrieb können den Konflikt von „noch nicht analysiert“ unterscheiden; Punkt 3 darf für diesen Fall nicht als erfüllt dargestellt werden ([T2.3, Befund](../evidenz/1C/2026-10-24-tests.md#t23--veralteter-themen-snapshot-in-redis-prozesskonflikt)).
- **Nur loggen, Projektion unverändert:** nicht empfohlen, weil die Lehrperson in Vorschau und Zusammenfassung dann weiter „keine Daten“ sieht; der Entwurf verlangt beides ([Issue-Entwurf T2.3, Erwartetes Verhalten](../evidenz/1C/issue-t2-3-entwurf.md#erwartetes-verhalten)).

## Belege

- **Hypothese und Ergebnis:** H (unterscheidbarer Zustand) widerlegt, G eingetreten wie vorab erwartet; die gesamte Projektion ist per `toEqual` identisch mit der bei leerem Redis ([T2.3](../evidenz/1C/2026-10-24-tests.md#t23--veralteter-themen-snapshot-in-redis-prozesskonflikt)).
- **Kontrolle:** derselbe Snapshot mit aktueller Version wird geliefert, `topics.state = 'available'` (ebd.).
- **Tests:** Charakterisierung in `wordCloudAnalysisCache.test.ts` und `moderationQaContext.test.ts`, dazu `it.todo('distinguishes a stale snapshot from no data')` seit Commit `14d26d15` (ebd.).
- **Labor:** kein zusätzlicher Beleg; beide Läufe haben den Fall nicht untersucht ([Issue-Entwurf T2.3, Aktualisierung](../evidenz/1C/issue-t2-3-entwurf.md#gültigkeitsgrenze)).

## Folgen

- **Kosten:** gering, ein zusätzlicher Zweig im Cache-Getter und in der Projektion, Schema-Erweiterung um einen Grund ([Issue-Entwurf T2.3, Vorschlag](../evidenz/1C/issue-t2-3-entwurf.md#vorschlag)).
- **Risiko:** gering; neue Grundwerte müssen in Vorschau-UI und allen fünf Locales ergänzt werden. **Rückweg:** Revert.
- **Gültigkeitsgrenze:** Unit-Ebene mit gemocktem Redis-Client, Produktivcode `248029dc`; _Aktualisiert 2026-11-10:_ mit dem Produktivcode von `def56700` (HEAD des Branches) erneut grün (`wordCloudAnalysisCache.test.ts`, `moderationQaContext.test.ts`: 55 bestanden, 1 todo). Wie oft der Konflikt real auftritt, etwa bei Rolling Deployments mit gemeinsamem Redis, ist nicht gemessen ([T2.3](../evidenz/1C/2026-10-24-tests.md#t23--veralteter-themen-snapshot-in-redis-prozesskonflikt)).
- **Issue-Entwurf:** [`issue-t2-3-entwurf.md`](../evidenz/1C/issue-t2-3-entwurf.md), nicht angelegt. _Aktualisiert 2026-11-09:_ angelegt als [#15](https://github.com/NiklasSkulll/arsnova.eu/issues/15) im Fork (Unter-Issue von #10; ursprünglich englisch, seit 2026-11-10 deutsch).
