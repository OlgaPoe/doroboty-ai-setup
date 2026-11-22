import { z } from "zod";

/** Five role questions (P-5). Answers feed the job ad and the calibrated Match Score. */
export type QuestionId = "q1" | "q2" | "q3" | "q4" | "q5";
export const QUESTION_IDS = ["q1", "q2", "q3", "q4", "q5"] as const satisfies readonly QuestionId[];

export const ROLE_QUESTIONS: readonly { id: QuestionId; label: string; hint: string }[] = [
  {
    id: "q1",
    label: "Nad czym ta osoba będzie pracować na początku?",
    hint: "Jeden konkretny projekt, np. pilot sprawdzania faktur kosztowych u 3 klientów.",
  },
  {
    id: "q2",
    label: "Za co będzie odpowiadać sama, a w czym będzie pomagać innym?",
    hint: "Np. sama prowadzi discovery, a inżynierom pomaga ustalić kryteria odbioru.",
  },
  {
    id: "q3",
    label: "Jakie decyzje będzie mogła podjąć bez pytania managera?",
    hint: "Np. wybiera zakres pilota, a budżet uzgadnia z managerem.",
  },
  {
    id: "q4",
    label: "Z kim będzie pracować na co dzień?",
    hint: "Np. designerka, dwóch inżynierów i osoba od wdrożeń u klienta.",
  },
  {
    id: "q5",
    label: "Po czym poznasz w zgłoszeniu dobrego kandydata?",
    hint: "Np. opisuje jeden projekt, w którym sam zdecydował, czego nie robić, i podaje wynik w liczbach.",
  },
];

export type AnswerSource = "none" | "recruiter" | "recruiter_confirmed" | "manager";
export const SOURCE_LABELS: Record<Exclude<AnswerSource, "none">, string> = {
  recruiter: "Twoja odpowiedź",
  recruiter_confirmed: "Twoja odpowiedź, potwierdzona przez managera",
  manager: "Od managera",
};

export type SkipReason = "dont_know" | "role_undecided" | "confidential";
export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  dont_know: "Nie wiem",
  role_undecided: "Rola jeszcze nieustalona",
  confidential: "Nie mogę ujawnić",
};

const token = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const answerSchema = z.object({
  questionId: z.enum(QUESTION_IDS),
  text: z.string().trim().max(2000),
  source: z.enum(["none", "recruiter", "recruiter_confirmed", "manager"]),
  skipReason: z.enum(["dont_know", "role_undecided", "confidential"]).optional(),
});
export const roleBriefSchema = z.object({
  answers: z
    .array(answerSchema)
    .length(5)
    .refine((answers) => answers.every((a, i) => a.questionId === QUESTION_IDS[i]), {
      message: "Answers must be ordered q1–q5",
    }),
  managerRequest: z
    .object({
      token,
      sentAt: z.iso.datetime(),
      requestedBy: z.string().trim().min(1).max(200),
      answeredAt: z.iso.datetime().optional(),
    })
    .optional(),
  /** Pre-P-5 free-text brief, kept read-only once the questions are used. */
  legacyBrief: z.string().trim().max(12000).optional(),
  /** When the recruiter last published the job after the manager's answers. */
  appliedAt: z.iso.datetime().optional(),
  /** Simulated "AI" short labels for the question 5 criteria, valid only for the text in `basis`. */
  criterionLabels: z
    .object({
      basis: z.string().max(2000),
      labels: z.array(z.string().trim().min(1).max(60)).max(4),
    })
    .optional(),
});
export type RoleBrief = z.infer<typeof roleBriefSchema>;
export type RoleAnswer = RoleBrief["answers"][number];
export type RecruiterAnswers = Record<QuestionId, string>;

export function emptyRoleBrief(): RoleBrief {
  return { answers: QUESTION_IDS.map((questionId) => ({ questionId, text: "", source: "none" })) };
}

export function answerOf(brief: RoleBrief | undefined, id: QuestionId): RoleAnswer | undefined {
  return brief?.answers.find((a) => a.questionId === id);
}

export type Criterion = { id: string; text: string; short: string; source: AnswerSource };

/** Fallback short label: the criterion itself when short, otherwise its first four words. */
export function shortLabel(text: string): string {
  const words = text.replace(/[.!?]+$/, "").split(/\s+/);
  const label =
    words.length <= 5
      ? words.join(" ")
      : `${words
          .slice(0, 4)
          .join(" ")
          .replace(/[,;:]$/, "")}…`;
  return label.charAt(0).toLocaleLowerCase("pl") + label.slice(1);
}
const ABBREVIATIONS =
  /(?<![\p{L}])(?:np|m\.in|ok|itp|itd|tj|tzn|ang|wg|tys|mln|mld|ds|pt|godz)\./giu;

/** Simulated "AI": question 5 cut into sentences, at most four criteria. */
export function deriveCriteria(brief: RoleBrief): Criterion[] {
  const q5 = answerOf(brief, "q5");
  if (!q5 || !q5.text.trim()) return [];
  // Protect the dots of common Polish abbreviations so they do not end a criterion.
  const protectedText = q5.text.replace(ABBREVIATIONS, (match) => match.replace(/\./g, "\uE000"));
  return protectedText
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.replace(/\uE000/g, ".").trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((text, index) => ({
      id: `c${index + 1}`,
      text,
      short:
        (brief.criterionLabels?.basis === q5.text && brief.criterionLabels.labels[index]) ||
        shortLabel(text),
      source: q5.source,
    }));
}

const SECTION_HEADINGS: [QuestionId, string][] = [
  ["q1", "Pierwszy projekt"],
  ["q2", "Za co odpowiadasz"],
  ["q3", "Decyzje i odpowiedzialność"],
  ["q4", "Zespół i współpraca"],
];

/** Simulated "AI" description: a deterministic template from answers 1–4. Question 5 stays internal. */
export function descriptionFromBrief(brief: RoleBrief): string {
  const sections = SECTION_HEADINGS.flatMap(([id, heading]) => {
    const text = answerOf(brief, id)?.text.trim();
    return text ? [`### ${heading}\n${text}`] : [];
  });
  sections.push(
    "### Proces rekrutacji\nPrześlij aplikację i opisz jeden projekt, w którym Twoje decyzje wpłynęły na wynik.",
  );
  return sections.join("\n\n");
}

export function needsDescriptionUpdate(job: {
  publicationStatus: string;
  roleBrief?: RoleBrief;
}): boolean {
  const answeredAt = job.roleBrief?.managerRequest?.answeredAt;
  const appliedAt = job.roleBrief?.appliedAt;
  return Boolean(
    answeredAt && job.publicationStatus === "published" && (!appliedAt || appliedAt < answeredAt),
  );
}
