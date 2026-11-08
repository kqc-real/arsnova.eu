# English UI copy

These rules apply to English user-facing copy across arsnova.eu. They complement
[ADR-0008](../architecture/decisions/0008-i18n-internationalization.md), the
[styleguide](STYLEGUIDE.md), and the [Angular i18n workflow](../I18N-ANGULAR.md).
German remains the source language. Preserve the intended behavior and write
natural English rather than following German sentence structure.

Use **US English**: **color**, **organization**, **prioritize**, **categorization**,
**canceled**, and **neighbor**. Technical keys, enum values, IDs, code samples,
URLs, and proper names keep their original spelling.

## Product terminology

| Meaning                         | English copy                                                 | Avoid                                                                                   |
| ------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Person running a session        | **host**                                                     | **instructor**, **lecturer**, or **teacher** in generic session UI                      |
| Live event in the app           | **session**, **live session**                                | Switching between **event**, **room**, and **session** for the same thing               |
| Quiz-Sammlung                   | **quiz library**                                             | Mixing **library** and **collection** in the same flow                                  |
| Share the quiz library          | **Share library**                                            | **Share collection** when the visible button says **Share library**                     |
| Blitzlicht, named feature       | **Pulse Check**                                              | **Blitzlicht**, **quick feedback**, or **instant feedback** as alternate feature names  |
| Generic polling in marketing    | **live polls**                                               | Treating every use of **feedback** as the named Pulse Check feature                     |
| Feedback about speed            | **pace feedback**, **Pace barometer**                        | Switching between **pace** and **tempo** in the same UI                                 |
| Q&A                             | **Q&A**, **Q&A questions**, **Q&A forum**                    | **Q&As** as a channel name                                                              |
| Q&A freigeben                   | **Publish**, **Published**, **Awaiting review**              | **Release** for questions or labels that imply the host grades their content            |
| Q&A anheften                    | **Pin**, **Unpin**, **Pinned**                               | **Highlight** when the action persistently pins a question                              |
| Q&A Stimmensaldo                | **Net votes**                                                | Calling the vote difference a rating of factual correctness                             |
| Q&A klare Zustimmung            | **Strong support**                                           | **Best questions**, **quality**, or **correctness** for this score                      |
| Wortwolken-Wortgruppen          | **Phrases**; in explanations, **words and phrases**          | Literal **word groups** as the main label                                               |
| Wortwolken-Themen               | **Topics**                                                   | Implying that topic grouping assesses the participants                                  |
| Sicherheit der Gruppierung      | **Grouping reliability**                                     | Confusing it with answer confidence                                                     |
| Selbsteinschätzung der Antwort  | **Answer confidence**; **self-rated confidence** in analysis | **Self-assessment** without specifying what is assessed; **safe/unsafe**                |
| Moderations-Kompass             | **Moderation compass**, compact **Compass**                  | Different names in host, help, and landing views                                        |
| Suggested action in the compass | **Next step**                                                | **Next move** or **Up next** as competing product labels                                |
| Lernziel                        | **Learning objective**                                       | Alternating **goal**, **target**, **proposal**, and **objective**                       |
| KI-Vorschlag: origin            | **AI suggestion**                                            | **AI draft** when describing origin rather than status                                  |
| Lernziel: status                | **Draft**, **Confirmed**, **Review required**                | Treating an AI suggestion as confirmed or always unconfirmed                            |
| PDF document used for follow-up | **Debriefing report**                                        | Mixing **debrief plan**, **results PDF**, and **debriefing report** for one action      |
| Plan section inside the report  | **Debriefing plan**                                          | Using this term as an alternate name for every export action                            |
| Accessible PDF option           | **Accessible (PDF/UA-1)**                                    | Literal **Barrier-free**                                                                |
| Single Choice / Multiple Choice | **Single choice**, **Multiple choice**                       | Inconsistent capitalization or different names in preview and PDF                       |
| Other structured formats        | **Matching**, **Ordering**, **Categorization**               | **Attribution**, **association elements**, or **sequence question** as competing labels |
| Schätzfrage                     | **Numeric estimate**, **numeric estimation question**        | Switching to **numerical estimate** in the same type selector                           |
| Local style labels              | **Business**, **Gamification**                               | Replacing established labels with **Professional**, **Serious**, or **Gamified**        |
| Session code                    | **6-character code**                                         | **6-digit code**: codes can contain letters                                             |

Presets and themes are local browser choices in session views. Do not imply that
the host forces a participant’s style or theme. Quiz setup presets describe
initial configuration values.

## Do’s and don’ts from the review

| Context                      | Do                                                                       | Don’t                                                                            |
| ---------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Matching validation          | **Left-hand terms must be unique.**                                      | **Left-wing terms must be clear.**                                               |
| Waiting for answers          | **Waiting for participants to submit their matches…**                    | **Waiting for participants to be assigned…**                                     |
| Ordering results             | **Correct order**, **Common swaps**                                      | **Unsorted order**, **Frequent substitutions** when neither describes the result |
| Finding text to redact       | **One match found.**                                                     | **Found a site.**                                                                |
| Saving a redaction           | **Saving redactions…**                                                   | **Blackness is saved…**                                                          |
| Checking a service           | **Checking…**                                                            | **Exam is ongoing…**                                                             |
| Failed action                | **Couldn’t save the learning objective. Try again.**                     | Empty **Error** messages or an unsupported promise that nothing is broken        |
| Pending versus success       | **Saving…** while pending; **Saved.** after confirmation                 | A success message before the server confirms the action                          |
| Source and status            | **AI suggestion** + **Confirmed**, when confirmed                        | A permanent **AI draft** badge after confirmation                                |
| Learning objective reference | **The question used to generate this suggestion is missing.**            | **The original question about this AI proposal is missing.**                     |
| Q&A analysis                 | **Unanswered questions** when the state means unanswered                 | **Open questions** when readers could interpret it as open-ended questions       |
| Agreement versus correctness | **Strong support** for a question’s votes                                | Declaring a popular question factually correct or better quality                 |
| Educational interpretation   | **Possible misconception**, **understanding**                            | A confirmed diagnosis or proven learning gain based only on one answer or score  |
| A second vote                | **Your second-round answer replaces your first.**                        | Implying that an earlier vote disappears even when no replacement is submitted   |
| Connected-device permissions | **Control the current session; the quiz library stays on the computer.** | Suggesting that a paired device can edit or delete quizzes                       |
| Privacy                      | Explain pseudonyms and optional identity linking                         | Equating a nickname with complete anonymity                                      |
| Extra response time          | Explain extra time and the host’s phase controls                         | Promising that results will always wait indefinitely                             |
| A shared confirmation button | **Continue anyway** if used for both discussion and results              | **Show results anyway** in a dialog that may start a discussion                  |
| Legal hold                   | Explain retention separately from access                                 | Suggesting a hold extends host or participant access                             |

## Tone, grammar, and typography

- Use short, direct sentences with one main idea. Rewrite German noun chains
  and passive constructions when ordinary English is clearer.
- Use **you**, **your**, and conversational contractions where appropriate:
  **you’re**, **couldn’t**, **don’t**. Report prose and legal copy can be more
  formal while staying readable.
- Use sentence case for ordinary labels and headings. Keep established feature
  names such as **Pulse Check**, **Business**, and **Gamification**, as well as
  proper names and deliberately styled report titles.
- Use verbs for actions: **Save**, **Publish**, **Delete**, **Try again**. Quote
  the actual visible label in instructions. For example, the quiz card uses
  **Start**, so its help text must not invent a different button name.
- Use an Oxford comma in lists of three or more items.
- Check subject–verb agreement, singular/plural forms, articles, and the noun
  modified by a phrase. Change the whole sentence when a word substitution
  changes its meaning.
- Prefer short sentences to long strings of dashes. When useful, use an em dash
  without surrounding spaces. An en dash can separate paired labels.
- Use US quotation marks **“…”** around control labels and dynamic names.
  Preserve the separate i18n markup around dynamic quoted values.
- Prefer typographic apostrophes in authored prose. Existing `&apos;` entities
  are valid. Never alter apostrophes or braces that are part of ICU syntax,
  source code, answer variants, or machine-readable content.
- Keep the full accessible name when shortening a visible label, for example
  **Objectives** or **Generate**. Check the real layout at 320 px.

## Preserve the actual behavior

Read the implementation and nearby tests before translating stateful copy.
Follow the full sequence: action, pending, success, rejection or timeout, then
retry or dismissal. A failed save may retain input; a conflict may already load
the latest version. Describe that specific result.

Keep these distinctions clear:

- Pausing a word cloud pauses its display; it does not stop new contributions.
- Publishing a question changes visibility. Pinning, archiving, deleting, and
  redacting are separate actions.
- Word grouping reliability is independent of answer confidence and correctness.
- Learning objective origin is independent of confirmation status. Confirmed
  objectives can later need review when linked questions change.
- Completed generation batches and drafts may survive an interruption. Explain
  whether retry continues or starts again; do not imply existing drafts vanish.
- Effective-vote scoring uses a replacement second-round answer when submitted.
  Copy must not change the scoring rule or imply that confidence affects points.
- Pseudonymous participation, anonymous display, and anonymized data are different
  concepts. Preserve the legal source’s qualifications and retention periods.

The [report glossary](../features/session-export-pdf-i18n-glossary.md) defines
pedagogical terms. A wrong answer with high confidence is an **indicator of a
possible misconception**, not a diagnosis. A correct-response rate is not a
complete measure of learning or a person’s ability.

## Cover every text source

| Source                                                                                      | Review scope                                                                                                           |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/locale/messages.en.xlf`                                                  | Navigation, host/participant/presenter views, settings, results, help, ARIA names, SEO, and loading/empty/error states |
| Locale-specific Frontend/Backend TypeScript                                                 | Sort help, summary fallbacks, and learning-objective generation limitations outside XLF                                |
| `apps/frontend/scripts/apply-demo-quiz-locale-strings.mjs` and `quiz-demo-showcase.en.json` | Demo title, introduction, questions, answers, image descriptions, and generator output                                 |
| `libs/session-export-report/src/labels-locale.util.ts`                                      | Curated `EN_LABELS`, in addition to their app-catalog equivalents                                                      |
| Both English demo PDFs                                                                      | Actual rendered text, charts, tables, pagination, and accessibility profile                                            |
| `scripts/load/demo-quiz-classroom-30.mjs`                                                   | Authored sample responses used to generate the demo reports                                                            |
| `apps/frontend/src/assets/legal/*.en.md`                                                    | Legal notice, privacy policy, accessibility statement, and their UI references                                         |
| `apps/landing/src/i18n/en.ts`                                                               | Hero, every section, FAQ, sample views, navigation, accessible names, metadata, and JSON-LD                            |
| `apps/landing/src/pages/en/`                                                                | The landing site’s own legal context, footer routes, canonicals, and sitemap                                           |
| `apps/frontend/scripts/patch-pwa-manifest-per-locale.mjs`                                   | Shortcuts and screenshot labels                                                                                        |

The landing site and live app describe different hosting contexts. Do not replace
one set of legal pages with the other. Preserve provider details, URLs, legal
references, deadlines, and qualifications when improving legal wording.

English report labels are maintained in both `EN_LABELS` and the Angular catalog.
The locale-label regression test compares all effective English report labels to
the actual `$localize` bindings. Update both sources. Do not assume a catalog
edit automatically overwrites curated report labels.

For the fixed demo, edit the generator and regenerate its JSON. Preserve question
types, IDs, solution keys, numeric settings, and accepted answer variants unless
a separate functional correction is intended. Regenerate both English demo PDFs
when demo or report copy changes, render all pages, and validate PDF/UA.

## Validation and review

- Edit English `<target>` values only unless the German source needs a deliberate
  change. Preserve source text, IDs, context, inline XML, indexed report slots,
  ICU keywords, and case selectors.
- Do not translate user-authored quiz content. The fixed demo is a deliberate
  exception. Changes to German UI wording require all five locales; English-only
  language improvements do not require rewriting the other languages.
- Run `npm run check:i18n -w @arsnova/frontend`, appropriate tests, and the localized
  build. A passing catalog check proves structural consistency, not idiomatic
  language or accessibility.
- For landing changes, build the landing, run `test:i18n`, and test the new links
  and real mobile layout. Include metadata and structured data in the review.
- For PDFs, inspect rendered pages as well as text extraction and run veraPDF
  for the PDF/UA output. Text extraction alone cannot detect clipping.
- Review the complete diff. Report executed checks and manual limits honestly;
  an automated axe pass does not replace a full screen-reader or keyboard audit.

For local development, root `npm run dev` defaults to German. Use
`npm run dev:en` for English and `npm run dev:de` for German. See the
[development workflow](../I18N-ANGULAR.md) for localized builds and previews.
