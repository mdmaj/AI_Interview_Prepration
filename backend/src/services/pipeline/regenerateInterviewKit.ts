import InterviewKit, {
  type Question,
  type Flashcard,
  type Requirement,
  type QuestionCategory,
  type QuestionDifficulty,
  type ScheduleDay,
} from "../../models/InterviewKit.js";

import { generateCompanyBrief } from "../ai/companyBrief.js";
import { generateQuestions } from "../ai/questionGenerator.js";
import { generateFlashcards } from "../ai/flashcardsGenerator.js";

import { crawlCompany } from "../crawler/index.js";
import { researchInterview } from "../research/interviewResearch.js";

import { runCoveragePipeline } from "./coveragePipeline.js";

import { allocateSchedule } from "../scheduling/scheduleAllocator.js";
import { validateFinalKit } from "../validation/kitValidator.js";

export type RegenerateSection =
  | "company_brief"
  | "questions"
  | "flashcards"
  | "schedule";

interface RegenerateOptions {
  kitId: string;
  userId: string;
  section: RegenerateSection;
  category?: string;
}

const MAX_RESEARCH_CHARS = 60000;

/*
 * ============================================================
 * Types
 * ============================================================
 */

type GeneratedQuestionShape = {
  id?: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: QuestionDifficulty;
};

/*
 * ============================================================
 * Generation Progress
 * ============================================================
 */

const updateGeneration = async (
  kitId: string,
  userId: string,
  progress: number,
  currentStep: string,
): Promise<void> => {
  await InterviewKit.findOneAndUpdate(
    {
      _id: kitId,
      user_id: userId,
    },
    {
      $set: {
        "generation.status": "generating",
        "generation.progress": progress,
        "generation.current_step": currentStep,
        "generation.error": null,
      },
    },
  );
};

/*
 * ============================================================
 * ID Helpers
 * ============================================================
 */

const createQuestionId = (): string => {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const createFlashcardId = (): string => {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

/*
 * ============================================================
 * Text Helpers
 * ============================================================
 */

const normalizeText = (text: string): string => {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
};

/*
 * ============================================================
 * Research Helpers
 * ============================================================
 */

const buildResearchText = (
  pages: Array<{
    url: string;
    title: string;
    text: string;
  }>,
  company: string,
  companyUrl: string,
): string => {
  const fullResearchText = pages
    .map(
      (page) =>
        `URL: ${page.url}\n` +
        `TITLE: ${page.title}\n` +
        `CONTENT: ${page.text}`,
    )
    .join("\n\n");

  if (!fullResearchText.trim()) {
    return `No usable company website content was available.

Company: ${company}

Company website:
${companyUrl}

The company website could not be researched successfully.
Use only the available company name and other research sources.
Do not invent company-specific facts.`;
  }

  return fullResearchText.length > MAX_RESEARCH_CHARS
    ? fullResearchText.slice(0, MAX_RESEARCH_CHARS)
    : fullResearchText;
};

const getCompanyResearch = async (companyUrl: string, company: string) => {
  try {
    const result = await crawlCompany(companyUrl);

    return {
      pages: result.pages,
      failedUrls: result.failedUrls,
    };
  } catch (error) {
    console.error("Regeneration company research failed:", error);

    return {
      pages: [],
      failedUrls: [companyUrl],
    };
  }
};

const getInterviewResearch = async (company: string, role: string) => {
  try {
    return await researchInterview(company, role);
  } catch (error) {
    console.error("Regeneration interview research failed:", error);

    return {
      process: [],
      common_topics: [],
      reported_questions: [],
      sources: [],
      gaps: ["Public interview research could not be completed."],
    };
  }
};

/*
 * ============================================================
 * Question Sanitization
 * ============================================================
 */

const sanitizeGeneratedQuestions = <T extends GeneratedQuestionShape>(
  questions: T[],
  validRequirementIds: Set<string>,
): T[] => {
  const seenPrompts = new Set<string>();

  return questions.filter((question: T) => {
    if (!question.prompt?.trim()) {
      return false;
    }

    if (!question.answer_outline?.trim()) {
      return false;
    }

    const validIds = [
      ...new Set(
        (question.requirement_ids ?? []).filter(
          (id): id is string =>
            typeof id === "string" && validRequirementIds.has(id),
        ),
      ),
    ];

    if (validIds.length === 0) {
      console.warn(
        "Dropping generated question without valid requirement IDs:",
        question.prompt,
      );

      return false;
    }

    const normalizedPrompt = normalizeText(question.prompt);

    if (seenPrompts.has(normalizedPrompt)) {
      console.warn("Dropping duplicate generated question:", question.prompt);

      return false;
    }

    seenPrompts.add(normalizedPrompt);

    question.requirement_ids = validIds;

    return true;
  });
};

/*
 * ============================================================
 * Question Merge
 * ============================================================
 *
 * Edited/pinned questions always win.
 *
 * Preserved questions are inserted first so that a regenerated
 * duplicate never replaces user-owned content.
 * ============================================================
 */

const mergeQuestionsWithoutDuplicates = (
  preservedQuestions: Question[],
  regeneratedQuestions: Question[],
): Question[] => {
  const result: Question[] = [];
  const seenPrompts = new Set<string>();

  const addQuestion = (question: Question): void => {
    const key = normalizeText(question.prompt);

    if (!key || seenPrompts.has(key)) {
      return;
    }

    seenPrompts.add(key);
    result.push(question);
  };

  for (const question of preservedQuestions) {
    addQuestion(question);
  }

  for (const question of regeneratedQuestions) {
    addQuestion(question);
  }

  return result;
};

/*
 * ============================================================
 * Flashcard Merge
 * ============================================================
 */

const mergeFlashcardsWithoutDuplicates = (
  preservedFlashcards: Flashcard[],
  regeneratedFlashcards: Flashcard[],
): Flashcard[] => {
  const result: Flashcard[] = [];
  const seen = new Set<string>();

  const addFlashcard = (flashcard: Flashcard): void => {
    const key =
      `${normalizeText(flashcard.front)}|` + `${normalizeText(flashcard.back)}`;

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(flashcard);
  };

  for (const flashcard of preservedFlashcards) {
    addFlashcard(flashcard);
  }

  for (const flashcard of regeneratedFlashcards) {
    addFlashcard(flashcard);
  }

  return result;
};

/*
 * ============================================================
 * Coverage
 * ============================================================
 */

const calculateFinalCoverage = (
  requirements: Requirement[],
  questions: Question[],
  passes: number,
) => {
  const coveredRequirementIds = new Set<string>();

  for (const question of questions) {
    for (const requirementId of question.requirement_ids) {
      coveredRequirementIds.add(requirementId);
    }
  }

  const uncoveredRequirementIds = requirements
    .filter(
      (requirement: Requirement) => !coveredRequirementIds.has(requirement.id),
    )
    .map((requirement: Requirement) => requirement.id);

  const mustHaveUncovered = requirements
    .filter(
      (requirement: Requirement) =>
        requirement.priority === "must" &&
        uncoveredRequirementIds.includes(requirement.id),
    )
    .map((requirement: Requirement) => requirement.id);

  return {
    uncovered_requirement_ids: uncoveredRequirementIds,
    must_have_uncovered: mustHaveUncovered,
    passes: Math.max(1, passes),
  };
};

/*
 * ============================================================
 * Question Validation
 * ============================================================
 */

const validateQuestions = (
  questions: Question[],
  validRequirementIds: Set<string>,
): void => {
  const seenIds = new Set<string>();
  const seenPrompts = new Set<string>();

  for (const question of questions) {
    if (!question.id?.trim()) {
      throw new Error("A question is missing an ID.");
    }

    if (seenIds.has(question.id)) {
      throw new Error(`Duplicate question ID "${question.id}".`);
    }

    seenIds.add(question.id);

    if (!question.prompt?.trim()) {
      throw new Error(`Question "${question.id}" has an empty prompt.`);
    }

    if (!question.answer_outline?.trim()) {
      throw new Error(`Question "${question.id}" has an empty answer outline.`);
    }

    if (!question.requirement_ids?.length) {
      throw new Error(`Question "${question.id}" has no requirement IDs.`);
    }

    for (const requirementId of question.requirement_ids) {
      if (!validRequirementIds.has(requirementId)) {
        throw new Error(
          `Question "${question.id}" contains invalid requirement ID "${requirementId}".`,
        );
      }
    }

    const promptKey = normalizeText(question.prompt);

    if (seenPrompts.has(promptKey)) {
      throw new Error(
        `Duplicate question prompt detected: "${question.prompt}".`,
      );
    }

    seenPrompts.add(promptKey);

    if (![1, 2, 3].includes(question.difficulty)) {
      throw new Error(`Question "${question.id}" has invalid difficulty.`);
    }
  }
};

/*
 * ============================================================
 * Flashcard Validation
 * ============================================================
 */

const validateFlashcards = (
  flashcards: Flashcard[],
  validRequirementIds: Set<string>,
): void => {
  const seenIds = new Set<string>();
  const seenContent = new Set<string>();

  for (const flashcard of flashcards) {
    if (!flashcard.id?.trim()) {
      throw new Error("A flashcard is missing an ID.");
    }

    if (seenIds.has(flashcard.id)) {
      throw new Error(`Duplicate flashcard ID "${flashcard.id}".`);
    }

    seenIds.add(flashcard.id);

    if (!flashcard.front?.trim()) {
      throw new Error(`Flashcard "${flashcard.id}" has an empty front.`);
    }

    if (!flashcard.back?.trim()) {
      throw new Error(`Flashcard "${flashcard.id}" has an empty back.`);
    }

    if (!flashcard.requirement_ids?.length) {
      throw new Error(`Flashcard "${flashcard.id}" has no requirement IDs.`);
    }

    for (const requirementId of flashcard.requirement_ids) {
      if (!validRequirementIds.has(requirementId)) {
        throw new Error(
          `Flashcard "${flashcard.id}" contains invalid requirement ID "${requirementId}".`,
        );
      }
    }

    const contentKey =
      `${normalizeText(flashcard.front)}|` + `${normalizeText(flashcard.back)}`;

    if (seenContent.has(contentKey)) {
      throw new Error(
        `Duplicate flashcard content detected: "${flashcard.front}".`,
      );
    }

    seenContent.add(contentKey);
  }
};

/*
 * ============================================================
 * Schedule Helpers
 * ============================================================
 */

const cleanScheduleQuestionIds = (
  schedule: {
    days_available: number;
    days: ScheduleDay[];
  },
  questions: Question[],
): {
  days_available: number;
  days: ScheduleDay[];
} => {
  const validQuestionIds = new Set(questions.map((question) => question.id));

  return {
    days_available: schedule.days_available,

    days: schedule.days.map((day) => ({
      ...day,

      question_ids: [
        ...new Set(
          (day.question_ids ?? []).filter((questionId) =>
            validQuestionIds.has(questionId),
          ),
        ),
      ],
    })),
  };
};

/*
 * ------------------------------------------------------------
 * Build generated schedule with model flags
 * ------------------------------------------------------------
 */

const mapGeneratedSchedule = (schedule: {
  days_available: number;
  days: Array<{
    day: number;
    focus: string;
    question_ids: string[];
    minutes: number;
  }>;
}): {
  days_available: number;
  days: ScheduleDay[];
} => {
  return {
    days_available: schedule.days_available,

    days: schedule.days.map((day) => ({
      day: day.day,
      focus: day.focus,
      question_ids: [...day.question_ids],
      minutes: day.minutes,
      is_edited: false,
      is_pinned: false,
    })),
  };
};

/*
 * ------------------------------------------------------------
 * Merge regenerated schedule with user-owned schedule state
 * ------------------------------------------------------------
 *
 * Rules:
 *
 * 1. Edited/pinned days always survive.
 * 2. Untouched days are regenerated.
 * 3. Invalid question IDs are removed.
 * 4. A generated day will not duplicate a question already
 *    assigned to a preserved day where possible.
 * 5. Missing must-have requirement coverage is repaired using
 *    generated/unpreserved days.
 * ------------------------------------------------------------
 */

const mergeSchedulesPreservingUserState = (
  existingSchedule: {
    days_available: number;
    days: ScheduleDay[];
  },
  regeneratedSchedule: {
    days_available: number;
    days: ScheduleDay[];
  },
  questions: Question[],
  requirements: Requirement[],
): {
  days_available: number;
  days: ScheduleDay[];
} => {
  const validQuestionIds = new Set(questions.map((question) => question.id));

  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );

  const existingDaysByNumber = new Map<number, ScheduleDay>();

  for (const day of existingSchedule.days ?? []) {
    existingDaysByNumber.set(day.day, day);
  }

  const generatedDaysByNumber = new Map<number, ScheduleDay>();

  for (const day of regeneratedSchedule.days ?? []) {
    generatedDaysByNumber.set(day.day, day);
  }

  /*
   * ----------------------------------------------------------
   * First preserve edited/pinned days.
   * ----------------------------------------------------------
   */

  const preservedDays = new Map<number, ScheduleDay>();

  for (const day of existingSchedule.days ?? []) {
    if (day.is_edited || day.is_pinned) {
      preservedDays.set(day.day, {
        ...day,
        question_ids: [
          ...new Set(
            (day.question_ids ?? []).filter((questionId) =>
              validQuestionIds.has(questionId),
            ),
          ),
        ],
      });
    }
  }

  /*
   * ----------------------------------------------------------
   * Questions already owned by preserved schedule days.
   * ----------------------------------------------------------
   */

  const assignedQuestionIds = new Set<string>();

  for (const day of preservedDays.values()) {
    for (const questionId of day.question_ids) {
      assignedQuestionIds.add(questionId);
    }
  }

  /*
   * ----------------------------------------------------------
   * Build final days.
   * ----------------------------------------------------------
   */

  const finalDays: ScheduleDay[] = [];

  const totalDays = existingSchedule.days_available;

  for (let dayNumber = 1; dayNumber <= totalDays; dayNumber += 1) {
    const preservedDay = preservedDays.get(dayNumber);

    if (preservedDay) {
      finalDays.push(preservedDay);
      continue;
    }

    const generatedDay = generatedDaysByNumber.get(dayNumber);

    if (!generatedDay) {
      const existingDay = existingDaysByNumber.get(dayNumber);

      if (existingDay) {
        finalDays.push({
          ...existingDay,
          question_ids: [
            ...new Set(
              (existingDay.question_ids ?? []).filter((questionId) =>
                validQuestionIds.has(questionId),
              ),
            ),
          ],
        });
      }

      continue;
    }

    const filteredQuestionIds = [
      ...new Set(
        (generatedDay.question_ids ?? []).filter(
          (questionId) =>
            validQuestionIds.has(questionId) &&
            !assignedQuestionIds.has(questionId),
        ),
      ),
    ];

    for (const questionId of filteredQuestionIds) {
      assignedQuestionIds.add(questionId);
    }

    finalDays.push({
      ...generatedDay,
      question_ids: filteredQuestionIds,
      is_edited: false,
      is_pinned: false,
    });
  }

  /*
   * ----------------------------------------------------------
   * Make sure every expected day exists.
   * ----------------------------------------------------------
   */

  const existingFinalDayNumbers = new Set(finalDays.map((day) => day.day));

  for (let dayNumber = 1; dayNumber <= totalDays; dayNumber += 1) {
    if (existingFinalDayNumbers.has(dayNumber)) {
      continue;
    }

    const generatedDay = generatedDaysByNumber.get(dayNumber);

    if (generatedDay) {
      finalDays.push({
        ...generatedDay,
        is_edited: false,
        is_pinned: false,
      });

      continue;
    }

    finalDays.push({
      day: dayNumber,
      focus: "Interview preparation",
      question_ids: [],
      minutes: 0,
      is_edited: false,
      is_pinned: false,
    });
  }

  finalDays.sort((a, b) => a.day - b.day);

  /*
   * ----------------------------------------------------------
   * Repair missing MUST-HAVE requirement coverage.
   * ----------------------------------------------------------
   *
   * Only unpreserved days are modified.
   * ----------------------------------------------------------
   */

  const scheduledRequirementIds = new Set<string>();

  for (const day of finalDays) {
    for (const questionId of day.question_ids) {
      const question = questionById.get(questionId);

      if (!question) {
        continue;
      }

      for (const requirementId of question.requirement_ids) {
        scheduledRequirementIds.add(requirementId);
      }
    }
  }

  const mustHaveRequirements = requirements.filter(
    (requirement) => requirement.priority === "must",
  );

  const uncoveredMustRequirements = mustHaveRequirements.filter(
    (requirement) => !scheduledRequirementIds.has(requirement.id),
  );

  if (uncoveredMustRequirements.length > 0) {
    const unpreservedDays = finalDays.filter(
      (day) => !day.is_edited && !day.is_pinned,
    );

    for (const requirement of uncoveredMustRequirements) {
      const matchingQuestion = questions.find(
        (question) =>
          question.requirement_ids.includes(requirement.id) &&
          !assignedQuestionIds.has(question.id),
      );

      if (!matchingQuestion) {
        continue;
      }

      const targetDay =
        unpreservedDays.find((day) => day.question_ids.length === 0) ??
        unpreservedDays[unpreservedDays.length - 1];

      if (!targetDay) {
        /*
         * Every day is edited/pinned, so changing the schedule
         * would violate the user's explicit preservation state.
         */
        continue;
      }

      targetDay.question_ids = [...targetDay.question_ids, matchingQuestion.id];

      assignedQuestionIds.add(matchingQuestion.id);

      for (const requirementId of matchingQuestion.requirement_ids) {
        scheduledRequirementIds.add(requirementId);
      }
    }
  }

  /*
   * ----------------------------------------------------------
   * Final question ID cleanup + deduplication.
   * ----------------------------------------------------------
   */

  const seenAcrossSchedule = new Set<string>();

  for (const day of finalDays) {
    const cleanedIds: string[] = [];

    for (const questionId of day.question_ids) {
      if (!validQuestionIds.has(questionId)) {
        continue;
      }

      /*
       * Preserved days are allowed to retain their original
       * question assignments.
       */
      if (day.is_edited || day.is_pinned) {
        cleanedIds.push(questionId);
        continue;
      }

      if (seenAcrossSchedule.has(questionId)) {
        continue;
      }

      seenAcrossSchedule.add(questionId);
      cleanedIds.push(questionId);
    }

    day.question_ids = [...new Set(cleanedIds)];
  }

  return {
    days_available: totalDays,
    days: finalDays.slice(0, totalDays),
  };
};

/*
 * ============================================================
 * Practice Helpers
 * ============================================================
 */

const cleanPracticeForFlashcards = (
  practiceFlashcards: Array<{
    flashcard_id: string;
    confidence: "low" | "medium" | "high";
    is_covered: boolean;
  }>,
  flashcards: Flashcard[],
) => {
  const validFlashcardIds = new Set(
    flashcards.map((flashcard) => flashcard.id),
  );

  const seen = new Set<string>();

  return practiceFlashcards.filter((practice) => {
    if (!validFlashcardIds.has(practice.flashcard_id)) {
      return false;
    }

    if (seen.has(practice.flashcard_id)) {
      return false;
    }

    seen.add(practice.flashcard_id);

    return true;
  });
};

/*
 * ============================================================
 * Final Candidate Validation
 * ============================================================
 */

const validateCandidateKit = (
  candidate: {
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
      is_edited?: boolean;
      is_pinned?: boolean;
    };

    role: {
      title: string;
      seniority: string;
      responsibilities: string[];
      requirements: Requirement[];
    };

    questions: Question[];

    flashcards: Flashcard[];

    schedule: {
      days_available: number;
      days: ScheduleDay[];
    };

    coverage: {
      uncovered_requirement_ids: string[];
      passes: number;
    };
  },
  expectedDays: number,
): void => {
  const validation = validateFinalKit(candidate, expectedDays);

  if (!validation.is_valid) {
    throw new Error(
      `Regenerated kit validation failed: ${validation.errors.join(" | ")}`,
    );
  }
};

/*
 * ============================================================
 * Main Regeneration Service
 * ============================================================
 */

export const regenerateInterviewKit = async ({
  kitId,
  userId,
  section,
  category,
}: RegenerateOptions): Promise<void> => {
  try {
    /*
     * --------------------------------------------------
     * LOAD KIT
     * --------------------------------------------------
     */

    const kit = await InterviewKit.findOne({
      _id: kitId,
      user_id: userId,
    });

    if (!kit) {
      throw new Error("Interview kit not found");
    }

    console.log(`\n🔄 Regenerating ${section} for kit: ${kitId}`);

    await updateGeneration(
      kitId,
      userId,
      10,
      `Starting ${section} regeneration`,
    );

    /*
     * --------------------------------------------------
     * CREATE WORKING STATE
     * --------------------------------------------------
     */

    let candidateQuestions: Question[] = [...(kit.questions ?? [])];

    let candidateFlashcards: Flashcard[] = [...(kit.flashcards ?? [])];

    let candidateSchedule = cleanScheduleQuestionIds(
      {
        days_available: kit.schedule.days_available,
        days: kit.schedule.days ?? [],
      },
      candidateQuestions,
    );

    let candidateCoverage = {
      uncovered_requirement_ids: [
        ...(kit.coverage.uncovered_requirement_ids ?? []),
      ],
      passes: kit.coverage.passes ?? 0,
    };

    /*
     * IMPORTANT:
     *
     * Preserve company brief edit/pin metadata.
     */

    let candidateCompanyBrief = {
      summary: kit.company_brief.summary,
      what_they_do: kit.company_brief.what_they_do,
      sources: [...(kit.company_brief.sources ?? [])],
      is_edited: Boolean(kit.company_brief.is_edited),
      is_pinned: Boolean(kit.company_brief.is_pinned),
    };

    let candidatePagesUsed = [...(kit.source.pages_used ?? [])];

    let candidateResearchedAt = kit.source.researched_at;

    let candidatePracticeFlashcards = [...(kit.practice?.flashcards ?? [])];

    /*
     * --------------------------------------------------
     * VALID REQUIREMENT IDS
     * --------------------------------------------------
     */

    const validRequirementIds = new Set<string>(
      kit.role.requirements.map((requirement: Requirement) => requirement.id),
    );

    /*
     * --------------------------------------------------
     * COMPANY RESEARCH
     * --------------------------------------------------
     */

    let companyResearch = {
      pages: [] as Array<{
        url: string;
        title: string;
        text: string;
      }>,

      failedUrls: [] as string[],
    };

    const needsCompanyResearch =
      section === "company_brief" || section === "questions";

    if (needsCompanyResearch) {
      await updateGeneration(kitId, userId, 25, "Researching company website");

      companyResearch = await getCompanyResearch(
        kit.source.company_url,
        kit.source.company,
      );

      if (companyResearch.pages.length > 0) {
        candidatePagesUsed = companyResearch.pages.map((page) => page.url);

        candidateResearchedAt = new Date().toISOString();
      }
    }

    /*
     * ==================================================
     * COMPANY BRIEF
     * ==================================================
     */

    if (section === "company_brief") {
      await updateGeneration(kitId, userId, 50, "Regenerating company brief");

      const researchText = buildResearchText(
        companyResearch.pages,
        kit.source.company,
        kit.source.company_url,
      );

      const generatedBrief = await generateCompanyBrief(
        kit.source.company,
        researchText,
        candidatePagesUsed,
      );

      /*
       * ------------------------------------------------
       * USER-OWNED COMPANY BRIEF PROTECTION
       * ------------------------------------------------
       *
       * If the user edited or pinned the brief, do not
       * overwrite their content.
       *
       * Research metadata can still be refreshed.
       * ------------------------------------------------
       */

      if (!kit.company_brief.is_edited && !kit.company_brief.is_pinned) {
        candidateCompanyBrief = {
          summary: generatedBrief.summary.trim(),
          what_they_do: generatedBrief.what_they_do.trim(),
          sources:
            generatedBrief.sources.length > 0
              ? [...generatedBrief.sources]
              : [...candidatePagesUsed],

          is_edited: false,
          is_pinned: false,
        };
      } else {
        candidateCompanyBrief = {
          summary: kit.company_brief.summary,
          what_they_do: kit.company_brief.what_they_do,
          sources: [...(kit.company_brief.sources ?? [])],
          is_edited: Boolean(kit.company_brief.is_edited),
          is_pinned: Boolean(kit.company_brief.is_pinned),
        };
      }
    }

    /*
     * ==================================================
     * QUESTIONS
     * ==================================================
     */

    if (section === "questions") {
      if (kit.role.requirements.length === 0) {
        throw new Error(
          "Cannot regenerate questions without role requirements.",
        );
      }

      await updateGeneration(
        kitId,
        userId,
        40,
        "Researching public interview experiences",
      );

      const interviewResearch = await getInterviewResearch(
        kit.source.company,
        kit.role.title,
      );

      await updateGeneration(
        kitId,
        userId,
        55,
        "Regenerating interview questions",
      );

      const researchText = buildResearchText(
        companyResearch.pages,
        kit.source.company,
        kit.source.company_url,
      );

      /*
       * Use current company brief as context.
       */

      let workingCompanyBrief = {
        summary: candidateCompanyBrief.summary,
        what_they_do: candidateCompanyBrief.what_they_do,
        sources: [...candidateCompanyBrief.sources],
      };

      /*
       * If company brief is empty, generate a temporary one.
       * This temporary brief is NOT saved as the company brief.
       */

      if (
        !workingCompanyBrief.summary.trim() &&
        !workingCompanyBrief.what_they_do.trim()
      ) {
        const generatedBrief = await generateCompanyBrief(
          kit.source.company,
          researchText,
          candidatePagesUsed,
        );

        workingCompanyBrief = {
          summary: generatedBrief.summary.trim(),
          what_they_do: generatedBrief.what_they_do.trim(),
          sources:
            generatedBrief.sources.length > 0
              ? [...generatedBrief.sources]
              : [...candidatePagesUsed],
        };
      }

      /*
       * --------------------------------------------------
       * GENERATE QUESTIONS
       * --------------------------------------------------
       */

      const generatedQuestions = await generateQuestions(
        kit.role.title,
        kit.role.requirements,
        workingCompanyBrief,
        interviewResearch,
      );

      /*
       * --------------------------------------------------
       * FIRST SANITIZATION
       * --------------------------------------------------
       */

      const sanitizedQuestions = sanitizeGeneratedQuestions(
        generatedQuestions,
        validRequirementIds,
      );

      if (sanitizedQuestions.length === 0) {
        throw new Error("Question regeneration produced no valid questions.");
      }

      /*
       * --------------------------------------------------
       * ASSIGN TEMPORARY IDS
       * --------------------------------------------------
       */

      const questionsWithIds: Question[] = sanitizedQuestions.map(
        (question): Question => ({
          ...question,
          id: question.id?.trim() || createQuestionId(),
          is_edited: false,
          is_pinned: false,
        }),
      );

      await updateGeneration(
        kitId,
        userId,
        70,
        "Checking regenerated question coverage",
      );

      /*
       * --------------------------------------------------
       * COVERAGE PIPELINE
       * --------------------------------------------------
       */

      const coverageResult = await runCoveragePipeline(
        kit.role.title,
        kit.role.requirements,
        questionsWithIds,
        workingCompanyBrief,
        interviewResearch,
      );

      /*
       * --------------------------------------------------
       * SECOND SANITIZATION
       * --------------------------------------------------
       */

      const coveredQuestions = sanitizeGeneratedQuestions(
        coverageResult.questions,
        validRequirementIds,
      );

      if (coveredQuestions.length === 0) {
        throw new Error("Coverage pipeline produced no valid questions.");
      }

      /*
       * --------------------------------------------------
       * FINAL GENERATED QUESTIONS
       * --------------------------------------------------
       */

      const generatedFinalQuestions: Question[] = coveredQuestions.map(
        (question): Question => ({
          ...question,
          id: question.id?.trim() || createQuestionId(),
          is_edited: false,
          is_pinned: false,
        }),
      );

      const existingQuestions = kit.questions ?? [];

      let preservedQuestions: Question[] = [];
      let regeneratedQuestions = generatedFinalQuestions;

      /*
       * ==================================================
       * CATEGORY REGENERATION
       * ==================================================
       */

      if (category?.trim()) {
        const normalizedCategory = normalizeText(category);

        const existingCategoryQuestions = existingQuestions.filter(
          (question: Question) =>
            normalizeText(question.category) === normalizedCategory,
        );

        /*
         * Preserve:
         *
         * 1. All questions outside selected category.
         * 2. Edited questions in selected category.
         * 3. Pinned questions in selected category.
         */

        preservedQuestions = existingQuestions.filter(
          (question: Question) =>
            normalizeText(question.category) !== normalizedCategory ||
            question.is_edited ||
            question.is_pinned,
        );

        /*
         * Only replace the selected category.
         */

        regeneratedQuestions = generatedFinalQuestions.filter(
          (question: Question) =>
            normalizeText(question.category) === normalizedCategory,
        );

        /*
         * If AI does not produce this category but an
         * existing category exists, retain the old category.
         */

        if (
          regeneratedQuestions.length === 0 &&
          existingCategoryQuestions.length > 0
        ) {
          preservedQuestions = [...existingQuestions];
          regeneratedQuestions = [];
        }

        /*
         * If category did not previously exist and AI
         * produced nothing, fail safely.
         */

        if (
          regeneratedQuestions.length === 0 &&
          existingCategoryQuestions.length === 0
        ) {
          throw new Error(
            `Question regeneration produced no questions for category "${category}".`,
          );
        }
      } else {
        /*
         * ==================================================
         * FULL QUESTION REGENERATION
         * ==================================================
         *
         * Only edited/pinned questions survive.
         */

        preservedQuestions = existingQuestions.filter(
          (question: Question) => question.is_edited || question.is_pinned,
        );
      }

      /*
       * --------------------------------------------------
       * MERGE
       * --------------------------------------------------
       */

      const finalQuestions = mergeQuestionsWithoutDuplicates(
        preservedQuestions,
        regeneratedQuestions,
      );

      if (finalQuestions.length === 0) {
        throw new Error("Regeneration resulted in an empty question set.");
      }

      /*
       * --------------------------------------------------
       * VALIDATE QUESTIONS
       * --------------------------------------------------
       */

      validateQuestions(finalQuestions, validRequirementIds);

      /*
       * --------------------------------------------------
       * FINAL COVERAGE
       * --------------------------------------------------
       */

      const finalCoverage = calculateFinalCoverage(
        kit.role.requirements,
        finalQuestions,
        coverageResult.passes,
      );

      if (finalCoverage.must_have_uncovered.length > 0) {
        throw new Error(
          `Coverage incomplete after ${coverageResult.passes} passes. ` +
            `Uncovered MUST-HAVE requirements: ` +
            finalCoverage.must_have_uncovered.join(", "),
        );
      }

      /*
       * --------------------------------------------------
       * REBUILD / MERGE SCHEDULE
       * --------------------------------------------------
       */

      await updateGeneration(
        kitId,
        userId,
        80,
        "Rebuilding schedule for regenerated questions",
      );

      const regeneratedScheduleRaw = allocateSchedule(
        kit.schedule.days_available,
        kit.role.requirements,
        finalQuestions,
      );

      const regeneratedSchedule = mapGeneratedSchedule(regeneratedScheduleRaw);

      candidateQuestions = finalQuestions;

      candidateCoverage = {
        uncovered_requirement_ids: [...finalCoverage.uncovered_requirement_ids],
        passes: finalCoverage.passes,
      };

      /*
       * IMPORTANT:
       *
       * Do not simply replace the entire schedule.
       * Preserve edited/pinned days.
       */

      candidateSchedule = mergeSchedulesPreservingUserState(
        kit.schedule,
        regeneratedSchedule,
        finalQuestions,
        kit.role.requirements,
      );
    }

    /*
     * ==================================================
     * FLASHCARDS
     * ==================================================
     */

    if (section === "flashcards") {
      if (kit.questions.length === 0) {
        throw new Error("Cannot regenerate flashcards without questions.");
      }

      await updateGeneration(
        kitId,
        userId,
        55,
        "Regenerating interview flashcards",
      );

      const newFlashcards = await generateFlashcards(
        kit.role.title,
        kit.role.requirements,
        kit.questions,
      );

      const seenContent = new Set<string>();

      const regeneratedFlashcards = newFlashcards
        .map<Flashcard | null>((flashcard) => {
          if (!flashcard.front?.trim() || !flashcard.back?.trim()) {
            return null;
          }

          const validIds = [
            ...new Set(
              (flashcard.requirement_ids ?? []).filter(
                (id): id is string =>
                  typeof id === "string" && validRequirementIds.has(id),
              ),
            ),
          ];

          if (validIds.length === 0) {
            return null;
          }

          const contentKey =
            `${normalizeText(flashcard.front)}|` +
            `${normalizeText(flashcard.back)}`;

          if (seenContent.has(contentKey)) {
            return null;
          }

          seenContent.add(contentKey);

          return {
            ...flashcard,
            requirement_ids: validIds,
            id: createFlashcardId(),
            is_edited: false,
            is_pinned: false,
          } satisfies Flashcard;
        })
        .filter((flashcard): flashcard is Flashcard => flashcard !== null);

      if (regeneratedFlashcards.length === 0) {
        throw new Error("Flashcard regeneration produced no valid flashcards.");
      }

      const existingFlashcards = kit.flashcards ?? [];

      /*
       * Only edited/pinned flashcards survive.
       */

      const preservedFlashcards = existingFlashcards.filter(
        (flashcard: Flashcard) => flashcard.is_edited || flashcard.is_pinned,
      );

      const finalFlashcards = mergeFlashcardsWithoutDuplicates(
        preservedFlashcards,
        regeneratedFlashcards,
      );

      validateFlashcards(finalFlashcards, validRequirementIds);

      /*
       * Preserve practice state for flashcards that
       * still exist.
       */

      candidatePracticeFlashcards = cleanPracticeForFlashcards(
        candidatePracticeFlashcards,
        finalFlashcards,
      );

      candidateFlashcards = finalFlashcards;
    }

    /*
     * ==================================================
     * SCHEDULE
     * ==================================================
     */

    if (section === "schedule") {
      if (kit.questions.length === 0) {
        throw new Error("Cannot regenerate schedule without questions.");
      }

      await updateGeneration(
        kitId,
        userId,
        60,
        "Regenerating interview preparation schedule",
      );

      const regeneratedScheduleRaw = allocateSchedule(
        kit.schedule.days_available,
        kit.role.requirements,
        kit.questions,
      );

      const regeneratedSchedule = mapGeneratedSchedule(regeneratedScheduleRaw);

      candidateSchedule = mergeSchedulesPreservingUserState(
        kit.schedule,
        regeneratedSchedule,
        kit.questions,
        kit.role.requirements,
      );
    }

    /*
     * ==================================================
     * FINAL CLEANUP
     * ==================================================
     */

    candidateSchedule = cleanScheduleQuestionIds(
      candidateSchedule,
      candidateQuestions,
    );

    /*
     * Remove stale practice records.
     */

    candidatePracticeFlashcards = cleanPracticeForFlashcards(
      candidatePracticeFlashcards,
      candidateFlashcards,
    );

    /*
     * ==================================================
     * FINAL VALIDATION
     * ==================================================
     */

    await updateGeneration(
      kitId,
      userId,
      90,
      "Validating regenerated interview kit",
    );

    const candidate = {
      source: {
        company: kit.source.company,
        company_url: kit.source.company_url,
        role: kit.source.role,
        location: kit.source.location,
        jd_chars: kit.source.jd_chars,
        researched_at: candidateResearchedAt,
        pages_used: candidatePagesUsed,
      },

      company_brief: candidateCompanyBrief,

      role: {
        title: kit.role.title,
        seniority: kit.role.seniority,
        responsibilities: [...kit.role.responsibilities],
        requirements: kit.role.requirements,
      },

      questions: candidateQuestions,

      flashcards: candidateFlashcards,

      schedule: candidateSchedule,

      coverage: candidateCoverage,
    };

    validateCandidateKit(candidate, kit.schedule.days_available);

    /*
     * ==================================================
     * FINAL CONTENT SAVE
     * ==================================================
     */

    await updateGeneration(kitId, userId, 95, "Saving validated interview kit");

    const updatedKit = await InterviewKit.findOneAndUpdate(
      {
        _id: kitId,
        user_id: userId,
      },
      {
        $set: {
          company_brief: candidateCompanyBrief,

          questions: candidateQuestions,

          flashcards: candidateFlashcards,

          practice: {
            flashcards: candidatePracticeFlashcards,
          },

          schedule: candidateSchedule,

          coverage: candidateCoverage,

          "source.pages_used": candidatePagesUsed,

          "source.researched_at": candidateResearchedAt,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedKit) {
      throw new Error("Interview kit disappeared before final save.");
    }

    /*
     * ==================================================
     * COMPLETED
     * ==================================================
     */

    await InterviewKit.findOneAndUpdate(
      {
        _id: kitId,
        user_id: userId,
      },
      {
        $set: {
          "generation.status": "completed",
          "generation.progress": 100,
          "generation.current_step": `${section} regenerated successfully`,
          "generation.error": null,
        },
      },
    );

    console.log(`\n✅ ${section} regeneration completed: ${kitId}`);
  } catch (error) {
    console.error(`\n❌ ${section} regeneration failed for ${kitId}:`, error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown regeneration error";

    await InterviewKit.findOneAndUpdate(
      {
        _id: kitId,
        user_id: userId,
      },
      {
        $set: {
          "generation.status": "failed",
          "generation.progress": 0,
          "generation.current_step": "Regeneration failed",
          "generation.error": errorMessage,
        },
      },
    );

    throw error;
  }
};
