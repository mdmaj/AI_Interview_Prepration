import { generateText } from "./llmClient.js";
import {
  flashcardsSchema,
  type GeneratedFlashcard,
} from "./schemas.js";
import { flashcardGenerationPrompt } from "./prompts.js";

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
      "Gemini returned invalid JSON for flashcard generation",
    );
  }
};

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

export const generateFlashcards = async (
  role: string,
  requirements: Requirement[],
  questions: Question[],
): Promise<GeneratedFlashcard[]> => {
  if (!role.trim()) {
    throw new Error("Role cannot be empty");
  }

  if (questions.length === 0) {
    return [];
  }

  const requirementText = requirements
    .map(
      (requirement) =>
        `${requirement.id}: ${requirement.text} | priority=${requirement.priority}`,
    )
    .join("\n");

  const questionText = questions
    .map(
      (question) => `
${question.id}
Requirement IDs: ${question.requirement_ids.join(", ")}
Question: ${question.prompt}
Answer outline: ${question.answer_outline}
`,
    )
    .join("\n");

  const prompt = flashcardGenerationPrompt(
    role,
    requirementText,
    questionText,
  );

  const rawResponse = await generateText(prompt);

  const parsed = parseJsonResponse(rawResponse);

  const validated = flashcardsSchema.safeParse(parsed);

  if (!validated.success) {
    console.error(
      "Flashcard validation error:",
      validated.error.flatten(),
    );

    throw new Error(
      "Invalid flashcard structure returned by Gemini",
    );
  }

  const validRequirementIds = new Set(
    requirements.map((requirement) => requirement.id),
  );

  for (const flashcard of validated.data.flashcards) {
    const hasInvalidRequirementId =
      flashcard.requirement_ids.some(
        (id) => !validRequirementIds.has(id),
      );

    if (hasInvalidRequirementId) {
      throw new Error(
        "Gemini generated flashcards with invalid requirement IDs",
      );
    }

    if (flashcard.requirement_ids.length === 0) {
      throw new Error(
        "Gemini generated a flashcard without requirement IDs",
      );
    }
  }

  const seen = new Set<string>();

  const uniqueFlashcards =
    validated.data.flashcards.filter((flashcard) => {
      const key = `${normalizeText(flashcard.front)}|${normalizeText(
        flashcard.back,
      )}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

  return uniqueFlashcards.map(
    (flashcard, index) => ({
      ...flashcard,
      id: `f${index + 1}`,
    }),
  ) as GeneratedFlashcard[];
};