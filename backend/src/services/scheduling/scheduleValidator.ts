
import type {
  ScheduleDay,
  ScheduleQuestion,
} from "./scheduleAllocator.js";

export interface ScheduleValidationInput {
  days: ScheduleDay[];
  questions: ScheduleQuestion[];
  requirements: {
    id: string;
    priority: "must" | "nice";
  }[];
  daysAvailable: number;
}

export interface ScheduleValidationResult {
  is_valid: boolean;
  errors: string[];
}

export const validateSchedule = (
  input: ScheduleValidationInput,
): ScheduleValidationResult => {
  const errors: string[] = [];

  const {
    days,
    questions,
    requirements,
    daysAvailable,
  } = input;

  // --------------------------------------------------
  // 1. Validate exact number of days
  // --------------------------------------------------

  if (days.length !== daysAvailable) {
    errors.push(
      `Schedule must contain exactly ${daysAvailable} days, but received ${days.length}.`,
    );
  }

  // --------------------------------------------------
  // 2. Validate sequential day numbers
  // --------------------------------------------------

  days.forEach((day, index) => {
    const expectedDayNumber = index + 1;

    if (day.day !== expectedDayNumber) {
      errors.push(
        `Expected day ${expectedDayNumber}, but received day ${day.day}.`,
      );
    }
  });

  // --------------------------------------------------
  // 3. Create lookup maps
  // --------------------------------------------------

  const questionMap = new Map<string, ScheduleQuestion>();

  for (const question of questions) {
    questionMap.set(question.id, question);
  }

  const requirementMap = new Map<
    string,
    {
      id: string;
      priority: "must" | "nice";
    }
  >();

  for (const requirement of requirements) {
    requirementMap.set(requirement.id, requirement);
  }

  // --------------------------------------------------
  // 4. Validate each day
  // --------------------------------------------------

  const learningQuestionIds = new Set<string>();

  for (const day of days) {
    // Focus must exist
    if (!day.focus || day.focus.trim().length === 0) {
      errors.push(
        `Day ${day.day} has an empty focus.`,
      );
    }

    // Minutes must be a non-negative integer
    if (
      !Number.isInteger(day.minutes) ||
      day.minutes < 0
    ) {
      errors.push(
        `Day ${day.day} must have a non-negative integer number of minutes.`,
      );
    }

    // ------------------------------------------------
    // Validate question IDs within the day
    // ------------------------------------------------

    const questionIdsInDay = new Set<string>();

    for (const questionId of day.question_ids) {
      // Question must exist
      if (!questionMap.has(questionId)) {
        errors.push(
          `Day ${day.day} references unknown question "${questionId}".`,
        );

        continue;
      }

      // Same question should not appear twice
      // on the SAME day.
      if (questionIdsInDay.has(questionId)) {
        errors.push(
          `Question "${questionId}" appears more than once on day ${day.day}.`,
        );
      }

      questionIdsInDay.add(questionId);

      // ------------------------------------------------
      // Learning days
      //
      // Days containing "Review" are allowed to repeat
      // questions. Other days are treated as learning days.
      // ------------------------------------------------

      if (day.focus !== "Review") {
        learningQuestionIds.add(questionId);
      }
    }
  }

  // --------------------------------------------------
  // 5. Every question must appear in a learning day
  // --------------------------------------------------

  for (const question of questions) {
    if (!learningQuestionIds.has(question.id)) {
      errors.push(
        `Question "${question.id}" is not included in any learning day.`,
      );
    }
  }

  // --------------------------------------------------
  // 6. Validate question requirement references
  // --------------------------------------------------

  for (const question of questions) {
    for (const requirementId of question.requirement_ids) {
      if (!requirementMap.has(requirementId)) {
        errors.push(
          `Question "${question.id}" references unknown requirement "${requirementId}".`,
        );
      }
    }
  }

  // --------------------------------------------------
  // 7. Check must-have requirement coverage
  // --------------------------------------------------

  const coveredRequirementIds = new Set<string>();

  for (const question of questions) {
    for (const requirementId of question.requirement_ids) {
      if (requirementMap.has(requirementId)) {
        coveredRequirementIds.add(requirementId);
      }
    }
  }

  for (const requirement of requirements) {
    if (
      requirement.priority === "must" &&
      !coveredRequirementIds.has(requirement.id)
    ) {
      errors.push(
        `Must-have requirement "${requirement.id}" is not covered by any question.`,
      );
    }
  }

  // --------------------------------------------------
  // 8. Validate question IDs are unique
  // --------------------------------------------------

  const questionIds = questions.map(
    (question) => question.id,
  );

  const uniqueQuestionIds = new Set(questionIds);

  if (uniqueQuestionIds.size !== questionIds.length) {
    errors.push(
      "Questions contain duplicate question IDs.",
    );
  }

  // --------------------------------------------------
  // 9. Validate requirement IDs are unique
  // --------------------------------------------------

  const requirementIds = requirements.map(
    (requirement) => requirement.id,
  );

  const uniqueRequirementIds = new Set(requirementIds);

  if (
    uniqueRequirementIds.size !== requirementIds.length
  ) {
    errors.push(
      "Requirements contain duplicate requirement IDs.",
    );
  }

  // --------------------------------------------------
  // 10. Final validation result
  // --------------------------------------------------

  return {
    is_valid: errors.length === 0,
    errors,
  };
};

