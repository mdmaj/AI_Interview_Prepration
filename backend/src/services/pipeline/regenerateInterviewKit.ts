import InterviewKit, {
  type Question,
  type Flashcard,
  type Requirement,
  type QuestionCategory,
  type QuestionDifficulty,
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

type GeneratedQuestionShape = {
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: QuestionDifficulty;
};

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

const createQuestionId = (): string => {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const createFlashcardId = (): string => {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeText = (text: string): string => {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
};

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

/**
 * Sanitize generated questions while preserving their
 * original type and, when present, their ID.
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

/**
 * Merge preserved user content with regenerated content.
 *
 * Preserved questions always win when the prompt is duplicated.
 */
const mergeQuestionsWithoutDuplicates = (
  preservedQuestions: Question[],
  regeneratedQuestions: Question[],
): Question[] => {
  const result: Question[] = [];
  const seenPrompts = new Set<string>();

  for (const question of preservedQuestions) {
    const key = normalizeText(question.prompt);

    if (!key || seenPrompts.has(key)) {
      continue;
    }

    seenPrompts.add(key);
    result.push(question);
  }

  for (const question of regeneratedQuestions) {
    const key = normalizeText(question.prompt);

    if (!key || seenPrompts.has(key)) {
      continue;
    }

    seenPrompts.add(key);
    result.push(question);
  }

  return result;
};

/**
 * Merge preserved user flashcards with regenerated flashcards.
 *
 * Preserved flashcards always win when front/back are duplicated.
 */
const mergeFlashcardsWithoutDuplicates = (
  preservedFlashcards: Flashcard[],
  regeneratedFlashcards: Flashcard[],
): Flashcard[] => {
  const result: Flashcard[] = [];
  const seen = new Set<string>();

  for (const flashcard of preservedFlashcards) {
    const key =
      `${normalizeText(flashcard.front)}|` + `${normalizeText(flashcard.back)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(flashcard);
  }

  for (const flashcard of regeneratedFlashcards) {
    const key =
      `${normalizeText(flashcard.front)}|` + `${normalizeText(flashcard.back)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(flashcard);
  }

  return result;
};

/**
 * Calculate coverage from the FINAL question set.
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

/**
 * Regenerate one section of an existing interview kit.
 *
 * Important:
 * - Only the selected content is regenerated.
 * - User-edited content is preserved.
 * - User-pinned content is preserved.
 * - When questions are regenerated, the dependent schedule is
 *   rebuilt from the FINAL question IDs so the kit remains valid.
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
     * VALID REQUIREMENT IDS
     * --------------------------------------------------
     */

    const validRequirementIds: Set<string> = new Set<string>(
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
    }

    const pagesUsed = companyResearch.pages.map((page) => page.url);

    /*
     * --------------------------------------------------
     * COMPANY BRIEF
     * --------------------------------------------------
     */

    if (section === "company_brief") {
      await updateGeneration(kitId, userId, 50, "Regenerating company brief");

      const researchText = buildResearchText(
        companyResearch.pages,
        kit.source.company,
        kit.source.company_url,
      );

      const companyBrief = await generateCompanyBrief(
        kit.source.company,
        researchText,
      );

      await InterviewKit.findOneAndUpdate(
        {
          _id: kitId,
          user_id: userId,
        },
        {
          $set: {
            "company_brief.summary": companyBrief.summary,

            "company_brief.what_they_do": companyBrief.what_they_do,

            "company_brief.sources":
              companyBrief.sources.length > 0
                ? companyBrief.sources
                : pagesUsed,

            "source.pages_used":
              pagesUsed.length > 0 ? pagesUsed : kit.source.pages_used,

            "source.researched_at": new Date().toISOString(),
          },
        },
      );
    }

    /*
     * --------------------------------------------------
     * QUESTIONS
     * --------------------------------------------------
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

      let companyBrief = {
        summary: kit.company_brief.summary,

        what_they_do: kit.company_brief.what_they_do,

        sources:
          kit.company_brief.sources.length > 0
            ? kit.company_brief.sources
            : pagesUsed,
      };

      if (!companyBrief.summary.trim() && !companyBrief.what_they_do.trim()) {
        companyBrief = await generateCompanyBrief(
          kit.source.company,
          researchText,
        );
      }

      /*
       * --------------------------------------------------
       * GENERATE QUESTIONS
       * --------------------------------------------------
       */

      const generatedQuestions = await generateQuestions(
        kit.role.title,
        kit.role.requirements,
        companyBrief,
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
       * Newly generated questions need IDs before
       * entering the coverage pipeline.
       */

      const questionsWithIds: Question[] = sanitizedQuestions.map(
        (question): Question => ({
          ...question,
          id: createQuestionId(),
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
        companyBrief,
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
       * coverageResult.questions already contain IDs.
       * Preserve them instead of creating another ID.
       */

      const generatedFinalQuestions: Question[] = coveredQuestions.map(
        (question): Question => ({
          ...question,
          id:
            "id" in question && typeof question.id === "string"
              ? question.id
              : createQuestionId(),
          is_edited: false,
          is_pinned: false,
        }),
      );

      const existingQuestions = kit.questions ?? [];

      let preservedQuestions: Question[] = [];
      let regeneratedQuestions: Question[] = generatedFinalQuestions;

      /*
       * --------------------------------------------------
       * CATEGORY-SPECIFIC REGENERATION
       * --------------------------------------------------
       */

      if (category?.trim()) {
        const normalizedCategory = normalizeText(category);

        const existingCategoryQuestions = existingQuestions.filter(
          (question: Question) =>
            normalizeText(question.category) === normalizedCategory,
        );

        /*
         * Keep:
         * - all questions from other categories
         * - edited questions
         * - pinned questions
         */

        preservedQuestions = existingQuestions.filter(
          (question: Question) =>
            normalizeText(question.category) !== normalizedCategory ||
            question.is_edited ||
            question.is_pinned,
        );

        /*
         * Only insert newly generated questions
         * belonging to the requested category.
         */

        regeneratedQuestions = generatedFinalQuestions.filter(
          (question: Question) =>
            normalizeText(question.category) === normalizedCategory,
        );

        /*
         * If AI failed to generate this category,
         * preserve the existing category instead of
         * deleting it.
         */

        if (
          regeneratedQuestions.length === 0 &&
          existingCategoryQuestions.length > 0
        ) {
          preservedQuestions = [...existingQuestions];

          regeneratedQuestions = [];
        }

        /*
         * If there was no existing category and AI
         * generated nothing for it, fail clearly.
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
         * ------------------------------------------------
         * FULL QUESTION REGENERATION
         * ------------------------------------------------
         *
         * Keep only edited/pinned questions.
         * Replace untouched AI-generated questions.
         */

        preservedQuestions = existingQuestions.filter(
          (question: Question) => question.is_edited || question.is_pinned,
        );
      }

      /*
       * --------------------------------------------------
       * MERGE QUESTIONS
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
       * FINAL QUESTION VALIDATION
       * --------------------------------------------------
       */

      for (const question of finalQuestions) {
        if (
          !question.requirement_ids ||
          question.requirement_ids.length === 0
        ) {
          throw new Error(`Question "${question.id}" has no requirement IDs.`);
        }

        const hasInvalidRequirement = question.requirement_ids.some(
          (requirementId: string) => !validRequirementIds.has(requirementId),
        );

        if (hasInvalidRequirement) {
          throw new Error(
            `Question "${question.id}" contains an invalid requirement ID.`,
          );
        }

        if (!question.prompt.trim()) {
          throw new Error(`Question "${question.id}" has an empty prompt.`);
        }

        if (!question.answer_outline.trim()) {
          throw new Error(
            `Question "${question.id}" has an empty answer outline.`,
          );
        }
      }

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
       * REBUILD SCHEDULE FROM FINAL QUESTIONS
       * --------------------------------------------------
       *
       * IMPORTANT FIX:
       *
       * Question regeneration creates new question IDs.
       * Therefore the previous schedule can contain stale
       * IDs such as q1, q2, q3, q4, q5.
       *
       * Rebuilding the schedule here guarantees that every
       * schedule.question_ids value belongs to finalQuestions.
       */

      await updateGeneration(
        kitId,
        userId,
        80,
        "Rebuilding schedule for regenerated questions",
      );

      const regeneratedSchedule = allocateSchedule(
        kit.schedule.days_available,
        kit.role.requirements,
        finalQuestions,
      );

      /*
       * --------------------------------------------------
       * SAVE QUESTIONS + COVERAGE + SCHEDULE AT ONCE
       * --------------------------------------------------
       *
       * This keeps the dependent data synchronized.
       */

      await InterviewKit.findOneAndUpdate(
        {
          _id: kitId,
          user_id: userId,
        },
        {
          $set: {
            questions: finalQuestions,

            coverage: {
              uncovered_requirement_ids:
                finalCoverage.uncovered_requirement_ids,

              passes: finalCoverage.passes,
            },

            schedule: regeneratedSchedule,

            "source.pages_used":
              pagesUsed.length > 0 ? pagesUsed : kit.source.pages_used,

            "source.researched_at": new Date().toISOString(),
          },
        },
      );
    }

    /*
     * --------------------------------------------------
     * FLASHCARDS
     * --------------------------------------------------
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

      const preservedFlashcards = existingFlashcards.filter(
        (flashcard: Flashcard) => flashcard.is_edited || flashcard.is_pinned,
      );

      const finalFlashcards = mergeFlashcardsWithoutDuplicates(
        preservedFlashcards,
        regeneratedFlashcards,
      );

      await InterviewKit.findOneAndUpdate(
        {
          _id: kitId,
          user_id: userId,
        },
        {
          $set: {
            flashcards: finalFlashcards,
          },
        },
      );
    }

    /*
     * --------------------------------------------------
     * SCHEDULE
     * --------------------------------------------------
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

      const schedule = allocateSchedule(
        kit.schedule.days_available,
        kit.role.requirements,
        kit.questions,
      );

      await InterviewKit.findOneAndUpdate(
        {
          _id: kitId,
          user_id: userId,
        },
        {
          $set: {
            schedule,
          },
        },
      );
    }

    /*
     * --------------------------------------------------
     * FINAL VALIDATION
     * --------------------------------------------------
     */

    await updateGeneration(
      kitId,
      userId,
      90,
      "Validating regenerated interview kit",
    );

    const latestKit = await InterviewKit.findOne({
      _id: kitId,
      user_id: userId,
    });

    if (!latestKit) {
      throw new Error("Interview kit disappeared during regeneration.");
    }

    const validation = validateFinalKit(
      {
        source: {
          company: latestKit.source.company,

          company_url: latestKit.source.company_url,

          role: latestKit.source.role,

          location: latestKit.source.location,

          jd_chars: latestKit.source.jd_chars,

          researched_at: latestKit.source.researched_at,

          pages_used: latestKit.source.pages_used,
        },

        company_brief: {
          summary: latestKit.company_brief.summary,

          what_they_do: latestKit.company_brief.what_they_do,

          sources: latestKit.company_brief.sources,
        },

        role: {
          title: latestKit.role.title,

          seniority: latestKit.role.seniority,

          responsibilities: latestKit.role.responsibilities,

          requirements: latestKit.role.requirements,
        },

        questions: latestKit.questions,

        flashcards: latestKit.flashcards,

        schedule: latestKit.schedule,

        coverage: latestKit.coverage,
      },
      latestKit.schedule.days_available,
    );

    if (!validation.is_valid) {
      throw new Error(
        `Regenerated kit validation failed: ${validation.errors.join(" | ")}`,
      );
    }

    /*
     * --------------------------------------------------
     * COMPLETED
     * --------------------------------------------------
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
