import { checkCoverage } from "./coverageChecker.js";

const runTest = (
  name: string,
  requirements: {
    id: string;
    priority: "must" | "nice";
  }[],
  questions: {
    id: string;
    requirement_ids: string[];
  }[]
): void => {
  const result = checkCoverage(
    requirements,
    questions
  );

  console.log(`\n🧪 ${name}`);
  console.log("------------------------------");

  console.log(
    JSON.stringify(result, null, 2)
  );
};

// --------------------------------------------------
// TEST 1: All requirements covered
// --------------------------------------------------

runTest(
  "Test 1 - Complete Coverage",
  [
    { id: "r1", priority: "must" },
    { id: "r2", priority: "must" },
    { id: "r3", priority: "nice" },
  ],
  [
    {
      id: "q1",
      requirement_ids: ["r1"],
    },
    {
      id: "q2",
      requirement_ids: ["r2", "r3"],
    },
  ]
);

// --------------------------------------------------
// TEST 2: Must-have requirement uncovered
// --------------------------------------------------

runTest(
  "Test 2 - Must-have Uncovered",
  [
    { id: "r1", priority: "must" },
    { id: "r2", priority: "must" },
    { id: "r3", priority: "nice" },
  ],
  [
    {
      id: "q1",
      requirement_ids: ["r1"],
    },
  ]
);

// --------------------------------------------------
// TEST 3: Only nice-to-have uncovered
// --------------------------------------------------

runTest(
  "Test 3 - Only Nice-to-have Uncovered",
  [
    { id: "r1", priority: "must" },
    { id: "r2", priority: "must" },
    { id: "r3", priority: "nice" },
  ],
  [
    {
      id: "q1",
      requirement_ids: ["r1", "r2"],
    },
  ]
);

// --------------------------------------------------
// TEST 4: Multiple questions cover same requirement
// --------------------------------------------------

runTest(
  "Test 4 - Duplicate Requirement Coverage",
  [
    { id: "r1", priority: "must" },
    { id: "r2", priority: "must" },
  ],
  [
    {
      id: "q1",
      requirement_ids: ["r1"],
    },
    {
      id: "q2",
      requirement_ids: ["r1"],
    },
    {
      id: "q3",
      requirement_ids: ["r2"],
    },
  ]
);

// --------------------------------------------------
// TEST 5: No questions
// --------------------------------------------------

runTest(
  "Test 5 - No Questions",
  [
    { id: "r1", priority: "must" },
    { id: "r2", priority: "nice" },
  ],
  []
);