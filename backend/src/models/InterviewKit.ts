import mongoose, { Document, Schema } from "mongoose";

/*
 * ============================================================
 * Types
 * ============================================================
 */

export type RequirementKind = "technical" | "behavioral" | "other";

export type RequirementPriority = "must" | "nice";

export type QuestionCategory =
  | "technical"
  | "behavioral"
  | "system_design"
  | "coding"
  | "other";

export type QuestionDifficulty = 1 | 2 | 3;

/*
 * ------------------------------------------------------------
 * Requirement
 * ------------------------------------------------------------
 */

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

/*
 * ------------------------------------------------------------
 * Question
 * ------------------------------------------------------------
 */

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: QuestionDifficulty;

  // Builder state
  is_edited: boolean;
  is_pinned: boolean;
}

/*
 * ------------------------------------------------------------
 * Flashcard
 * ------------------------------------------------------------
 */

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];

  // Builder state
  is_edited: boolean;
  is_pinned: boolean;
}

/*
 * ------------------------------------------------------------
 * Schedule Day
 * ------------------------------------------------------------
 */

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

/*
 * ============================================================
 * Interview Kit Document
 * ============================================================
 */

export interface IInterviewKit extends Document {
  user_id: mongoose.Types.ObjectId;

  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd: string;
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

  generation: {
    status: "pending" | "generating" | "completed" | "failed";

    progress: number;

    current_step: string;

    error: string | null;
  };
}

/*
 * ============================================================
 * Requirement Schema
 * ============================================================
 */

const requirementSchema = new Schema<Requirement>(
  {
    id: {
      type: String,
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    kind: {
      type: String,
      enum: ["technical", "behavioral", "other"],
      required: true,
    },

    priority: {
      type: String,
      enum: ["must", "nice"],
      required: true,
    },
  },
  {
    _id: false,
  },
);

/*
 * ============================================================
 * Question Schema
 * ============================================================
 */

const questionSchema = new Schema<Question>(
  {
    id: {
      type: String,
      required: true,
    },

    requirement_ids: {
      type: [String],
      required: true,
      default: [],
    },

    category: {
      type: String,
      enum: ["technical", "behavioral", "system_design", "coding", "other"],
      required: true,
    },

    prompt: {
      type: String,
      required: true,
      trim: true,
    },

    answer_outline: {
      type: String,
      required: true,
      trim: true,
    },

    difficulty: {
      type: Number,
      enum: [1, 2, 3],
      required: true,
    },

    /*
     * --------------------------------------------------------
     * Builder state
     * --------------------------------------------------------
     *
     * is_edited:
     * User manually changed the question.
     *
     * is_pinned:
     * User explicitly wants to preserve this question
     * during regeneration.
     * --------------------------------------------------------
     */

    is_edited: {
      type: Boolean,
      default: false,
    },

    is_pinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
);

/*
 * ============================================================
 * Flashcard Schema
 * ============================================================
 */

const flashcardSchema = new Schema<Flashcard>(
  {
    id: {
      type: String,
      required: true,
    },

    front: {
      type: String,
      required: true,
      trim: true,
    },

    back: {
      type: String,
      required: true,
      trim: true,
    },

    requirement_ids: {
      type: [String],
      required: true,
      default: [],
    },

    /*
     * --------------------------------------------------------
     * Builder state
     * --------------------------------------------------------
     */

    is_edited: {
      type: Boolean,
      default: false,
    },

    is_pinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
);

/*
 * ============================================================
 * Schedule Day Schema
 * ============================================================
 */

const scheduleDaySchema = new Schema<ScheduleDay>(
  {
    day: {
      type: Number,
      required: true,
    },

    focus: {
      type: String,
      required: true,
      trim: true,
    },

    question_ids: {
      type: [String],
      required: true,
      default: [],
    },

    minutes: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

/*
 * ============================================================
 * Main Interview Kit Schema
 * ============================================================
 */

const interviewKitSchema = new Schema<IInterviewKit>(
  {
    /*
     * --------------------------------------------------------
     * User ownership
     * --------------------------------------------------------
     */

    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /*
     * --------------------------------------------------------
     * Source
     * --------------------------------------------------------
     */

    source: {
      company: {
        type: String,
        required: true,
        trim: true,
      },

      company_url: {
        type: String,
        required: true,
        trim: true,
      },

      role: {
        type: String,
        required: true,
        trim: true,
      },

      location: {
        type: String,
        default: "",
        trim: true,
      },

      jd: {
        type: String,
        required: true,
      },

      jd_chars: {
        type: Number,
        required: true,
        min: 0,
      },

      researched_at: {
        type: String,
        required: true,
      },

      pages_used: {
        type: [String],
        default: [],
      },
    },

    /*
     * --------------------------------------------------------
     * Company Brief
     * --------------------------------------------------------
     */

    company_brief: {
      summary: {
        type: String,
        default: "",
      },

      what_they_do: {
        type: String,
        default: "",
      },

      sources: {
        type: [String],
        default: [],
      },
    },

    /*
     * --------------------------------------------------------
     * Role
     * --------------------------------------------------------
     */

    role: {
      title: {
        type: String,
        required: true,
        trim: true,
      },

      seniority: {
        type: String,
        default: "",
        trim: true,
      },

      responsibilities: {
        type: [String],
        default: [],
      },

      requirements: {
        type: [requirementSchema],
        default: [],
      },
    },

    /*
     * --------------------------------------------------------
     * Questions
     * --------------------------------------------------------
     */

    questions: {
      type: [questionSchema],
      default: [],
    },

    /*
     * --------------------------------------------------------
     * Flashcards
     * --------------------------------------------------------
     */

    flashcards: {
      type: [flashcardSchema],
      default: [],
    },

    /*
     * --------------------------------------------------------
     * Schedule
     * --------------------------------------------------------
     */

    schedule: {
      days_available: {
        type: Number,
        required: true,
        min: 1,
        max: 60,
      },

      days: {
        type: [scheduleDaySchema],
        default: [],
      },
    },

    /*
     * --------------------------------------------------------
     * Coverage
     * --------------------------------------------------------
     */

    coverage: {
      uncovered_requirement_ids: {
        type: [String],
        default: [],
      },

      passes: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    /*
     * --------------------------------------------------------
     * Generation
     * --------------------------------------------------------
     */

    generation: {
      status: {
        type: String,
        enum: ["pending", "generating", "completed", "failed"],
        default: "pending",
      },

      progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },

      current_step: {
        type: String,
        default: "",
      },

      error: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

/*
 * ============================================================
 * Indexes
 * ============================================================
 *
 * Makes "my kits" queries faster.
 * ============================================================
 */

interviewKitSchema.index({
  user_id: 1,
  createdAt: -1,
});

/*
 * ============================================================
 * Model
 * ============================================================
 */

const InterviewKit =
  mongoose.models.InterviewKit ||
  mongoose.model<IInterviewKit>("InterviewKit", interviewKitSchema);

export default InterviewKit;
