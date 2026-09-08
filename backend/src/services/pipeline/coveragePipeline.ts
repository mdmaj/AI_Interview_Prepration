import { checkCoverage } from "../validation/coverageChecker.js";
import { generateMissingQuestions } from "../ai/missingQuestionGenerator.js";

interface Requirement {
  id: string;
  text: string;
  kind: "technical" | "behavioral" | "other";
  priority: "must" | "nice";
}

interface Question {
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

interface CompanyResearch {
  summary: string;
  what_they_do: string;
  sources: string[];
}

interface InterviewResearch {
  process: string[];
  common_topics: string[];
  reported_questions: string[];
  sources: string[];
  gaps: string[];
}

export interface CoveragePipelineResult {
  questions: Question[];
  coverage: ReturnType<typeof checkCoverage>;
  passes: number;
}

export const runCoveragePipeline = async (
  role: string,
  requirements: Requirement[],
  questions: Question[],
  companyResearch: CompanyResearch,
  interviewResearch: InterviewResearch,
): Promise<CoveragePipelineResult> => {
  let currentQuestions = [...questions];

  // Initial deterministic coverage check.
  let coverage = checkCoverage(
    requirements,
    currentQuestions,
  );

  let passes = 1;

  // One additional repair pass is allowed.
  while (!coverage.is_complete && passes < 2) {
    // Only uncovered MUST-HAVE requirements should
    // trigger the second-pass question generation.
    const uncoveredMustHaveRequirements =
      requirements.filter(
        (requirement) =>
          requirement.priority === "must" &&
          coverage.must_have_uncovered.includes(
            requirement.id,
          ),
      );

    if (uncoveredMustHaveRequirements.length === 0) {
      break;
    }

    const missingQuestions =
      await generateMissingQuestions(
        role,
        uncoveredMustHaveRequirements,
        companyResearch,
        interviewResearch,
        currentQuestions.length,
      );

    if (missingQuestions.length === 0) {
      break;
    }

    currentQuestions = [
      ...currentQuestions,
      ...missingQuestions,
    ];

    coverage = checkCoverage(
      requirements,
      currentQuestions,
    );

    passes += 1;
  }

  return {
    questions: currentQuestions,
    coverage,
    passes,
  };
};