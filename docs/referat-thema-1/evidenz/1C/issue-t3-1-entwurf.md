# Issue-Entwurf: Aktive Blitzlicht-Runde macht den `snapshotHash` zeitabhängig

> **Status:** _Aktualisiert 2026-11-09:_ angelegt als [#18](https://github.com/NiklasSkulll/arsnova.eu/issues/18) im Fork (Unter-Issue von #10; ursprünglich englisch, seit 2026-11-10 deutsch und überarbeitet, maßgeblich ist das Issue). Ursprünglich: Entwurf, nicht angelegt. Angelegt wird erst nach Freigabe durch den Autor; Ort (kqc-real oder Fork) entscheidet er. Grundlage: [Befund T3.1 im Protokoll Teil 3](2026-10-24-teil3.md#befund-t31--zeitabhängige-sourcerevision-bei-aktiver-blitzlicht-runde). Entworfen mit Claude Code (Modell Claude Opus 5.5).

**Vorgeschlagener Titel:** `Q&A-Zusammenfassung: aktive Blitzlicht-Runde ändert den snapshotHash bei jedem Kontextaufbau, Modellantworten enden immer als source_changed`

---

## Beobachtung

Ist für eine Session Blitzlicht aktiviert und liegt eine gültige Runde eines anderen Typs als `TEMPO` in Redis, liefert jeder Kontextaufbau einen neuen `snapshotHash`, auch wenn sich keine Daten geändert haben. Folgen (je im Protokoll belegt):

- Jeder Job endet mit `extractive`/`source_changed`; die Modellaussage wird verworfen, nachdem die Inferenz gelaufen ist.
- Jeder Abruf von `qa.summaryRuntime` baut neu auf, findet einen anderen Hash und ersetzt das Ergebnis erneut durch `source_changed`.
- Der Cooldown-Cache greift nie; jeder erneute Auftrag startet eine neue Inferenz, deren Aussage wieder verworfen wird.
- Der Packing-Cache trifft nie (jeder Aufbau ein `miss`).

## Mechanismus

Zeilen gelten für `main` `248029dc` (Basis des Branches `feature-1C-context-path`; der Branch ändert keinen Produktivcode). Pfade unter `apps/backend/src/lib/`.

1. `loadQuickFeedbackModerationSnapshot` setzt das Zeitfenster der Blitzlicht-Quelle auf `{ kind: 'interval', from: roundStartedAt, to: max(roundStartedAt, observedAt) }` (`quickFeedbackModerationSnapshot.ts` Z. 389–391 und 398).
2. `observedAt` ist der Aufbauzeitpunkt: `buildAuthorizedModerationTeachingSignals` übergibt `initial.authorizedAt` (`moderationTeachingSignals.ts` Z. 1999), und `loadAuthorizedModerationState` setzt `authorizedAt` auf `new Date()` (`moderationQaContext.ts` Z. 196 und 203).
3. `sourceRevisionFor` hasht den ungepackten Analysekontext und nimmt nur `analyzedAt`, `classifiedAt` und `confirmedAt` aus (`moderationPromptContext.ts` Z. 517–528 und Z. 40). Der Packer übernimmt `meta` samt `sourceRevision` (`moderationPromptContextPacking.ts` Z. 909–910).
4. `hashModerationPromptContextMaterial` (`moderationPromptContextPacking.ts` Z. 212–234) nimmt dieselben drei Schlüssel aus (Z. 159). Intervallgrenzen bleiben laut Kommentar (Z. 161–166) bewusst Teil des Hashs.
5. `processJob` vergleicht die Hashes von prepare (2) und (3) (`qaSummaryQueue.ts` Z. 341–345), der Lesepfad `getQaSummaryRuntimeFresh` den gespeicherten Hash mit einem neuen Aufbau (Z. 426–438), der Cooldown-Cache verlangt denselben Hash (Z. 494–508).

Für `TEMPO` entsteht keine Quelle (`quickFeedbackModerationSnapshot.ts` Z. 376–384); deshalb ist dieser Typ nicht betroffen.

## Voraussetzungen

- Blitzlicht der Session aktiviert (`quickFeedbackEnabled`, `moderationTeachingSignals.ts` Z. 1997).
- Eine gültige, session-gebundene Runde in Redis `qf:<CODE>`, Typ nicht `TEMPO`. Getestet ist `YESNO`; für die übrigen Typen folgt dasselbe aus dem Code (gleicher Zweig), dynamisch geprüft ist es nicht.
- Stimmen in der Runde sind nicht nötig (Test mit 0 Stimmen).
- Unabhängig davon, ob die Blitzlicht-Quelle ins Budget gepackt wird: `sourceRevision` entsteht vor dem Packen.

## Reproduktion

Zwei exploratorische Tests auf dem Branch `feature-1C-context-path` halten das heutige Verhalten fest (PostgreSQL und Redis, opt-in mit `RUN_PG_QA_SUMMARY_E2E_TESTS=1`):

- `apps/backend/src/__tests__/qa.summary-e2e.pg.test.ts` › `Negativprobe: liefert bei einer Blitzlicht-Runde vom Typ YESNO ohne Stimmen und ohne Datenänderung bei jedem Kontextaufbau einen neuen snapshotHash und verwirft die Modellaussage als source_changed`
- › `Kontrolle: liefert bei einer Blitzlicht-Runde vom Typ TEMPO ohne Datenänderung denselben snapshotHash, endet ready und beantwortet einen erneuten Auftrag aus dem Cache`

Befehl und Mutationsprobe (Fensterende unabhängig vom Aufbauzeitpunkt → Negativprobe rot, Kontrolle grün) stehen im [Protokoll](2026-10-24-teil3.md#befund-t31--zeitabhängige-sourcerevision-bei-aktiver-blitzlicht-runde). Wird der Befund behoben, ist die Negativprobe umzuschreiben, nicht abzuschwächen.

## Erwartetes Verhalten

Zwei Kontextaufbauten ohne Datenänderung liefern denselben `snapshotHash`, auch während einer aktiven Blitzlicht-Runde. Eine neue Stimme in der Runde ändert ihn weiterhin. Dafür reicht laut Code der übrige Inhalt der Quelle: Stimmenzahl (`population.included`) und Verteilung (`aggregation`) stehen in ihr (`quickFeedbackModerationSnapshot.ts` Z. 400–405). Dynamisch geprüft ist das für eine Korrektur noch nicht.

## Lösungsoptionen

Vorschläge, nicht umgesetzt. Nur Option 1 ist in einer Form geprüft: als lokale Mutationsprobe auf dem Referenzszenario, dort sind die Hashes zweier Vorschauen dann gleich.

| Option                                                                                                                                                                      | Kosten                                                                                                                                                                                                                                           | Risiko                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 Fensterende aus den Daten statt aus der Uhr:** `to` aus einem gespeicherten Zeitpunkt der Runde ableiten (im einfachsten Fall `roundStartedAt`, wie die Mutationsprobe) | gering: eine Stelle in `loadQuickFeedbackModerationSnapshot`, Negativprobe umschreiben, Unit-Test für zwei Aufbauten mit gleichem Hash                                                                                                           | Das Fenster beschreibt die Laufzeit der Runde nicht mehr; ob Kompassregeln oder das Modell die Fensterlänge nutzen, ist nicht geprüft. Ohne gespeicherten Zeitpunkt der letzten Stimme ist `to = from` ein Notbehelf |
| **2 Offenes Fenster im Vertrag:** eigene Fensterart „seit `from`“ ohne Ende für laufende Runden                                                                             | mittel: `ModerationPromptTimeWindowSchema` in `libs/shared-types` erweitern, Version der betroffenen Verträge prüfen, Tests der Schemas                                                                                                          | Vertragsänderung an der Modellschnittstelle; Adapter und Modellanweisung müssen die neue Art kennen                                                                                                                  |
| **3 Fensterende aus Hash und `sourceRevision` ausnehmen**                                                                                                                   | gering bis mittel: `timestampNeutralHashMaterial` (`moderationPromptContextPacking.ts`) und `timestampNeutralSourceMaterial` (`moderationPromptContext.ts`), dazu der Schlüssel des Packing-Caches (`hashModerationAnalysisForPacking`, Z. 1160) | widerspricht der dokumentierten Absicht (Kommentar Z. 161–166: Intervallgrenzen definieren den Umfang); andere Quellen mit echten Intervallen würden mit ausgenommen                                                 |

Empfehlung des Entwurfs (Vorschlag, keine Entscheidung): Option 1 prüfen, weil sie die Ursache an einer Stelle behebt und den Vertrag nicht ändert.

**Rückweg:** Revert der jeweiligen Änderung.

## Gültigkeitsgrenze

- Geprüft auf dem Branch `feature-1C-context-path` mit lokaler PostgreSQL- und Redis-Instanz (Podman) und einer Test-Runtime statt privater Inferenz; Produktivcode `248029dc`; _aktualisiert 2026-11-10:_ Befund auf `def56700` im [Nachlauf N5](2026-11-09-labor-nachlauf.md#n5-t31-auf-dem-echten-pfad) bestätigt. Zeilenangaben in diesem Entwurf beziehen sich auf `248029dc`.
- Getestet ist ein Typ (`YESNO`) auf einer synthetischen Referenzfixture. Weitere zeitabhängige Quellen sind nicht systematisch gesucht.
- Wie oft in echten Vorlesungen eine Nicht-TEMPO-Runde läuft, während eine Zusammenfassung angefordert wird, ist nicht gemessen.

> **Aktualisiert 2026-11-05:** Der Befund ist auf dem echten Pfad bestätigt (Test-Pfad mit privater Runtime, Fall L5): YESNO endete in 5 von 5 Läufen als `ready/extractive/source_changed`, TEMPO in 5 von 5 als `ready/full-context/null`. Belege: [Laptop, L5](2026-11-05-labor.md#l5-t31-auf-dem-echten-pfad) (dort erreichte der erste YESNO-Lauf das Modell nicht) und [PC, L5](2026-11-05-labor-pc.md#l5-t31-auf-dem-echten-pfad) (alle 10 Läufe mit Modellantwort). Die Gültigkeitsgrenze oben gilt weiter für andere Blitzlicht-Typen als YESNO.
