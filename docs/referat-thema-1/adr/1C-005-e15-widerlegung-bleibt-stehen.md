# 1C-005: Widerlegung von E15 bleibt stehen, der Fall wird nicht umformuliert

- **Status:** methodisch (2026-11-05); Entscheidung der KI-gestützten Steuerung, vom Autor bestätigt am 2026-11-12
- **Kategorie:** Methodik

## Kontext

Auftragsschritte 1 und 2 verlangen den vollständigen #456-Kontext auf dem Draht. E15 war vorregistriert: Mit Themen, Lernzielen, Blitzlicht, freigegebenen Ergebnissen und Kompass sind alle Bereiche in der Vorschau `available` mit mindestens einem Eintrag, und der gesendete Body ist bytegleich zur Vorschau ([E15](../evidenz/1C/2026-10-24-teil3.md#e15--voller-456-kontext-auf-dem-draht)). Je Fall waren vorab Hypothese (H), Gegenhypothese (G) und Kriterium (K) festgelegt; K (1) ist die erste Teilprüfung, hier „jeder Bereich `available` mit mindestens einem Eintrag“. Am unveränderten Code ist K (1) verfehlt. Nach der Ausführungsregel „K verfehlt am unveränderten Code → stoppen und berichten“ ist der Test nicht eingecheckt.

## Entscheidung

Die Widerlegung bleibt stehen. Der vorregistrierte Fall wird nicht nachträglich umformuliert, etwa auf ein größeres Profil oder weniger Bereiche. Getroffen hat das die KI-gestützte Steuerung; vom Autor ist es noch zu bestätigen ([E15](../evidenz/1C/2026-10-24-teil3.md#e15--voller-456-kontext-auf-dem-draht), [KI-Nutzung Teil 3](../evidenz/1C/2026-10-24-teil3.md#ki-nutzung)). _Aktualisiert 2026-11-12:_ Der Autor hat die Entscheidung bestätigt ([Stand der Autorenprüfung](../1C/1C-eigenanteil.md#stand-der-autorenprüfung)).

## Alternativen

- **Fall nachträglich anpassen** (größeres Packing-Profil, weniger Bereiche oder nur „Bereich vorhanden“ statt „mit Eintrag“): verworfen. Der Test würde dann grün, belegte aber eine andere Hypothese als die vorab festgelegte; das wäre ein Anpassen der Hypothese nach Sicht der Daten.
- **Fall stillschweigend streichen:** verworfen; der Test ist stattdessen als Patch [`e15-widerlegt.patch`](../evidenz/1C/e15-widerlegt.patch) versioniert (SHA-256 im Protokoll, `git apply --check` sauber gegen `f6a0ff2e`).

## Belege

- **Beobachtung:** Im Analysekontext haben alle fünf Bereiche Einträge; der Packer kürzt aus Budgetgründen Fragen, Kompass, freigegebene Ergebnisse und Feedback (`dataTokens` 6893). In der Vorschau sind Blitzlicht, freigegebene Ergebnisse und Kompass `available`, aber leer; das Lernziel war in 7 von 11 Läufen enthalten ([E15](../evidenz/1C/2026-10-24-teil3.md#e15--voller-456-kontext-auf-dem-draht)).
- **Kein Transportdefekt:** Ein Transportdefekt ist nicht beobachtet; was nicht gepackt ist, steht auch nicht im Body ([E15](../evidenz/1C/2026-10-24-teil3.md#e15--voller-456-kontext-auf-dem-draht)). Auf dem echten Pfad bestätigt L1 die Gleichheit von Vorschau und Draht auf beiden Rechnern ([1C-013](1C-013-vorschau-gleich-nutzlast-beibehalten.md)).
- **Labor, voller Kontext (L5):** Kürzungen aus Budgetgründen in Fragen, Kompass, Lernkontext, freigegebenen Ergebnissen und (YESNO) Feedback, auf dem Laptop ([L5 Laptop](../evidenz/1C/2026-11-05-labor.md#l5-t31-auf-dem-echten-pfad)) wie auf dem PC ([L5 PC](../evidenz/1C/2026-11-05-labor-pc.md#l5-t31-auf-dem-echten-pfad)).

## Ursachenkette

Beobachtung: K (1) von E15 rot, drei Bereiche leer → Hypothese: Packbudget statt Transport → Versuch: `budget.truncations` der Vorschau ausgelesen, Vergleich mit dem Referenzszenario ohne Zusatzbereiche (Diagnoselauf, nicht committet; `dataTokens` 6880, nur `questions: 2 (deduplication)` und `compass: 2 (token-budget)` weggelassen) → Ergebnis: Erst die Bereiche des vollen Kontexts verdrängen Blitzlicht, freigegebene Ergebnisse und Kompass ([E15](../evidenz/1C/2026-10-24-teil3.md#e15--voller-456-kontext-auf-dem-draht)) → Folgefrage zur Schätzung: [1C-014](1C-014-byte-schaetzung-kontextbudget-pruefen.md).

## Folgen

- **Für das Referat:** „voller #456-Kontext auf dem Draht“ gilt als widerlegt; ein Bereich kann aus Budgetgründen `available` und leer sein. Das ist kein Transportfehler, aber eine Grenze für „kein stiller Feldverlust“ (Punkt 3, [1C-diagrams](../1C/1C-diagrams.md#aufgabenabdeckung-prüfungsdokument-43-1c)).
- **Kosten:** keine. **Risiko:** keines für das Produkt.
- **Gültigkeitsgrenze:** eine synthetische Fixture; welche Lage eintritt (Lernziel enthalten oder nicht), hängt von zufälligen IDs ab und ist nicht deterministisch; die Ursache im Greedy-Packer ist nicht weiter untersucht ([E15](../evidenz/1C/2026-10-24-teil3.md#e15--voller-456-kontext-auf-dem-draht)).
- _Aktualisiert 2026-11-12:_ vom Autor bestätigt; nichts mehr offen.
