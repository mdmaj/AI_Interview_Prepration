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
 * ============================================================
 * Test Data
 * ============================================================
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
 * ============================================================
 * Helper: Validate Schedule
 * ============================================================
 */

const assertScheduleValid = (
  name: string,
  schedule: ScheduleResult,
  expectedDays: number,
): void => {
  const validation = validateSchedule({
    days: schedule.days,
    questions,
    requirements,
    daysAvailable: expectedDays,
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
 * ============================================================
 * Helper: Run Schedule Test
 * ============================================================
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

  /*
   * IMPORTANT:
   * Pass the actual requested number of days.
   *
   * This ensures that if we request 30 days,
   * validator checks for exactly 30 days.
   */

  assertScheduleValid(
    name,
    result,
    days,
  );

  return result;
};

/*
 * ============================================================
 * Test 1
 * 1 Day
 * ============================================================
 */

runTest(
  "Test 1 - 1 Day",
  1,
);

/*
 * ============================================================
 * Test 2
 * 3 Days
 * ============================================================
 */

runTest(
  "Test 2 - 3 Days",
  3,
);

/*
 * ============================================================
 * Test 3
 * 5 Days
 * ============================================================
 */

runTest(
  "Test 3 - 5 Days",
  5,
);

/*
 * ============================================================
 * Test 4
 * 30 Days
 * ============================================================
 */

runTest(
  "Test 4 - 30 Days",
  30,
);

/*
 * ============================================================
 * Test 5
 * 60 Days
 * ============================================================
 */

runTest(
  "Test 5 - 60 Days",
  60,
);

/*
 * ============================================================
 * Test 6
 * Deterministic Schedule
 * ============================================================
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
 * ============================================================
 * Test 7
 * Invalid: 0 Days
 * ============================================================
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
 * ============================================================
 * Test 8
 * Invalid: 61 Days
 * ============================================================
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
 * ============================================================
 * Test 9
 * Must-have Requirement Coverage
 * ============================================================
 */

const coverageSchedule = allocateSchedule(
  3,
  requirements,
  questions,
);

/*
 * Get all MUST-HAVE requirement IDs.
 */

const mustHaveRequirementIds =
  requirements
    .filter(
      (requirement) =>
        requirement.priority === "must",
    )
    .map(
      (requirement) =>
        requirement.id,
    );

/*
 * Get all questions scheduled
 * across all days.
 */

const scheduledQuestionIds =
  coverageSchedule.days.flatMap(
    (day) =>
      day.question_ids,
  );

/*
 * Find the actual questions
 * that were scheduled.
 */

const scheduledQuestions =
  questions.filter(
    (question) =>
      scheduledQuestionIds.includes(
        question.id,
      ),
  );

/*
 * Collect requirements covered
 * by scheduled questions.
 */

const scheduledRequirementIds =
  new Set(
    scheduledQuestions.flatMap(
      (question) =>
        question.requirement_ids,
    ),
  );

/*
 * Ensure every MUST-HAVE requirement
 * is represented in the schedule.
 */

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
 * ============================================================
 * Test 10
 * Exact Number of Days
 * ============================================================
 *
 * Explicitly verify that the allocator
 * returns exactly the requested number
 * of days.
 * ============================================================
 */

const requestedDays = 7;

const exactDaysSchedule =
  allocateSchedule(
    requestedDays,
    requirements,
    questions,
  );

if (
  exactDaysSchedule.days.length !==
  requestedDays
) {
  throw new Error(
    `❌ Test 10 failed: expected ${requestedDays} days but received ${exactDaysSchedule.days.length}.`,
  );
}

console.log(
  "\n✅ Test 10 - Exact number of days passed",
);

/*
 * ============================================================
 * Test 11
 * Day Numbers Are Sequential
 * ============================================================
 */

for (
  let index = 0;
  index <
  exactDaysSchedule.days.length;
  index++
) {
  const expectedDay =
    index + 1;

  if (
    exactDaysSchedule.days[index]
      .day !== expectedDay
  ) {
    throw new Error(
      `❌ Test 11 failed: expected day ${expectedDay}.`,
    );
  }
}

console.log(
  "\n✅ Test 11 - Sequential day numbers passed",
);

/*
 * ============================================================
 * Test 12
 * Valid Question IDs
 * ============================================================
 */

const validQuestionIds =
  new Set(
    questions.map(
      (question) =>
        question.id,
    ),
  );

for (
  const day of
  exactDaysSchedule.days
) {
  for (
    const questionId of
    day.question_ids
  ) {
    if (
      !validQuestionIds.has(
        questionId,
      )
    ) {
      throw new Error(
        `❌ Test 12 failed: unknown question ID ${questionId}.`,
      );
    }
  }
}

console.log(
  "\n✅ Test 12 - Valid question IDs passed",
);

/*
 * ============================================================
 * Test 13
 * Integer Minutes
 * ============================================================
 */

for (
  const day of
  exactDaysSchedule.days
) {
  if (
    !Number.isInteger(
      day.minutes,
    )
  ) {
    throw new Error(
      `❌ Test 13 failed: day ${day.day} has non-integer minutes.`,
    );
  }

  if (
    day.minutes < 0
  ) {
    throw new Error(
      `❌ Test 13 failed: day ${day.day} has negative minutes.`,
    );
  }
}

console.log(
  "\n✅ Test 13 - Integer minutes passed",
);

/*
 * ============================================================
 * Final Result
 * ============================================================
 */

console.log(
  "\n==========================================",
);

console.log(
  "🎉 All schedule allocator tests passed successfully!",
);

console.log(
  "==========================================",
);