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
  interviewResearch: InterviewResearch
): Promise<CoveragePipelineResult> => {
  let currentQuestions = [...questions];

  let coverage = checkCoverage(
    requirements,
    currentQuestions
  );

  let passes = 1;

  // Maximum 2 total coverage checks/passes.
  while (
    !coverage.is_complete &&
    passes < 2
  ) {
    const uncoveredRequirements =
      requirements.filter((requirement) =>
        coverage.uncovered_requirement_ids.includes(
          requirement.id
        )
      );

    if (uncoveredRequirements.length === 0) {
      break;
    }

    const missingQuestions =
      await generateMissingQuestions(
        role,
        uncoveredRequirements,
        companyResearch,
        interviewResearch,
        currentQuestions.length
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
      currentQuestions
    );

    passes += 1;
  }

  return {
    questions: currentQuestions,
    coverage,
    passes,
  };
};