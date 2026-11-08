# E1b – Sichtbarkeit des Kompass-Buttons (efd71b44)

Commit `efd71b44d4fd32d711cd483606ce5eefd1e9af5b` (clean: true), Regeln `moderation-compass-rules-v1`, v24.18.0, 2026-11-08T14:29:34.290Z

Ab diesem Stand erscheint der Button nur, wenn `buildModerationCompassView().actionRecommendation` nicht `null` ist.

| Statusvariante         | N    | Sortierung    | Wortwolke | Karten                  | Empfehlung  | Button   |
| ---------------------- | ---- | ------------- | --------- | ----------------------- | ----------- | -------- |
| S0_fixture             | 50   | BEST          | LEXICAL   | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 50   | BEST          | THEME     | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 50   | TOP           | LEXICAL   | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 50   | TOP           | THEME     | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 50   | CONTROVERSIAL | LEXICAL   | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 50   | CONTROVERSIAL | THEME     | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 50   | TIME          | LEXICAL   | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 50   | TIME          | THEME     | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 200  | BEST          | LEXICAL   | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 200  | BEST          | THEME     | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 200  | TOP           | LEXICAL   | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 200  | TOP           | THEME     | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 200  | CONTROVERSIAL | LEXICAL   | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 200  | CONTROVERSIAL | THEME     | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 200  | TIME          | LEXICAL   | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 200  | TIME          | THEME     | friction, clarification | pending-qa  | sichtbar |
| S0_fixture             | 1000 | BEST          | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S0_fixture             | 1000 | BEST          | THEME     | clarification           | pending-qa  | sichtbar |
| S0_fixture             | 1000 | TOP           | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S0_fixture             | 1000 | TOP           | THEME     | clarification           | pending-qa  | sichtbar |
| S0_fixture             | 1000 | CONTROVERSIAL | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S0_fixture             | 1000 | CONTROVERSIAL | THEME     | clarification           | pending-qa  | sichtbar |
| S0_fixture             | 1000 | TIME          | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S0_fixture             | 1000 | TIME          | THEME     | clarification           | pending-qa  | sichtbar |
| S1_all_approved        | 50   | BEST          | LEXICAL   | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 50   | BEST          | THEME     | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 50   | TOP           | LEXICAL   | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 50   | TOP           | THEME     | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 50   | CONTROVERSIAL | LEXICAL   | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 50   | CONTROVERSIAL | THEME     | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 50   | TIME          | LEXICAL   | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 50   | TIME          | THEME     | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 200  | BEST          | LEXICAL   | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 200  | BEST          | THEME     | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 200  | TOP           | LEXICAL   | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 200  | TOP           | THEME     | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 200  | CONTROVERSIAL | LEXICAL   | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 200  | CONTROVERSIAL | THEME     | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 200  | TIME          | LEXICAL   | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 200  | TIME          | THEME     | friction, topics        | controversy | sichtbar |
| S1_all_approved        | 1000 | BEST          | LEXICAL   | topics                  | topics      | sichtbar |
| S1_all_approved        | 1000 | BEST          | THEME     | topics                  | topics      | sichtbar |
| S1_all_approved        | 1000 | TOP           | LEXICAL   | topics                  | topics      | sichtbar |
| S1_all_approved        | 1000 | TOP           | THEME     | topics                  | topics      | sichtbar |
| S1_all_approved        | 1000 | CONTROVERSIAL | LEXICAL   | topics                  | topics      | sichtbar |
| S1_all_approved        | 1000 | CONTROVERSIAL | THEME     | topics                  | topics      | sichtbar |
| S1_all_approved        | 1000 | TIME          | LEXICAL   | topics                  | topics      | sichtbar |
| S1_all_approved        | 1000 | TIME          | THEME     | topics                  | topics      | sichtbar |
| S2_unreviewed_no_votes | 50   | BEST          | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 50   | BEST          | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 50   | TOP           | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 50   | TOP           | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 50   | CONTROVERSIAL | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 50   | CONTROVERSIAL | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 50   | TIME          | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 50   | TIME          | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 200  | BEST          | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 200  | BEST          | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 200  | TOP           | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 200  | TOP           | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 200  | CONTROVERSIAL | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 200  | CONTROVERSIAL | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 200  | TIME          | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 200  | TIME          | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 1000 | BEST          | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 1000 | BEST          | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 1000 | TOP           | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 1000 | TOP           | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 1000 | CONTROVERSIAL | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 1000 | CONTROVERSIAL | THEME     | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 1000 | TIME          | LEXICAL   | clarification           | pending-qa  | sichtbar |
| S2_unreviewed_no_votes | 1000 | TIME          | THEME     | clarification           | pending-qa  | sichtbar |
