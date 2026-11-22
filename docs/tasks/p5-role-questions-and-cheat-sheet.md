# P-5: five role questions and a screening cheat sheet

Status: design approved by Olga (2026-11-15). The screening part (cheat sheet, manual marks, three decisions) was replaced on 2026-11-22 by [p5-calibrated-match-score.md](p5-calibrated-match-score.md).

## Intent and why

Course discovery (fictional AIPH3 case) chose the employer need "candidates should know from the start what the job is and apply with the right example" (opportunity SZ-2) and the solution P-5:

- The person who knows the job (the hiring manager) answers five questions about the role.
- The answers become concrete sections of the job ad and a short cheat sheet ("Na co patrzeć") the recruiter uses when screening applications.

Signals behind it (course data, observations, not causes):

- Ads with concrete details (first project, scope, decision mandate, team, salary) had 46–61% continuation after the first conversation vs 12–22% without them (XI 2025–VI 2026).
- Only about half of the ads have these details, and the writing assistant does not add them.
- The recruiter screens every application, but the manager runs the first conversation. Managers continued with only 30–40% of the candidates recruiters invited.

**Who the prototype is for:** the recruiter (persona Karolina Wiśniewska, BrightLabs).

**Task in the scenario:** screen the applications for one role and decide for each one whether to invite the candidate to a conversation or reject them.

**What counts as "the prototype works":** the whole path runs end to end:

1. Recruiter answers what she knows.
2. She sends the questions to the manager.
3. The manager confirms or changes her answers and fills in the gaps.
4. The ad gets the concrete sections.
5. A candidate applies.
6. The recruiter screens applications with the cheat sheet next to each one and records a decision that the candidate then sees as a stage.

## Decisions already made by the product owner (Olga)

- Use the project's Poster People design system. The earlier "Niebo" direction was practice only.
- The recruiter answers the five questions herself first. Sending them to the manager is optional.
- The recruiter sends the manager all five questions at once, in one link. Her answers come prefilled for the manager to confirm ("Zgadza się") or change ("Zmień"). Empty questions are for the manager to fill.
- The manager form goes question by question, with progress (decision of 2026-11-06, carried over from the practice design).
- In the public ad, the concrete details are ordinary sections. There is no "from the manager" badge; candidates care about the whole offer.
- The cheat sheet is layout **A**: a checklist panel next to the application.
- Validation is planned on paper only. No real user test will run, so the prototype does not need experiment machinery.

## Approaches considered

**Cheat sheet layout:**

- **A. Checklist beside the application (chosen).**
  - Criteria sit next to every decision, and the recruiter can mark each one "Widać" or "Nie widać".
  - It extends the existing employer application detail (EMP-08).
  - Its marks record what the recruiter saw, which a later validation would need.
  - Cost: more clicks, and the manager's free text must be cut into criteria (simulated).
- **B. Cheat sheet above a triage list of all applications.** Fast comparison, but little room for the CV and full answer. It is also a new list screen, so more build.
- **C. Briefing first, then a collapsed reminder.** Read once, with the fewest changes, but the criteria fade by the sixth application.
- **Excluded: AI marks each criterion automatically.** It would act as a second Match Score. Discovery showed the recruiter would trust the number instead of reading.

**Manager request:**

- One message per question: rejected, too many messages.
- Only the unanswered questions: shortest for the manager, but the recruiter's guesses go unchecked.
- **All five, with the recruiter's answers to confirm (chosen).** This catches recruiter guesses, especially on question 5. "Zgadza się / Zmień" is the same mechanism P-5 planned for hints from a company's previous ad, so it can be reused later.

**Platform:** build inside this app with its design system (a course requirement), not as a standalone mock.

## Goals

1. The job editor asks five questions instead of the single "Brief" field. Each answer stores who gave it.
2. The recruiter can generate one manager link containing all five questions. The offer shows its status in the editor and in "Moje oferty".
3. A public manager page (no persona needed) goes question by question:
   - prefilled answers can be confirmed or changed,
   - empty ones can be answered,
   - any question can be skipped with an optional reason,
   - the manager submits once at the end.
4. "Przygotuj opis z AI" (a template, as today) turns answers 1–4 into description sections. The recruiter still edits and explicitly approves before publishing. If the manager answers after publication, the recruiter is told the description can be updated.
5. On the employer application detail, a cheat sheet panel shows:
   - the criteria from question 5, each with its source and "Widać / Nie widać" marks,
   - the first project and scope as context.
     At the screening stage, three decisions are offered: "Zaprosić na rozmowę", "Nie umiem ocenić", "Odrzucić".
6. Prepared data lets the screening task run immediately after reset:
   - **Role A (priority 1):** the existing "AI Product Manager" at BrightLabs. Mixed answer sources (manager, recruiter confirmed by the manager, one skip with a reason) and 8 applications, including Marek's existing one.
   - **Role B (priority 2):** the existing "AI Operations Specialist" (Apply) at BrightLabs, answered by the recruiter alone, also with 8 applications. It shows the case where no manager was asked. (Planning call: reusing an existing job instead of a new Build job keeps the public job count and its tests unchanged while still covering a different category.)
7. Existing journeys keep working:
   - publishing an offer without answers,
   - candidate apply,
   - stage decisions on jobs without a cheat sheet,
   - withdrawal, import/export/reset, hash deep links.

## Non-goals

- Real email or notifications. The link is copied by hand.
- A real AI model. All "AI" is deterministic templates.
- A purchase or payment step.
- Prefilling answers from the company's previous offer (the repeat-purchase hints in P-5). Deferred; mention it in the course post as the next step.
- A cheat-sheet on/off switch, an agreement score or any in-app experiment measurement.
- Any change to Match Score. It stays as it is. In a real validation it would be a confounder, and the post should say so.

## Anti-goals (would make this a failure even if it works)

- The cheat sheet judges applications for the recruiter instead of helping her read them.
- The manager step blocks publication. The recruiter can always publish without the manager.
- Candidates can see the cheat sheet, the marks, the skip reasons or the manager page content beyond the ad itself.
- Prepared applications written so the "right" answers are obvious. Each role needs hard cases, for example:
  - polished, broad text that is out of scope,
  - a strong project without numbers,
  - numbers that describe the team's work, not the candidate's own decisions.

## Constraints

- Follow AGENTS.md, GUI.md and docs/design-system (README, IMPLEMENTATION, VERIFICATION). Use existing Base UI primitives and host tokens. Do not create a parallel component family.
- The kit has no stepper. Compose the manager progress from existing primitives within Poster People roles: ink, paper, white, pink only for the primary action.
- End-user text is Polish, and code and docs are English.
- Data stays local, synthetic and in version-1 state. New fields are optional, so old saves and imports stay valid. Reset loads the new fixtures.
- The manager route is outside role gating and works with any active persona or none. The token is a local simulation, not security.
- Prepared candidates must not clutter the person picker. Anna and Marek stay the selectable candidates.
- Update FEATURES.md (EMP-03, EMP-05, EMP-06, EMP-08, EMP-09, OPS-06 and a new entry for the manager route) and existing e2e tests that use the old "Brief" label.
- Record actual verification here. Run ./scripts/verify and report real results.

## The five questions (Polish UI text, from experiment E-5)

1. Nad czym ta osoba będzie pracować na początku? Opisz jeden konkretny projekt.
2. Za co będzie odpowiadać sama, a w czym będzie pomagać innym?
3. Jakie decyzje będzie mogła podjąć bez pytania managera?
4. Z kim będzie pracować na co dzień?
5. Po czym poznasz w zgłoszeniu dobrego kandydata? Co powinien opisać, żebyś chciał z nim porozmawiać?

**Skip reasons:** „Nie wiem”, „Rola jeszcze nieustalona”, „Nie mogę ujawnić”.

**Answer sources shown to the recruiter:** „Od managera”, „Twoja odpowiedź, potwierdzona przez managera”, „Twoja odpowiedź”.

## Decisions mapped to existing stages

- **„Zaprosić na rozmowę”:** submitted → reviewed → interview_invited. Two history events, both valid transitions.
- **„Nie umiem ocenić”:** submitted → reviewed, with that note. The existing buttons then continue the process.
- **„Odrzucić”:** submitted → rejected.
- The three decisions appear only at the submitted stage on jobs that have a cheat sheet. All other cases keep today's stage buttons.

## Validation on paper (not built, for the course post and Olga's own plan)

1. **Do managers answer?**
   - Who: real managers, answering about a role they actually have.
   - What we look at: answered or not, time taken, which questions they skip and why, and how many prefilled answers they change versus confirm.
   - Limit: the test prompts them, so it cannot show whether they would answer an unprompted email.
2. **Does the cheat sheet help the recruiter?**
   - Set-up: two roles with 8 applications each. Each recruiter screens one role without the cheat sheet, then the other with it. Which role gets the cheat sheet is swapped between participants.
   - What we look at: how many of the recruiter's invitations the manager would also make, and how many "Nie umiem ocenić" decisions there are.
   - Limits: the order effect remains, and 5–8 people give a hint, not proof.
3. **Do repeat purchases rise?** An A/B test in the live portal (experiment E-2), out of scope here.

The prototype already stores what this would need: the source of each answer, skip reasons, sent and answered timestamps, criterion marks and decisions.

## Prepared screening scenario and answer key

The intended verdict of the hiring manager for each prepared application. It lives only here, never in app state or exports. Scores and summaries are fixed scenario values that ignore this key. Several deliberately contradict it.

**Role A: AI Product Manager.** Manager criteria (q5): one project with the candidate's own decision about what not to do, a result in numbers against a baseline, own decisions separated from the team's work, and a process where errors cost money.

| Application                         | Score | Verdict | Why                                                                                                                    |
| ----------------------------------- | ----: | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| Marek Nowak (`application-example`) |    72 | Reject  | Has a number (25%), but no visible own decision or scope trade-off, and no costly-error process                        |
| Ewa Sadowska (`s01`)                |    74 | Invite  | Clear fit: chose not to automate exceptions, 6 → 2 days, own vs team split                                             |
| Piotr Lis (`s02`)                   |    91 | Reject  | Polished and broad, no single project, nothing of his own (high score contradicts)                                     |
| Katarzyna Wróbel (`s03`)            |    63 | Invite  | Strong decision (dropped the chatbot), own vs team split, no numbers yet: worth a conversation (low score contradicts) |
| Rafał Bielecki (`s04`)              |    86 | Reject  | Numbers describe the team's work; his own role is unclear (high score contradicts)                                     |
| Agnieszka Mazur (`s05`)             |    79 | Invite  | Clear fit: rules before model, 7% → 2%, financial reconciliation                                                       |
| Michał Krawczyk (`s06`)             |    58 | Reject  | Clear misfit: wants model work, not product work                                                                       |
| Natalia Pawlak (`s07`)              |    68 | Invite  | Meets three of four criteria; no finance domain, but she named it herself                                              |

**Role B: AI Operations Specialist (the recruiter answered alone).** Recruiter criteria (q5): an automation the candidate built that runs for users, n8n or Make or similar, and how errors and exceptions were handled.

| Application                | Score | Verdict | Why                                                                                 |
| -------------------------- | ----: | ------- | ----------------------------------------------------------------------------------- |
| Julia Kamińska (`s08`)     |    77 | Invite  | Clear fit: n8n, manual exception queue, trained 12 people                           |
| Bartosz Zając (`s09`)      |    92 | Reject  | Polished and broad, no concrete automation (high score contradicts)                 |
| Weronika Szymańska (`s10`) |    61 | Invite  | Strong concrete Make scenario with exceptions, no numbers (low score contradicts)   |
| Kamil Dąbrowski (`s11`)    |    84 | Reject  | Team numbers; coordinated reporting, built nothing himself (high score contradicts) |
| Monika Lewandowska (`s12`) |    73 | Invite  | Clear fit: Zapier plus API, error path, 15 → 4 min                                  |
| Paweł Wójcik (`s13`)       |    66 | Reject  | Clear misfit: wants remote architecture work                                        |
| Zuzanna Kaczmarek (`s14`)  |    70 | Reject  | Introduced ChatGPT in the team but built no automation                              |
| Adam Nowicki (`s15`)       |    71 | Invite  | Built a Make approval flow alone, with error handling and 900 invoices a month      |

## Builder check: answers and calls

1. **Drafts before the manager link.** Answered by the P-5 decision of 2026-11-04: the recruiter can publish right away and update later, _or wait_. Waiting needs drafts.
   - Add "Zapisz szkic". Drafts need only a title of 3 or more characters and are kept out of the public listing, map and company page. The full jobSchema checks apply on publish.
   - The manager link can be generated from a draft or a published offer.
   - The main demo path is: answers → link → manager → generate → publish. The publish-first path shows "Manager odpowiedział: możesz zaktualizować opis".
2. **Where the manager link opens (call: same browser, same tab).**
   - The editor has "Skopiuj link" and "Otwórz stronę managera". The second one navigates in the same tab.
   - After submitting, the manager page links back to the recruiter's offers.
   - Polish helper text says the prototype keeps data in this browser only.
   - No cross-tab sync, so SYS-10 is unchanged. This is listed as a simulation in FEATURES.md.
3. **Answer key and prepared scores (call).**
   - The intended manager verdict per prepared application lives only in this task doc, never in app state or exports.
   - Fixed Match Scores and summaries ignore the key. Some deliberately contradict it, for example a polished, broad answer with a high score. This matches the discovery observation that Match Score stopped pointing to candidates managers continue with.
   - Role B's purpose: see "Open question for Olga" below.
4. **CVs of prepared candidates (call).** Text-only CVs using the existing saved-text fallback; no new PDFs. Marek keeps his PDF. The difference is visible and accepted.

## Role B criteria (Olga, 2026-11-15)

Realistic. The recruiter's own question 5 criteria for Role B are written as a competent recruiter would write them, not deliberately weakened. Role B shows that the flow works without a manager. It does not show that it works worse. Only a real validation could show that.

## Left to the builder

- The exact data shape and where criteria are derived (when the manager submits or when the description is generated). The cutting rule is deterministic: question 5 split into sentences, at most four criteria.
- Component structure, routing details, the token format and how prepared candidates are hidden from the picker.
- The wording of status messages, empty states and the thank-you screen, consistent with existing Polish UI copy.
- The exact desktop and mobile placement of the cheat sheet panel. On mobile it sits before the decisions.

## Implementation and verification (2026-11-15)

- Added `role-brief.ts`, which holds the questions, sources, skip reasons, schema, criteria derivation and the description template.
- In `model.ts`, all new fields are optional and the state stays version 1:
  - job `roleBrief`, application `screening`, person `hidden`;
  - draft-aware job validation;
  - actions `request_manager`, `manager_answer`, `screening_mark` and `screening_decision`.
- Added `screening-scenario.json` (role A and role B briefs, 15 hidden candidates, 15 applications). The answer key is in this document only.
- UI:
  - the job editor has five questions with sources, drafts, the manager request and status chips in "Moje oferty";
  - the public manager page lives at `/#/pytania/:token`;
  - the "Na co patrzeć" cheat sheet and the three screening decisions sit on the employer application record.
- Updated FEATURES.md: EMP-03, EMP-05, EMP-06, EMP-08, EMP-09 and OPS-06 changed; EMP-11 and EMP-12 added; the implementation limit for the manager link noted.

**Checks that ran:**

| Check                                                                     | Result    |
| ------------------------------------------------------------------------- | --------- |
| Formatting (`prettier --check`) over all tracked and untracked repo files | Passed    |
| Design-system kit check (Node 24.18.0)                                    | Passed    |
| Lint                                                                      | Passed    |
| Types                                                                     | Passed    |
| Unit tests                                                                | 43 passed |
| Packet verification                                                       | Passed    |
| Production build                                                          | Passed    |
| Playwright journeys (Chromium)                                            | 45 passed |

The Playwright journeys include:

- the new full P-5 journey,
- the manager page at 375 px with keyboard use,
- the cheat sheet ordering on a phone,
- legacy brief compatibility,
- axe WCAG 2 A/AA on the editor, the role B editor, the role A application and the manager page.

**Known gaps in what ran:**

- `./scripts/verify` was not run as one command. The provisioned Playwright browser is `chromium_headless_shell-1228`, while `@playwright/test` expects build 1243, so e2e ran through a local, git-ignored config pointing at the 1228 build. Run `npx playwright install chromium`, then `./scripts/verify`, to confirm with the expected browser.
- The default shell Node here is v26; checks ran with Node 24.

**Screenshots inspected** (`artifacts/p5-0{1..5}-*.png`, 1440 and 375 px):

- ink contours, white and paper surfaces, pink only on the primary action, Geist Serif headings, no horizontal scroll;
- at 1440 px the history column sat too narrow next to the cheat sheet, so the three-column layout now starts above 1600 px.

## Final review and fixes (2026-11-15)

A fresh reviewer read the whole diff. It found nothing critical.

**Fixed, each with a test that failed first:**

- Old saves with 1–2 character published titles load again. The 3-character minimum now applies only to drafts.
- A pre-P-5 brief is kept in `roleBrief.legacyBrief` and stays visible after the questions are used.
- Criterion marks are tied to the question 5 text they were made against (`screening.basis`).
- "Manager odpowiedział: możesz zaktualizować opis" clears once the job is republished (`roleBrief.appliedAt`; role A is seeded as up to date).
- Re-confirming the manager's own earlier answer keeps "Od managera".
- On the manager page:
  - prefilled questions can be skipped (spec Goal 3);
  - an unchanged "Zmień" counts as confirming;
  - the submit button is neutral ("Wyślij odpowiedzi");
  - focus moves to the thank-you status;
  - "Zmień" focuses its textarea;
  - hints are linked with `aria-describedby`.
- Criteria are no longer cut after common Polish abbreviations.

**Deferred minors:**

- re-sending silently replaces a pending link;
- the short-title error appears far from the button;
- cheat-sheet tab order versus its visual order;
- the draft notice reappears after a reload;
- copy fails silently on non-secure origins;
- raw hex colours instead of tokens;
- a shadowed `location` variable.

**After the fixes:**

| Check                                                                    | Result    |
| ------------------------------------------------------------------------ | --------- |
| Unit tests                                                               | 51 passed |
| Playwright journeys (Chromium 1228 override)                             | 48 passed |
| Lint, types, formatting, design-system check, packet verification, build | Passed    |

## Full gate (2026-11-16)

Olga installed the expected browser (`npx playwright install chromium`, build 1243). After that, `./scripts/verify` passed in a single run with Node 24.18.0: formatting, design-system kit check, lint, types, 51 unit tests, packet verification, build and 48 Chromium journeys. The earlier local browser override is no longer needed.

## UX iteration: question block (2026-11-16)

Olga's review in the browser found four problems:

- all five open textareas pushed "Wyślij pytania managerowi" out of sight;
- the button had no context;
- only some questions had a helper line;
- nobody reads the intro caption.

**Chosen layout: variant A**, with one change Olga asked for: the manager panel's copy is fixed. It does not count missing answers while the recruiter types.

**What changed:**

- **Manager panel** above the list: "Nie wszystko wiesz o tej roli?" with one sentence and the button. After sending it becomes "Czeka na managera" with the copy and open links; after the answers arrive it becomes "Manager odpowiedział" with "Wyślij pytania ponownie".
- **Question list** opens one question at a time. Each row shows a status ("Brak odpowiedzi", "Twoja odpowiedź", "Potwierdzona przez managera", "Od managera"), a one-line preview and a tag ("w ogłoszeniu" / "tylko na Twojej ściądze").
- **Every question** has a one-line example, which the manager page also shows.
- **Answered count** sits next to the heading ("N z 5 uzupełnione").
- **Removed:** the intro caption and the separate "sent" notice.

**Checks:** `./scripts/verify` passed with Node 24.22.3 (51 unit tests, 49 Chromium journeys, including the new "question list shows status, one example per question and a steady manager panel").
