import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/form-select";
import {
  categoryLabels,
  functionLabels,
  remoteLabels,
  seniorityLabels,
  contractLabels,
} from "@/features/jobs/presentation";
import { currentPerson, jobSchema } from "./model";
import {
  QUESTION_IDS,
  answerOf,
  descriptionFromBrief,
  emptyRoleBrief,
  needsDescriptionUpdate,
  type AnswerSource,
  type QuestionId,
  type RecruiterAnswers,
  type RoleBrief,
  type SkipReason,
} from "./role-brief";
import { RoleQuestionsEditor } from "./role-questions-editor";
import { usePrototype } from "./store";
import { Field } from "./workspace";
import { Empty, NotFound, PageTitle } from "./shell";

export function EmployerJobs() {
  const { state } = usePrototype();
  const person = currentPerson(state)!;
  const jobs = state.jobs.filter((x) => x.companyId === person.companyId);
  return (
    <>
      <PageTitle
        action={
          <Link to="/app/oferty/nowa" className={buttonVariants()}>
            Dodaj ofertę
          </Link>
        }
      >
        Moje oferty
      </PageTitle>
      <div className="space-y-4">
        {jobs.length ? (
          jobs.map((job) => {
            const request = job.roleBrief?.managerRequest;
            const status = !request
              ? ""
              : !request.answeredAt
                ? "Czeka na managera"
                : needsDescriptionUpdate(job)
                  ? "Manager odpowiedział: możesz zaktualizować opis"
                  : "";
            return (
              <article key={job.id} className="prototype-panel">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <Link
                      className="text-xl font-semibold text-[var(--gui-link)]"
                      to={`/app/oferty/${job.id}`}
                    >
                      {job.title}
                    </Link>
                    <p className="mt-3 text-muted-foreground">
                      {state.applications.filter((x) => x.jobId === job.id).length} aplikacji ·{" "}
                      {job.publicationStatus === "published" ? "Opublikowana" : "Szkic"}
                    </p>
                    {status ? <p className="role-job-status">{status}</p> : null}
                  </div>
                  {job.publicationStatus === "published" ? (
                    <Link
                      to={`/oferty/${job.slug}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Zobacz ofertę
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <Empty>Nie masz jeszcze ofert. Dodaj pierwszą ofertę.</Empty>
        )}
      </div>
    </>
  );
}
const cityCoordinates: Record<string, { latitude: number; longitude: number }> = {
  warszawa: { latitude: 52.2297, longitude: 21.0122 },
  kraków: { latitude: 50.0647, longitude: 19.945 },
  wrocław: { latitude: 51.1079, longitude: 17.0385 },
  gdańsk: { latitude: 54.352, longitude: 18.6466 },
  poznań: { latitude: 52.4064, longitude: 16.9252 },
};
function initialAnswers(brief: RoleBrief | undefined) {
  const answers = Object.fromEntries(
    QUESTION_IDS.map((id) => [id, answerOf(brief, id)?.text ?? ""]),
  ) as RecruiterAnswers;
  const sources = Object.fromEntries(
    QUESTION_IDS.map((id) => [id, answerOf(brief, id)?.source ?? "none"]),
  ) as Record<QuestionId, AnswerSource>;
  return { answers, sources };
}
export function EmployerJobEditor() {
  const { id } = useParams();
  const { state, run } = usePrototype();
  const person = currentPerson(state)!;
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const existing = state.jobs.find((x) => x.id === id && x.companyId === person.companyId);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [answers, setAnswers] = useState(() => initialAnswers(existing?.roleBrief).answers);
  const [sources, setSources] = useState(() => initialAnswers(existing?.roleBrief).sources);
  const [generated, setGenerated] = useState(existing?.generatedDescription ?? "");
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  // A new draft navigates to its own URL, which remounts the editor; the notice travels in route state.
  const [notice, setNotice] = useState(
    (location.state as { notice?: string } | null)?.notice ?? "",
  );
  if (id !== "nowa" && !existing) return <NotFound />;
  const legacyBrief =
    existing?.roleBrief?.legacyBrief ??
    (existing?.sourceBrief && !existing.roleBrief ? existing.sourceBrief : "");
  const isDraft = !existing || existing.publicationStatus === "draft";
  const skipReasons = Object.fromEntries(
    (existing?.roleBrief?.answers ?? [])
      .filter((a) => a.skipReason && answers[a.questionId].trim() === a.text)
      .map((a) => [a.questionId, a.skipReason]),
  ) as Partial<Record<QuestionId, SkipReason>>;

  function brief(): RoleBrief | undefined {
    const any = QUESTION_IDS.some((q) => answers[q].trim());
    const request = existing?.roleBrief?.managerRequest;
    if (!any && !request && !existing?.roleBrief) return undefined;
    return {
      answers: QUESTION_IDS.map((questionId) => {
        const text = answers[questionId].trim();
        const skipReason = skipReasons[questionId];
        return {
          questionId,
          text,
          source: !text
            ? "none"
            : sources[questionId] === "none"
              ? "recruiter"
              : sources[questionId],
          ...(skipReason ? { skipReason } : {}),
        };
      }),
      ...(request ? { managerRequest: request } : {}),
      ...(legacyBrief ? { legacyBrief } : {}),
      ...(existing?.roleBrief?.appliedAt ? { appliedAt: existing.roleBrief.appliedAt } : {}),
    };
  }
  function jobData(jobId: string, status: "draft" | "published") {
    const data = new FormData(formRef.current!);
    const location = String(data.get("location") ?? "").trim();
    const joined = QUESTION_IDS.map((q) => answers[q].trim())
      .filter(Boolean)
      .join("\n\n");
    return {
      id: jobId,
      slug: existing?.slug ?? `oferta-${jobId}`,
      companyId: person.companyId,
      title: title.trim(),
      summary,
      description,
      sourceBrief: joined || existing?.sourceBrief || "",
      generatedDescription: generated,
      roleBrief: brief(),
      category: data.get("category"),
      function: data.get("function"),
      remoteStatus: data.get("remoteStatus"),
      locations: [location],
      seniority: data.get("seniority"),
      contract: data.get("contract"),
      salaryMin: data.get("salaryMin") ? Number(data.get("salaryMin")) : undefined,
      salaryMax: data.get("salaryMax") ? Number(data.get("salaryMax")) : undefined,
      salaryCurrency: existing?.salaryCurrency ?? "PLN",
      salaryPeriod: existing?.salaryPeriod ?? "month",
      salaryKind: existing?.salaryKind ?? "gross",
      coordinates: cityCoordinates[location.toLocaleLowerCase("pl")],
      publicationStatus: status,
      publishedAt:
        existing?.publicationStatus === "published" || status === "draft"
          ? (existing?.publishedAt ?? new Date().toISOString())
          : new Date().toISOString(),
      expiryAt: existing?.expiryAt ?? "2099-12-31T23:59:59.000Z",
      verificationStatus: "employer_verified",
    };
  }
  function saveDraft(message: string): string | null {
    setError("");
    if (title.trim().length < 3) {
      setError("Wpisz nazwę stanowiska (co najmniej 3 znaki), aby zapisać szkic.");
      return null;
    }
    const jobId = existing?.id ?? crypto.randomUUID();
    const parsed = jobSchema.safeParse(jobData(jobId, "draft"));
    if (!parsed.success) {
      setError("Sprawdź nazwę stanowiska, lokalizację i widełki wynagrodzenia.");
      return null;
    }
    if (!run({ type: "publish", job: parsed.data })) return null;
    if (!existing) navigate(`/app/oferty/${jobId}`, { replace: true, state: { notice: message } });
    else setNotice(message);
    return jobId;
  }
  function sendToManager() {
    // The manager panel in the question block shows the result; no separate notice.
    const jobId = isDraft ? saveDraft("") : existing!.id;
    if (!jobId) return;
    if (run({ type: "request_manager", jobId, token: crypto.randomUUID(), answers })) setNotice("");
  }
  function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!approved) {
      setError("Zatwierdź opis przed publikacją.");
      return;
    }
    const parsed = jobSchema.safeParse(jobData(existing?.id ?? crypto.randomUUID(), "published"));
    if (!parsed.success) {
      setError(
        "Sprawdź formularz: tytuł, lokalizacja, podsumowanie (min. 10 znaków), opis (min. 30 znaków) i widełki wynagrodzenia.",
      );
      return;
    }
    if (run({ type: "publish", job: parsed.data })) navigate("/app/oferty");
  }
  const canGenerate =
    title.trim().length >= 3 && (["q1", "q2", "q3", "q4"] as const).some((q) => answers[q].trim());
  return (
    <>
      <PageTitle>{existing ? "Edytuj ofertę" : "Nowa oferta"}</PageTitle>
      <form ref={formRef} className="prototype-form" onSubmit={publish}>
        <Field label="Nazwa stanowiska">
          <Input
            required
            maxLength={200}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setApproved(false);
            }}
          />
        </Field>
        <RoleQuestionsEditor
          answers={answers}
          sources={sources}
          skipReasons={skipReasons}
          legacyBrief={legacyBrief}
          request={existing?.roleBrief?.managerRequest}
          onChange={(question, text) => {
            setAnswers((current) => ({ ...current, [question]: text }));
            setSources((current) => ({
              ...current,
              [question]: text.trim() ? "recruiter" : "none",
            }));
            setGenerated("");
            setApproved(false);
          }}
          onSend={sendToManager}
        />
        {notice ? (
          <p role="status" className="record-caption">
            {notice}
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={!canGenerate}
            onClick={() => {
              setGenerated(descriptionFromBrief(brief() ?? emptyRoleBrief()));
              setApproved(false);
            }}
          >
            Przygotuj opis z AI
          </Button>
        </div>
        {generated && (
          <section className="prototype-panel">
            <h2 className="mb-4">Propozycja opisu</h2>
            <p className="whitespace-pre-wrap">{generated}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() => {
                setDescription(generated);
                if (!summary) {
                  const first = QUESTION_IDS.slice(0, 4)
                    .map((q) => answers[q].trim())
                    .find(Boolean);
                  setSummary((first ?? "").slice(0, 180));
                }
                setApproved(false);
              }}
            >
              Użyj propozycji
            </Button>
          </section>
        )}
        <Field label="Krótkie podsumowanie">
          <Textarea
            required
            minLength={10}
            maxLength={12000}
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              setApproved(false);
            }}
          />
        </Field>
        <Field label="Opis oferty">
          <Textarea
            required
            minLength={30}
            maxLength={12000}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setApproved(false);
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["category", "Kategoria", categoryLabels, existing?.category ?? "build"],
              ["function", "Funkcja", functionLabels, existing?.function ?? "engineering"],
              ["remoteStatus", "Tryb pracy", remoteLabels, existing?.remoteStatus ?? "hybrid"],
              ["seniority", "Poziom", seniorityLabels, existing?.seniority ?? "mid"],
              ["contract", "Umowa", contractLabels, existing?.contract ?? "employment"],
            ] as const
          ).map(([name, label, values, value]) => (
            <Field key={name} label={label}>
              <FormSelect
                name={name}
                ariaLabel={label}
                defaultValue={value}
                options={Object.entries(values).map(([value, label]) => ({ value, label }))}
              />
            </Field>
          ))}
          <Field label="Lokalizacja">
            <Input
              name="location"
              required
              maxLength={200}
              defaultValue={existing?.locations.join(" / ") ?? "Warszawa"}
            />
          </Field>
          <Field label="Wynagrodzenie od (PLN brutto / mies.)">
            <Input name="salaryMin" type="number" min="0" defaultValue={existing?.salaryMin} />
          </Field>
          <Field label="Wynagrodzenie do (PLN brutto / mies.)">
            <Input name="salaryMax" type="number" min="0" defaultValue={existing?.salaryMax} />
          </Field>
        </div>
        <label className="flex items-start gap-3">
          <Checkbox
            checked={approved}
            onCheckedChange={setApproved}
            aria-label="Zatwierdzam treść oferty"
          />
          <span>Zatwierdzam treść oferty do publikacji.</span>
        </label>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <div className="record-actions">
          <Button type="submit" disabled={!approved}>
            Opublikuj ofertę
          </Button>
          {isDraft ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => saveDraft("Szkic został zapisany.")}
            >
              Zapisz szkic
            </Button>
          ) : null}
        </div>
      </form>
    </>
  );
}
export function CompanyEditor() {
  const { state, run } = usePrototype();
  const person = currentPerson(state)!;
  const company = state.companies.find((x) => x.id === person.companyId)!;
  const [message, setMessage] = useState("");
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (
      run({
        type: "company",
        name: String(data.get("name")),
        description: String(data.get("description")),
      })
    )
      setMessage("Dane firmy zostały zapisane.");
  }
  return (
    <>
      <PageTitle>Twoja organizacja</PageTitle>
      <form className="prototype-panel prototype-form" onSubmit={save}>
        <Field label="Nazwa firmy">
          <Input name="name" required maxLength={200} defaultValue={company.name} />
        </Field>
        <Field label="Opis firmy">
          <Textarea name="description" maxLength={12000} defaultValue={company.description} />
        </Field>
        <Button type="submit">Zapisz dane firmy</Button>
        {message && <p role="status">{message}</p>}
        <Link className="text-[var(--gui-link)]" to={`/firmy/${company.slug}`}>
          Zobacz profil firmy
        </Link>
      </form>
    </>
  );
}
