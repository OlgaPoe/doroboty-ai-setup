# P-5: a real AI model behind the calibrated Match Score

Status: draft for Olga's approval (2026-11-22). Builds on
[p5-calibrated-match-score.md](p5-calibrated-match-score.md), whose screens and scoring rule stay.

## Intent and why

P-5 shows one Match Score computed against the role's question 5 criteria, with a quote per
criterion. Today every "AI" step is simulated:

- criteria are question 5 cut into sentences (`deriveCriteria`),
- short criterion labels are curated in the scenario (`criterionLabels`),
- per-criterion judgements are hand-written for the 16 prepared applications (`evidence`) and a
  keyword rule for everything else (`simulateQuote`).

So the prototype only shows the ideal case. The Case Forge post says so: whether a model would
judge like the manager has to be checked on a real model. Olga wants the prototype **as close to
a real deployment as possible**: a real OpenAI model in the app path, first locally, then behind a
shareable link (a later, separate step).

## Goals

1. A real OpenAI model performs the two AI steps of P-5:
   - **criteria:** question 5 text → at most four criteria, each with a short label;
   - **assessment:** criteria + application answer + CV → per criterion `full` / `partial` /
     `none`, a verbatim quote, and for `partial` what is missing.
2. The score rule is unchanged (1 / ½ / 0 points, divided by the number of criteria), so the
   number and the evidence still cannot disagree.
3. The API key never reaches the browser, the bundle, git or logs.
4. An evaluation compares the model with the manager's answer key on the 16 prepared applications
   before any screen work, and can compare models.
5. The server code is a Web-standard `Request → Response` handler, so the same code runs in the
   Vite dev/preview server now and as a Vercel Function later without rewriting.

## Non-goals

- Deploying now (separate step after this one).
- A database or sharing data between browsers. State stays in localStorage.
- AI for the job description template (`descriptionFromBrief`) or for the generic score of roles
  without question 5.
- Changing the candidate view. Candidates keep seeing the stored score, never criteria or quotes.
- A "disagree" control for the recruiter (unchanged from the calibrated-score design).

## Anti-goals (failure even if it technically works)

- The key appears in client code, `dist/`, a commit, localStorage, an export or a log.
- A quote shown to the recruiter that is not verbatim in the answer or CV.
- Simulated results presented as model output, or model failures silently replaced by simulated
  numbers.
- Anyone with the (later) public link can spend unlimited credits.

## Approaches considered

- **A. Local server only (chosen first step).** The key lives in `.env.local`; the Vite dev and
  preview servers expose `/api/ai`. Fast, no risk of strangers spending credits, works only on
  Olga's computer.
- **B. Deployed behind a link (Vercel Function).** Shareable for remote tests, but needs spending
  and abuse limits, ideally a password, and without a database the manager link still works only
  in one browser.
- **Chosen (Olga, 2026-11-22): A now, B later**, with the handler written so B is a thin wrapper.
- **Provider (Olga, 2026-11-22): OpenAI**, as in the AIPH3 lessons. OpenRouter and Anthropic were
  considered; OpenAI was picked as simpler.

## Design

### Server (`server/ai/`, no Vite or path-alias imports)

- `handleAiRequest(request: Request, env): Promise<Response>` routes `POST /api/ai/criteria` and
  `POST /api/ai/assess`, plus `GET /api/ai/status` → `{ enabled, model }` (never the key).
- Request bodies are validated with Zod (shared schemas, length limits as in the app schemas).
- Calls use the OpenAI Node SDK, Responses API, `responses.parse` with `zodTextFormat` for
  structured output, and `store: false`.
- **Model (builder call):** default `gpt-6.2-sol` (balance of quality and cost), overridable with
  `OPENAI_MODEL`. The evaluation also runs `gpt-6-luna` and `gpt-6.2-astra`; the default may change
  after the evaluation.
- **Prompts** live in `server/ai/prompts.ts` with a `PROMPT_VERSION`. They are Polish-aware and
  instruct the model to quote verbatim, to judge only what the text shows, and to separate the
  candidate's own work from the team's when a criterion asks for it.
- **Quote check:** after parsing, every quote must be an exact substring of the answer or CV
  (after whitespace normalisation). A failing quote downgrades that criterion to `none` and is
  counted in the response metadata (`droppedQuotes`), never shown.
- **Limits:** in-memory limit per server process (builder call: 30 calls per minute, 300 per day),
  returning 429 with a Polish message. Olga also sets a monthly spending limit in her OpenAI
  account. (For the later deploy, an in-memory limit is not enough; see "Later: deploy".)
- **Logging:** only operation, model, prompt version, token counts, latency and error codes. Never
  application text, question 5 text or quotes (AGENTS.md: never log private free text).
- **Vite integration:** a small plugin in `vite.config.ts` mounts the handler for `/api/ai/*` in
  `configureServer` and `configurePreviewServer`, reading `OPENAI_API_KEY` and `OPENAI_MODEL` via
  `loadEnv` without the `VITE_` prefix, so they are never exposed to client code.

### Client

- `GET /api/ai/status` decides the mode once per load:
  - **model mode** (key configured): criteria and assessments come from the model;
  - **simulation mode** (no key, CI, participant package): today's behaviour, unchanged.
- **Criteria:** requested when question 5 is saved by the recruiter or the manager, and lazily for
  a role whose stored criteria do not match the current question 5 text. Stored on the role brief
  with `{ basis, model, promptVersion, criteria: [{ text, short }] }`.
- **Assessment:** requested when an application is submitted, and lazily (a backfill) for
  applications whose stored assessment does not match the current criteria basis or application
  text. Stored on the application with `{ basis, model, promptVersion, items, assessedAt }`.
  Backfill runs at most 3 requests at a time.
- **Prepared applications (builder call):** the 16 prepared applications and the two prepared
  role criteria ship with real model output from the chosen evaluation run, tagged with model and
  prompt version. Reset restores that output. Live calls happen only for new applications or a
  changed question 5. Reason: a real deployment assesses an application once at submission and
  stores the result, so every recruiter sees the same output and nobody waits on a reset.
- `assessApplication` gains a stored-model-assessment branch; curated `evidence` and
  `simulateQuote` are used only in simulation mode.
- **States on the employer list and detail:** "Analizuję zgłoszenie…" while pending; an error state
  with "Spróbuj ponownie" when the call fails (no number shown); the existing panel when done. A
  short note "Ocenę przygotował model AI (OpenAI)" sits in the "Dlaczego taki wynik" panel.
- Schemas: all new fields optional, state stays version 1, so existing saves load.

### Evaluation (`evals/`, run before any screen work)

- `npm run eval:ai` runs the server functions directly (no browser) on the 16 prepared
  applications, using the scenario's question 5 texts for role A and role B.
- The manager's answer key moves from the task doc into `evals/p5-answer-key.json` (verdict per
  application, plus the curated per-criterion levels as a second reference).
- Each model runs 3 times to show variance. The report states, per model and role:
  - whether the top 4 by score are exactly the manager's invites,
  - invite/reject agreement at a score threshold of 50 (builder call),
  - per-criterion agreement with the curated levels,
  - dropped quotes, tokens and estimated cost.
- Output: a markdown report in `evals/reports/` (git-ignored, like `artifacts/`). The summary of
  the chosen run is copied into this task doc.
- `evals/` stays out of the participant package (instructor material).

## Constraints

- Node 24, npm, existing Zod 4; add the `openai` package only. Verify `zodTextFormat` works with
  Zod 4 before relying on it; otherwise convert the Zod schema to JSON Schema for `text.format`.
- `.env*` is already in `.gitignore`. Add `.env.example` with empty `OPENAI_API_KEY=` and
  `OPENAI_MODEL=` (needs a `.gitignore` exception).
- Olga pastes the key into `.env.local` herself. It is never pasted into the agent chat.
- `./scripts/verify` must pass without a key and without network: unit tests cover the server with
  a mocked OpenAI client; browser tests run in simulation mode plus model mode against a stubbed
  `/api/ai` route.
- Add `server` to the participant package entries (the Vite config imports it); keep `evals` out.
- **Model mode is local to Olga's copy (builder call).** It is not a participant feature: no
  changes to PARTICIPANT_GUIDE.md, `.env.example` stays out of the package, and without a key the
  package behaves as today. README gets a short "Model AI lokalnie" section; FEATURES.md OPS-06
  says a key can be configured locally and is never stored in the browser.
- **"Przygotuj opis z AI" (builder call):** relabelled "Wstaw opis z odpowiedzi", because it stays
  a fixed template and must not pass for model output.
- Update `docs/SECURITY.md` (there is now a local trusted server; application text is sent to
  OpenAI in model mode, so synthetic data only), FEATURES.md, and the README setup section.
- UI changes follow the Poster People design system (AGENTS.md).

## Later: deploy (separate task, not built now)

`api/ai.ts` exports `{ fetch }` wrapping `handleAiRequest`; the key and model go into Vercel
environment variables. Before the link is shared: a password or access code, a limit that works
across instances, and the OpenAI spending limit. Without a database, the manager link still only
works in one browser.

## Left to the builder

- File layout inside `server/ai/` and `evals/`, exact prompt wording, error copy in Polish
  consistent with existing UI text.
- How pending/error states look within the Poster People kit, at desktop and 375 px.
- Exact cache keys (e.g. a short hash of the inputs).
