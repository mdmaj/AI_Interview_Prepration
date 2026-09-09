// src/services/validation/testKitValidator.ts

import { validateFinalKit, type FinalKit } from "./kitValidator.js";

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

const cloneKit = (): FinalKit => {
  return structuredClone(baseKit);
};

const runTest = (name: string, kit: FinalKit, expectedValid: boolean): void => {
  const result = validateFinalKit(kit, 2);

  if (result.is_valid !== expectedValid) {
    console.error(`❌ ${name}`);
    console.error(result.errors);
    throw new Error(`Test failed: ${name}`);
  }

  console.log(`✅ ${name}`);

  if (result.errors.length > 0) {
    console.log("   Errors:", result.errors);
  }
};

// --------------------------------------------------
// TEST 1
// --------------------------------------------------

runTest("Valid complete kit structure", cloneKit(), true);

// --------------------------------------------------
// TEST 2
// --------------------------------------------------

const duplicateRequirement = cloneKit();

duplicateRequirement.role.requirements.push({
  id: "r1",
  text: "Duplicate requirement",
  kind: "technical",
  priority: "must",
});

runTest("Duplicate requirement ID rejected", duplicateRequirement, false);

// --------------------------------------------------
// TEST 3
// --------------------------------------------------

const invalidQuestionReference = cloneKit();

invalidQuestionReference.questions[0].requirement_ids = ["r999"];

runTest(
  "Unknown question requirement ID rejected",
  invalidQuestionReference,
  false,
);

// --------------------------------------------------
// TEST 4
// --------------------------------------------------

const duplicateQuestion = cloneKit();

duplicateQuestion.questions.push({
  id: "q1",
  requirement_ids: ["r1"],
  category: "technical",
  prompt: "Another question",
  answer_outline: "Answer",
  difficulty: 1,
});

runTest("Duplicate question ID rejected", duplicateQuestion, false);

// --------------------------------------------------
// TEST 5
// --------------------------------------------------

const invalidDifficulty = cloneKit();

invalidDifficulty.questions[0].difficulty = 4 as 1 | 2 | 3;

runTest("Invalid difficulty rejected", invalidDifficulty, false);

// --------------------------------------------------
// TEST 6
// --------------------------------------------------

const invalidCategory = cloneKit();

invalidCategory.questions[0].category =
  "invalid" as FinalKit["questions"][number]["category"];

runTest("Invalid question category rejected", invalidCategory, false);

// --------------------------------------------------
// TEST 7
// --------------------------------------------------

const invalidFlashcardReference = cloneKit();

invalidFlashcardReference.flashcards[0].requirement_ids = ["r999"];

runTest(
  "Unknown flashcard requirement ID rejected",
  invalidFlashcardReference,
  false,
);

// --------------------------------------------------
// TEST 8
// --------------------------------------------------

const wrongScheduleDays = cloneKit();

wrongScheduleDays.schedule.days.pop();

runTest("Wrong number of schedule days rejected", wrongScheduleDays, false);

// --------------------------------------------------
// TEST 9
// --------------------------------------------------

const invalidScheduleQuestion = cloneKit();

invalidScheduleQuestion.schedule.days[0].question_ids = ["q999"];

runTest(
  "Unknown schedule question ID rejected",
  invalidScheduleQuestion,
  false,
);

// --------------------------------------------------
// TEST 10
// --------------------------------------------------

const uncoveredMustRequirement = cloneKit();

uncoveredMustRequirement.questions = uncoveredMustRequirement.questions.filter(
  (question) => question.id !== "q2",
);

uncoveredMustRequirement.coverage.uncovered_requirement_ids = ["r2", "r3"];

runTest(
  "Uncovered must-have requirement rejected",
  uncoveredMustRequirement,
  false,
);

// --------------------------------------------------
// TEST 11
// --------------------------------------------------

const inconsistentCoverage = cloneKit();

inconsistentCoverage.coverage.uncovered_requirement_ids = [];

runTest("Inconsistent coverage rejected", inconsistentCoverage, false);

// --------------------------------------------------
// TEST 12
// --------------------------------------------------

const duplicateFlashcard = cloneKit();

duplicateFlashcard.flashcards.push({
  id: "f1",
  front: "Duplicate",
  back: "Duplicate",
  requirement_ids: ["r1"],
});

runTest("Duplicate flashcard ID rejected", duplicateFlashcard, false);

// --------------------------------------------------
// TEST 13
// --------------------------------------------------

const invalidScheduleMinutes = cloneKit();

invalidScheduleMinutes.schedule.days[0].minutes = 30.5;

runTest("Non-integer schedule minutes rejected", invalidScheduleMinutes, false);

// --------------------------------------------------
// TEST 14
// --------------------------------------------------

const wrongExpectedDays = cloneKit();

const result = validateFinalKit(wrongExpectedDays, 5);

if (result.is_valid) {
  throw new Error("Test failed: Expected days mismatch should be rejected");
}

console.log("✅ Expected days mismatch rejected");
console.log("   Errors:", result.errors);

// --------------------------------------------------
// FINAL
// --------------------------------------------------

console.log("\n🎉 All Final Kit Validation tests passed!");
