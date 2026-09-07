import { generateText } from "./llmClient.js";
import {
  questionsSchema,
  GeneratedQuestion,
} from "./schemas.js";

import {
  missingQuestionGenerationPrompt,
} from "./prompts.js";

interface Requirement {
  id: string;
  text: string;
  kind: "technical" | "behavioral" | "other";
  priority: "must" | "nice";
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

export const generateMissingQuestions = async (
  role: string,
  uncoveredRequirements: Requirement[],
  companyResearch: CompanyResearch,
  interviewResearch: InterviewResearch,
  existingQuestionCount: number
): Promise<GeneratedQuestion[]> => {
  if (uncoveredRequirements.length === 0) {
    return [];
  }

  const requirementText = uncoveredRequirements
    .map(
      (requirement) =>
        `${requirement.id}: ${requirement.text} | kind=${requirement.kind} | priority=${requirement.priority}`
    )
    .join("\n");

  const companyText = `
Summary:
${companyResearch.summary}

What they do:
${companyResearch.what_they_do}
`;

  const interviewText = `
Process:
${interviewResearch.process.join("\n")}

Common topics:
${interviewResearch.common_topics.join("\n")}

Reported questions:
${interviewResearch.reported_questions.join("\n")}

Research gaps:
${interviewResearch.gaps.join("\n")}
`;

  const prompt = missingQuestionGenerationPrompt(
  role,
  requirementText,
  companyText,
  interviewText
);

  const rawResponse = await generateText(prompt);

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    throw new Error(
      "Gemini returned invalid JSON for missing question generation"
    );
  }

  const validated = questionsSchema.safeParse(parsed);

  if (!validated.success) {
    console.error(
      "Missing question validation error:",
      validated.error
    );

    throw new Error(
      "Invalid missing question structure returned by Gemini"
    );
  }

  const validRequirementIds = new Set(
    uncoveredRequirements.map(
      (requirement) => requirement.id
    )
  );

  const invalidQuestions =
    validated.data.questions.filter((question) =>
      question.requirement_ids.some(
        (id) => !validRequirementIds.has(id)
      )
    );

  if (invalidQuestions.length > 0) {
    throw new Error(
      "Gemini generated a question for an invalid requirement"
    );
  }

  return validated.data.questions.map(
    (question, index) => ({
      ...question,
      id: `q${existingQuestionCount + index + 1}`,
    })
  ) as GeneratedQuestion[];
};