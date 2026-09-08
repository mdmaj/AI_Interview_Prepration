export interface Requirement {
  id: string;
  text: string;
  kind: "technical" | "behavioral" | "other";
  priority: "must" | "nice";
}

export interface Question {
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

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface Coverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface GenerationStatus {
  status: "pending" | "generating" | "completed" | "failed";
  progress: number;
  current_step: string;
  error: string | null;
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

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
}

export interface InterviewKit {
  _id: string;

  source: KitSource;

  company_brief: CompanyBrief;

  role: Role;

  questions: Question[];

  flashcards: Flashcard[];

  schedule: Schedule;

  coverage: Coverage;

  generation?: GenerationStatus;
}