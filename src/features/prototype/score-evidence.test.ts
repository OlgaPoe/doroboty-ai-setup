import { describe, expect, it } from "vitest";
import { initialState } from "./model";
import { emptyRoleBrief, type RoleBrief } from "./role-brief";
import { assessApplication, simulateQuote } from "./score-evidence";

function briefWith(q5: string): RoleBrief {
  const brief = emptyRoleBrief();
  brief.answers[4] = { questionId: "q5", text: q5, source: "manager" };
  return brief;
}

describe("calibrated Match Score", () => {
  it("falls back to the stored score when the role has no question 5", () => {
    const app = { answer: "Tekst odpowiedzi.", cv: "CV", score: 72 };
    expect(assessApplication(app, undefined)).toEqual({ kind: "generic", score: 72 });
    expect(assessApplication(app, emptyRoleBrief())).toEqual({ kind: "generic", score: 72 });
  });

  it("scores the share of criteria with evidence", () => {
    const app = {
      answer: "Wdrożyłam agenta do klasyfikacji zgłoszeń. Nic więcej.",
      cv: "CV bez konkretów.",
      score: 10,
    };
    const result = assessApplication(
      app,
      briefWith("Opisuje agenta, którego sam wdrożył. Pokazuje, jak mierzył jakość odpowiedzi."),
    );
    expect(result.kind).toBe("role");
    if (result.kind !== "role") return;
    expect(result.score).toBe(50);
    expect(result.criteria.map((c) => c.quote)).toEqual([
      "Wdrożyłam agenta do klasyfikacji zgłoszeń.",
      null,
    ]);
    expect(result.criteria[0]).toMatchObject({ from: "answer", source: "manager" });
  });

  it("uses curated quotes only for the question 5 text they were written for", () => {
    const q5 = "Wynik porównany z punktem wyjścia, w liczbach. Własna decyzja.";
    const app = {
      answer: "Czas spadł z 6 do 2 dni. Zespół zrobił resztę.",
      cv: "Umiejętności: discovery.",
      score: 40,
      evidence: { basis: q5, quotes: ["Czas spadł z 6 do 2 dni.", "Umiejętności: discovery."] },
    };
    const curated = assessApplication(app, briefWith(q5));
    expect(curated).toMatchObject({ kind: "role", score: 100 });
    if (curated.kind === "role") expect(curated.criteria[1].from).toBe("cv");
    const changed = assessApplication(app, briefWith("Zna n8n, Make albo podobne narzędzie."));
    expect(changed).toMatchObject({ kind: "role", score: 0 });
  });

  it("counts a partial match as half a point and says what is missing", () => {
    const q5 = "Wynik w liczbach. Własna decyzja.";
    const app = {
      answer: "Błędy spadły o 40%. Zespół zdecydował.",
      cv: "CV.",
      score: 40,
      evidence: {
        basis: q5,
        quotes: [{ quote: "Błędy spadły o 40%.", missing: "punktu wyjścia" }, null],
      },
    };
    const result = assessApplication(app, briefWith(q5));
    expect(result).toMatchObject({ kind: "role", score: 25 });
    if (result.kind === "role")
      expect(result.criteria[0]).toMatchObject({
        level: "partial",
        quote: "Błędy spadły o 40%.",
        missing: "punktu wyjścia",
      });
  });

  it("ignores a curated quote that is not in the answer or CV", () => {
    const q5 = "Wynik w liczbach.";
    const app = {
      answer: "Odpowiedź.",
      cv: "CV.",
      score: 40,
      evidence: { basis: q5, quotes: ["Zmyślony cytat."] },
    };
    expect(assessApplication(app, briefWith(q5))).toMatchObject({ score: 0 });
  });

  it("simulated quote needs two shared keywords and prefers the answer", () => {
    expect(simulateQuote("Zna narzędzie n8n.", "Brak.", "Brak.")).toBeNull();
    expect(
      simulateQuote(
        "Mierzył jakość odpowiedzi.",
        "Mierzyłam jakość odpowiedzi co tydzień.",
        "Mierzyłam jakość odpowiedzi w CV.",
      ),
    ).toEqual({ quote: "Mierzyłam jakość odpowiedzi co tydzień.", from: "answer" });
  });

  it("prepared scenario ranks the manager's invitations first", () => {
    const state = initialState();
    const scores = (jobId: string) =>
      Object.fromEntries(
        state.applications
          .filter((a) => a.jobId === jobId)
          .map((a) => [
            a.candidateName,
            assessApplication(a, state.jobs.find((j) => j.id === jobId)?.roleBrief).score,
          ]),
      );
    expect(scores("20000000-0000-4000-8000-000000000001")).toEqual({
      "Marek Nowak": 13,
      "Ewa Sadowska": 100,
      "Piotr Lis": 0,
      "Katarzyna Wróbel": 75,
      "Rafał Bielecki": 38,
      "Agnieszka Mazur": 100,
      "Michał Krawczyk": 0,
      "Natalia Pawlak": 88,
    });
    expect(scores("20000000-0000-4000-8000-000000000004")).toEqual({
      "Julia Kamińska": 100,
      "Bartosz Zając": 33,
      "Weronika Szymańska": 100,
      "Kamil Dąbrowski": 50,
      "Monika Lewandowska": 100,
      "Paweł Wójcik": 0,
      "Zuzanna Kaczmarek": 0,
      "Adam Nowicki": 100,
    });
  });
});
