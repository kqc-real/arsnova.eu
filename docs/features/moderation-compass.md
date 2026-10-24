<!-- markdownlint-disable MD013 -->

# Deterministischer Live-Moderationskompass (Story 8.9a)

**Zielgruppe:** Product Owner, Entwickler, Betrieb, Lehre
**Stand:** 2026-10-23
**Status:** ✅ umgesetzt (Host-Dialog, regelbasierte Karten, Quellen-Sprünge)
**Backlog:** Story 8.9a
**Erweiterungen:** [Q&A-NLP-Kaskade (8.9b)](qa-nlp-moderation.md) · [Moderationszusammenfassung (8.9c)](qa-summary.md)
**ADR:** [0032-optional-nlp-cascade-for-qa-moderation-signals.md](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md) (gilt für 8.9b/c; 8.9a bleibt ohne Inferenz)

## Zweck

**Technisches Onboarding für Release 1.3:** [Architektur, Analyseverfahren, Datenverträge und Betrieb des Moderationskompasses](moderation-compass-onboarding-1.3.md). Die Dokumentation erläutert den Zielstand aus #463 und #456 und unterscheidet belegten Code von zusätzlichen Releaseverträgen.

Der Host erhält während einer Live-Session eine **regelbasierte, quellenbelegte Lageeinschätzung** aus bereits geladenen Host-Signalen. Der Kompass schlägt vorsichtige nächste Schritte vor. Pin, Archiv und Phasen startet er nicht von selbst. Ein bestätigter Sprung zu einem früheren Quiz-Ergebnis steuert den Raum, weil die Ergebnisansicht gemeinsam ist.

Er ist die Fallback-Basis für 8.9b und 8.9c: ohne NLP, ohne LLM, ohne neuen Dauerpoller und ohne Teilnehmer-Fan-out. Presenter- und Teilnehmendenansicht zeigen den Kompass nicht.

## Host-UI

Button **Kompass** neben der Live-Leiste, in allen Live-Kanälen, als kompakte Pille oben an der Join-Karte (nicht über deren volle Höhe). Present/Vote und `FINISHED` ohne Kompass. Der Dialog bleibt erreichbar, auch wenn noch keine Karte entsteht; dann erscheint der Leertext, der die vier Kartenarten nennt. Sobald mindestens eine Karte da ist, trägt der Button `has-signals`. Die Dialogfläche liegt auf `surface-container-high` (Dark: `surface-container-highest`) mit eigenem Scrim-Backdrop, damit sie sich vom Host-Verlauf abhebt.

Leseordnung im Dialog: zuerst **Als Nächstes** (ein Vorschlag aus der stärksten Karte), dann die Signalkarten. Reihenfolge der Karten: **Feedback zum Vortragstempo**, **Reibung**, **Klärung**, **Antwortverteilung**, **Themen**. Dieselbe Lesart ordnet die Q&A-Sortierung und **Größe nach**: **Kontroverse**, **Beste Fragen**, **Stimmensaldo**, zuletzt **Zeit** bzw. **Vorkommen in Fragen**. **Kommen nicht mit** gilt nur, wenn es zu schnell ist oder Teilnehmende abgehängt sind. Zu langsam und gemischte Tempo-Rückmeldungen haben eigene Sätze. Der nächste Schritt steht nur in der Handlungszeile, nicht noch einmal auf der Karte. Tautologische Vorschläge auf einer einzelnen Karte entfallen. Ohne Q&A-Klassifikation erscheint kein Hinweis, dass eine automatische Sortierung aus ist.

Quellen sind gestapelte Sprungzeilen mit Zielchip (**Q&A**, **Wortwolke**, **Quiz**, **Blitzlicht**). Pro Eintrag stehen höchstens drei Zeilen: **Überschrift**, optional **Beleg** (Antwortpaar, wiederholter Text), optional **Kontext** (Fragenstamm). Wiederholungen entfallen: ein Fragenstamm unter »Median« bleibt, Keyword-Suppe wie »Skalierung prüfen Kontext prüfen« unter »Skalierung und Kontext« nicht. Pro Karte sind drei Quellen sichtbar; weitere stehen hinter einem Aufklapp-Label. Bei gemischten Quellen lautet es **Weitere Einstiege (N)**; bei weiteren Wortwolken-Termen **Weitere Wortwolken-Themen**; nur bei Sortierung **BEST**, aktiver Glättung und Einzelwort-Modus (keine Phrasen) **Top-Themen der Wortwolke**. NLP-Kategorien (Inhalt/Ablauf/Technik) erscheinen separat als Q&A-Quellen. Quellenklicks wechseln den Kanal und heben Forum-Beiträge hervor (Badge **Aus dem Kompass · …**). Eine Q&A-Wortwolke öffnet sich nur in der Host-Ansicht; die Präsentation schaltet dabei nicht mit, auch nicht über **Zurück zum Kompass**. Ein Quiz-Sprung auf eine andere bereits geöffnete Ergebnisfrage fragt zuerst nach, weil Teilnehmende und Präsentation diese Frage dann im Ergebnis sehen. **Zurück zum Kompass** stellt den vorherigen Kanal wieder her und öffnet den Dialog erneut. **Markierung lösen** entfernt die Hervorhebung.

Der Kompass ist eine Host-Funktion. Vertrauenswürdige Tutor:innen oder Moderator:innen sollen ihn künftig ausschließlich als vollwertige, separat widerrufbare Paired Hosts gemäß Story **2.10** nutzen.

## Signale

Der Kompass liest nur, was der Host ohnehin sehen darf:

- Q&A: Status, Pin/Archiv, Up-/Downvote-Aggregate, `score` / `bestScore` / `controversyScore`, aktiver Sortiermodus
- Q&A- und Freitext-Wortwolken-Terme (Gewichtungsbasis wie in der Wolke)
- Quiz-Ergebnisse nach `RESULTS` (Verteilungen, Streuung, Histogramm, numerische Schätzung, Rundenvergleich)
- Tempo-Blitzlicht-Tendenz und aggregiertes Quick-Feedback

Vor Ergebnisfreigabe gelten die Data-Stripping-Regeln weiter. Keine Rohverteilungen oder Lösungshinweise, solange sie dem Host fachlich nicht offenstehen.

Seit #456 Slice 3 liegt die seiteneffektfreie Fachentscheidung mit Version `moderation-compass-rules-v1` in `libs/shared-types/src/moderation-compass-rules.ts`. Dort stehen Schwellen, Faktenermittlung, Quellenauswahl, Kartenreihenfolge und Priorisierung genau einmal für Browser und Backend. Der Frontend-Adapter in `moderation-compass.ts` bleibt für Beschriftung, Kürzung, Sprungziele und andere Präsentationsdetails zuständig; er berechnet keine zweite Schwellenlogik. Ein Histogramm gilt nur mit nachgewiesenem numerischem Toleranzband als »außerhalb des Bands«; `inBandPercent: null` ist ausdrücklich kein negatives Signal.

## Wann eine Karte erscheint

Es gibt **keine** globale Teilnehmer- oder Frageschwelle für den Dialog. Karten entstehen nur mit einer Quelle (`buildModerationCompassCards`). Ohne Quellen keine Karte. Schwache Quiz-Hinweise bleiben sichtbar, bestimmen aber nicht den nächsten Schritt, solange Moderationsstau oder Reibung vorliegen.

| Karte                      | Schwelle (Auszug)                                                                                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Themen                     | Begriff mindestens zweimal (`documentFrequency >= 2` oder `sourceCount >= 2`). Hervorhebungen sind keine Themenquelle. Die Gewichtungsbasis steht als Hinweis unter der Karte.                                                                                                                  |
| Klärung                    | ausstehende Q&A und belastbare Quiz-Fakten (Mehrheitsfehler, Histogramm-Spitze bei vorhandenem Toleranzband ≥ 30 %, numerisch n ≥ 8, Rundenrückgang, strukturierte Verwechslung ab 30 % der Antworten, wiederkehrende selbstsicher falsche Option ab 30 % der Antworten mit Selbsteinschätzung) |
| Antwortverteilung          | Umfrage mit mindestens einer Stimme. Sie steht nicht auf **Noch klären** und nicht vor offenen Fragen oder Reibung.                                                                                                                                                                             |
| Erwähnung                  | einzelne falsche Option, seltene Verwechslung, wiederholter Freitext oder selbstsicher falsche Antworten unter 30 % bzw. ohne wiederkehrende Option. Sichtbar, aber erst nach Moderationsstau und Reibung. Freitext hat einen eigenen Vorschlag.                                                |
| Reibung                    | `ACTIVE`/`PINNED` mit `controversyScore > 0.5` und mindestens der raumgrößenabhängigen Stimmenzahl `T`, oder explizit kontrovers; `PENDING` bleibt ein reiner Moderationshinweis, Archiv/gelöscht bleibt ohne Reibung                                                                           |
| Feedback zum Vortragstempo | nur wenn eine Tempo-/Feedback-Tendenz vorliegt; Split z. B. Mehrheit &lt; 60 % und Zweite ≥ 30 %                                                                                                                                                                                                |
| Nächster Schritt           | Alarm-Tempo, dann belastbare Quiz-Klärung, dann vorsichtiges Tempo, dann offene Fragen, dann Reibung, dann Freitext, Umfrage und einzelne andere Antworten, dann Themen                                                                                                                         |

Der Kompass liest den ungefilterten Host-Bestand. Suche, Autor- und Statusfilter der Q&A-Liste ändern die Karten nicht. Passt die aktuelle Seite nicht, lädt er bis zur Listenobergrenze nach.

Die optionale 8.9c-Kurzfassung ist kein Signalkarten-Typ. Sie erscheint nur bei Kill-Switch, konfiguriertem privatem Endpunkt und mindestens drei sichtbaren Q&A-Beiträgen; siehe [qa-summary.md](qa-summary.md).

Fachregeln: `libs/shared-types/src/moderation-compass-rules.ts`. Frontend-Präsentationsadapter: `apps/frontend/src/app/features/session/session-host/moderation-compass.ts`.

## Grenzen

- Keine automatischen Pin-/Archiv-/Phasenaktionen, kein Blitzlicht-Start, keine zweite Runde.
- Keine Bewertung einzelner Teilnehmender, keine Persönlichkeitsprofile, keine Punkte.
- Keine NLP-/LLM-Inferenz in 8.9a. Optionale Hilfssignale: 8.9b. Optionale Sätze: 8.9c, Kill-Switch default aus.
- i18n in `de`, `en`, `fr`, `es`, `it`.

## Tests

`libs/shared-types/src/moderation-compass-rules.test.ts`, `moderation-compass.spec.ts`, `moderation-compass-dialog.component.spec.ts` und Host-Component-Tests unter `apps/frontend/src/app/features/session/session-host/`. Seed für lokale Demo: `npm run seed:moderation-compass -w @arsnova/backend`.
