import mongoose, { Document, Schema } from "mongoose";

interface Requirement {
  id: string;
  text: string;
  kind: "technical" | "behavioral" | "other";
  priority: "must" | "nice";
}

interface Question {
  id: string;
  requirement_ids: string[];
  category: string;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
}

interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface IInterviewKit extends Document {
  user_id: mongoose.Types.ObjectId;

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
}

const requirementSchema = new Schema<Requirement>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    kind: { type: String, required: true },
    priority: { type: String, required: true },
  },
  { _id: false }
);

const questionSchema = new Schema<Question>(
  {
    id: { type: String, required: true },
    requirement_ids: { type: [String], default: [] },
    category: { type: String, required: true },
    prompt: { type: String, required: true },
    answer_outline: { type: String, required: true },
    difficulty: { type: Number, required: true },
  },
  { _id: false }
);

const flashcardSchema = new Schema<Flashcard>(
  {
    id: { type: String, required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    requirement_ids: { type: [String], default: [] },
  },
  { _id: false }
);

const scheduleDaySchema = new Schema<ScheduleDay>(
  {
    day: { type: Number, required: true },
    focus: { type: String, required: true },
    question_ids: { type: [String], default: [] },
    minutes: { type: Number, required: true },
  },
  { _id: false }
);

const interviewKitSchema = new Schema<IInterviewKit>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    source: {
      company: { type: String, required: true },
      company_url: { type: String, required: true },
      role: { type: String, required: true },
      location: { type: String, default: "" },
      jd_chars: { type: Number, required: true },
      researched_at: { type: String, default: "" },
      pages_used: { type: [String], default: [] },
    },

    company_brief: {
      summary: { type: String, default: "" },
      what_they_do: { type: String, default: "" },
      sources: { type: [String], default: [] },
    },

    role: {
      title: { type: String, default: "" },
      seniority: { type: String, default: "" },
      responsibilities: { type: [String], default: [] },
      requirements: {
        type: [requirementSchema],
        default: [],
      },
    },

    questions: {
      type: [questionSchema],
      default: [],
    },

    flashcards: {
      type: [flashcardSchema],
      default: [],
    },

    schedule: {
      days_available: { type: Number, required: true },
      days: {
        type: [scheduleDaySchema],
        default: [],
      },
    },

    coverage: {
      uncovered_requirement_ids: {
        type: [String],
        default: [],
      },
      passes: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

const InterviewKit = mongoose.model<IInterviewKit>(
  "InterviewKit",
  interviewKitSchema
);

export default InterviewKit;