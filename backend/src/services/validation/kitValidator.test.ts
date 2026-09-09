import { describe, expect, it } from "vitest";

import {
  validateFinalKit,
  type FinalKit,
} from "./kitValidator.js";

const baseKit: FinalKit = {
  source: {
    company: "Tech Corp",
    company_url: "https://example.com",
    role: "Full Stack Developer",
    location: "Remote",
    jd_chars: 500,
    researched_at: new Date().toISOString(),
    pages_used: ["https://example.com"],
  },

  company_brief: {
    summary: "A technology company building software products.",
    what_they_do: "They build web-based software solutions.",
    sources: ["https://example.com"],
  },

  role: {
    title: "Full Stack Developer",
    seniority: "Junior",
    responsibilities: ["Build web applications"],
    requirements: [
      {
        id: "r1",
        text: "React.js",
        kind: "technical",
        priority: "must",
      },
      {
        id: "r2",
        text: "Node.js",
        kind: "technical",
        priority: "must",
      },
      {
        id: "r3",
        text: "Communication skills",
        kind: "behavioral",
        priority: "nice",
      },
    ],
  },

  questions: [
    {
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Explain React components.",
      answer_outline: "Discuss reusable UI components.",
      difficulty: 1,
    },
    {
      id: "q2",
      requirement_ids: ["r2"],
      category: "technical",
      prompt: "Explain Node.js.",
      answer_outline: "Discuss runtime and event loop.",
      difficulty: 2,
    },
  ],

  flashcards: [
    {
      id: "f1",
      front: "What is React?",
      back: "A library for building user interfaces.",
      requirement_ids: ["r1"],
    },
  ],

  schedule: {
    days_available: 2,
    days: [
      {
        day: 1,
        focus: "Technical",
        question_ids: ["q1"],
        minutes: 30,
      },
      {
        day: 2,
        focus: "Technical",
        question_ids: ["q2"],
        minutes: 45,
      },
    ],
  },

  coverage: {
    uncovered_requirement_ids: ["r3"],
    passes: 1,
  },
};

const cloneKit = (): FinalKit => structuredClone(baseKit);

describe("validateFinalKit", () => {
  // --------------------------------------------------
  // BASIC VALIDATION
  // --------------------------------------------------

  it("accepts a valid complete kit", () => {
    const result = validateFinalKit(cloneKit(), 2);

    expect(result.is_valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a null/invalid kit", () => {
    const result = validateFinalKit(null as unknown as FinalKit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain("Kit must be a valid object");
  });

  // --------------------------------------------------
  // REQUIREMENTS
  // --------------------------------------------------

  it("rejects duplicate requirement IDs", () => {
    const kit = cloneKit();

    kit.role.requirements.push({
      id: "r1",
      text: "Duplicate requirement",
      kind: "technical",
      priority: "must",
    });

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Duplicate requirement id: r1",
    );
  });

  it("rejects a requirement with missing ID", () => {
    const kit = cloneKit();

    kit.role.requirements[0].id = "";

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Requirement 1: missing id",
    );
  });

  it("rejects an invalid requirement kind", () => {
    const kit = cloneKit();

    kit.role.requirements[0].kind =
      "invalid" as FinalKit["role"]["requirements"][number]["kind"];

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Requirement r1: invalid kind",
    );
  });

  it("rejects an invalid requirement priority", () => {
    const kit = cloneKit();

    kit.role.requirements[0].priority =
      "invalid" as FinalKit["role"]["requirements"][number]["priority"];

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Requirement r1: invalid priority",
    );
  });

  // --------------------------------------------------
  // QUESTIONS
  // --------------------------------------------------

  it("rejects unknown question requirement IDs", () => {
    const kit = cloneKit();

    kit.questions[0].requirement_ids = ["r999"];

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Question q1: unknown requirement id r999",
    );
  });

  it("rejects a question with no requirement references", () => {
    const kit = cloneKit();

    kit.questions[0].requirement_ids = [];

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Question q1: must reference at least one requirement",
    );
  });

  it("rejects duplicate question IDs", () => {
    const kit = cloneKit();

    kit.questions.push({
      id: "q1",
      requirement_ids: ["r1"],
      category: "technical",
      prompt: "Another question",
      answer_outline: "Answer",
      difficulty: 1,
    });

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Duplicate question id: q1",
    );
  });

  it("rejects invalid question difficulty", () => {
    const kit = cloneKit();

    kit.questions[0].difficulty = 4 as 1 | 2 | 3;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Question q1: difficulty must be 1, 2 or 3",
    );
  });

  it("accepts all valid question categories", () => {
    const categories: FinalKit["questions"][number]["category"][] = [
      "technical",
      "behavioral",
      "system_design",
      "coding",
      "other",
    ];

    for (const category of categories) {
      const kit = cloneKit();
      kit.questions[0].category = category;

      const result = validateFinalKit(kit, 2);

      expect(result.is_valid).toBe(true);
    }
  });

  it("rejects an invalid question category", () => {
    const kit = cloneKit();

    kit.questions[0].category =
      "invalid" as FinalKit["questions"][number]["category"];

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Question q1: invalid category",
    );
  });

  it("rejects a question with missing prompt", () => {
    const kit = cloneKit();

    kit.questions[0].prompt = "";

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Question q1: missing prompt",
    );
  });

  it("rejects a question with missing answer outline", () => {
    const kit = cloneKit();

    kit.questions[0].answer_outline = "";

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Question q1: missing answer_outline",
    );
  });

  // --------------------------------------------------
  // FLASHCARDS
  // --------------------------------------------------

  it("rejects unknown flashcard requirement IDs", () => {
    const kit = cloneKit();

    kit.flashcards[0].requirement_ids = ["r999"];

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Flashcard f1: unknown requirement id r999",
    );
  });

  it("rejects duplicate flashcard IDs", () => {
    const kit = cloneKit();

    kit.flashcards.push({
      id: "f1",
      front: "Duplicate",
      back: "Duplicate",
      requirement_ids: ["r1"],
    });

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Duplicate flashcard id: f1",
    );
  });

  it("rejects a flashcard with missing front", () => {
    const kit = cloneKit();

    kit.flashcards[0].front = "";

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Flashcard f1: missing front",
    );
  });

  it("rejects a flashcard with missing back", () => {
    const kit = cloneKit();

    kit.flashcards[0].back = "";

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Flashcard f1: missing back",
    );
  });

  // --------------------------------------------------
  // SCHEDULE
  // --------------------------------------------------

  it("rejects wrong number of schedule days", () => {
    const kit = cloneKit();

    kit.schedule.days.pop();

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Schedule must contain exactly 2 days",
    );
  });

  it("rejects incorrect expected days", () => {
    const kit = cloneKit();

    const result = validateFinalKit(kit, 5);

    expect(result.is_valid).toBe(false);

    expect(result.errors).toContain(
      "schedule.days_available must be exactly 5",
    );

    expect(result.errors).toContain(
      "Schedule must contain exactly 5 days",
    );
  });

  it("rejects unknown schedule question IDs", () => {
    const kit = cloneKit();

    kit.schedule.days[0].question_ids = ["q999"];

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Schedule day 1: unknown question id q999",
    );
  });

  it("rejects non-integer schedule minutes", () => {
    const kit = cloneKit();

    kit.schedule.days[0].minutes = 30.5;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Schedule day 1: minutes must be a non-negative integer",
    );
  });

  it("accepts zero schedule minutes", () => {
    const kit = cloneKit();

    kit.schedule.days[0].minutes = 0;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(true);
  });

  it("rejects negative schedule minutes", () => {
    const kit = cloneKit();

    kit.schedule.days[0].minutes = -10;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Schedule day 1: minutes must be a non-negative integer",
    );
  });

  it("rejects incorrect schedule day numbering", () => {
    const kit = cloneKit();

    kit.schedule.days[1].day = 3;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Schedule day 2: expected day number 2",
    );
  });

  it("rejects duplicate schedule day numbers", () => {
    const kit = cloneKit();

    kit.schedule.days[1].day = 1;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "Duplicate schedule day: 1",
    );
  });

  // --------------------------------------------------
  // COVERAGE
  // --------------------------------------------------

  it("rejects uncovered must-have requirements", () => {
    const kit = cloneKit();

    kit.questions = kit.questions.filter(
      (question) => question.id !== "q2",
    );

    kit.coverage.uncovered_requirement_ids = ["r2", "r3"];

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);

    expect(result.errors).toContain(
      "Uncovered must-have requirements: r2",
    );
  });

  it("allows uncovered nice-to-have requirements", () => {
    const kit = cloneKit();

    expect(kit.coverage.uncovered_requirement_ids).toEqual([
      "r3",
    ]);

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(true);
  });

  it("rejects inconsistent coverage information", () => {
    const kit = cloneKit();

    kit.coverage.uncovered_requirement_ids = [];

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);

    expect(result.errors).toContain(
      "coverage.uncovered_requirement_ids does not match actual question coverage",
    );
  });

  it("rejects coverage passes below 1", () => {
    const kit = cloneKit();

    kit.coverage.passes = 0;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "coverage.passes must be at least 1",
    );
  });

  it("rejects non-integer coverage passes", () => {
    const kit = cloneKit();

    kit.coverage.passes = 1.5;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain(
      "coverage.passes must be an integer",
    );
  });

  // --------------------------------------------------
  // REQUIRED TOP-LEVEL STRUCTURE
  // --------------------------------------------------

  it("rejects missing source", () => {
    const kit = cloneKit();

    delete (kit as Partial<FinalKit>).source;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain("Missing source");
  });

  it("rejects missing company brief", () => {
    const kit = cloneKit();

    delete (kit as Partial<FinalKit>).company_brief;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain("Missing company_brief");
  });

  it("rejects missing role", () => {
    const kit = cloneKit();

    delete (kit as Partial<FinalKit>).role;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain("Missing role");
  });

  it("rejects missing schedule", () => {
    const kit = cloneKit();

    delete (kit as Partial<FinalKit>).schedule;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain("Missing schedule");
  });

  it("rejects missing coverage", () => {
    const kit = cloneKit();

    delete (kit as Partial<FinalKit>).coverage;

    const result = validateFinalKit(kit, 2);

    expect(result.is_valid).toBe(false);
    expect(result.errors).toContain("Missing coverage");
  });
});