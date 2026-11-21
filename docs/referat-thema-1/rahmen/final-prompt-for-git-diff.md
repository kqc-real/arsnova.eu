# Final Prompt for git diff

You are working in the `NiklasSkulll/arsnova.eu` repository. The task **"..."** in the current branch is considered complete and should be merged into `main`.

Create a clear overview of my work in Markdown bullet points. It should serve as the basis for the project documentation and my individual performance report. Check which requirements have actually been met and which pieces of evidence are still missing. Do not accept the assumed completion date without verifying it.

**Documentation:**

- _Task 1A:_ `docs/referat-thema-1/1A/1A-ressourcenisolation-app-host.md`
- _Task 1B 1-2:_ `docs/referat-thema-1/1B/1B-private-inferenz-zweiter-host.md`
- _Task 1B 3-4:_ `docs/referat-thema-1/1B/1B-private-inferenz-zweiter-host.md`
- _Task 1C:_ `docs/referat-thema-1/1C/1C-kontext-und-adapterpfad.md`

**Workflow:**

1. Read the relevant repository instructions as well as the project and exam requirements (`docs/referat-thema-1/rahmen/00-rahmen-und-pruefung.md`, `docs/referat-thema-1/rahmen/01-aufteilung.md`). If they are missing or differ from the requirements listed below, please indicate this explicitly.
2. Check the current branch, the working tree, and the available comparison basis relative to `main`. Document the references and commit IDs used.
3. Analyze the changes to the branch since the common starting point, for example using `git diff main...HEAD`, as well as the associated commits. If necessary, use `origin/main` and specify this choice. List uncommitted changes separately.
4. In addition to the diff, read the relevant files, tests, documentation, and existing test results, to the extent necessary for understanding.
5. Map the changes to the requirements. When doing so, distinguish between implemented functionality, existing tests, documented test runs, and scientific or exam-related evidence.

**Requirements to be taken into account according to the Repo version:**

- **Individual chain of evidence per person:** hypothesis, counter-hypothesis, at least one self-developed executable test, self-developed baseline run, error or variant, result with a validity limit, and decision.

**Output:**

- **Work Completed:** Group the changes according to their technical purpose. For each change, describe what was changed, its purpose, and where it is documented.
- **Comparison with Requirements:** For each requirement, specify the status as **covered**, **partially covered**, **not covered**, or **not applicable**. Justify your answer with specific references.
- **Individual chain of evidence:** List each required element individually and refer to existing evidence or identify any gaps.
- **Open Issues Before the Merge or Submission:** Distinguish between technical issues and missing documentation or audit evidence.
- **Summary for Inclusion:** Conclude by formulating brief bullet points for my project documentation. Use the first-person form exclusively for contributions that can be clearly attributed to me.

**Rules:**

- Support your statements with file paths, line ranges, test names, or commit IDs whenever possible.
- Do not attribute all branch changes to me across the board. Use reliable evidence of authorship and clearly label unclear or collaborative contributions.
- Do not invent hypotheses, test results, baseline runs, decisions, or prior agreements.
- The existence of a test does not constitute proof of a successful test run. Clearly indicate whether results have already been documented or have been re-verified by you.
- Do not infer full compliance with test requirements based solely on code changes.
- Do not modify any files or perform any commits, pushes, or merges.

**Output Template (Stick to it):**

```
## Eigenanteil

### Aufgabe und Beitrag

- **Aufgabe:** <Aufgabe>.
- **Änderungen und Zweck:** <eigene Änderungen und Zweck>.
- **Belege:** <Dateien/Zeilen, Commits>.
- **Gemeinschaftliche oder unklare Anteile:** <Abgrenzung>.

### Prüfgrundlage

- `<Branch>@<SHA>` gegenüber `<main oder origin/main>@<SHA>`.
- **Merge-Base:** `<SHA>`.
- **Nicht committete Änderungen:** <keine/Liste>.
- **Vorgaben und Aufgabendokumentation:** <Fundstellen; fehlende oder abweichende Vorgaben>.

### Anforderungsabgleich

- <Je Anforderung: abgedeckt / teilweise abgedeckt / nicht abgedeckt / nicht anwendbar — kurze Begründung und Beleg>.

### Tests

- **Tests:** <Testnamen>.
- **Status:** <Lauf dokumentiert / erneut ausgeführt>.
- **Ergebnis:** <Ergebnis, getesteter Commit, Nachweis>.

### Individuelle Beweiskette

- **Hypothese:** <Beleg/Lücke>.
- **Gegenhypothese:** <Beleg/Lücke>.
- **Eigener ausführbarer Test:** <Beleg/Lücke>.
- **Eigener Baseline-Lauf:** <Beleg/Lücke>.
- **Fehler/Variante:** <Beleg/Lücke>.
- **Ergebnis mit Gültigkeitsgrenze:** <Beleg/Lücke>.
- **Entscheidung:** <Beleg/Lücke>.

### Offen

- **Technisch:** <Punkte/keine>.
- **Dokumentation und Prüfungsnachweise:** <Punkte/keine>.

### Leistungsnachweis

- <1–2 kurze Sätze zu Beitrag, Nutzen und belegtem Ergebnis; Ich-Form nur bei eindeutig nachgewiesenem Eigenanteil>.
```
