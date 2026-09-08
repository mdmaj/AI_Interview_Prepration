// src/services/validation/kitValidator.ts

export interface KitRequirement {
  id: string;
  text: string;
  kind: "technical" | "behavioral" | "other";
  priority: "must" | "nice";
}

export interface KitQuestion {
  id: string;
  requirement_ids: string[];
  category:
    | "technical"
    | "behavioral"
    | "system_design"
    | "coding"
    | "other";
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
}

export interface KitFlashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
}

export interface KitScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface KitSchedule {
  days_available: number;
  days: KitScheduleDay[];
}

export interface KitCoverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface FinalKit {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };

  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
  };

  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: KitRequirement[];
  };

  questions: KitQuestion[];

  flashcards: KitFlashcard[];

  schedule: KitSchedule;

  coverage: KitCoverage;
}

export interface KitValidationResult {
  is_valid: boolean;
  errors: string[];
}

const VALID_CATEGORIES = new Set([
  "technical",
  "behavioral",
  "system_design",
  "coding",
  "other",
]);

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isPositiveInteger = (value: unknown): value is number => {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
};

export const validateFinalKit = (
  kit: FinalKit,
  expectedDays: number,
): KitValidationResult => {
  const errors: string[] = [];

  if (!kit || typeof kit !== "object") {
    return {
      is_valid: false,
      errors: ["Kit must be a valid object"],
    };
  }

  // --------------------------------------------------
  // SOURCE
  // --------------------------------------------------

  if (!kit.source) {
    errors.push("Missing source");
  } else {
    if (!isNonEmptyString(kit.source.company)) {
      errors.push("source.company is required");
    }

    if (!isNonEmptyString(kit.source.company_url)) {
      errors.push("source.company_url is required");
    }

    if (!isNonEmptyString(kit.source.role)) {
      errors.push("source.role is required");
    }

    if (!isNonEmptyString(kit.source.location)) {
      errors.push("source.location is required");
    }

    if (!Number.isInteger(kit.source.jd_chars) || kit.source.jd_chars < 0) {
      errors.push("source.jd_chars must be a non-negative integer");
    }

    if (!isNonEmptyString(kit.source.researched_at)) {
      errors.push("source.researched_at is required");
    }

    if (!Array.isArray(kit.source.pages_used)) {
      errors.push("source.pages_used must be an array");
    }
  }

  // --------------------------------------------------
  // COMPANY BRIEF
  // --------------------------------------------------

  if (!kit.company_brief) {
    errors.push("Missing company_brief");
  } else {
    if (!isNonEmptyString(kit.company_brief.summary)) {
      errors.push("company_brief.summary is required");
    }

    if (!isNonEmptyString(kit.company_brief.what_they_do)) {
      errors.push("company_brief.what_they_do is required");
    }

    if (!Array.isArray(kit.company_brief.sources)) {
      errors.push("company_brief.sources must be an array");
    }
  }

  // --------------------------------------------------
  // ROLE
  // --------------------------------------------------

  if (!kit.role) {
    errors.push("Missing role");
  } else {
    if (!isNonEmptyString(kit.role.title)) {
      errors.push("role.title is required");
    }

    if (!isNonEmptyString(kit.role.seniority)) {
      errors.push("role.seniority is required");
    }

    if (!Array.isArray(kit.role.responsibilities)) {
      errors.push("role.responsibilities must be an array");
    }

    if (!Array.isArray(kit.role.requirements)) {
      errors.push("role.requirements must be an array");
    }
  }

  const requirements = kit.role?.requirements ?? [];

  // --------------------------------------------------
  // REQUIREMENTS
  // --------------------------------------------------

  const requirementIds = new Set<string>();

  requirements.forEach((requirement, index) => {
    if (!isNonEmptyString(requirement.id)) {
      errors.push(`Requirement ${index + 1}: missing id`);
    } else if (requirementIds.has(requirement.id)) {
      errors.push(`Duplicate requirement id: ${requirement.id}`);
    } else {
      requirementIds.add(requirement.id);
    }

    if (!isNonEmptyString(requirement.text)) {
      errors.push(`Requirement ${requirement.id || index + 1}: missing text`);
    }

    if (!["technical", "behavioral", "other"].includes(requirement.kind)) {
      errors.push(
        `Requirement ${requirement.id || index + 1}: invalid kind`,
      );
    }

    if (!["must", "nice"].includes(requirement.priority)) {
      errors.push(
        `Requirement ${requirement.id || index + 1}: invalid priority`,
      );
    }
  });

  // --------------------------------------------------
  // QUESTIONS
  // --------------------------------------------------

  const questions = Array.isArray(kit.questions) ? kit.questions : [];

  if (!Array.isArray(kit.questions)) {
    errors.push("questions must be an array");
  }

  const questionIds = new Set<string>();

  questions.forEach((question, index) => {
    if (!isNonEmptyString(question.id)) {
      errors.push(`Question ${index + 1}: missing id`);
    } else if (questionIds.has(question.id)) {
      errors.push(`Duplicate question id: ${question.id}`);
    } else {
      questionIds.add(question.id);
    }

    if (!Array.isArray(question.requirement_ids)) {
      errors.push(
        `Question ${question.id || index + 1}: requirement_ids must be an array`,
      );
    } else {
      if (question.requirement_ids.length === 0) {
        errors.push(
          `Question ${question.id || index + 1}: must reference at least one requirement`,
        );
      }

      for (const requirementId of question.requirement_ids) {
        if (!requirementIds.has(requirementId)) {
          errors.push(
            `Question ${question.id || index + 1}: unknown requirement id ${requirementId}`,
          );
        }
      }
    }

    if (!VALID_CATEGORIES.has(question.category)) {
      errors.push(
        `Question ${question.id || index + 1}: invalid category`,
      );
    }

    if (!isNonEmptyString(question.prompt)) {
      errors.push(`Question ${question.id || index + 1}: missing prompt`);
    }

    if (!isNonEmptyString(question.answer_outline)) {
      errors.push(
        `Question ${question.id || index + 1}: missing answer_outline`,
      );
    }

    if (![1, 2, 3].includes(question.difficulty)) {
      errors.push(
        `Question ${question.id || index + 1}: difficulty must be 1, 2 or 3`,
      );
    }
  });

  // --------------------------------------------------
  // FLASHCARDS
  // --------------------------------------------------

  const flashcards = Array.isArray(kit.flashcards)
    ? kit.flashcards
    : [];

  if (!Array.isArray(kit.flashcards)) {
    errors.push("flashcards must be an array");
  }

  const flashcardIds = new Set<string>();

  flashcards.forEach((flashcard, index) => {
    if (!isNonEmptyString(flashcard.id)) {
      errors.push(`Flashcard ${index + 1}: missing id`);
    } else if (flashcardIds.has(flashcard.id)) {
      errors.push(`Duplicate flashcard id: ${flashcard.id}`);
    } else {
      flashcardIds.add(flashcard.id);
    }

    if (!isNonEmptyString(flashcard.front)) {
      errors.push(
        `Flashcard ${flashcard.id || index + 1}: missing front`,
      );
    }

    if (!isNonEmptyString(flashcard.back)) {
      errors.push(
        `Flashcard ${flashcard.id || index + 1}: missing back`,
      );
    }

    if (!Array.isArray(flashcard.requirement_ids)) {
      errors.push(
        `Flashcard ${flashcard.id || index + 1}: requirement_ids must be an array`,
      );
    } else {
      for (const requirementId of flashcard.requirement_ids) {
        if (!requirementIds.has(requirementId)) {
          errors.push(
            `Flashcard ${
              flashcard.id || index + 1
            }: unknown requirement id ${requirementId}`,
          );
        }
      }
    }
  });

  // --------------------------------------------------
  // SCHEDULE
  // --------------------------------------------------

  if (!kit.schedule) {
    errors.push("Missing schedule");
  } else {
    if (kit.schedule.days_available !== expectedDays) {
      errors.push(
        `schedule.days_available must be exactly ${expectedDays}`,
      );
    }

    if (!Array.isArray(kit.schedule.days)) {
      errors.push("schedule.days must be an array");
    } else {
      if (kit.schedule.days.length !== expectedDays) {
        errors.push(
          `Schedule must contain exactly ${expectedDays} days`,
        );
      }

      const scheduleDayNumbers = new Set<number>();

      kit.schedule.days.forEach((day, index) => {
        if (day.day !== index + 1) {
          errors.push(
            `Schedule day ${index + 1}: expected day number ${
              index + 1
            }`,
          );
        }

        if (scheduleDayNumbers.has(day.day)) {
          errors.push(`Duplicate schedule day: ${day.day}`);
        }

        scheduleDayNumbers.add(day.day);

        if (!isNonEmptyString(day.focus)) {
          errors.push(`Schedule day ${day.day}: missing focus`);
        }

        if (!Array.isArray(day.question_ids)) {
          errors.push(
            `Schedule day ${day.day}: question_ids must be an array`,
          );
        } else {
          for (const questionId of day.question_ids) {
            if (!questionIds.has(questionId)) {
              errors.push(
                `Schedule day ${day.day}: unknown question id ${questionId}`,
              );
            }
          }
        }

        if (!Number.isInteger(day.minutes) || day.minutes < 0) {
          errors.push(
            `Schedule day ${day.day}: minutes must be a non-negative integer`,
          );
        }
      });
    }
  }

  // --------------------------------------------------
  // MUST-HAVE COVERAGE
  // --------------------------------------------------

  const coveredRequirementIds = new Set<string>();

  for (const question of questions) {
    for (const requirementId of question.requirement_ids) {
      if (requirementIds.has(requirementId)) {
        coveredRequirementIds.add(requirementId);
      }
    }
  }

  const uncoveredMustRequirements = requirements
    .filter(
      (requirement) =>
        requirement.priority === "must" &&
        !coveredRequirementIds.has(requirement.id),
    )
    .map((requirement) => requirement.id);

  if (uncoveredMustRequirements.length > 0) {
    errors.push(
      `Uncovered must-have requirements: ${uncoveredMustRequirements.join(
        ", ",
      )}`,
    );
  }

  // --------------------------------------------------
  // COVERAGE OBJECT CONSISTENCY
  // --------------------------------------------------

  if (!kit.coverage) {
    errors.push("Missing coverage");
  } else {
    if (!Array.isArray(kit.coverage.uncovered_requirement_ids)) {
      errors.push(
        "coverage.uncovered_requirement_ids must be an array",
      );
    } else {
      const actualUncovered = requirements
        .filter(
          (requirement) =>
            !coveredRequirementIds.has(requirement.id),
        )
        .map((requirement) => requirement.id);

      const expected = [...actualUncovered].sort();
      const received = [
        ...kit.coverage.uncovered_requirement_ids,
      ].sort();

      if (JSON.stringify(expected) !== JSON.stringify(received)) {
        errors.push(
          "coverage.uncovered_requirement_ids does not match actual question coverage",
        );
      }
    }

    if (!Number.isInteger(kit.coverage.passes)) {
      errors.push("coverage.passes must be an integer");
    } else if (kit.coverage.passes < 1) {
      errors.push("coverage.passes must be at least 1");
    }
  }

  return {
    is_valid: errors.length === 0,
    errors,
  };
};