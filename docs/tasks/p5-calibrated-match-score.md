# P-5 rework: Match Score calibrated to the role questions

Status: design approved by Olga (2026-11-22). Replaces the screening part of
[p5-role-questions-and-cheat-sheet.md](p5-role-questions-and-cheat-sheet.md).

## Intent and why

The problem: the recruiter invites people the manager then rejects (managers continued with only
30–40% of recruiter invitations). Olga's review of the first P-5 build found that:

- it is too large to be a reasonable experiment,
- the candidate list still shows only Match Score,
- the manual "Widać / Nie widać" marks add work the AI should do,
- those marks partly duplicate Match Score.

New direction: one number. Match Score is calibrated to the role answers (question 5 criteria)
instead of a generic comparison with the ad, and it always shows its evidence, so the recruiter
can check whether she agrees with the AI.

## Assumption changed on purpose

The first P-5 design excluded "AI marks each criterion" because the recruiter would trust a number
instead of reading. Olga changed this assumption deliberately (2026-11-22): the score may judge
for the recruiter, as long as every judgement shows its evidence.

## Approaches considered

- **A. Evidence quotes beside the existing score.** Smallest, but the recruiter still guesses
  what the manager wants.
- **B. Manager calibrates on three applications.** Real manager judgement, but needs the manager
  and adds waiting time.
- **C. Second score computed on the candidate's own draft.** Grounded in the data, but a second
  number adds noise.
- **Chosen: one Match Score computed against the role criteria, with evidence.** Olga's proposal.
  It replaces the generic score where criteria exist instead of adding a second one.

## Design

- **Criteria:** question 5 cut into at most four criteria (existing `deriveCriteria`).
- **Assessment (simulated AI):** for each criterion, a short quote from the application answer or
  CV that shows it, or nothing.
  - Prepared applications carry curated evidence that matches the manager verdicts in the answer
    key, tied to the question 5 text it was written for.
  - Any other application, or after question 5 changes, uses a deterministic keyword rule. It is
    labelled as a simulation in FEATURES.md. There is no real model.
- **Score:** 1 point per criterion shown, ½ per criterion partly shown (curated, with what is missing), divided by the number of criteria (2026-11-22 change; was full or none). The number and the evidence
  can never disagree.
- **Candidate list (employer):** the score plus one line of criteria, each marked shown or not.
- **Application detail (employer):** "Dlaczego taki wynik" panel with each criterion, its quote and
  where it came from (answer or CV). Quotes from the answer are highlighted in the answer text.
- **Roles without question 5:** the existing score, labelled "ogólne dopasowanie do ogłoszenia",
  with no criteria line.
- **Recruiter does not correct the AI.** No "disagree" control. She decides through the existing
  stage buttons.
- **Candidate view:** unchanged. The candidate keeps seeing the stored score and never sees the
  criteria or evidence. (Builder call: the criteria are internal to the employer.)

## Removed from the first P-5 build

- the "Na co patrzeć" cheat sheet with manual "Widać / Nie widać" marks,
- the three screening decisions ("Zaprosić na rozmowę", "Nie umiem ocenić", "Odrzucić") and their
  actions; the existing stage buttons are used on every job.

## Kept from the first P-5 build

- the five questions in the job editor, the optional manager link and manager page,
- drafts and the description generated from answers 1–4,
- the prepared role A and role B scenario (16 applications).

## Non-goals

- A real AI model, a second score, a "disagree" control, any change to the candidate view.

## Verification

Update unit and e2e tests and FEATURES.md, run `./scripts/verify`, then check the list and detail
in the browser at desktop and mobile widths.

## Implementation plan

1. **Assessment logic** in new `src/features/prototype/score-evidence.ts`, tested in
   `score-evidence.test.ts`:
   - `assessApplication(application, brief)` returns `{ kind: "role", score, criteria: Evidence[] }`
     or `{ kind: "generic", score }`. `Evidence = { id, text, source, quote: string | null, from: "answer" | "cv" | null }`.
   - Curated `application.evidence = { basis, quotes }` is used only when `basis` equals the current
     question 5 text. Otherwise `simulateQuote(criterion, answer, cv)` picks the sentence sharing at
     least two keyword stems (5-letter prefixes of words of 5+ letters, minus stop words).
   - Score = round(100 × criteria with a quote / criteria).
2. **Model and fixtures:** add optional `evidence` to the application schema; remove `screening`,
   the `screening_mark` and `screening_decision` actions, `screeningMarks` and `hasCheatSheet`.
   Add curated quotes to the 15 prepared applications and to Marek's example, matching the answer
   key (role A: invites 100/100/75/75, rejects 50/25/0/0; role B: invites 100 ×4, rejects 33/33/0/0).
3. **UI:** employer list shows the assessed score and a criteria line; the employer detail shows the
   "Dlaczego taki wynik" panel in place of the cheat sheet, highlights answer quotes, and uses the
   existing stage buttons. Delete `cheat-sheet.tsx` and its CSS. Candidate views unchanged.
4. **Tests and docs:** replace cheat-sheet and screening-decision tests; update FEATURES.md
   (EMP-08, EMP-09, EMP-12, OPS-06, OPS-07, CAN-14 checked).
5. **Verify:** `./scripts/verify`, then desktop and 375 px checks in the browser.
