import {
  allocateSchedule,
  type ScheduleRequirement,
  type ScheduleQuestion,
  type ScheduleResult,
} from "./scheduleAllocator.js";

import {
  validateSchedule,
} from "./scheduleValidator.js";

/*
 * -----------------------------------------
 * Test Data
 * -----------------------------------------
 */

const requirements: ScheduleRequirement[] = [
  {
    id: "r1",
    priority: "must",
  },
  {
    id: "r2",
    priority: "must",
  },
  {
    id: "r3",
    priority: "nice",
  },
  {
    id: "r4",
    priority: "nice",
  },
];

const questions: ScheduleQuestion[] = [
  {
    id: "q1",
    requirement_ids: ["r1"],
    category: "coding",
    difficulty: 3,
  },
  {
    id: "q2",
    requirement_ids: ["r2"],
    category: "system_design",
    difficulty: 3,
  },
  {
    id: "q3",
    requirement_ids: ["r3"],
    category: "technical",
    difficulty: 2,
  },
  {
    id: "q4",
    requirement_ids: ["r4"],
    category: "behavioral",
    difficulty: 1,
  },
  {
    id: "q5",
    requirement_ids: ["r1", "r2"],
    category: "technical",
    difficulty: 2,
  },
];

/*
 * -----------------------------------------
 * Helper: Validate Schedule
 * -----------------------------------------
 */


const assertScheduleValid = (
  name: string,
  schedule: ScheduleResult,
): void => {
  const validation = validateSchedule({
    days: schedule.days,
    questions,
    requirements,
    daysAvailable: schedule.days.length,
  });

  if (!validation.is_valid) {
    console.error("\n❌ Validation Failed");

    for (const error of validation.errors) {
      console.error(`   - ${error}`);
    }

    throw new Error(
      `${name} failed schedule validation.`,
    );
  }

  console.log(
    `\n✅ ${name} validation passed`,
  );
};


/*
 * -----------------------------------------
 * Helper: Run Schedule Test
 * -----------------------------------------
 */

const runTest = (
  name: string,
  days: number,
): ScheduleResult => {
  console.log(`\n🧪 ${name}`);
  console.log("==============================");

  const result = allocateSchedule(
    days,
    requirements,
    questions,
  );

  console.log(
    JSON.stringify(result, null, 2),
  );

  assertScheduleValid(
    name,
    result,
  );

  return result;
};

/*
 * -----------------------------------------
 * Test 1
 * 1 Day
 * -----------------------------------------
 */

runTest(
  "Test 1 - 1 Day",
  1,
);

/*
 * -----------------------------------------
 * Test 2
 * 3 Days
 * -----------------------------------------
 */

runTest(
  "Test 2 - 3 Days",
  3,
);

/*
 * -----------------------------------------
 * Test 3
 * 5 Days
 * -----------------------------------------
 */

runTest(
  "Test 3 - 5 Days",
  5,
);

/*
 * -----------------------------------------
 * Test 4
 * 30 Days
 * -----------------------------------------
 */

runTest(
  "Test 4 - 30 Days",
  30,
);

/*
 * -----------------------------------------
 * Test 5
 * 60 Days
 * -----------------------------------------
 */

runTest(
  "Test 5 - 60 Days",
  60,
);

/*
 * -----------------------------------------
 * Test 6
 * Deterministic Schedule
 * -----------------------------------------
 */

const firstRun = allocateSchedule(
  30,
  requirements,
  questions,
);

const secondRun = allocateSchedule(
  30,
  requirements,
  questions,
);

if (
  JSON.stringify(firstRun) !==
  JSON.stringify(secondRun)
) {
  throw new Error(
    "❌ Schedule is not deterministic.",
  );
}

console.log(
  "\n✅ Test 6 - Deterministic schedule passed",
);

/*
 * -----------------------------------------
 * Test 7
 * Invalid: 0 Days
 * -----------------------------------------
 */

let zeroDaysPassed = false;

try {
  allocateSchedule(
    0,
    requirements,
    questions,
  );
} catch (error) {
  zeroDaysPassed = true;

  console.log(
    "\n✅ Test 7 - 0 days rejected",
  );

  if (error instanceof Error) {
    console.log(
      `   Message: ${error.message}`,
    );
  }
}

if (!zeroDaysPassed) {
  throw new Error(
    "❌ Test 7 failed: 0 days should be rejected.",
  );
}

/*
 * -----------------------------------------
 * Test 8
 * Invalid: 61 Days
 * -----------------------------------------
 */

let sixtyOneDaysPassed = false;

try {
  allocateSchedule(
    61,
    requirements,
    questions,
  );
} catch (error) {
  sixtyOneDaysPassed = true;

  console.log(
    "\n✅ Test 8 - 61 days rejected",
  );

  if (error instanceof Error) {
    console.log(
      `   Message: ${error.message}`,
    );
  }
}

if (!sixtyOneDaysPassed) {
  throw new Error(
    "❌ Test 8 failed: 61 days should be rejected.",
  );
}

/*
 * -----------------------------------------
 * Test 9
 * Must-have requirement coverage
 * -----------------------------------------
 */

const coverageSchedule = allocateSchedule(
  3,
  requirements,
  questions,
);

const mustHaveRequirementIds =
  requirements
    .filter(
      (requirement) =>
        requirement.priority === "must",
    )
    .map(
      (requirement) => requirement.id,
    );

const scheduledQuestionIds =
  coverageSchedule.days.flatMap(
    (day) => day.question_ids,
  );

const scheduledQuestions =
  questions.filter(
    (question) =>
      scheduledQuestionIds.includes(
        question.id,
      ),
  );

const scheduledRequirementIds =
  new Set(
    scheduledQuestions.flatMap(
      (question) =>
        question.requirement_ids,
    ),
  );

for (
  const requirementId of
  mustHaveRequirementIds
) {
  if (
    !scheduledRequirementIds.has(
      requirementId,
    )
  ) {
    throw new Error(
      `❌ Must-have requirement ${requirementId} is missing from schedule.`,
    );
  }
}

console.log(
  "\n✅ Test 9 - Must-have requirement coverage passed",
);

/*
 * -----------------------------------------
 * Final Result
 * -----------------------------------------
 */

console.log(
  "\n🎉 All schedule allocator tests passed successfully!",
);