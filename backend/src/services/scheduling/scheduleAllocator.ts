
/*
 * ============================================================
 * Schedule Allocator
 * ============================================================
 *
 * Responsibilities:
 * 1. Validate days_available
 * 2. Sort questions deterministically
 * 3. Allocate every question across learning days
 * 4. Add review days when days > number of questions
 * 5. Ensure every requested day exists
 * 6. Keep allocation deterministic
 *
 * Scheduling decisions are made in application code,
 * not by the LLM.
 * ============================================================
 */

/*
 * ------------------------------------------------------------
 * Types
 * ------------------------------------------------------------
 */

export interface ScheduleRequirement {
  id: string;
  priority: "must" | "nice";
}

export interface ScheduleQuestion {
  id: string;
  requirement_ids: string[];
  category:
    | "technical"
    | "behavioral"
    | "system_design"
    | "coding"
    | "other";
  difficulty: 1 | 2 | 3;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface ScheduleResult {
  days_available: number;
  days: ScheduleDay[];
}

/*
 * ------------------------------------------------------------
 * Question duration
 * ------------------------------------------------------------
 *
 * Difficulty:
 * 1 = 30 minutes
 * 2 = 45 minutes
 * 3 = 60 minutes
 * ------------------------------------------------------------
 */

const getQuestionMinutes = (
  question: ScheduleQuestion,
): number => {
  switch (question.difficulty) {
    case 3:
      return 60;

    case 2:
      return 45;

    case 1:
      return 30;

    default:
      return 30;
  }
};

/*
 * ------------------------------------------------------------
 * Requirement priority
 * ------------------------------------------------------------
 *
 * must = 100
 * nice = 50
 * ------------------------------------------------------------
 */

const getRequirementPriorityScore = (
  question: ScheduleQuestion,
  requirementMap: Map<
    string,
    ScheduleRequirement
  >,
): number => {
  let highestPriority = 0;

  for (const requirementId of question.requirement_ids) {
    const requirement =
      requirementMap.get(requirementId);

    if (!requirement) {
      continue;
    }

    if (requirement.priority === "must") {
      highestPriority = Math.max(
        highestPriority,
        100,
      );
    } else {
      highestPriority = Math.max(
        highestPriority,
        50,
      );
    }
  }

  return highestPriority;
};

/*
 * ------------------------------------------------------------
 * Question score
 * ------------------------------------------------------------
 *
 * Priority is more important than difficulty.
 *
 * must + difficulty 3 = 130
 * must + difficulty 2 = 120
 * must + difficulty 1 = 110
 *
 * nice + difficulty 3 = 80
 * nice + difficulty 2 = 70
 * nice + difficulty 1 = 60
 *
 * Questions with no valid requirement get 0.
 * ------------------------------------------------------------
 */

const getQuestionScore = (
  question: ScheduleQuestion,
  requirementMap: Map<
    string,
    ScheduleRequirement
  >,
): number => {
  const priorityScore =
    getRequirementPriorityScore(
      question,
      requirementMap,
    );

  return (
    priorityScore +
    question.difficulty * 10
  );
};

/*
 * ------------------------------------------------------------
 * Get question focus
 * ------------------------------------------------------------
 */

const getFocus = (
  questions: ScheduleQuestion[],
): string => {
  if (questions.length === 0) {
    return "Review";
  }

  const categoryCounts = new Map<
    ScheduleQuestion["category"],
    number
  >();

  for (const question of questions) {
    const current =
      categoryCounts.get(question.category) ?? 0;

    categoryCounts.set(
      question.category,
      current + 1,
    );
  }

  let mostCommonCategory: ScheduleQuestion["category"] =
    questions[0].category;

  let highestCount =
    categoryCounts.get(mostCommonCategory) ?? 0;

  for (const [category, count] of categoryCounts.entries()) {
    if (count > highestCount) {
      highestCount = count;
      mostCommonCategory = category;
    }
  }

  switch (mostCommonCategory) {
    case "system_design":
      return "System Design";

    case "technical":
      return "Technical";

    case "coding":
      return "Coding";

    case "behavioral":
      return "Behavioral";

    case "other":
      return "Other";

    default:
      return "Other";
  }
};

/*
 * ------------------------------------------------------------
 * Create learning day
 * ------------------------------------------------------------
 */

const createLearningDay = (
  dayNumber: number,
  questions: ScheduleQuestion[],
): ScheduleDay => {
  return {
    day: dayNumber,

    focus: getFocus(questions),

    question_ids: questions.map(
      (question) => question.id,
    ),

    minutes: questions.reduce(
      (total, question) =>
        total +
        getQuestionMinutes(question),
      0,
    ),
  };
};

/*
 * ------------------------------------------------------------
 * Create review day
 * ------------------------------------------------------------
 *
 * Review days intentionally repeat previously introduced
 * questions.
 *
 * We rotate through questions so that long schedules do
 * not always repeat the exact same questions.
 * ------------------------------------------------------------
 */

const createReviewDay = (
  dayNumber: number,
  questions: ScheduleQuestion[],
): ScheduleDay => {
  if (questions.length === 0) {
    return {
      day: dayNumber,
      focus: "Review",
      question_ids: [],
      minutes: 30,
    };
  }

  /*
   * Rotate starting position based on day number.
   *
   * Example with 5 questions:
   *
   * Day 6 -> q1,q2
   * Day 7 -> q3,q4
   * Day 8 -> q5,q1
   * Day 9 -> q2,q3
   * ...
   */

  const firstIndex =
    ((dayNumber - 1) * 2) %
    questions.length;

  const reviewQuestions: ScheduleQuestion[] =
    [];

  /*
   * Maximum two questions per review day.
   */
  const reviewCount = Math.min(
    2,
    questions.length,
  );

  for (
    let i = 0;
    i < reviewCount;
    i++
  ) {
    const index =
      (firstIndex + i) %
      questions.length;

    reviewQuestions.push(
      questions[index],
    );
  }

  return {
    day: dayNumber,

    focus: "Review",

    question_ids:
      reviewQuestions.map(
        (question) => question.id,
      ),

    minutes:
      reviewQuestions.reduce(
        (total, question) =>
          total +
          Math.min(
            getQuestionMinutes(question),
            30,
          ),
        0,
      ),
  };
};

/*
 * ============================================================
 * Main Scheduler
 * ============================================================
 */

export const allocateSchedule = (
  daysAvailable: number,
  requirements: ScheduleRequirement[],
  questions: ScheduleQuestion[],
): ScheduleResult => {
  /*
   * ----------------------------------------------------------
   * 1. Validate days
   * ----------------------------------------------------------
   */

  if (
    !Number.isInteger(daysAvailable)
  ) {
    throw new Error(
      "daysAvailable must be an integer.",
    );
  }

  if (
    daysAvailable < 1 ||
    daysAvailable > 60
  ) {
    throw new Error(
      "daysAvailable must be between 1 and 60.",
    );
  }

  /*
   * ----------------------------------------------------------
   * 2. Create requirement map
   * ----------------------------------------------------------
   */

  const requirementMap =
    new Map<
      string,
      ScheduleRequirement
    >(
      requirements.map(
        (requirement) => [
          requirement.id,
          requirement,
        ],
      ),
    );

  /*
   * ----------------------------------------------------------
   * 3. Keep only questions with valid requirement
   *    references.
   *
   * This prevents broken requirement references from
   * entering the final schedule.
   * ----------------------------------------------------------
   */

  const validQuestions =
    questions.filter((question) =>
      question.requirement_ids.some(
        (requirementId) =>
          requirementMap.has(
            requirementId,
          ),
      ),
    );

  /*
   * ----------------------------------------------------------
   * 4. Sort questions deterministically
   *
   * Higher priority first.
   * Harder questions first.
   * ID as final deterministic tie-breaker.
   * ----------------------------------------------------------
   */

  const sortedQuestions =
    [...validQuestions].sort(
      (a, b) => {
        const scoreA =
          getQuestionScore(
            a,
            requirementMap,
          );

        const scoreB =
          getQuestionScore(
            b,
            requirementMap,
          );

        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        return a.id.localeCompare(
          b.id,
        );
      },
    );

  /*
   * ----------------------------------------------------------
   * 5. Create requested number of days
   * ----------------------------------------------------------
   */

  const days: ScheduleDay[] =
    Array.from(
      {
        length: daysAvailable,
      },
      (_, index) => ({
        day: index + 1,
        focus: "Review",
        question_ids: [],
        minutes: 0,
      }),
    );

  /*
   * ----------------------------------------------------------
   * 6. No questions case
   * ----------------------------------------------------------
   */

  if (sortedQuestions.length === 0) {
    return {
      days_available: daysAvailable,

      days: days.map((day) => ({
        ...day,
        focus: "Review",
        minutes: 30,
      })),
    };
  }

  /*
   * ----------------------------------------------------------
   * 7. Determine learning days
   *
   * If we have:
   *
   * 5 questions + 3 days
   * -> 3 learning days
   *
   * 5 questions + 30 days
   * -> 5 learning days + 25 review days
   *
   * ----------------------------------------------------------
   */

  const learningDays = Math.min(
    daysAvailable,
    sortedQuestions.length,
  );

  /*
   * ----------------------------------------------------------
   * 8. Balanced distribution
   *
   * We don't use round-robin because that would produce:
   *
   * Day 1 -> q1,q3
   * Day 2 -> q2,q4
   * Day 3 -> q5
   *
   * Instead, questions remain in priority order:
   *
   * Day 1 -> q1,q2
   * Day 2 -> q3,q4
   * Day 3 -> q5
   *
   * Distribution is balanced using quotient + remainder.
   * ----------------------------------------------------------
   */

  const baseQuestionsPerDay =
    Math.floor(
      sortedQuestions.length /
        learningDays,
    );

  const extraQuestions =
    sortedQuestions.length %
    learningDays;

  let currentIndex = 0;

  /*
   * ----------------------------------------------------------
   * 9. Allocate learning days
   * ----------------------------------------------------------
   */

  for (
    let dayIndex = 0;
    dayIndex < learningDays;
    dayIndex++
  ) {
    const count =
      baseQuestionsPerDay +
      (dayIndex <
      extraQuestions
        ? 1
        : 0);

    const dayQuestions =
      sortedQuestions.slice(
        currentIndex,
        currentIndex + count,
      );

    currentIndex += count;

    days[dayIndex] =
      createLearningDay(
        dayIndex + 1,
        dayQuestions,
      );
  }

  /*
   * ----------------------------------------------------------
   * 10. Add review days
   * ----------------------------------------------------------
   */

  for (
    let dayIndex = learningDays;
    dayIndex < daysAvailable;
    dayIndex++
  ) {
    days[dayIndex] =
      createReviewDay(
        dayIndex + 1,
        sortedQuestions,
      );
  }

  /*
   * ----------------------------------------------------------
   * 11. Final result
   * ----------------------------------------------------------
   */

  return {
    days_available: daysAvailable,
    days,
  };
};
