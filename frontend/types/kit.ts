export interface Requirement {
  id: string;
  text: string;
  kind: "technical" | "behavioral" | "other";
  priority: "must" | "nice";
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: "technical" | "behavioral" | "system_design" | "coding" | "other";
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;

  // Builder state
  is_edited?: boolean;
  is_pinned?: boolean;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];

  // Builder state
  is_edited?: boolean;
  is_pinned?: boolean;
}

export interface PracticeFlashcard {
  flashcard_id: string;
  confidence: "low" | "medium" | "high";
  is_covered: boolean;
}

export interface Practice {
  flashcards: PracticeFlashcard[];
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export interface Role {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface InterviewKit {
  _id: string;

  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];

    // Optional because backend/API may expose it
    jd?: string;
  };

  company_brief: CompanyBrief;

  role: Role;

  questions: Question[];

  flashcards: Flashcard[];

  practice?: Practice;

  schedule: {
    days_available: number;
    days: ScheduleDay[];
  };

  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };

  generation: {
    status: "idle" | "generating" | "completed" | "failed";
    progress: number;
    current_step: string;
    error: string | null;
  };

  createdAt?: string;
  updatedAt?: string;
}
