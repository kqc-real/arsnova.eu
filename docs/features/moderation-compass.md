<!-- markdownlint-disable MD013 -->

# Deterministischer Live-Moderationskompass (Story 8.9a)

**Zielgruppe:** Product Owner, Entwickler, Betrieb, Lehre
**Stand:** 2026-08-20
**Status:** ✅ umgesetzt (Host-Dialog, regelbasierte Karten, Quellen-Sprünge)
**Backlog:** Story 8.9a
**Erweiterungen:** [Q&A-NLP-Kaskade (8.9b)](qa-nlp-moderation.md) · [Moderationszusammenfassung (8.9c)](qa-summary.md)
**ADR:** [0032-optional-nlp-cascade-for-qa-moderation-signals.md](../architecture/decisions/0032-optional-nlp-cascade-for-qa-moderation-signals.md) (gilt für 8.9b/c; 8.9a bleibt ohne Inferenz)

## Zweck

Der Host erhält während einer Live-Session eine **regelbasierte, quellenbelegte Lageeinschätzung** aus bereits geladenen Host-Signalen. Der Kompass schlägt vorsichtige nächste Schritte vor, führt aber **keine** Aktionen aus.

Er ist die Fallback-Basis für 8.9b und 8.9c: ohne NLP, ohne LLM, ohne neuen Dauerpoller und ohne Teilnehmer-Fan-out. Presenter- und Teilnehmendenansicht zeigen den Kompass nicht.

## Host-UI

Button **Kompass** neben der Live-Leiste, in allen Live-Kanälen. Present/Vote und `FINISHED` ohne Kompass. Der Dialog bleibt erreichbar, auch wenn noch keine Karte entsteht; dann erscheint der Leertext, der die vier Kartenarten nennt. Sobald mindestens eine Karte da ist, trägt der Button `has-signals`. Vor dem ersten Öffnen im Tab gibt es zusätzlich den kurzen Hinweis **Hinweise bereit**. Die Dialogfläche liegt auf `surface-container-high` (Dark: `surface-container-highest`) mit eigenem Scrim-Backdrop, damit sie sich vom Host-Verlauf abhebt.

Leseordnung im Dialog: zuerst **Als Nächstes** (ein Vorschlag aus der stärksten Karte), dann die Signalkarten. Reihenfolge der Karten: **Tempo**, **Reibung**, **Klärung**, **Themen**. Tempo mit Vorsicht oder Alarm heißt **Kommen nicht mit**. Der nächste Schritt steht nur in der Handlungszeile, nicht noch einmal auf der Karte. Tautologische Vorschläge auf einer einzelnen Karte entfallen.

Quellen sind Sprungzeilen mit Ziel (**Q&A**, **Wortwolke**, **Quiz**, **Blitzlicht**). Pro Karte sind drei Quellen sichtbar, weitere hinter **Noch … anzeigen**. Quellenklicks wechseln den Kanal, heben Forum-Beiträge hervor (Badge **Aus dem Kompass · …**) oder öffnen die Wortwolke zum Begriff. **Zurück zum Kompass** stellt den vorherigen Kanal wieder her und öffnet den Dialog erneut. **Markierung lösen** entfernt die Hervorhebung.

Moderatorzugang bleibt an Story **8.5** gebunden; bis dahin nur Host-Token.

## Signale

Der Kompass liest nur, was der Host ohnehin sehen darf:

- Q&A: Status, Pin/Archiv, Up-/Downvote-Aggregate, `score` / `bestScore` / `controversyScore`, aktiver Sortiermodus
- Q&A- und Freitext-Wortwolken-Terme (Gewichtungsbasis wie in der Wolke)
- Quiz-Ergebnisse nach `RESULTS` (Verteilungen, Streuung, Histogramm, numerische Schätzung, Rundenvergleich)
- Tempo-Blitzlicht-Tendenz und aggregiertes Quick-Feedback

Vor Ergebnisfreigabe gelten die Data-Stripping-Regeln weiter. Keine Rohverteilungen oder Lösungshinweise, solange sie dem Host fachlich nicht offenstehen.

## Wann eine Karte erscheint

Es gibt **keine** globale Teilnehmer- oder Frageschwelle für den Dialog. Karten entstehen nur bei belastbarer Evidenz (`buildModerationCompassCards`). Ohne Quellen keine Karte.

| Karte            | Schwelle (Auszug)                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Themen           | Begriff mindestens zweimal (`documentFrequency >= 2` oder `sourceCount >= 2`)                                     |
| Klärung          | ausstehende Q&A und/oder Quiz-Fakten (u. a. Histogramm-Spitze ≥ 30 %, numerisch n ≥ 8, Freitext-Wiederholung ≥ 2) |
| Reibung          | `controversyScore > 0.5` oder explizit kontrovers; Archiv/gelöscht ohne Reibung                                   |
| Tempo            | nur wenn eine Tempo-/Feedback-Tendenz vorliegt; Split z. B. Mehrheit &lt; 60 % und Zweite ≥ 30 %                  |
| Nächster Schritt | nur wenn bereits eine andere Karte da ist                                                                         |

Implementierung: `apps/frontend/src/app/features/session/session-host/moderation-compass.ts`.

## Grenzen

- Keine automatischen Pin-/Archiv-/Phasenaktionen, kein Blitzlicht-Start, keine zweite Runde.
- Keine Bewertung einzelner Teilnehmender, keine Persönlichkeitsprofile, keine Punkte.
- Keine NLP-/LLM-Inferenz in 8.9a. Optionale Hilfssignale: 8.9b. Optionale Sätze: 8.9c, Kill-Switch default aus.
- i18n in `de`, `en`, `fr`, `es`, `it`.

## Tests

`moderation-compass.spec.ts`, `moderation-compass-dialog.component.spec.ts` und Host-Component-Tests unter `apps/frontend/src/app/features/session/session-host/`. Seed für lokale Demo: `npm run seed:moderation-compass -w @arsnova/backend`.
