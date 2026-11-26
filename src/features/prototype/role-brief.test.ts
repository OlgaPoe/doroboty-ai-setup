import { describe, expect, it } from "vitest";
import {
  ROLE_QUESTIONS,
  deriveCriteria,
  descriptionFromBrief,
  emptyRoleBrief,
  roleBriefSchema,
} from "./role-brief";

describe("role brief", () => {
  it("lists the five E-5 questions in order", () => {
    expect(ROLE_QUESTIONS.map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(ROLE_QUESTIONS[0].label).toBe("Nad czym ta osoba będzie pracować na początku?");
    expect(ROLE_QUESTIONS.every((q) => /np\./i.test(q.hint))).toBe(true);
    expect(ROLE_QUESTIONS[4].label).toBe("Po czym poznasz w zgłoszeniu dobrego kandydata?");
  });

  it("starts empty and valid", () => {
    const brief = emptyRoleBrief();
    expect(roleBriefSchema.parse(brief)).toEqual(brief);
    expect(brief.answers.every((a) => a.text === "" && a.source === "none")).toBe(true);
    expect(deriveCriteria(brief)).toEqual([]);
  });

  it("derives at most four criteria from q5 sentences with q5's source", () => {
    const b = emptyRoleBrief();
    b.answers[4] = {
      questionId: "q5",
      text: "Opisuje jeden projekt. Podaje wynik w liczbach! Zna procesy? Pisze krótko. Piąte.",
      source: "manager",
    };
    const criteria = deriveCriteria(b);
    expect(criteria.map((c) => c.text)).toEqual([
      "Opisuje jeden projekt.",
      "Podaje wynik w liczbach!",
      "Zna procesy?",
      "Pisze krótko.",
    ]);
    expect(criteria.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(criteria.map((c) => c.short)).toEqual([
      "opisuje jeden projekt",
      "podaje wynik w liczbach",
      "zna procesy",
      "pisze krótko",
    ]);
    b.answers[4].text = "Umie opisać, jak sam obsłużył błędy i wyjątki.";
    expect(deriveCriteria(b)[0].short).toBe("umie opisać, jak sam…");
    b.criterionLabels = { basis: b.answers[4].text, labels: ["obsługa błędów"] };
    expect(deriveCriteria(b)[0].short).toBe("obsługa błędów");
    b.answers[4].text = "Inne kryterium do sprawdzenia w zgłoszeniu.";
    expect(deriveCriteria(b)[0].short).toBe("inne kryterium do sprawdzenia…");
    expect(criteria.every((c) => c.source === "manager")).toBe(true);
  });

  it("splits q5 on line breaks too", () => {
    const b = emptyRoleBrief();
    b.answers[4] = {
      questionId: "q5",
      text: "Jeden projekt\n\nwynik w liczbach",
      source: "recruiter",
    };
    expect(deriveCriteria(b).map((c) => c.text)).toEqual(["Jeden projekt", "wynik w liczbach"]);
  });

  it("returns no criteria when q5 is empty or skipped", () => {
    const b = emptyRoleBrief();
    b.answers[4] = { questionId: "q5", text: "", source: "none", skipReason: "dont_know" };
    expect(deriveCriteria(b)).toEqual([]);
  });

  it("builds description sections only for answered q1–q4", () => {
    const b = emptyRoleBrief();
    b.answers[0] = { questionId: "q1", text: "Pilot sprawdzania faktur.", source: "manager" };
    b.answers[3] = {
      questionId: "q4",
      text: "Designerka i dwóch inżynierów.",
      source: "recruiter",
    };
    b.answers[4] = { questionId: "q5", text: "Tajne kryterium managera.", source: "manager" };
    const description = descriptionFromBrief(b);
    expect(description).toContain("### Pierwszy projekt\nPilot sprawdzania faktur.");
    expect(description).toContain("### Zespół i współpraca\nDesignerka i dwóch inżynierów.");
    expect(description).not.toContain("### Za co odpowiadasz");
    expect(description).not.toContain("### Decyzje i odpowiedzialność");
    expect(description).not.toContain("Tajne kryterium managera.");
    expect(
      description.endsWith(
        "### Proces rekrutacji\nPrześlij aplikację i opisz jeden projekt, w którym Twoje decyzje wpłynęły na wynik.",
      ),
    ).toBe(true);
  });

  it("does not cut criteria after common Polish abbreviations", () => {
    const b = emptyRoleBrief();
    b.answers[4] = {
      questionId: "q5",
      text: "Zna n8n, np. do faktur. Opisuje m.in. wyjątki. Pisze krótko.",
      source: "manager",
    };
    expect(deriveCriteria(b).map((c) => c.text)).toEqual([
      "Zna n8n, np. do faktur.",
      "Opisuje m.in. wyjątki.",
      "Pisze krótko.",
    ]);
  });
});
