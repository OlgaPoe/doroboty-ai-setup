import { useState } from "react";
import { Link } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  QUESTION_IDS,
  ROLE_QUESTIONS,
  SKIP_REASON_LABELS,
  SOURCE_LABELS,
  type AnswerSource,
  type QuestionId,
  type RecruiterAnswers,
  type RoleBrief,
  type SkipReason,
} from "./role-brief";

const dateFormat = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

const STATUS_LABELS: Record<AnswerSource, string> = {
  none: "Brak odpowiedzi",
  recruiter: "Twoja odpowiedź",
  recruiter_confirmed: "Potwierdzona przez managera",
  manager: "Od managera",
};

/** Five role questions in the job editor as a disclosure list; sending to the manager is optional (P-5). */
export function RoleQuestionsEditor({
  answers,
  sources,
  skipReasons,
  onChange,
  request,
  legacyBrief,
  onSend,
}: {
  answers: RecruiterAnswers;
  sources: Record<QuestionId, AnswerSource>;
  skipReasons: Partial<Record<QuestionId, SkipReason>>;
  onChange(id: QuestionId, text: string): void;
  request?: RoleBrief["managerRequest"];
  legacyBrief?: string;
  onSend(): void;
}) {
  // Open the first question with neither an answer nor a skip; afterwards one question at a time.
  const [open, setOpen] = useState<QuestionId | null>(
    () => QUESTION_IDS.find((id) => !answers[id].trim() && !skipReasons[id]) ?? null,
  );
  const [copyStatus, setCopyStatus] = useState("");
  const answered = QUESTION_IDS.filter((id) => answers[id].trim()).length;
  const managerPath = request ? `/pytania/${request.token}` : "";
  function copyLink() {
    const url = `${location.origin}${location.pathname}#${managerPath}`;
    const failed = () => setCopyStatus(`Nie udało się skopiować. Link: ${url}`);
    try {
      navigator.clipboard
        .writeText(url)
        .then(() => setCopyStatus("Link skopiowany."))
        .catch(failed);
    } catch {
      failed();
    }
  }
  return (
    <section className="role-questions" aria-labelledby="role-questions-heading">
      <div className="role-questions-head">
        <h2 id="role-questions-heading">5 pytań o rolę</h2>
        <p className="record-caption">{answered} z 5 uzupełnione</p>
      </div>
      {legacyBrief ? (
        <div className="role-legacy-brief">
          <h3>Wcześniejszy brief</h3>
          <p>{legacyBrief}</p>
        </div>
      ) : null}
      <div className="role-request">
        {!request ? (
          <>
            <h3>Nie wszystko wiesz o tej roli?</h3>
            <p>
              Wyślij pytania managerowi, który będzie pracować z nową osobą. Dostanie wszystkie 5, a
              Twoje odpowiedzi tylko potwierdzi albo poprawi.
            </p>
            <div className="record-actions">
              <Button type="button" variant="outline" onClick={onSend}>
                Wyślij pytania managerowi
              </Button>
            </div>
          </>
        ) : !request.answeredAt ? (
          <>
            <div role="status">
              <h3>Czeka na managera</h3>
              <p>
                Wysłane {formatDate(request.sentAt)}. W prototypie otwórz stronę managera w tej
                samej karcie. Link nie przenosi scenariusza na inne urządzenie.
              </p>
            </div>
            <div className="record-actions">
              <Button type="button" variant="outline" onClick={copyLink}>
                Skopiuj link
              </Button>
              <Link className={buttonVariants({ variant: "outline" })} to={managerPath}>
                Otwórz stronę managera
              </Link>
            </div>
          </>
        ) : (
          <>
            <div role="status">
              <h3>Manager odpowiedział</h3>
              <p>{formatDate(request.answeredAt)}. Odpowiedzi są przy pytaniach poniżej.</p>
            </div>
            <div className="record-actions">
              <Button type="button" variant="outline" onClick={onSend}>
                Wyślij pytania ponownie
              </Button>
            </div>
          </>
        )}
        {copyStatus ? (
          <p className="record-caption" role="status">
            {copyStatus}
          </p>
        ) : null}
      </div>
      <ol className="role-question-list">
        {ROLE_QUESTIONS.map((question, index) => {
          const isOpen = open === question.id;
          const text = answers[question.id].trim();
          const source: AnswerSource = text ? sources[question.id] : "none";
          const skip = skipReasons[question.id];
          const ids = {
            label: `role-${question.id}-label`,
            panel: `role-${question.id}-panel`,
            hint: `role-${question.id}-hint`,
          };
          return (
            <li key={question.id} className="role-question" data-open={isOpen || undefined}>
              <button
                type="button"
                className="role-question-toggle"
                aria-expanded={isOpen}
                aria-controls={ids.panel}
                onClick={() => setOpen(isOpen ? null : question.id)}
              >
                <span className="role-question-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="role-question-text">
                  <span id={ids.label} className="role-question-label">
                    {question.label}
                  </span>
                  <span className="role-question-tag">
                    {question.id === "q5" ? "liczy się do Match Score" : "w ogłoszeniu"}
                  </span>
                  {!isOpen && text ? <span className="role-question-preview">{text}</span> : null}
                  {!isOpen && skip ? (
                    <span className="role-question-preview">
                      Manager pominął: {SKIP_REASON_LABELS[skip]}
                    </span>
                  ) : null}
                </span>
                <span className="role-question-status" data-source={source}>
                  {STATUS_LABELS[source]}
                </span>
              </button>
              {isOpen ? (
                <div id={ids.panel} className="role-question-body">
                  <p id={ids.hint} className="role-question-hint">
                    {question.hint}
                  </p>
                  <Textarea
                    id={`role-${question.id}`}
                    rows={3}
                    maxLength={2000}
                    aria-labelledby={ids.label}
                    aria-describedby={ids.hint}
                    value={answers[question.id]}
                    onChange={(event) => onChange(question.id, event.target.value)}
                  />
                  {source !== "none" ? (
                    <p className="role-question-source">{SOURCE_LABELS[source]}</p>
                  ) : null}
                  {skip ? (
                    <p className="role-question-source">
                      Manager pominął: {SKIP_REASON_LABELS[skip]}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
