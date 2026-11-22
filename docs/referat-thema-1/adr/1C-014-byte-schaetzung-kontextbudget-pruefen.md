# 1C-014: Byte-Schätzung des Kontextbudgets: Verbesserung prüfen

- **Status:** empfohlen (2026-11-05), nicht umgesetzt; _aktualisiert 2026-11-09:_ Issue [#17](https://github.com/NiklasSkulll/arsnova.eu/issues/17) im Fork
- **Kategorie:** Verbesserung

## Kontext

Auftragsschritt 2 fragt, was vom Kontext beim Modell ankommt. Der Packer zählt jedes UTF-8-Byte als ein Token (`estimateModerationPromptUtf8Tokens`, Schätzer `utf8-byte-upper-bound`); im Fenster von 8192 Tokens bleiben nach Instruktion, Definition, Ausgabereserve 640 und Marge 128 auf `248029dc` höchstens 6907 Byte für das Kontext-JSON, _aktualisiert 2026-11-10:_ auf `def56700` (Instruktion v5: 650, Definition 203) höchstens 6571 Byte ([Dossier 5.3](../1C/1C-kontext-und-adapterpfad.md#53-packing-budget-und-auswahl) für die Rechnung; Werte auf `def56700` aus `budget` der [Nachlauf-Rohdaten](../evidenz/1C/messung/2026-11-09-labor-nachlauf.json.gz)). In E15 fielen mit vollem #456-Kontext Blitzlicht, freigegebene Ergebnisse und Kompass aus Budgetgründen heraus ([E15](../evidenz/1C/2026-10-24-teil3.md#e15--voller-456-kontext-auf-dem-draht)). Fall L2 misst, wie stark die Schätzung die echten Prompt-Tokens überschätzt ([Labor-Design 5](../specs/2026-10-25-1c-labor-design.md#5-fälle)).

## Entscheidung

Befund: Die Byte-Schätzung ist sicher, verschenkt aber rund zwei Drittel des Fensters. Empfohlen wird, eine genauere Zählung **zu prüfen**: exakte Zählung über die Runtime oder ein kalibrierter Faktor mit Marge. Umgesetzt ist nichts ([Entscheidungen Laptop](../evidenz/1C/2026-11-05-labor.md#entscheidungen-nach-design-abschnitt-6), [Entscheidungen PC](../evidenz/1C/2026-11-05-labor-pc.md#entscheidungen-nach-design-abschnitt-6-144-und-153)).

## Alternativen

- **Beibehaltung der Byte-Schätzung mit dokumentiertem Faktor:** Das wäre nach der vorab festgelegten Regel die Folge bei Median q > 0,5 gewesen ([Labor-Design 6](../specs/2026-10-25-1c-labor-design.md#6-entscheidungsregeln)); gemessen ist q ≈ 0,32 auf beiden Rechnern, die Zeile greift nicht.
- **Exakte Zählung über die Runtime** und **kalibrierter Faktor mit Marge:** beide als Prüfkandidaten benannt, keiner bevorzugt. Kosten und Risiko sind in den Quellen nicht gemessen; Einschätzung (nicht belegt): Eine exakte Zählung koppelt das Packen an die Erreichbarkeit der Runtime; ein Faktor gilt nur für dieses Modell und diesen Tokenizer und braucht eine Marge für Ausreißer und den nicht budgetierten Template-Overhead (Offener Punkt O5, [Dossier 13](../1C/1C-kontext-und-adapterpfad.md#13-offene-punkte--fragen-an-den-prüfer)).

## Belege

- **Kriterium K_L2:** max q ≤ 1 (Schätzung konservativ), q = `prompt_tokens` / `packedInputTokens` ([Labor-Design 5](../specs/2026-10-25-1c-labor-design.md#5-fälle)).
- **Laptop:** Median q 0,320 (95 %-KI 0,319–0,321), 3,12 Byte je Token; `prompt_tokens` Median 2196 bei 6855 geschätzten Tokens; belegt max. 2857 von 8192 (`prompt_tokens` + `max_tokens` 640; _korrigiert 2026-11-10_, vorher „Kopffreiheit“) ([L2 Laptop](../evidenz/1C/2026-11-05-labor.md#l2-tokens)).
- **PC:** Median q 0,318 (95 %-KI 0,317–0,319), 3,14 Byte je Token; `prompt_tokens` Median 2182 bei 6855 geschätzten Tokens; belegt max. 2845 von 8192 (`prompt_tokens` + `max_tokens` 640; _korrigiert 2026-11-10_) ([L2 PC](../evidenz/1C/2026-11-05-labor-pc.md#l2-tokens)).
- **Voller Kontext (L5):** q Median 0,339 / 0,340 (Laptop, YESNO / TEMPO) und 0,345 / 0,338 (PC); auch dort wurden Bereiche aus Budgetgründen gekürzt ([L5 Laptop](../evidenz/1C/2026-11-05-labor.md#l5-t31-auf-dem-echten-pfad), [L5 PC](../evidenz/1C/2026-11-05-labor-pc.md#l5-t31-auf-dem-echten-pfad)).

## Ursachenkette

Beobachtung: In E15 bleiben Blitzlicht, freigegebene Ergebnisse und Kompass `available`, aber leer, bei `dataTokens` 6893 ([E15](../evidenz/1C/2026-10-24-teil3.md#e15--voller-456-kontext-auf-dem-draht)) → Hypothese (Labor-Design 5): Die Schätzung ist konservativ (q ≤ 1 in jedem Lauf), erwartet ohne Schwelle q ≈ 0,3–0,4 → Versuch: L2 mit `usage.prompt_tokens` der ausgelieferten Runtime auf zwei Rechnern → Ergebnis: q ≈ 0,32, auf Laptop und PC reproduziert → Verbesserung prüfen.

## Folgen

- **Kosten der Empfehlung:** nicht beziffert; jede Variante ist eine Produktionsänderung am Packer.
- **Risiko bei Umsetzung:** eine zu knappe Zählung überschreitet `n_ctx`; heute ist die Schätzung in jedem Lauf konservativ (max q ≤ 1).
- **Gültigkeitsgrenze:** ein Modell, ein Tokenizer, eine Sprache (`de`), Referenzfixture und L5 exemplarisch. Ob die gekürzten Bereiche mit genauerer Zählung tatsächlich passen würden, zeigt keiner der Läufe ([Entscheidungen Laptop](../evidenz/1C/2026-11-05-labor.md#entscheidungen-nach-design-abschnitt-6)). Kein Qualitätsurteil über die Modellausgabe.
- Zugehöriger Befund: Widerlegung von E15, siehe [1C-005](1C-005-e15-widerlegung-bleibt-stehen.md).
- _Aktualisiert 2026-11-09:_ Auf `def56700` unverändert: q Median 0,318 (max. 0,319), 7406 geschätzte gegen 2353 echte Prompt-Tokens ([Nachlauf, N2](../evidenz/1C/2026-11-09-labor-nachlauf.md#n2-tokens)).
- _Ergänzt 2026-11-12:_ Vorschau und Packing bleiben nach [1C-013](1C-013-vorschau-gleich-nutzlast-beibehalten.md) unverändert; eine genauere Zählung änderte nur das Budget, die Gleichheit von Vorschau und Nutzlast muss erhalten bleiben.
