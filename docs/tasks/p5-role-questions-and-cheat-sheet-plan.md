# P-5 Role Questions and Cheat Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a recruiter answer five role questions, optionally send all five to a manager in one link, turn the answers into ad sections, and screen applications with a checklist cheat sheet and three decisions.

**Architecture:** A pure domain module (`role-brief.ts`) holds the questions, schemas, criteria derivation and the description template. `model.ts` gains optional fields and five actions, so version-1 saves stay valid. The UI reuses the job editor, adds one public manager route and extends the employer application record with a cheat-sheet panel in its existing side column. Prepared roles live in a separate JSON fixture merged by `initialState()`.

**Tech Stack:** React 19, TypeScript, Vite, React Router (hash), Zod 4, Base UI primitives in `src/components/ui`, Vitest, Playwright (Chromium is provisioned).

**Spec:** `docs/tasks/p5-role-questions-and-cheat-sheet.md` (approved by Olga, 2026-11-15)

## Global Constraints

- Node 24 + npm only. No new dependencies.
- End-user copy is Polish; code, comments and docs are English.
- New and changed UI follows Poster People via `docs/design-system/README.md`, `IMPLEMENTATION.md` and `VERIFICATION.md`. Use existing Base UI primitives (`Button`, `Textarea`, `Input`, `Checkbox`) and host tokens. Do not create a parallel component family or edit `docs/design-system/agent-kit`.
- State stays `version: 1`. Every new field is optional, so existing saves and imports stay valid.
- No network calls, email or real AI. "AI" is a deterministic template.
- The manager route is not role-gated. The token is a local simulation, not security.
- Cheat sheet, criterion marks, skip reasons and screening notes are never rendered to candidates.
- Do not commit. Olga has not asked for commits. Work on branch `p5-role-questions` and leave the changes uncommitted for her review.
- Update FEATURES.md in the same change and record actual verification in the spec's task doc. `./scripts/verify` must pass before claiming completion.

## Review Focus

1. **An old save or import without `roleBrief`, `screening` or `hidden` loads unchanged.** Owned by Task 1: `parses a version-1 state saved before P-5`.
2. **Sending to the manager again after the manager has answered.** It creates a new token, clears `answeredAt` and keeps the current answers as prefill. Owned by Task 1: `request_manager twice keeps answers and resets answeredAt`.
3. **Editing an offer that has a legacy `sourceBrief` and no `roleBrief`.** The five questions start empty, the old brief stays visible read-only and is preserved on publish. Owned by Task 3: `legacy brief stays visible and preserved`.
4. **A manager link that is unknown or already answered.** Unknown shows the not-found page. Answered shows "Odpowiedzi zostały już wysłane." with no form. Owned by Task 4: `manager page rejects unknown and answered tokens`.
5. **A job whose question 5 was skipped.** The cheat sheet shows context, says "Kryteria nie zostały podane." and still offers the three decisions. Owned by Task 5: `cheat sheet without criteria still offers decisions`.

---

## File Structure

| File                                                                      | Responsibility                                                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/features/prototype/role-brief.ts` (create)                           | Questions, skip reasons, source labels, `roleBriefSchema`, `deriveCriteria`, `descriptionFromBrief`, `hasCheatSheet`        |
| `src/features/prototype/role-brief.test.ts` (create)                      | Unit tests for the module                                                                                                   |
| `src/features/prototype/model.ts` (modify)                                | Optional fields on job, application and person; draft-aware job validation; five actions; fixture merge in `initialState()` |
| `src/features/prototype/model.test.ts` (modify)                           | Action and compatibility tests                                                                                              |
| `src/features/prototype/data/screening-scenario.json` (create)            | 15 hidden candidates, 15 applications, role briefs for roles A and B                                                        |
| `src/features/prototype/role-questions-editor.tsx` (create)               | The five-question block with sources, manager status and link actions                                                       |
| `src/features/prototype/employer.tsx` (modify)                            | Editor uses the block, adds draft save and manager request, and shows status chips in "Moje oferty"                         |
| `src/features/prototype/manager-questions.tsx` (create)                   | Public question-by-question manager page                                                                                    |
| `src/features/prototype/cheat-sheet.tsx` (create)                         | Cheat-sheet panel with criterion marks                                                                                      |
| `src/features/prototype/recruiting-application.tsx` (modify)              | Shows the panel and screening decisions                                                                                     |
| `src/features/prototype/application-record.tsx` (modify)                  | New optional `margin` prop rendered at the top of the side column                                                           |
| `src/features/prototype/workspace.tsx` (modify)                           | `PersonPicker` hides `hidden` people                                                                                        |
| `src/features/prototype/app.tsx` (modify)                                 | Route `pytania/:token`                                                                                                      |
| `src/app/records.css`, `src/app/workspace.css` (modify)                   | Styles for the panel, toggles, question list and progress, from host tokens                                                 |
| `tests/e2e/prototype.spec.ts` (modify)                                    | Old journey updated; new P-5 journeys                                                                                       |
| `FEATURES.md`, `docs/tasks/p5-role-questions-and-cheat-sheet.md` (modify) | Behavior register and verification record                                                                                   |

---

### Task 1: Domain module and model actions

**Files:**

- Create: `src/features/prototype/role-brief.ts`, `src/features/prototype/role-brief.test.ts`
- Modify: `src/features/prototype/model.ts` (schemas around lines 28–135; `Action` type; `transition()`)
- Test: `src/features/prototype/model.test.ts`

**Interfaces:**

- Produces, from `role-brief.ts`:
  - `type QuestionId = "q1" | "q2" | "q3" | "q4" | "q5"`
  - `ROLE_QUESTIONS: readonly { id: QuestionId; label: string; hint: string }[]`: the five questions from the spec. `label` is the first sentence; `hint` is the second sentence of q1 and q5, empty for the others.
  - `type AnswerSource = "none" | "recruiter" | "recruiter_confirmed" | "manager"`
  - `SOURCE_LABELS: Record<Exclude<AnswerSource,"none">, string>` = `{ recruiter: "Twoja odpowiedź", recruiter_confirmed: "Twoja odpowiedź, potwierdzona przez managera", manager: "Od managera" }`
  - `type SkipReason = "dont_know" | "role_undecided" | "confidential"`
  - `SKIP_REASON_LABELS` = `{ dont_know: "Nie wiem", role_undecided: "Rola jeszcze nieustalona", confidential: "Nie mogę ujawnić" }`
  - `roleBriefSchema`, the zod object:
    - `answers`: an array of exactly 5 items, ordered q1–q5, each `{ questionId, text: string max 2000, source: AnswerSource, skipReason?: SkipReason }`
    - `managerRequest?`: `{ token: id, sentAt: iso datetime, requestedBy: shortText, answeredAt?: iso datetime }`
  - `type RoleBrief = z.infer<typeof roleBriefSchema>`
  - `emptyRoleBrief(): RoleBrief`
  - `type Criterion = { id: string; text: string; source: AnswerSource }`
  - `deriveCriteria(brief: RoleBrief): Criterion[]`
  - `descriptionFromBrief(brief: RoleBrief): string`
  - `hasCheatSheet(brief?: RoleBrief): boolean` (true when any answer text is non-empty)
  - `type RecruiterAnswers = Record<QuestionId, string>`
- Produces, from `model.ts`:
  - `jobSchema` gains `roleBrief: roleBriefSchema.optional()`. Summary and description length checks (≥10, ≥30) apply only when `publicationStatus !== "draft"`. Drafts need only a `title` (shortText, min 3 chars via refine).
  - `applicationSchema` gains `screening?: { marks: Record<string, "seen" | "not_seen"> }`.
  - `personSchema` gains `hidden?: boolean`.
  - New `Action` members:
    - `{ type: "request_manager"; jobId: string; token: string; answers: RecruiterAnswers }`: employer of the job's company only. Writes the recruiter answers, then sets `managerRequest = { token, sentAt: now, requestedBy: person.name }` with no `answeredAt`. Each answer gets source `none` if its text is empty. Otherwise its previous source is kept if the text is unchanged, or set to `recruiter` if the text changed.
    - `{ type: "manager_answer"; token: string; answers: { questionId: QuestionId; outcome: "confirmed" | "answered" | "skipped"; text?: string; skipReason?: SkipReason }[] }`: needs no persona. Fails on an unknown token or when `answeredAt` is already set.
      - `confirmed` requires an existing non-empty text and sets source `recruiter_confirmed`.
      - `answered` requires non-empty text and sets source `manager`.
      - `skipped` is allowed only when the text is empty; it sets source `none` and the optional reason.
      - Finally sets `answeredAt = now`.
    - `{ type: "screening_mark"; applicationId: string; criterionId: string; mark: "seen" | "not_seen" | null }`: employer of the company only. `null` removes the mark.
    - `{ type: "screening_decision"; applicationId: string; decision: "invite" | "unsure" | "reject"; note: string }`: employer of the company only, and the stage must be `submitted`.
      - `invite` pushes `reviewed` (with the note) and then `interview_invited` (empty note).
      - `unsure` pushes `reviewed` with note `"Nie umiem ocenić"`, plus `" — " + note` when the note is non-empty.
      - `reject` pushes `rejected` with the note.
  - The existing `publish` action is unchanged in shape. It upserts drafts as well, because the editor passes `publicationStatus: "draft"`.

- [ ] **Step 1: Write failing unit tests in `role-brief.test.ts`**

```ts
it("derives at most four criteria from q5 sentences with q5's source", () => {
  const b = emptyRoleBrief();
  b.answers[4] = {
    questionId: "q5",
    text: "Opisuje jeden projekt. Podaje wynik w liczbach! Zna procesy? Pisze krótko. Piąte.",
    source: "manager",
  };
  expect(deriveCriteria(b).map((c) => c.text)).toEqual([
    "Opisuje jeden projekt.",
    "Podaje wynik w liczbach!",
    "Zna procesy?",
    "Pisze krótko.",
  ]);
  expect(deriveCriteria(b).every((c) => c.source === "manager")).toBe(true);
});
it("returns no criteria when q5 is empty or skipped", () => {
  /* q5 text "" , source "none", skipReason "dont_know" → [] */
});
it("builds description sections only for answered q1–q4", () => {
  // q1 and q4 answered, q2/q3 empty →
  // contains "### Pierwszy projekt\n<q1>" and "### Zespół i współpraca\n<q4>",
  // does not contain "### Za co odpowiadasz" or "### Decyzje i odpowiedzialność",
  // ends with "### Proces rekrutacji\nPrześlij aplikację i opisz jeden projekt, w którym Twoje decyzje wpłynęły na wynik."
  // never contains q5 text
});
```

- [ ] **Step 2: Run `npx vitest run src/features/prototype/role-brief.test.ts`.** Expected: FAIL (module missing).

- [ ] **Step 3: Implement `role-brief.ts`.**
  - Split criteria with `text.split(/\n+|(?<=[.!?])\s+/)`, trim, drop empty items, take 4. Ids are `c1`–`c4`.
  - Section headings, in order: `Pierwszy projekt` (q1), `Za co odpowiadasz` (q2), `Decyzje i odpowiedzialność` (q3), `Zespół i współpraca` (q4), then the fixed `Proces rekrutacji` section. Sections are separated by a blank line and use the `### ` prefix that `parseJobDescription` reads.

- [ ] **Step 4: Run the same command.** Expected: PASS.

- [ ] **Step 5: Write failing model tests in `model.test.ts`.**
  - `parses a version-1 state saved before P-5`: `stateSchema.parse(JSON.parse(JSON.stringify(stateWithoutNewFields)))`. Build it from `initialState()` by deleting `roleBrief`, `screening` and `hidden` everywhere. Expect no throw.
  - `saves a draft with only a title and publishes only with full content`: a draft with summary `""` and description `""` passes. The same job with `publicationStatus: "published"` throws.
  - `request_manager is employer-only and stores sources`: as the Anna persona it throws `"Wybierz profil pracodawcy."`. As `employer-brightlabs` with `{ q2: "Sama decyduje…", others "" }`: q2 source is `recruiter`, the others are `none`, and `managerRequest.requestedBy` is `"Karolina Wiśniewska"`.
  - `manager_answer works without a persona and maps outcomes`: `select_person null`. Then confirmed q2 → `recruiter_confirmed`; answered q1 → `manager` with the text; skipped q3 with `role_undecided` → `none` and the reason; `answeredAt === time`.
  - `manager_answer rejects unknown token, second submission, confirming empty and skipping filled`: four `toThrow()` checks.
  - `request_manager twice keeps answers and resets answeredAt`: after a manager answer, sending again with a new token keeps the q1 text and source `manager`, and `answeredAt` is undefined.
  - `screening_decision maps to valid stage history`:
    - invite → stages `["submitted","reviewed","interview_invited"]`;
    - unsure with note "x" → stage `reviewed`, last note `"Nie umiem ocenić — x"`;
    - reject → `rejected`;
    - a second decision on a non-`submitted` application throws;
    - another company's employer (`employer-northstar`) throws.
  - `screening_mark sets and clears a mark`.

- [ ] **Step 6: Run `npx vitest run src/features/prototype/model.test.ts`.** Expected: the new tests FAIL.

- [ ] **Step 7: Implement the schema fields and the four new actions in `model.ts`, following the Interfaces above.** Reuse the `employer()` guard and `nextStages` validation. `screening_decision` pushes events through the same `nextStages` check so `stateSchema` history validation still holds.

- [ ] **Step 8: Run `npx vitest run`.** Expected: PASS, with the existing tests unchanged.

### Task 2: Prepared screening scenario

**Files:**

- Create: `src/features/prototype/data/screening-scenario.json`
- Modify: `src/features/prototype/model.ts` (`initialState()`), `src/features/prototype/workspace.tsx` (`PersonPicker`)
- Modify: `docs/tasks/p5-role-questions-and-cheat-sheet.md` (add "Prepared screening scenario and answer key")
- Test: `src/features/prototype/model.test.ts`

**Interfaces:**

- Consumes: `RoleBrief` and `roleBriefSchema` (Task 1).
- Produces: after reset, these exist:
  - job `20000000-0000-4000-8000-000000000001` (AI Product Manager, role A) has a `roleBrief` with `managerRequest.answeredAt` set and mixed sources: q1 and q5 `manager`, q2 and q4 `recruiter_confirmed`, q3 `none` with `confidential`;
  - job `20000000-0000-4000-8000-000000000004` (AI Operations Specialist, role B) has a `roleBrief` with all sources `recruiter` and no `managerRequest`;
  - 7 new applications on role A (plus Marek's `application-example`, 8 in total) and 8 on role B, all at stage `submitted` with fixed timestamps in `2026-11-0x`;
  - 15 people with `role: "candidate", hidden: true` and ids `candidate-s01`…`candidate-s15`.

- [ ] **Step 1: Write failing tests.**
  - `initial state contains both prepared roles`: role A has 8 applications and role B has 8; `hasCheatSheet` is true for both; `deriveCriteria(roleA).length >= 2`.
  - `prepared candidates are hidden and never the active person`: 15 `hidden` people.

- [ ] **Step 2: Run `npx vitest run src/features/prototype/model.test.ts`.** Expected: FAIL.

- [ ] **Step 3: Write the fixture content (Polish).**
  - **Role A answers** must agree with the existing AI Product Manager description: pilot in one financial process, discovery to recommendation, designer, engineers and implementation people. **Role B answers** are written as a competent recruiter would (spec decision: realistic, not weakened).
  - **Each role's 8 applications** must include at least:
    - one polished, broad answer that is out of scope, with a high fixed score;
    - one strong concrete project without numbers;
    - one with numbers that describe the team's work, not the candidate's own decisions;
    - two clear fits;
    - one clear misfit.
  - Fixed scores and summaries ignore the answer key, and at least two contradict it.
  - CVs are short text, at least 20 characters.
  - Write the answer key (the manager's intended verdict per application: invite or reject, one-line reason) only in the spec doc, never in the JSON.

- [ ] **Step 4: Merge the fixture in `initialState()` and filter `!person.hidden` in `PersonPicker`.** Order: base people + scenario people; attach briefs by job id; append scenario applications after Marek's.

- [ ] **Step 5: Run `npx vitest run`.** Expected: PASS.

### Task 3: Job editor with five questions, drafts and manager request

**Files:**

- Create: `src/features/prototype/role-questions-editor.tsx`
- Modify: `src/features/prototype/employer.tsx` (`EmployerJobs`, `EmployerJobEditor`), `src/app/workspace.css`
- Test: `tests/e2e/prototype.spec.ts`

**Interfaces:**

- Consumes: Task 1 exports. Actions `publish` and `request_manager`.
- Produces: the component `RoleQuestionsEditor({ answers, sources, onChange, request, onCopyLink, onOpenManager }: { answers: RecruiterAnswers; sources: Record<QuestionId, AnswerSource>; onChange(id: QuestionId, text: string): void; request?: RoleBrief["managerRequest"]; onCopyLink(): void; onOpenManager(): void })`. Each textarea is labelled with the full question label, so tests use `getByLabel(ROLE_QUESTIONS[i].label)`.
- **Exact copy:**

| Element                       | Copy                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Section heading               | „5 pytań o rolę”                                                                                            |
| Intro                         | „Odpowiedz na to, co wiesz. Resztę uzupełni manager, któremu wyślesz pytania. Każde pytanie można pominąć.” |
| Buttons                       | „Zapisz szkic”, „Wyślij pytania managerowi”, „Skopiuj link”, „Otwórz stronę managera”                       |
| Pending status                | „Czeka na managera · wysłane {data}”                                                                        |
| Answered status               | „Manager odpowiedział {data}”                                                                               |
| Helper under the link actions | „Prototyp: link działa tylko w tej przeglądarce.”                                                           |
| Status chips in „Moje oferty” | „Czeka na managera”; „Manager odpowiedział: możesz zaktualizować opis” (when published before `answeredAt`) |

- **Behavior:**
  - Edits mark the source `recruiter`, or `none` when emptied.
  - „Przygotuj opis z AI” is enabled when the title has 3 or more characters and at least one of q1–q4 is answered. It fills the proposal from `descriptionFromBrief`.
  - „Użyj propozycji” sets the description, and the summary when empty: q1, otherwise the first non-empty of q2–q4, cut to 180 chars.
  - `sourceBrief` is saved as the non-empty answers joined with blank lines.
  - „Wyślij pytania managerowi” first saves a draft when the offer is new, then sends `request_manager` with a new `crypto.randomUUID()` token.
  - „Zapisz szkic” is shown only for new or draft offers.
  - „Otwórz stronę managera” navigates in the same tab to `/pytania/{token}`. „Skopiuj link” copies `${location.origin}${location.pathname}#/pytania/{token}`.

- [ ] **Step 1: Update the existing journey test.**
  - In `published job → saved offer/draft → submitted application → employer decision survives reload`, replace the `Brief —` fill with `getByLabel("Nad czym ta osoba będzie pracować na początku?")`.
  - Keep the rest. This job has a cheat sheet and Anna's application is at `submitted`, so replace its first click `„W przeglądzie”` with `„Nie umiem ocenić”`, which also leads to `reviewed`. Keep the remaining stage clicks.

- [ ] **Step 2: Add failing e2e tests.**
  - `recruiter saves a draft, sends all questions and sees the pending status`:
    - title „Inżynier/ka agentów AI”, q2 and q4 filled, then „Zapisz szkic”;
    - in „Moje oferty” the offer shows „Szkic” and does not appear on `/#/oferty`;
    - then „Wyślij pytania managerowi” → „Czeka na managera” is visible, and „Otwórz stronę managera” leads to a URL matching `#/pytania/`.
  - `legacy brief stays visible and preserved`: import a state whose job has `sourceBrief` and no `roleBrief`. The editor shows the old brief text read-only, and after publish the job's `sourceBrief` in localStorage still contains it.

- [ ] **Step 3: Run `npm run build && npx playwright test -g "recruiter saves a draft|legacy brief"`.** Expected: FAIL.

- [ ] **Step 4: Implement the editor block and the employer changes.** Follow the Poster People roles: one primary pink action per form (publish); the others are outline buttons; the source label sits under each answer as muted text.

- [ ] **Step 5: Run the tests from Step 3 and the updated journey.** Expected: PASS.

### Task 4: Manager page

**Files:**

- Create: `src/features/prototype/manager-questions.tsx`
- Modify: `src/features/prototype/app.tsx` (route `pytania/:token` inside `<Shell />`, not wrapped in `RequireRole`), `src/app/workspace.css`
- Test: `tests/e2e/prototype.spec.ts`

**Interfaces:**

- Consumes: the `manager_answer` action and Task 1 constants.
- Produces: `ManagerQuestionsPage()`.

**Exact copy:**

| Element            | Copy                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading            | „{tytuł oferty}: 5 pytań o rolę”                                                                                                                                              |
| Subline            | „{firma} · prośba od {requestedBy}”                                                                                                                                           |
| Intro              | „Twoje odpowiedzi trafią do ogłoszenia i pomogą wybrać kandydatów na rozmowę z Tobą. Każde pytanie możesz pominąć.”                                                           |
| Progress           | „Pytanie {n} z 5” plus a 5-segment progress bar (`role="progressbar"`, `aria-valuenow`)                                                                                       |
| Prefilled question | label „Wpisane przez: {requestedBy}”, the text, buttons „Zgadza się” and „Zmień” (`aria-pressed`). „Zmień” reveals a textarea prefilled with the text.                        |
| Empty question     | textarea, „Pomiń pytanie”, which reveals optional reason radios with the `SKIP_REASON_LABELS`                                                                                 |
| Navigation         | „Wstecz”, „Dalej” (disabled until the question is decided: confirmed, changed with non-empty text, answered, or skipped); on step 5 the primary button is „Wyślij rekruterce” |
| Done               | „Dziękujemy. Odpowiedzi trafiły do {requestedBy}.” and a link „Przejdź do panelu rekrutacji” → `/app/oferty`                                                                  |
| Already answered   | „Odpowiedzi zostały już wysłane.”                                                                                                                                             |
| Unknown token      | existing `<NotFound />`                                                                                                                                                       |

- [ ] **Step 1: Add failing e2e tests.**
  - `manager confirms, changes, answers and skips, then the recruiter sees sources`:
    - continue the Task 3 draft;
    - on the manager page: q1 answered, q2 „Zgadza się”, q3 skipped with „Rola jeszcze nieustalona”, q4 „Zmień” to new text, q5 answered;
    - submit and see the done text;
    - as Karolina, the editor shows „Od managera” under q1, „Twoja odpowiedź, potwierdzona przez managera” under q2, „Od managera” under q4, and „Manager odpowiedział”.
  - `manager page rejects unknown and answered tokens`.
  - `manager page fits 375px and is keyboard operable`: no horizontal scroll at 375 px; Tab reaches „Zgadza się”; Space toggles it.

- [ ] **Step 2: Run `npm run build && npx playwright test -g "manager"`.** Expected: FAIL.

- [ ] **Step 3: Implement the page.** In-progress answers live in component state and are saved only on submit; the spec accepts that. After a successful step change, move focus to the question heading.

- [ ] **Step 4: Run the Step 2 command again.** Expected: PASS.

### Task 5: Cheat sheet and screening decisions

**Files:**

- Create: `src/features/prototype/cheat-sheet.tsx`
- Modify: `src/features/prototype/application-record.tsx` (optional `margin?: ReactNode` rendered first inside `<aside className="recruiting-margin">`), `src/features/prototype/recruiting-application.tsx`, `src/app/records.css`
- Test: `tests/e2e/prototype.spec.ts`

**Interfaces:**

- Consumes: `deriveCriteria`, `hasCheatSheet`, `SOURCE_LABELS`, `ROLE_QUESTIONS`; actions `screening_mark` and `screening_decision`.
- Produces: `CheatSheet({ brief, marks, onMark }: { brief: RoleBrief; marks: Record<string, "seen" | "not_seen">; onMark(criterionId: string, mark: "seen" | "not_seen" | null): void })`.

**Exact copy:**

| Element                                       | Copy                                                                                                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading                                       | „Na co patrzeć” (h2)                                                                                                                                                                   |
| Meta                                          | „Na podstawie odpowiedzi z {data answeredAt}” or, without an answer date, „Na podstawie formularza oferty”                                                                             |
| Criteria heading                              | „Dobre zgłoszenie opisuje”                                                                                                                                                             |
| Per criterion                                 | the text, its source label, and toggle buttons „Widać” and „Nie widać” (`aria-pressed`; pressing the active one clears it). Each toggle's accessible name includes the criterion text. |
| No criteria                                   | „Kryteria nie zostały podane.”                                                                                                                                                         |
| Context                                       | „Pierwszy projekt” (q1) and „Za co odpowiada” (q2), each with its source label, omitted when empty                                                                                     |
| Decisions (at `submitted` with a cheat sheet) | „Zaprosić na rozmowę” (primary), „Nie umiem ocenić” and „Odrzucić” (outline)                                                                                                           |

Without a cheat sheet, or at any other stage, today's stage buttons are unchanged. The existing note textarea feeds the decision note.

**Mobile:** the side column already stacks. The panel must appear before the decision footer at ≤700px. If the existing order puts the side column after the footer, render the panel through `children` on mobile instead; the builder picks one mechanism and tests it.

- [ ] **Step 1: Add failing e2e tests.**
  - `recruiter screens a prepared application with the cheat sheet`:
    - as Karolina, open a role A application from „Kandydaci”; the panel shows „Na co patrzeć”, at least two criteria and the label „Od managera”;
    - mark one „Widać” (aria-pressed true, survives reload);
    - click „Zaprosić na rozmowę” → status „Zaproszenie na rozmowę”, and the history shows „W przeglądzie” then „Zaproszenie na rozmowę”.
  - `cheat sheet without criteria still offers decisions`: import a state where role A's q5 is skipped. The panel shows „Kryteria nie zostały podane.” and the three decisions.
  - `candidate never sees the cheat sheet or screening notes`: after „Nie umiem ocenić” on Anna's application, Anna's record has no „Na co patrzeć” and no „Nie umiem ocenić”.
  - `jobs without answers keep the old stage buttons`: a published job without `roleBrief` shows „W przeglądzie” at `submitted`.

- [ ] **Step 2: Run `npm run build && npx playwright test -g "cheat sheet|screens a prepared|old stage buttons"`.** Expected: FAIL.

- [ ] **Step 3: Implement the panel and decisions.** Focus moves to the updated status after a decision, as with stage changes today.

- [ ] **Step 4: Run the Step 2 command again.** Expected: PASS.

### Task 6: Full journey, accessibility, register and verification

**Files:**

- Modify: `tests/e2e/prototype.spec.ts`, `FEATURES.md`, `docs/tasks/p5-role-questions-and-cheat-sheet.md`

- [ ] **Step 1: Add the end-to-end test `P-5: recruiter answers, manager completes, candidate applies, recruiter screens`.**
  - Chain: new offer → q2 and q4 → send → manager completes → „Przygotuj opis z AI” → „Użyj propozycji” → approve → publish.
  - Anna opens the offer and sees the heading „Pierwszy projekt” with the manager's q1 text, then applies.
  - Karolina opens Anna's application and sees the cheat sheet criteria from the manager's q5, marks one and invites.
  - Anna sees „Zaproszenie na rozmowę”.
  - Take full-page screenshots at 1440 px and 375 px into `artifacts/p5-*.png`.
  - Assert no external requests and no page errors, as the existing journey does.

- [ ] **Step 2: Extend `core screens have no serious accessibility violations`** with `/#/pytania/{token}`, the editor `/#/app/oferty/nowa` and a role A application detail.

- [ ] **Step 3: Update FEATURES.md.**
  - Change EMP-03, EMP-05, EMP-06, EMP-08, EMP-09 and OPS-06 to describe the actual behavior.
  - Add `EMP-11 | Simulated | /#/pytania/:token` (manager page, local token, same-browser only) and `EMP-12 | Simulated | Screening cheat sheet` (template-derived criteria, prepared roles, no AI judgement).
  - Note in "Current implementation limits" that the manager link works only in the same browser.

- [ ] **Step 4: Run `./scripts/verify`.** Expected: all stages pass: format, design-system check, lint, types, unit, packet, build, e2e. If formatting fails, run `npm run format` and re-run.

- [ ] **Step 5: Inspect the screenshots against Poster People** (ink contours, paper and white surfaces, pink only on the primary action, Geist Serif headings, no horizontal scroll). Record the actual results in the spec's task doc under "Implementation and verification", in the style of `docs/tasks/simplify-candidate-application.md`.
