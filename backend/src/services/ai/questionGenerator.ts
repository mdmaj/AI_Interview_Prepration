import { generateText } from "./llmClient.js";
import {
  questionsSchema,
  type GeneratedQuestion,
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

const parseJsonResponse = (rawResponse: string): unknown => {
  const cleaned = rawResponse
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(
      "Gemini returned invalid JSON for question generation",
    );
  }
};

const normalizeQuestion = (question: string): string => {
  return question
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

export const generateQuestions = async (
  role: string,
  requirements: Requirement[],
  companyResearch: CompanyResearch,
  interviewResearch: InterviewResearch,
): Promise<GeneratedQuestion[]> => {
  if (!role.trim()) {
    throw new Error("Role cannot be empty");
  }

  if (requirements.length === 0) {
    throw new Error(
      "Cannot generate questions without requirements",
    );
  }

  const requirementText = requirements
    .map(
      (requirement) =>
        `${requirement.id}: ${requirement.text} | kind=${requirement.kind} | priority=${requirement.priority}`,
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
    interviewText,
  );

  const rawResponse = await generateText(prompt);

  const parsed = parseJsonResponse(rawResponse);

  const validated = questionsSchema.safeParse(parsed);

  if (!validated.success) {
    console.error(
      "Question validation error:",
      validated.error.flatten(),
    );

    throw new Error(
      "Invalid question structure returned by Gemini",
    );
  }

  if (validated.data.questions.length === 0) {
    throw new Error(
      "Gemini returned no interview questions",
    );
  }

  const validRequirementIds = new Set(
    requirements.map((requirement) => requirement.id),
  );

  for (const question of validated.data.questions) {
    const hasInvalidRequirementId =
      question.requirement_ids.some(
        (id) => !validRequirementIds.has(id),
      );

    if (hasInvalidRequirementId) {
      throw new Error(
        "Gemini generated questions with invalid requirement IDs",
      );
    }

    if (question.requirement_ids.length === 0) {
      throw new Error(
        "Gemini generated a question without requirement IDs",
      );
    }
  }

  const seenQuestions = new Set<string>();

  const uniqueQuestions = validated.data.questions.filter(
    (question) => {
      const key = normalizeQuestion(question.prompt);

      if (seenQuestions.has(key)) {
        return false;
      }

      seenQuestions.add(key);
      return true;
    },
  );

  if (uniqueQuestions.length === 0) {
    throw new Error(
      "No unique interview questions were generated",
    );
  }

  return uniqueQuestions.map(
    (question, index) => ({
      ...question,
      id: `q${index + 1}`,
    }),
  ) as GeneratedQuestion[];
};