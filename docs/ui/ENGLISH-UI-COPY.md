# English UI copy — language rules (`messages.en.xlf`)

This document generalises the copy-editing rules applied to the English XLF targets for **arsnova.eu**. It complements **ADR-0008** (informal address, idiomatic targets, mobile-first length) and **`docs/I18N-ANGULAR.md`** (workflow, ICU, XLF mechanics).

**Scope:** User-facing strings in **`apps/frontend/src/locale/messages.en.xlf`** (and the same voice for **legal markdown** in English where we control the wording). **Quiz content** in the app is not extracted to XLF; the **English showcase demo quiz** (`apps/frontend/src/assets/demo/quiz-demo-showcase.en.json`) is authored in English and should follow this guide (terminology, US spelling, tone). Regenerate from **`apps/frontend/scripts/apply-demo-quiz-locale-strings.mjs`** keeps the `en` patch in sync with the JSON.

**Default variety:** **US English** for spelling (_color_, _center_ when used, _neighbor_ if ever needed) and typical product UI tone. Prefer **clear, conversational** phrasing over formal or “translatorese”.

**Local dev default:** Root **`npm run dev`** serves the **English** bundle (`localize: ["en"]`); open **`http://localhost:4200/en/`**. For German source strings without XLF merge, use **`npm run dev:de`** and **`http://localhost:4200`**. See **`docs/I18N-ANGULAR.md`** (Dev-Server).

---

## 1. Product terminology (stay consistent)

| Prefer                                             | Avoid / use only if source locks you                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **host** (person running the live session)         | _instructor_, _lecturer_, _teacher_ in generic session UI — those imply a classroom and confuse corporate or informal use                         |
| **session**, **live session**                      | _event_ when we mean the same flow as “Veranstaltung” in product copy (SEO/join/help/errors)                                                      |
| **Start session** (button/help that quotes the UI) | _Start event_ if the German UI still says “Veranstaltung starten” — English UI and help should **quote the same English label**                   |
| **participants** / **audience**                    | stiff _learners_ unless the sentence is clearly didactic                                                                                          |
| **leaderboard** (feature/options)                  | _rankings_ as a noun for that feature                                                                                                             |
| **Reveal answers** / **Show results**              | _Release answers_ / _Show result_ — must match **actual button labels** in `messages.en.xlf`                                                      |
| **Privacy policy** (page title, SEO, navigation)   | _Data protection_ as a standalone consumer-facing title (UK/legal tone); body text can still mention GDPR/data handling                           |
| **quiz, Q&A, and live polls** (home hero tagline)  | _quiz, Q&A and Blitzlicht_ in source — marketing line favors **live polls** (US SaaS idiom); elsewhere keep **Pulse Check** for the named feature |
| **6-character** (session code)                     | _6-digit_ when the code is alphanumeric                                                                                                           |
| **Business** (session preset; DE: Seriös)          | _Professional_ / _Serious_ as the toggle label — **Business** reads better for corporate US than “professional” alone                             |
| **Gamification** (session preset; DE: Spielerisch) | _Gamified_ as an adjective label — prefer the **category noun** **Gamification** on toggles and in help                                           |
| **Pulse Check** (feature; tabs, errors, help)      | _Blitzlicht_ — standard US term for a quick mood/status poll; avoid leaving _Blitzlicht_ in English targets                                       |
| **poll** (verb/noun in UX)                         | _pulse_ as a verb (_to pulse_ the room) — use **poll** / **live polls** instead                                                                   |

**Note:** German source strings still say **Blitzlicht** / **Seriös** / **Spielerisch**; English **`messages.en.xlf` targets** use **Pulse Check**, **Business**, and **Gamification** as above.

---

## 2. Tone and register

- **Short and direct:** Especially buttons, errors, snackbars, and participant one-liners. Prefer **one clear idea per sentence**.
- **Contractions in UI:** **Do** use _couldn’t_, _won’t_, _you’re_, _it’s_ where it fits the voice — errors sound less stiff than _could not_ / _will not_.
- **Errors:** Pattern **“Couldn’t &lt;verb&gt; …”** or **“Couldn’t &lt;verb&gt; the &lt;noun&gt;. Try again.”** instead of passive _X could not be loaded_.
- **Encouragement (gamification style):** Idiomatic and upbeat; avoid literal renderings of German idioms if English has a natural equivalent (_So close—next round!_ vs _Just missed it - next round_).
- **Business style:** Still friendly, but slightly more neutral; no slang that ages quickly.

---

## 3. Punctuation and typography

- **Sentence breaks:** Prefer the **em dash (—)** without spaces for sharp breaks in short UI copy (_Stay on this page—we’ll update for you_). Avoid **space-hyphen-space** (`-`) as a sentence dash; hyphens stay for **compound modifiers** (_high-energy_, _on-the-fly_).
- **En dash (–):** Acceptable where the German source uses it for **paired labels** (_Lobby – participants can join_); keep **consistent** within the same UI surface.
- **Apostrophes in XLF:** Use **`&apos;`** in `<target>` where escaping keeps the file uniform (_Time&apos;s up_, _You&apos;re in_).
- **Quotation marks in help text:** Curly/smart quotes in English are fine if the XLF remains **well-formed**; match **Angular/Material button labels** exactly when quoting controls.

---

## 4. Grammar and micro-style

- **Oxford comma** in lists of three or more (_quiz, Q&A, and Pulse Check_).
- **Agreement:** When separate `trans-units` exist for _one_ vs _many_ (ICU split), keep **has/have** correct (_1 of 10 has voted_ vs _3 of 10 have voted_).
- **Avoid calques** from German: _operation takes place_, _widespread offers_, _traceable instead of closed platform_ → rewrite as natural English (_runs on_, _mainstream tools_, _transparent, not a walled garden_).
- **CTAs:** Imperative or _you_-focused (_Share the preview link…_, _Tap “Next question” to begin_).

---

## 5. SEO and meta descriptions

- **Titles:** _Privacy policy – arsnova.eu_ (not _Data protection_) for parity with user expectations and `descPrivacy`.
- **Descriptions:** Benefit-led, scannable; **em dash** or tight clauses; avoid bureaucratic phrasing (_how we handle personal data_ beats _processing of personal data_ when space allows).
- **Home (`@@seo.titleHome` / `@@seo.descHome`), aligned with `apps/landing/src/config/seo.ts`:** EN title _arsnova.eu | The European Alternative to Mentimeter & Kahoot_; EN description _Interactive sessions, quizzes & live feedback – Made in Europe. The privacy-first ARS since 2012 for schools, universities, and business. Discover more!_ — FR/ES/IT targets live in the respective XLF files.

---

## 6. XLF / i18n mechanics (do not break the build)

- Edit **`<target>`** only unless the German source changes; preserve **`<x id=…/>`**, **ICU** (`plural`, `select`, `other`), and **placeholders**.
- Never translate **ICU keywords** — see **`docs/I18N-ANGULAR.md` § 3.3.1**.
- After bulk edits: **`xmllint --noout apps/frontend/src/locale/messages.en.xlf`** and **`npm run build -w @arsnova/frontend`** (or localised build if you changed structure).

---

## 7. Relation to other languages

- **German** remains the **i18n source** in code; English rules apply to **`en`** targets only.
- Other locales (**fr**, **es**, **it**) should follow the **same product terminology** where those languages have a natural equivalent (_host_, _session_, equivalent of **Pulse Check**).
- Any change that **relabels German UI** (e.g. button text) requires **all five locales** per ADR-0008 — not only English.

---

## 8. Quick checklist (before merging EN copy)

- [ ] Host/session wording; no stray _instructor/lecturer_ unless legally or contextually required
- [ ] Button quotes match **actual** EN labels
- [ ] Preset toggles use **Business** and **Gamification**; feature **Blitzlicht** is **Pulse Check** in EN targets
- [ ] Oxford comma in triple lists; **Q&A** spelling consistent
- [ ] No `-` as em dash; **`&apos;`** where we standardize apostrophes
- [ ] Errors short, with contractions where appropriate
- [ ] XML/ICU valid; frontend build passes

---

_Stand: derived from the EN copy pass on `messages.en.xlf` (2025–2026); update this doc when product terms or button labels change._
