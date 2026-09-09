import { Response } from "express";
import InterviewKit, {
  type Flashcard,
  type PracticeFlashcard,
  type Question,
  type Requirement,
  type ScheduleDay,
} from "../models/InterviewKit.js";
import { AuthRequest } from "../middleware/authMiddleware.js";
import { generateInterviewKit } from "../services/pipeline/generateInterviewKit.js";
import {
  regenerateInterviewKit,
  type RegenerateSection,
} from "../services/pipeline/regenerateInterviewKit.js";

/*
 * ============================================================
 * Helpers
 * ============================================================
 */

const getKitId = (req: AuthRequest): string => {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
};

const isValidDays = (value: unknown): value is number => {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 60
  );
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === "string" && value.trim().length > 0;
};

const isValidDifficulty = (value: unknown): value is 1 | 2 | 3 => {
  return value === 1 || value === 2 || value === 3;
};

const isBooleanOrUndefined = (value: unknown): value is boolean | undefined => {
  return value === undefined || typeof value === "boolean";
};

const stringArraysEqual = (first: string[], second: string[]): boolean => {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((value, index) => value === second[index]);
};

/*
 * ============================================================
 * Requirement validation
 * ============================================================
 */

const validateRequirements = (
  requirements: unknown,
): requirements is Requirement[] => {
  if (!Array.isArray(requirements)) {
    return false;
  }

  const requirementIds = new Set<string>();

  for (const requirement of requirements) {
    if (typeof requirement !== "object" || requirement === null) {
      return false;
    }

    const item = requirement as Record<string, unknown>;

    if (!isNonEmptyString(item.id) || !isNonEmptyString(item.text)) {
      return false;
    }

    /*
     * IMPORTANT:
     * InterviewKit model supports:
     * technical | behavioral | other
     *
     * "domain" was previously accepted here but is not
     * supported by the Mongoose schema.
     */
    if (
      item.kind !== "technical" &&
      item.kind !== "behavioral" &&
      item.kind !== "other"
    ) {
      return false;
    }

    if (item.priority !== "must" && item.priority !== "nice") {
      return false;
    }

    if (requirementIds.has(item.id)) {
      return false;
    }

    requirementIds.add(item.id);
  }

  return true;
};

/*
 * ============================================================
 * Question validation
 * ============================================================
 */

const validateQuestions = (
  questions: unknown,
  requirementIds: Set<string>,
): questions is Question[] => {
  if (!Array.isArray(questions)) {
    return false;
  }

  const questionIds = new Set<string>();

  for (const question of questions) {
    if (typeof question !== "object" || question === null) {
      return false;
    }

    const item = question as Record<string, unknown>;

    if (
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.prompt) ||
      !isNonEmptyString(item.answer_outline)
    ) {
      return false;
    }

    if (
      !Array.isArray(item.requirement_ids) ||
      item.requirement_ids.length === 0
    ) {
      return false;
    }

    if (!isNonEmptyString(item.category)) {
      return false;
    }

    if (!isValidDifficulty(item.difficulty)) {
      return false;
    }

    if (!isBooleanOrUndefined(item.is_edited)) {
      return false;
    }

    if (!isBooleanOrUndefined(item.is_pinned)) {
      return false;
    }

    if (questionIds.has(item.id)) {
      return false;
    }

    questionIds.add(item.id);

    for (const requirementId of item.requirement_ids) {
      if (
        typeof requirementId !== "string" ||
        !requirementIds.has(requirementId)
      ) {
        return false;
      }
    }
  }

  return true;
};

/*
 * ============================================================
 * Flashcard validation
 * ============================================================
 */

const validateFlashcards = (
  flashcards: unknown,
  requirementIds: Set<string>,
): flashcards is Flashcard[] => {
  if (!Array.isArray(flashcards)) {
    return false;
  }

  const flashcardIds = new Set<string>();

  for (const flashcard of flashcards) {
    if (typeof flashcard !== "object" || flashcard === null) {
      return false;
    }

    const item = flashcard as Record<string, unknown>;

    if (
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.front) ||
      !isNonEmptyString(item.back)
    ) {
      return false;
    }

    if (!Array.isArray(item.requirement_ids)) {
      return false;
    }

    if (!isBooleanOrUndefined(item.is_edited)) {
      return false;
    }

    if (!isBooleanOrUndefined(item.is_pinned)) {
      return false;
    }

    if (flashcardIds.has(item.id)) {
      return false;
    }

    flashcardIds.add(item.id);

    for (const requirementId of item.requirement_ids) {
      if (
        typeof requirementId !== "string" ||
        !requirementIds.has(requirementId)
      ) {
        return false;
      }
    }
  }

  return true;
};

/*
 * ============================================================
 * Company brief validation
 * ============================================================
 */

const validateCompanyBrief = (
  companyBrief: unknown,
): companyBrief is {
  summary: string;
  what_they_do: string;
  sources: string[];
  is_edited?: boolean;
  is_pinned?: boolean;
} => {
  if (typeof companyBrief !== "object" || companyBrief === null) {
    return false;
  }

  const item = companyBrief as Record<string, unknown>;

  if (!isNonEmptyString(item.summary) || !isNonEmptyString(item.what_they_do)) {
    return false;
  }

  if (!Array.isArray(item.sources)) {
    return false;
  }

  if (!item.sources.every((source) => typeof source === "string")) {
    return false;
  }

  if (!isBooleanOrUndefined(item.is_edited)) {
    return false;
  }

  if (!isBooleanOrUndefined(item.is_pinned)) {
    return false;
  }

  return true;
};

/*
 * ============================================================
 * Schedule validation
 * ============================================================
 */

const validateSchedule = (
  schedule: unknown,
  daysAvailable: number,
  questionIds: Set<string>,
): schedule is {
  days_available: number;
  days: ScheduleDay[];
} => {
  if (typeof schedule !== "object" || schedule === null) {
    return false;
  }

  const item = schedule as Record<string, unknown>;

  if (item.days_available !== daysAvailable) {
    return false;
  }

  if (!Array.isArray(item.days)) {
    return false;
  }

  if (item.days.length !== daysAvailable) {
    return false;
  }

  for (let index = 0; index < item.days.length; index += 1) {
    const day = item.days[index];

    if (typeof day !== "object" || day === null) {
      return false;
    }

    const dayItem = day as Record<string, unknown>;

    if (dayItem.day !== index + 1) {
      return false;
    }

    if (!isNonEmptyString(dayItem.focus)) {
      return false;
    }

    if (!Array.isArray(dayItem.question_ids)) {
      return false;
    }

    if (
      !dayItem.question_ids.every(
        (questionId) => typeof questionId === "string",
      )
    ) {
      return false;
    }

    if (
      typeof dayItem.minutes !== "number" ||
      !Number.isInteger(dayItem.minutes) ||
      dayItem.minutes < 0
    ) {
      return false;
    }

    if (!isBooleanOrUndefined(dayItem.is_edited)) {
      return false;
    }

    if (!isBooleanOrUndefined(dayItem.is_pinned)) {
      return false;
    }

    for (const questionId of dayItem.question_ids) {
      if (!questionIds.has(questionId)) {
        return false;
      }
    }
  }

  return true;
};

/*
 * ============================================================
 * Coverage
 * ============================================================
 */

const calculateCoverage = (
  requirements: Requirement[],
  questions: Question[],
): string[] => {
  const coveredRequirementIds = new Set<string>();

  for (const question of questions) {
    for (const requirementId of question.requirement_ids) {
      coveredRequirementIds.add(requirementId);
    }
  }

  return requirements
    .filter(
      (requirement) =>
        requirement.priority === "must" &&
        !coveredRequirementIds.has(requirement.id),
    )
    .map((requirement) => requirement.id);
};

/*
 * ============================================================
 * Schedule cleanup
 * ============================================================
 */

const cleanScheduleQuestionIds = (
  schedule: {
    days_available: number;
    days: ScheduleDay[];
  },
  questionIds: Set<string>,
) => {
  return {
    days_available: schedule.days_available,

    days: schedule.days.map((day) => ({
      day: day.day,
      focus: day.focus,
      question_ids: day.question_ids.filter((questionId) =>
        questionIds.has(questionId),
      ),
      minutes: day.minutes,
      is_edited: day.is_edited ?? false,
      is_pinned: day.is_pinned ?? false,
    })),
  };
};

/*
 * ============================================================
 * Normalize question builder state
 * ============================================================
 *
 * Important behavior:
 *
 * 1. Existing edited question stays edited.
 * 2. Existing pinned question stays pinned unless the client
 *    explicitly changes pin state.
 * 3. Changing prompt/answer/category/difficulty/requirements
 *    automatically marks question as edited.
 * 4. Reordering questions does NOT mark them edited.
 * 5. New questions start as unedited unless explicitly marked.
 * ============================================================
 */

const mergeQuestionBuilderState = (
  incomingQuestions: Question[],
  existingQuestions: Question[],
): Question[] => {
  const existingById = new Map<string, Question>();

  for (const question of existingQuestions) {
    existingById.set(question.id, question);
  }

  return incomingQuestions.map((question) => {
    const existing = existingById.get(question.id);

    if (!existing) {
      return {
        id: question.id,
        requirement_ids: [...question.requirement_ids],
        category: question.category,
        prompt: question.prompt,
        answer_outline: question.answer_outline,
        difficulty: question.difficulty,
        is_edited: question.is_edited ?? false,
        is_pinned: question.is_pinned ?? false,
      };
    }

    const contentChanged =
      existing.prompt !== question.prompt ||
      existing.answer_outline !== question.answer_outline ||
      existing.category !== question.category ||
      existing.difficulty !== question.difficulty ||
      !stringArraysEqual(existing.requirement_ids, question.requirement_ids);

    return {
      id: question.id,
      requirement_ids: [...question.requirement_ids],
      category: question.category,
      prompt: question.prompt,
      answer_outline: question.answer_outline,
      difficulty: question.difficulty,

      is_edited:
        existing.is_edited || contentChanged || question.is_edited === true,

      is_pinned:
        question.is_pinned !== undefined
          ? question.is_pinned
          : existing.is_pinned,
    };
  });
};

/*
 * ============================================================
 * Normalize flashcard builder state
 * ============================================================
 */

const mergeFlashcardBuilderState = (
  incomingFlashcards: Flashcard[],
  existingFlashcards: Flashcard[],
): Flashcard[] => {
  const existingById = new Map<string, Flashcard>();

  for (const flashcard of existingFlashcards) {
    existingById.set(flashcard.id, flashcard);
  }

  return incomingFlashcards.map((flashcard) => {
    const existing = existingById.get(flashcard.id);

    if (!existing) {
      return {
        id: flashcard.id,
        front: flashcard.front,
        back: flashcard.back,
        requirement_ids: [...flashcard.requirement_ids],
        is_edited: flashcard.is_edited ?? false,
        is_pinned: flashcard.is_pinned ?? false,
      };
    }

    const contentChanged =
      existing.front !== flashcard.front ||
      existing.back !== flashcard.back ||
      !stringArraysEqual(existing.requirement_ids, flashcard.requirement_ids);

    return {
      id: flashcard.id,
      front: flashcard.front,
      back: flashcard.back,
      requirement_ids: [...flashcard.requirement_ids],

      is_edited:
        existing.is_edited || contentChanged || flashcard.is_edited === true,

      is_pinned:
        flashcard.is_pinned !== undefined
          ? flashcard.is_pinned
          : existing.is_pinned,
    };
  });
};

/*
 * ============================================================
 * Normalize company brief builder state
 * ============================================================
 */

const mergeCompanyBriefBuilderState = (
  incoming: {
    summary: string;
    what_they_do: string;
    sources: string[];
    is_edited?: boolean;
    is_pinned?: boolean;
  },
  existing: {
    summary: string;
    what_they_do: string;
    sources: string[];
    is_edited?: boolean;
    is_pinned?: boolean;
  },
) => {
  const contentChanged =
    existing.summary !== incoming.summary ||
    existing.what_they_do !== incoming.what_they_do ||
    !stringArraysEqual(existing.sources, incoming.sources);

  return {
    summary: incoming.summary.trim(),
    what_they_do: incoming.what_they_do.trim(),
    sources: incoming.sources,

    is_edited:
      existing.is_edited === true ||
      contentChanged ||
      incoming.is_edited === true,

    is_pinned:
      incoming.is_pinned !== undefined
        ? incoming.is_pinned
        : (existing.is_pinned ?? false),
  };
};

/*
 * ============================================================
 * Normalize schedule builder state
 * ============================================================
 */

const mergeScheduleBuilderState = (
  incoming: {
    days_available: number;
    days: ScheduleDay[];
  },
  existing: {
    days_available: number;
    days: ScheduleDay[];
  },
) => {
  const existingByDay = new Map<number, ScheduleDay>();

  for (const day of existing.days) {
    existingByDay.set(day.day, day);
  }

  return {
    days_available: incoming.days_available,

    days: incoming.days.map((day) => {
      const existingDay = existingByDay.get(day.day);

      if (!existingDay) {
        return {
          day: day.day,
          focus: day.focus.trim(),
          question_ids: [...day.question_ids],
          minutes: day.minutes,
          is_edited: day.is_edited ?? false,
          is_pinned: day.is_pinned ?? false,
        };
      }

      const contentChanged =
        existingDay.focus !== day.focus ||
        existingDay.minutes !== day.minutes ||
        !stringArraysEqual(existingDay.question_ids, day.question_ids);

      return {
        day: day.day,
        focus: day.focus.trim(),
        question_ids: [...day.question_ids],
        minutes: day.minutes,

        is_edited:
          existingDay.is_edited === true ||
          contentChanged ||
          day.is_edited === true,

        is_pinned:
          day.is_pinned !== undefined
            ? day.is_pinned
            : (existingDay.is_pinned ?? false),
      };
    }),
  };
};

/*
 * ============================================================
 * Create Kit
 * ============================================================
 */

export const createKit = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const {
      company,
      company_url,
      role,
      location = "",
      jd,
      days_available,
    } = req.body;

    if (
      !isNonEmptyString(company) ||
      !isNonEmptyString(company_url) ||
      !isNonEmptyString(role) ||
      !isNonEmptyString(jd) ||
      !isValidDays(days_available)
    ) {
      res.status(400).json({
        success: false,
        message:
          "company, company_url, role, jd and days_available are required. days_available must be an integer between 1 and 60.",
      });
      return;
    }

    let parsedCompanyUrl: URL;

    try {
      parsedCompanyUrl = new URL(company_url);

      if (
        parsedCompanyUrl.protocol !== "http:" &&
        parsedCompanyUrl.protocol !== "https:"
      ) {
        throw new Error("Invalid protocol");
      }
    } catch {
      res.status(400).json({
        success: false,
        message: "company_url must be a valid HTTP/HTTPS URL",
      });
      return;
    }

    const kit = await InterviewKit.create({
      user_id: req.userId,

      source: {
        company: company.trim(),
        company_url: parsedCompanyUrl.toString(),
        role: role.trim(),
        location: typeof location === "string" ? location.trim() : "",
        jd,
        jd_chars: jd.length,
        researched_at: new Date().toISOString(),
        pages_used: [],
      },

      company_brief: {
        summary: "",
        what_they_do: "",
        sources: [],
        is_edited: false,
        is_pinned: false,
      },

      role: {
        title: role.trim(),
        seniority: "",
        responsibilities: [],
        requirements: [],
      },

      questions: [],

      flashcards: [],

      schedule: {
        days_available,
        days: [],
      },

      coverage: {
        uncovered_requirement_ids: [],
        passes: 0,
      },

      generation: {
        status: "pending",
        progress: 0,
        current_step: "Ready to generate",
        error: null,
      },

      practice: {
        flashcards: [],
      },
    });

    res.status(201).json({
      success: true,
      message: "Interview kit created successfully",
      kit,
    });
  } catch (error) {
    console.error("Create kit error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create interview kit",
    });
  }
};

/*
 * ============================================================
 * Get My Kits
 * ============================================================
 */

export const getMyKits = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const kits = await InterviewKit.find({
      user_id: req.userId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: kits.length,
      kits,
    });
  } catch (error) {
    console.error("Get kits error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch interview kits",
    });
  }
};

/*
 * ============================================================
 * Get Kit By ID
 * ============================================================
 */

export const getKitById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = getKitId(req);

    const kit = await InterviewKit.findOne({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      kit,
    });
  } catch (error) {
    console.error("Get kit by ID error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch interview kit",
    });
  }
};

/*
 * ============================================================
 * Update Kit / Builder Save
 * ============================================================
 */

export const updateKit = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = getKitId(req);

    const kit = await InterviewKit.findOne({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    if (kit.generation.status === "generating") {
      res.status(409).json({
        success: false,
        message: "Kit cannot be edited while generation is in progress",
      });
      return;
    }

    const { company_brief, role, questions, flashcards, schedule } = req.body;

    /*
     * ---------------------------------------------------------
     * Company Brief
     * ---------------------------------------------------------
     */

    if (company_brief !== undefined) {
      if (!validateCompanyBrief(company_brief)) {
        res.status(400).json({
          success: false,
          message: "Invalid company_brief",
        });
        return;
      }

      kit.company_brief = mergeCompanyBriefBuilderState(
        company_brief,
        kit.company_brief,
      );
    }

    /*
     * ---------------------------------------------------------
     * Role
     * ---------------------------------------------------------
     */

    if (role !== undefined) {
      if (
        typeof role !== "object" ||
        role === null ||
        !isNonEmptyString(role.title) ||
        !isNonEmptyString(role.seniority) ||
        !Array.isArray(role.responsibilities) ||
        !role.responsibilities.every(
          (item: unknown) => typeof item === "string",
        ) ||
        !validateRequirements(role.requirements)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid role structure",
        });
        return;
      }

      kit.role = {
        title: role.title.trim(),
        seniority: role.seniority.trim(),
        responsibilities: role.responsibilities.map((item: string) =>
          item.trim(),
        ),
        requirements: role.requirements.map((requirement: Requirement) => ({
          id: requirement.id.trim(),
          text: requirement.text.trim(),
          kind: requirement.kind,
          priority: requirement.priority,
        })),
      };
    }

    /*
     * Current requirements are taken AFTER role update.
     */

    const currentRequirements = kit.role.requirements;

    const requirementIds = new Set<string>(
      currentRequirements.map((requirement: Requirement) => requirement.id),
    );

    /*
     * ---------------------------------------------------------
     * Questions
     * ---------------------------------------------------------
     */

    if (questions !== undefined) {
      if (!validateQuestions(questions, requirementIds)) {
        res.status(400).json({
          success: false,
          message:
            "Invalid questions. Every question must have a unique id, prompt, answer_outline, difficulty, category and valid requirement_ids.",
        });
        return;
      }

      /*
       * Important:
       *
       * We compare by question ID instead of array position.
       * Therefore moving/reordering questions doesn't make every
       * question look manually edited.
       */
      kit.questions = mergeQuestionBuilderState(questions, kit.questions);
    }

    /*
     * ---------------------------------------------------------
     * Flashcards
     * ---------------------------------------------------------
     */

    if (flashcards !== undefined) {
      if (!validateFlashcards(flashcards, requirementIds)) {
        res.status(400).json({
          success: false,
          message:
            "Invalid flashcards. Every flashcard must have a unique id, front, back and valid requirement_ids.",
        });
        return;
      }

      kit.flashcards = mergeFlashcardBuilderState(flashcards, kit.flashcards);
    }

    /*
     * ---------------------------------------------------------
     * Current question IDs
     * ---------------------------------------------------------
     */

    const currentQuestionIds = new Set<string>(
      kit.questions.map((question: Question) => question.id),
    );

    /*
     * ---------------------------------------------------------
     * Schedule
     * ---------------------------------------------------------
     */

    if (schedule !== undefined) {
      if (
        !validateSchedule(
          schedule,
          kit.schedule.days_available,
          currentQuestionIds,
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid schedule. It must contain exactly the requested number of days and only valid question IDs.",
        });
        return;
      }

      kit.schedule = mergeScheduleBuilderState(schedule, kit.schedule);
    } else {
      /*
       * If questions were changed but schedule wasn't supplied,
       * remove deleted/stale question IDs.
       *
       * Existing schedule edit/pin metadata remains intact.
       */
      kit.schedule = cleanScheduleQuestionIds(kit.schedule, currentQuestionIds);
    }

    /*
     * ---------------------------------------------------------
     * Coverage
     * ---------------------------------------------------------
     *
     * Never trust coverage sent by the frontend.
     * Always derive it from the actual question data.
     * ---------------------------------------------------------
     */

    const uncoveredRequirementIds = calculateCoverage(
      kit.role.requirements,
      kit.questions,
    );

    kit.coverage = {
      uncovered_requirement_ids: uncoveredRequirementIds,
      passes: kit.coverage.passes,
    };

    /*
     * ---------------------------------------------------------
     * Practice cleanup
     * ---------------------------------------------------------
     *
     * Deleted flashcards must not leave stale practice records.
     * ---------------------------------------------------------
     */

    const currentFlashcardIds = new Set<string>(
      kit.flashcards.map((flashcard: Flashcard) => flashcard.id),
    );

    kit.practice.flashcards = kit.practice.flashcards.filter(
      (practiceItem: PracticeFlashcard) =>
        currentFlashcardIds.has(practiceItem.flashcard_id),
    );

    await kit.save();

    res.status(200).json({
      success: true,
      message: "Interview kit updated successfully",
      kit,
    });
  } catch (error) {
    console.error("Update kit error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update interview kit",
    });
  }
};

/*
 * ============================================================
 * Delete Kit
 * ============================================================
 */

export const deleteKit = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = getKitId(req);

    const kit = await InterviewKit.findOneAndDelete({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Interview kit deleted successfully",
    });
  } catch (error) {
    console.error("Delete kit error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete interview kit",
    });
  }
};

/*
 * ============================================================
 * Start Kit Generation
 * ============================================================
 */

export const startKitGeneration = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = getKitId(req);

    const kit = await InterviewKit.findOne({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    if (kit.generation.status === "generating") {
      res.status(409).json({
        success: false,
        message: "Kit generation is already in progress",
      });
      return;
    }

    kit.generation = {
      status: "generating",
      progress: 5,
      current_step: "Starting interview kit generation",
      error: null,
    };

    await kit.save();

    res.status(202).json({
      success: true,
      message: "Interview kit generation started",
      kit,
    });

    generateInterviewKit({
      kitId: id,
      userId: req.userId,
    }).catch((error) => {
      console.error("Background generation failed:", error);
    });
  } catch (error) {
    console.error("Start kit generation error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to start interview kit generation",
    });
  }
};

/*
 * ============================================================
 * Regenerate Kit Section
 * ============================================================
 */

export const regenerateKitSection = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = getKitId(req);

    const { section, category } = req.body;

    const validSections: RegenerateSection[] = [
      "company_brief",
      "questions",
      "flashcards",
      "schedule",
    ];

    if (!section || !validSections.includes(section)) {
      res.status(400).json({
        success: false,
        message:
          "Invalid section. Allowed sections: company_brief, questions, flashcards, schedule",
      });
      return;
    }

    if (
      section === "questions" &&
      category !== undefined &&
      typeof category !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "category must be a string",
      });
      return;
    }

    const kit = await InterviewKit.findOne({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    if (kit.generation.status === "generating") {
      res.status(409).json({
        success: false,
        message: "Kit generation is already in progress",
      });
      return;
    }

    kit.generation = {
      status: "generating",
      progress: 5,
      current_step: `Regenerating ${section}`,
      error: null,
    };

    await kit.save();

    res.status(202).json({
      success: true,
      message: `Kit ${section} regeneration started`,
      kit,
    });

    regenerateInterviewKit({
      kitId: id,
      userId: req.userId,
      section,
      category: typeof category === "string" ? category : undefined,
    }).catch((error) => {
      console.error("Background kit regeneration failed:", error);
    });
  } catch (error) {
    console.error("Regenerate kit section error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to start kit regeneration",
    });
  }
};

/*
 * ============================================================
 * Get Practice Progress
 * ============================================================
 */

export const getPracticeProgress = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = getKitId(req);

    const kit = await InterviewKit.findOne({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      practice: kit.practice,
    });
  } catch (error) {
    console.error("Get practice progress error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch practice progress",
    });
  }
};

/*
 * ============================================================
 * Update Flashcard Practice
 * ============================================================
 */

export const updateFlashcardPractice = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const id = getKitId(req);

    const flashcardId = Array.isArray(req.params.flashcardId)
      ? req.params.flashcardId[0]
      : req.params.flashcardId;

    const { confidence, is_covered } = req.body;

    const validConfidence = ["low", "medium", "high"];

    if (confidence !== undefined && !validConfidence.includes(confidence)) {
      res.status(400).json({
        success: false,
        message: "confidence must be low, medium, or high",
      });
      return;
    }

    if (is_covered !== undefined && typeof is_covered !== "boolean") {
      res.status(400).json({
        success: false,
        message: "is_covered must be a boolean",
      });
      return;
    }

    const kit = await InterviewKit.findOne({
      _id: id,
      user_id: req.userId,
    });

    if (!kit) {
      res.status(404).json({
        success: false,
        message: "Interview kit not found",
      });
      return;
    }

    const flashcardExists = kit.flashcards.some(
      (flashcard: Flashcard) => flashcard.id === flashcardId,
    );

    if (!flashcardExists) {
      res.status(404).json({
        success: false,
        message: "Flashcard not found",
      });
      return;
    }

    const existingPractice = kit.practice.flashcards.find(
      (item: PracticeFlashcard) => item.flashcard_id === flashcardId,
    );

    if (existingPractice) {
      if (confidence !== undefined) {
        existingPractice.confidence = confidence;
      }

      if (is_covered !== undefined) {
        existingPractice.is_covered = is_covered;
      }
    } else {
      kit.practice.flashcards.push({
        flashcard_id: flashcardId,
        confidence: confidence ?? "low",
        is_covered: is_covered ?? false,
      });
    }

    await kit.save();

    res.status(200).json({
      success: true,
      message: "Flashcard practice progress updated",
      practice: kit.practice,
    });
  } catch (error) {
    console.error("Update flashcard practice error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update flashcard practice progress",
    });
  }
};
