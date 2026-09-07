import { generateText } from "./llmClient.js";
import {
  questionsSchema,
  GeneratedQuestion,
} from "./schemas.js";
import { questionGenerationPrompt } from "./prompts.js";

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

export const generateQuestions = async (
  role: string,
  requirements: Requirement[],
  companyResearch: CompanyResearch,
  interviewResearch: InterviewResearch
): Promise<GeneratedQuestion[]> => {
  if (requirements.length === 0) {
    throw new Error(
      "Cannot generate questions without requirements"
    );
  }

  const requirementText = requirements
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

  const prompt = questionGenerationPrompt(
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
      "Gemini returned invalid JSON for question generation"
    );
  }

  const validated = questionsSchema.safeParse(parsed);

  if (!validated.success) {
    console.error(
      "Question validation error:",
      validated.error
    );

    throw new Error(
      "Invalid question structure returned by Gemini"
    );
  }

  const validRequirementIds = new Set(
    requirements.map((requirement) => requirement.id)
  );

  const invalidQuestions =
    validated.data.questions.filter((question) =>
      question.requirement_ids.some(
        (id) => !validRequirementIds.has(id)
      )
    );

  if (invalidQuestions.length > 0) {
    throw new Error(
      "Gemini generated questions with invalid requirement IDs"
    );
  }

  return validated.data.questions.map(
    (question, index) => ({
      ...question,
      id: `q${index + 1}`,
    })
  ) as GeneratedQuestion[];
};