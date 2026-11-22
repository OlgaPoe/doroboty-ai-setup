import { z } from "zod";
import { answerOf, deriveCriteria, type AnswerSource, type RoleBrief } from "./role-brief";

/** Curated evidence for prepared applications, valid only for the question 5 text it was written for. */
export const evidenceSchema = z.object({
  basis: z.string().max(2000),
  /** A string is a full match, an object a partial one with what is missing, null no evidence. */
  quotes: z
    .array(
      z.union([
        z.string().trim().min(1).max(2000),
        z.object({
          quote: z.string().trim().min(1).max(2000),
          missing: z.string().trim().min(1).max(300),
        }),
        z.null(),
      ]),
    )
    .max(4),
});
export type StoredEvidence = z.infer<typeof evidenceSchema>;

export type Evidence = {
  id: string;
  text: string;
  short: string;
  source: AnswerSource;
  level: "full" | "partial" | "none";
  quote: string | null;
  from: "answer" | "cv" | null;
  /** For a partial match: what the criterion asks for that the quote does not show. */
  missing: string | null;
};

const POINTS = { full: 1, partial: 0.5, none: 0 } as const;
export type Assessment =
  { kind: "role"; score: number; criteria: Evidence[] } | { kind: "generic"; score: number };

type Assessable = { answer: string; cv: string; score: number; evidence?: StoredEvidence };

const STOP_WORDS = new Set(
  [
    "opisuje",
    "opisać",
    "którą",
    "który",
    "które",
    "która",
    "którego",
    "którym",
    "kandydat",
    "kandydata",
    "zgłoszeniu",
    "dobrego",
    "powinien",
    "swoje",
    "swojej",
    "jeden",
    "jedno",
    "jedna",
    "będzie",
    "podobne",
    "albo",
  ].map((word) => word.slice(0, 5)),
);

function stems(text: string): Set<string> {
  const words = text.toLocaleLowerCase("pl").match(/\p{L}[\p{L}\d-]*/gu) ?? [];
  return new Set(
    words
      .filter((word) => word.length >= 5)
      .map((word) => word.slice(0, 5))
      .filter((stem) => !STOP_WORDS.has(stem)),
  );
}

function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Simulated "AI": the answer or CV sentence sharing the most keyword stems with the criterion. */
export function simulateQuote(
  criterion: string,
  answer: string,
  cv: string,
): { quote: string; from: "answer" | "cv" } | null {
  const keywords = stems(criterion);
  const needed = Math.min(2, keywords.size);
  if (!needed) return null;
  let best: { quote: string; from: "answer" | "cv"; hits: number } | null = null;
  for (const [from, text] of [
    ["answer", answer],
    ["cv", cv],
  ] as const) {
    for (const sentence of sentences(text)) {
      const own = stems(sentence);
      const hits = [...keywords].filter((stem) => own.has(stem)).length;
      if (hits >= needed && (!best || hits > best.hits)) best = { quote: sentence, from, hits };
    }
  }
  return best ? { quote: best.quote, from: best.from } : null;
}

function locate(quote: string, application: Assessable): "answer" | "cv" | null {
  if (application.answer.includes(quote)) return "answer";
  if (application.cv.includes(quote)) return "cv";
  return null;
}

/** Match Score calibrated to the role's question 5 criteria; generic score when there are none. */
export function assessApplication(
  application: Assessable,
  brief: RoleBrief | undefined,
): Assessment {
  const criteria = brief ? deriveCriteria(brief) : [];
  if (!criteria.length) return { kind: "generic", score: application.score };
  const basis = answerOf(brief, "q5")?.text ?? "";
  const curated = application.evidence?.basis === basis ? application.evidence.quotes : undefined;
  const assessed = criteria.map((criterion, index): Evidence => {
    const none = { ...criterion, level: "none" as const, quote: null, from: null, missing: null };
    if (curated) {
      const item = curated[index] ?? null;
      const quote = typeof item === "string" ? item : (item?.quote ?? null);
      const from = quote ? locate(quote, application) : null;
      if (!quote || !from) return none;
      return typeof item === "string"
        ? { ...criterion, level: "full", quote, from, missing: null }
        : { ...criterion, level: "partial", quote, from, missing: item!.missing };
    }
    const found = simulateQuote(criterion.text, application.answer, application.cv);
    return found ? { ...criterion, level: "full", ...found, missing: null } : none;
  });
  const points = assessed.reduce((sum, item) => sum + POINTS[item.level], 0);
  return { kind: "role", score: Math.round((100 * points) / assessed.length), criteria: assessed };
}
