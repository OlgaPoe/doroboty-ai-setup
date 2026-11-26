import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { usePrototype } from "./store";
import { NotFound } from "./shell";
import { ROLE_QUESTIONS, SKIP_REASON_LABELS, type SkipReason } from "./role-brief";

type Draft = {
  outcome?: "confirmed" | "answered" | "skipped";
  text: string;
  editing: boolean;
  skipReason?: SkipReason;
};

/** Public, persona-free page where the manager answers the five role questions (P-5, simulated link). */
export function ManagerQuestionsPage() {
  const { token } = useParams();
  const { state, run } = usePrototype();
  const job = state.jobs.find((x) => x.roleBrief?.managerRequest?.token === token);
  const brief = job?.roleBrief;
  const request = brief?.managerRequest;
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    ROLE_QUESTIONS.map((q) => ({
      text: brief?.answers.find((a) => a.questionId === q.id)?.text ?? "",
      editing: false,
    })),
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  if (!job || !brief || !request) return <NotFound />;
  const company = state.companies.find((x) => x.id === job.companyId);
  const header = (
    <header className="manager-header">
      <h1>{job.title}: 5 pytań o rolę</h1>
      <p className="record-caption">
        {company?.name} · Osoba rekrutująca: {request.requestedBy}
      </p>
    </header>
  );
  if (done)
    return (
      <section className="prototype-section manager-questions">
        {header}
        <div className="prototype-form manager-card" role="status" tabIndex={-1} ref={doneRef}>
          <p className="manager-done">Dziękujemy. Odpowiedzi zostały przekazane.</p>
          <p className="record-caption">
            Osoba rekrutująca: {request.requestedBy} zobaczy je w formularzu oferty.
          </p>
          <Link className={cn(buttonVariants({ variant: "outline" }), "mt-4")} to="/app/oferty">
            Przejdź do panelu rekrutacji
          </Link>
        </div>
      </section>
    );
  if (request.answeredAt)
    return (
      <section className="prototype-section manager-questions">
        {header}
        <div className="prototype-form manager-card">
          <p className="manager-done">Odpowiedzi zostały już wysłane.</p>
        </div>
      </section>
    );

  const question = ROLE_QUESTIONS[step];
  const prefill = brief.answers[step];
  const recruiterText = prefill?.text ?? "";
  const draft = drafts[step];
  const decided = (d: Draft) =>
    d.outcome === "confirmed" ||
    d.outcome === "skipped" ||
    (d.outcome === "answered" && !!d.text.trim());
  const update = (patch: Partial<Draft>) =>
    setDrafts((current) => current.map((d, i) => (i === step ? { ...d, ...patch } : d)));
  const go = (next: number) => {
    moved.current = true;
    setStep(next);
  };
  const last = step === ROLE_QUESTIONS.length - 1;
  const headingId = `manager-${question.id}-heading`;
  const hintId = question.hint ? `${headingId}-hint` : undefined;
  const toggleSkip = () =>
    draft.outcome === "skipped"
      ? update({
          outcome: !recruiterText && draft.text.trim() ? "answered" : undefined,
          skipReason: undefined,
        })
      : update({ outcome: "skipped", editing: false });
  const skipControls = (
    <>
      <Button
        type="button"
        variant="outline"
        aria-pressed={draft.outcome === "skipped"}
        className="manager-choice"
        onClick={toggleSkip}
      >
        Pomiń pytanie
      </Button>
    </>
  );
  const skipReasons =
    draft.outcome === "skipped" ? (
      <fieldset className="manager-skip">
        <legend className="record-caption">Dlaczego? (opcjonalnie)</legend>
        {(Object.keys(SKIP_REASON_LABELS) as SkipReason[]).map((reason) => (
          <label key={reason} className="manager-skip-option">
            <input
              type="radio"
              name={`skip-${question.id}`}
              checked={draft.skipReason === reason}
              onChange={() => update({ skipReason: reason })}
            />
            {SKIP_REASON_LABELS[reason]}
          </label>
        ))}
      </fieldset>
    ) : null;
  function submit() {
    const ok = run({
      type: "manager_answer",
      token: request!.token,
      answers: ROLE_QUESTIONS.map((q, i) => {
        const d = drafts[i];
        return d.outcome === "answered"
          ? { questionId: q.id, outcome: "answered" as const, text: d.text }
          : d.outcome === "confirmed"
            ? { questionId: q.id, outcome: "confirmed" as const }
            : { questionId: q.id, outcome: "skipped" as const, skipReason: d.skipReason };
      }),
    });
    if (ok) setDone(true);
  }
  return (
    <section className="prototype-section manager-questions">
      {header}
      <p className="manager-intro">
        Twoje odpowiedzi trafią do ogłoszenia i pomogą wybrać kandydatów na rozmowę z Tobą. Każde
        pytanie możesz pominąć.
      </p>
      <div className="prototype-form manager-card">
        <p className="record-caption">
          Pytanie {step + 1} z {ROLE_QUESTIONS.length}
        </p>
        <div
          className="manager-progress"
          role="progressbar"
          aria-label="Postęp odpowiedzi"
          aria-valuemin={1}
          aria-valuemax={ROLE_QUESTIONS.length}
          aria-valuenow={step + 1}
        >
          {ROLE_QUESTIONS.map((q, i) => (
            <span key={q.id} data-state={i < step ? "done" : i === step ? "current" : "todo"} />
          ))}
        </div>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="manager-question">
          {question.label}
        </h2>
        {question.hint ? (
          <p id={hintId} className="record-caption">
            {question.hint}
          </p>
        ) : null}
        {recruiterText ? (
          <div className="manager-prefill">
            <p className="record-caption">
              {prefill?.source === "manager"
                ? "Twoja wcześniejsza odpowiedź"
                : `Wpisane przez: ${request.requestedBy}`}
            </p>
            <p className="manager-prefill-text">{recruiterText}</p>
            <div className="record-actions">
              <Button
                type="button"
                variant="outline"
                aria-pressed={draft.outcome === "confirmed"}
                className="manager-choice"
                onClick={() =>
                  update({ outcome: "confirmed", editing: false, text: recruiterText })
                }
              >
                Zgadza się
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-pressed={draft.editing}
                className="manager-choice"
                onClick={() => update({ outcome: "answered", editing: true })}
              >
                Zmień
              </Button>
              {skipControls}
            </div>
            {skipReasons}
            {draft.editing ? (
              <Textarea
                autoFocus
                aria-labelledby={headingId}
                aria-describedby={hintId}
                rows={4}
                maxLength={2000}
                value={draft.text}
                onChange={(e) => update({ text: e.target.value, outcome: "answered" })}
              />
            ) : null}
          </div>
        ) : (
          <div className="manager-answer">
            {draft.outcome !== "skipped" ? (
              <Textarea
                aria-labelledby={headingId}
                aria-describedby={hintId}
                rows={4}
                maxLength={2000}
                value={draft.text}
                onChange={(e) =>
                  update({
                    text: e.target.value,
                    outcome: e.target.value.trim() ? "answered" : undefined,
                  })
                }
              />
            ) : null}
            <div className="record-actions">{skipControls}</div>
            {skipReasons}
          </div>
        )}
        <div className="manager-nav">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => go(step - 1)}
          >
            Wstecz
          </Button>
          {last ? (
            <Button type="button" disabled={!drafts.every(decided)} onClick={submit}>
              Wyślij odpowiedzi
            </Button>
          ) : (
            <Button type="button" disabled={!decided(draft)} onClick={() => go(step + 1)}>
              Dalej
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
