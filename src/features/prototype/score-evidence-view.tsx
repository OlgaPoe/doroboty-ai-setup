import type { ReactNode } from "react";
import { Check, Contrast, Minus } from "lucide-react";
import { SOURCE_LABELS } from "./role-brief";
import type { Assessment, Evidence } from "./score-evidence";

type Level = Evidence["level"];
const LEVEL_PREFIX: Record<Level, string> = {
  full: "Widać: ",
  partial: "Widać częściowo: ",
  none: "Nie widać: ",
};

function Mark({ level }: { level: Level }) {
  const Icon = level === "full" ? Check : level === "partial" ? Contrast : Minus;
  return <Icon className="score-evidence-icon" data-level={level} aria-hidden="true" />;
}

/** Employer list: short labels of the criteria the application meets, fully or partly. */
export function CriteriaLine({ assessment }: { assessment: Assessment }) {
  if (assessment.kind === "generic")
    return <p className="score-basis">Ogólne dopasowanie do ogłoszenia</p>;
  const met = assessment.criteria.filter((item) => item.level !== "none");
  if (!met.length) return <p className="score-basis">Nie spełnia żadnego kryterium</p>;
  return (
    <div className="criteria-line">
      <span className="criteria-line-label" aria-hidden="true">
        Widać:
      </span>
      <ul aria-label="Spełnione kryteria">
        {met.map((item) => (
          <li key={item.id} title={item.text} data-level={item.level}>
            {item.short}
            {item.level === "partial" ? (
              <span className="criteria-partial"> (częściowo)</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

const GROUPS: { level: Level; title: string }[] = [
  { level: "full", title: "Widać w aplikacji" },
  { level: "partial", title: "Widać częściowo" },
  { level: "none", title: "Nie widać" },
];

/** Employer detail: every criterion with the quote the simulated AI found, grouped by level. */
export function ScoreEvidencePanel({ assessment }: { assessment: Assessment }) {
  if (assessment.kind === "generic") return null;
  const source = assessment.criteria[0]?.source;
  return (
    <section className="score-evidence" aria-labelledby="score-evidence-heading">
      <h2 id="score-evidence-heading">Dlaczego taki wynik</h2>
      <p className="record-caption">
        Match Score {assessment.score}%: każde kryterium widoczne w odpowiedzi lub CV to pełny
        punkt, widoczne częściowo to pół punktu
        {source && source !== "none" ? ` (kryteria: ${SOURCE_LABELS[source].toLowerCase()})` : ""}.
        Sprawdź cytaty przed decyzją.
      </p>
      {GROUPS.map(({ level, title }) => (
        <EvidenceGroup
          key={level}
          id={`score-evidence-${level}`}
          title={title}
          level={level}
          items={assessment.criteria.filter((item) => item.level === level)}
        />
      ))}
    </section>
  );
}

function EvidenceGroup({
  id,
  title,
  level,
  items,
}: {
  id: string;
  title: string;
  level: Level;
  items: Evidence[];
}) {
  if (!items.length) return null;
  return (
    <div className="score-evidence-group" data-level={level}>
      <h3 id={id}>
        {title} <span className="score-evidence-count">{items.length}</span>
      </h3>
      <ul className="score-evidence-list" aria-labelledby={id}>
        {items.map((item) => (
          <EvidenceItem key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

function EvidenceItem({ item }: { item: Evidence }) {
  return (
    <li className="score-evidence-item" data-level={item.level}>
      <p className="score-evidence-criterion">
        <Mark level={item.level} />
        <span className="sr-only">{LEVEL_PREFIX[item.level]}</span>
        {item.text}
      </p>
      {item.quote ? (
        <blockquote>
          „{item.quote}”
          <span className="score-evidence-from">
            {item.from === "cv" ? "z CV" : "z odpowiedzi"}
          </span>
        </blockquote>
      ) : (
        <p className="score-evidence-missing">Nie znaleziono w odpowiedzi ani w CV.</p>
      )}
      {item.missing ? <p className="score-evidence-gap">Brakuje: {item.missing}.</p> : null}
    </li>
  );
}

/** Wraps each quote that appears in the text in a <mark>, in reading order. */
export function highlightQuotes(text: string, quotes: string[]): ReactNode {
  const ranges = quotes
    .map((quote) => ({ start: text.indexOf(quote), length: quote.length }))
    .filter((range) => range.start >= 0)
    .sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const { start, length } of ranges) {
    if (start < cursor) continue;
    parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className="score-evidence-mark">
        {text.slice(start, start + length)}
      </mark>,
    );
    cursor = start + length;
  }
  parts.push(text.slice(cursor));
  return parts;
}
