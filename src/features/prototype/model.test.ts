import { describe, expect, it } from "vitest";
import { initialState, transition, stateSchema, type State } from "./model";
import { deriveCriteria, needsDescriptionUpdate } from "./role-brief";
const time = "2026-11-03T10:00:00.000Z";
function as(state: State, id: string) {
  return transition(state, { type: "select_person", id });
}
function submitted() {
  const s = as(initialState(), "candidate-anna");
  return transition(
    s,
    {
      type: "submit",
      jobId: s.jobs[0].id,
      notes: "Original notes",
      generated: "Generated copy",
      answer: "Approved application with sufficient context.",
      consent: true,
    },
    time,
    "application-anna",
  );
}
describe("coherent browser scenario", () => {
  it("requires approval and prevents duplicate applications", () => {
    const s = as(initialState(), "candidate-anna");
    const input = {
      type: "submit" as const,
      jobId: s.jobs[0].id,
      notes: "",
      generated: "",
      answer: "Approved application with sufficient context.",
      consent: false,
    };
    expect(() => transition(s, input, time)).toThrow("Zatwierdź");
    expect(() => transition(submitted(), { ...input, consent: true }, time)).toThrow("już wysłana");
    expect(s.applications).toHaveLength(initialState().applications.length);
  });
  it("preserves approved sources while profile and notes evolve", () => {
    const s = submitted();
    const app = s.applications.at(-1)!;
    const changed = transition(s, {
      type: "profile",
      value: {
        name: "Updated Name",
        headline: "Updated Headline",
        bio: "Changed",
        location: "Wrocław",
      },
    });
    expect(changed.applications.at(-1)).toEqual(app);
    expect(app.candidateName).toBe("Anna Kowalska");
    expect(app.sourceNotes).toBe("Original notes");
    expect(app.generatedAnswer).toBe("Generated copy");
  });
  it("supports employer review through conversation and continuation without skipping stages", () => {
    let s = as(submitted(), "employer-brightlabs");
    expect(() =>
      transition(
        s,
        { type: "stage", applicationId: "application-anna", stage: "continued", note: "" },
        time,
      ),
    ).toThrow();
    for (const stage of [
      "reviewed",
      "interview_invited",
      "first_conversation_held",
      "continued",
      "hired",
    ] as const)
      s = transition(
        s,
        { type: "stage", applicationId: "application-anna", stage, note: "Employer note" },
        time,
      );
    expect(s.applications.at(-1)?.stage).toBe("hired");
    expect(s.applications.at(-1)?.events).toHaveLength(6);
  });
  it("rejects another employer’s stage writes and another candidate’s withdrawal", () => {
    expect(() =>
      transition(
        as(submitted(), "employer-northstar"),
        { type: "stage", applicationId: "application-anna", stage: "reviewed", note: "" },
        time,
      ),
    ).toThrow();
    expect(() =>
      transition(
        as(submitted(), "candidate-marek"),
        { type: "withdraw", applicationId: "application-anna" },
        time,
      ),
    ).toThrow();
  });
  it("makes withdrawal terminal and keeps drafts and saved jobs person-specific", () => {
    let s = submitted();
    s = transition(s, { type: "withdraw", applicationId: "application-anna" }, time);
    expect(() =>
      transition(
        as(s, "employer-brightlabs"),
        { type: "stage", applicationId: "application-anna", stage: "reviewed", note: "" },
        time,
      ),
    ).toThrow();
    s = transition(s, {
      type: "draft",
      jobId: s.jobs[1].id,
      notes: "Notes",
      generated: "Output",
      answer: "Edited",
    });
    s = transition(s, { type: "toggle_saved", jobId: s.jobs[1].id });
    expect(s.drafts[0].candidateId).toBe("candidate-anna");
    expect(s.saved[0].candidateId).toBe("candidate-anna");
  });
  it("validates broken references, duplicate submissions and invalid histories on import", () => {
    const s = submitted();
    s.applications.push({ ...s.applications.at(-1)!, id: "another-id" });
    expect(stateSchema.safeParse(s).success).toBe(false);
    const broken = submitted();
    broken.applications.at(-1)!.events.push({ stage: "hired", at: time, note: "" });
    broken.applications.at(-1)!.stage = "hired";
    expect(stateSchema.safeParse(broken).success).toBe(false);
    const unknown = initialState();
    unknown.jobs[0].companyId = "missing";
    expect(stateSchema.safeParse(unknown).success).toBe(false);
  });
  it("only publishes own-company jobs and keeps submitted job snapshots unchanged", () => {
    const state = as(submitted(), "employer-brightlabs");
    const updated = { ...state.jobs[0], title: "Updated public role" };
    const result = transition(state, { type: "publish", job: updated });
    expect(result.jobs[0].title).toBe("Updated public role");
    expect(result.applications.at(-1)?.jobTitle).toBe("AI Product Manager");
    expect(() =>
      transition(as(state, "employer-northstar"), { type: "publish", job: updated }),
    ).toThrow();
    expect(() =>
      transition(state, { type: "publish", job: { ...updated, salaryMin: 500, salaryMax: 1 } }),
    ).toThrow();
  });
});

describe("P-5 role questions and screening", () => {
  const empty = { q1: "", q2: "", q3: "", q4: "", q5: "" };
  function draftJob(state: State) {
    return {
      ...state.jobs[0],
      id: "job-draft",
      slug: "oferta-job-draft",
      title: "Inżynier/ka agentów AI",
      summary: "",
      description: "",
      publicationStatus: "draft" as const,
      roleBrief: undefined,
      sourceBrief: undefined,
      generatedDescription: undefined,
    };
  }
  function withDraft() {
    const s = as(initialState(), "employer-brightlabs");
    return transition(s, { type: "publish", job: draftJob(s) }, time);
  }
  function requested() {
    return transition(
      withDraft(),
      {
        type: "request_manager",
        jobId: "job-draft",
        token: "token-1",
        answers: { ...empty, q2: "Sama decyduje, który proces pilotujemy.", q4: "Designerka." },
      },
      time,
    );
  }
  const managerTime = "2026-11-04T10:00:00.000Z";
  function answered() {
    const s = transition(requested(), { type: "select_person", id: null });
    return transition(
      s,
      {
        type: "manager_answer",
        token: "token-1",
        answers: [
          { questionId: "q1", outcome: "answered", text: "Pilot sprawdzania faktur." },
          { questionId: "q2", outcome: "confirmed" },
          { questionId: "q3", outcome: "skipped", skipReason: "role_undecided" },
          { questionId: "q4", outcome: "answered", text: "Designerka i dwóch inżynierów." },
          { questionId: "q5", outcome: "answered", text: "Jeden projekt. Wynik w liczbach." },
        ],
      },
      managerTime,
    );
  }
  const brief = (s: State) => s.jobs.find((j) => j.id === "job-draft")!.roleBrief!;

  it("parses a version-1 state saved before P-5", () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    for (const job of old.jobs) delete job.roleBrief;
    for (const a of old.applications) delete a.evidence;
    for (const p of old.people) delete p.hidden;
    expect(() => stateSchema.parse(old)).not.toThrow();
  });

  it("saves a draft with only a title and publishes only with full content", () => {
    const s = withDraft();
    expect(s.jobs.find((j) => j.id === "job-draft")?.publicationStatus).toBe("draft");
    expect(() =>
      transition(s, { type: "publish", job: { ...draftJob(s), publicationStatus: "published" } }),
    ).toThrow();
    expect(() =>
      transition(s, { type: "publish", job: { ...draftJob(s), title: "AI" } }),
    ).toThrow();
  });

  it("request_manager is employer-only and stores sources", () => {
    expect(() =>
      transition(
        as(withDraft(), "candidate-anna"),
        { type: "request_manager", jobId: "job-draft", token: "token-1", answers: empty },
        time,
      ),
    ).toThrow("Wybierz profil pracodawcy.");
    const b = brief(requested());
    expect(b.answers.map((a) => a.source)).toEqual([
      "none",
      "recruiter",
      "none",
      "recruiter",
      "none",
    ]);
    expect(b.managerRequest).toEqual({
      token: "token-1",
      sentAt: time,
      requestedBy: "Karolina Wiśniewska",
    });
  });

  it("manager_answer works without a persona and maps outcomes", () => {
    const s = answered();
    expect(s.activePersonId).toBeNull();
    const b = brief(s);
    expect(b.answers[0]).toEqual({
      questionId: "q1",
      text: "Pilot sprawdzania faktur.",
      source: "manager",
    });
    expect(b.answers[1]).toMatchObject({
      text: "Sama decyduje, który proces pilotujemy.",
      source: "recruiter_confirmed",
    });
    expect(b.answers[2]).toMatchObject({ text: "", source: "none", skipReason: "role_undecided" });
    expect(b.answers[3]).toMatchObject({
      text: "Designerka i dwóch inżynierów.",
      source: "manager",
    });
    expect(b.managerRequest?.answeredAt).toBe(managerTime);
  });

  it("manager_answer rejects unknown token, second submission and confirming empty", () => {
    const base = transition(requested(), { type: "select_person", id: null });
    const ok = [
      { questionId: "q1" as const, outcome: "skipped" as const },
      { questionId: "q2" as const, outcome: "confirmed" as const },
      { questionId: "q3" as const, outcome: "skipped" as const },
      { questionId: "q4" as const, outcome: "confirmed" as const },
      { questionId: "q5" as const, outcome: "skipped" as const },
    ];
    expect(() =>
      transition(base, { type: "manager_answer", token: "nope", answers: ok }),
    ).toThrow();
    expect(() =>
      transition(answered(), { type: "manager_answer", token: "token-1", answers: ok }),
    ).toThrow();
    expect(() =>
      transition(base, {
        type: "manager_answer",
        token: "token-1",
        answers: ok.map((a) =>
          a.questionId === "q1" ? { ...a, outcome: "confirmed" as const } : a,
        ),
      }),
    ).toThrow();
  });

  it("request_manager twice keeps answers and resets answeredAt", () => {
    let s = as(answered(), "employer-brightlabs");
    const current = brief(s);
    const answers = Object.fromEntries(
      current.answers.map((a) => [a.questionId, a.text]),
    ) as typeof empty;
    s = transition(
      s,
      { type: "request_manager", jobId: "job-draft", token: "token-2", answers },
      time,
    );
    const b = brief(s);
    expect(b.answers[0]).toMatchObject({ text: "Pilot sprawdzania faktur.", source: "manager" });
    expect(b.answers[1].source).toBe("recruiter_confirmed");
    expect(b.managerRequest?.token).toBe("token-2");
    expect(b.managerRequest?.answeredAt).toBeUndefined();
  });
});

describe("prepared screening scenario", () => {
  const roleA = "20000000-0000-4000-8000-000000000001";
  const roleB = "20000000-0000-4000-8000-000000000004";
  it("initial state contains both prepared roles", () => {
    const s = initialState();
    const briefA = s.jobs.find((j) => j.id === roleA)!.roleBrief;
    const briefB = s.jobs.find((j) => j.id === roleB)!.roleBrief;
    expect(s.applications.filter((a) => a.jobId === roleA)).toHaveLength(8);
    expect(s.applications.filter((a) => a.jobId === roleB)).toHaveLength(8);
    expect(deriveCriteria(briefA!)).toHaveLength(4);
    expect(deriveCriteria(briefB!)).toHaveLength(3);
    expect(deriveCriteria(briefA!).length).toBeGreaterThanOrEqual(2);
    expect(briefA!.managerRequest?.answeredAt).toBeDefined();
    expect(briefA!.answers.map((a) => a.source)).toEqual([
      "manager",
      "recruiter_confirmed",
      "none",
      "recruiter_confirmed",
      "manager",
    ]);
    expect(briefB!.managerRequest).toBeUndefined();
    expect(briefB!.answers.every((a) => a.source === "recruiter" || a.source === "none")).toBe(
      true,
    );
    expect(s.applications.every((a) => a.stage === "submitted")).toBe(true);
  });
  it("prepared candidates are hidden and never the active person", () => {
    const s = initialState();
    const hidden = s.people.filter((p) => p.hidden);
    expect(hidden).toHaveLength(15);
    expect(hidden.every((p) => p.role === "candidate" && /^candidate-s\d{2}$/.test(p.id))).toBe(
      true,
    );
    expect(s.activePersonId).toBeNull();
  });
});

describe("P-5 final review fixes", () => {
  const empty = { q1: "", q2: "", q3: "", q4: "", q5: "" };
  const t1 = "2026-11-04T10:00:00.000Z";
  const t2 = "2026-11-05T10:00:00.000Z";
  const roleB = "20000000-0000-4000-8000-000000000004";

  it("loads a pre-P-5 save with a two-character published title", () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    old.jobs[1].title = "PM";
    for (const job of old.jobs) delete job.roleBrief;
    expect(() => stateSchema.parse(old)).not.toThrow();
  });

  it("keeps a legacy brief when the recruiter starts using the questions", () => {
    const s0 = initialState();
    const job = s0.jobs.find((j) => j.id === roleB)!;
    delete job.roleBrief;
    job.sourceBrief = "Stary brief.";
    let s = as(s0, "employer-brightlabs");
    s = transition(
      s,
      {
        type: "request_manager",
        jobId: roleB,
        token: "tok-l",
        answers: { ...empty, q1: "Nowy projekt." },
      },
      t1,
    );
    expect(s.jobs.find((j) => j.id === roleB)!.roleBrief!.legacyBrief).toBe("Stary brief.");
  });

  it("asks to update the description only until the job is republished", () => {
    const s0 = initialState();
    expect(needsDescriptionUpdate(s0.jobs.find((j) => j.id === roleB)!)).toBe(false);
    expect(needsDescriptionUpdate(s0.jobs[0])).toBe(false);
    let s = as(s0, "employer-brightlabs");
    const answers = Object.fromEntries(
      s.jobs.find((j) => j.id === roleB)!.roleBrief!.answers.map((a) => [a.questionId, a.text]),
    ) as typeof empty;
    s = transition(s, { type: "request_manager", jobId: roleB, token: "tok-u", answers }, t1);
    s = transition(
      s,
      {
        type: "manager_answer",
        token: "tok-u",
        answers: (["q1", "q2", "q3", "q4", "q5"] as const).map((questionId) =>
          questionId === "q3"
            ? { questionId, outcome: "skipped" as const }
            : { questionId, outcome: "confirmed" as const },
        ),
      },
      t1,
    );
    expect(needsDescriptionUpdate(s.jobs.find((j) => j.id === roleB)!)).toBe(true);
    s = transition(s, { type: "publish", job: s.jobs.find((j) => j.id === roleB)! }, t2);
    expect(needsDescriptionUpdate(s.jobs.find((j) => j.id === roleB)!)).toBe(false);
  });

  function sentTwice() {
    let s = as(initialState(), "employer-brightlabs");
    const job = {
      ...s.jobs[0],
      id: "job-x",
      slug: "oferta-job-x",
      title: "Rola X",
      summary: "",
      description: "",
      publicationStatus: "draft" as const,
      roleBrief: undefined,
      sourceBrief: undefined,
      generatedDescription: undefined,
    };
    s = transition(s, { type: "publish", job }, t1);
    s = transition(
      s,
      {
        type: "request_manager",
        jobId: "job-x",
        token: "tok-1",
        answers: { ...empty, q2: "Zakres rekruterki." },
      },
      t1,
    );
    s = transition(
      s,
      {
        type: "manager_answer",
        token: "tok-1",
        answers: [
          { questionId: "q1", outcome: "answered", text: "Projekt managera." },
          { questionId: "q2", outcome: "confirmed" },
          { questionId: "q3", outcome: "skipped" },
          { questionId: "q4", outcome: "skipped" },
          { questionId: "q5", outcome: "skipped" },
        ],
      },
      t1,
    );
    s = as(s, "employer-brightlabs");
    s = transition(
      s,
      {
        type: "request_manager",
        jobId: "job-x",
        token: "tok-2",
        answers: {
          ...empty,
          q1: "Projekt managera.",
          q2: "Zakres rekruterki.",
          q3: "Zgadywane decyzje.",
        },
      },
      t2,
    );
    return s;
  }
  const answersOf = (s: State) => s.jobs.find((j) => j.id === "job-x")!.roleBrief!.answers;

  it("keeps the manager as the source when the manager re-confirms an earlier answer", () => {
    const s = transition(
      sentTwice(),
      {
        type: "manager_answer",
        token: "tok-2",
        answers: [
          { questionId: "q1", outcome: "confirmed" },
          { questionId: "q2", outcome: "confirmed" },
          { questionId: "q3", outcome: "confirmed" },
          { questionId: "q4", outcome: "skipped" },
          { questionId: "q5", outcome: "skipped" },
        ],
      },
      t2,
    );
    expect(answersOf(s).map((a) => a.source)).toEqual([
      "manager",
      "recruiter_confirmed",
      "recruiter_confirmed",
      "none",
      "none",
    ]);
  });

  it("lets the manager skip a prefilled question and keeps the text unconfirmed with the reason", () => {
    const s = transition(
      sentTwice(),
      {
        type: "manager_answer",
        token: "tok-2",
        answers: [
          { questionId: "q1", outcome: "confirmed" },
          { questionId: "q2", outcome: "confirmed" },
          { questionId: "q3", outcome: "skipped", skipReason: "confidential" },
          { questionId: "q4", outcome: "skipped" },
          { questionId: "q5", outcome: "skipped" },
        ],
      },
      t2,
    );
    expect(answersOf(s)[2]).toEqual({
      questionId: "q3",
      text: "Zgadywane decyzje.",
      source: "recruiter",
      skipReason: "confidential",
    });
  });

  it("treats an unchanged 'Zmień' as confirming, not as the manager's text", () => {
    const s = transition(
      sentTwice(),
      {
        type: "manager_answer",
        token: "tok-2",
        answers: [
          { questionId: "q1", outcome: "confirmed" },
          { questionId: "q2", outcome: "answered", text: "Zakres rekruterki." },
          { questionId: "q3", outcome: "answered", text: "Inne decyzje." },
          { questionId: "q4", outcome: "skipped" },
          { questionId: "q5", outcome: "skipped" },
        ],
      },
      t2,
    );
    expect(answersOf(s)[1].source).toBe("recruiter_confirmed");
    expect(answersOf(s)[2].source).toBe("manager");
  });
});
