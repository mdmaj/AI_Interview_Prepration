import { generateText } from "./llmClient.js";
import {
  flashcardsSchema,
  GeneratedFlashcard,
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

export const generateFlashcards = async (
  role: string,
  requirements: Requirement[],
  questions: Question[]
): Promise<GeneratedFlashcard[]> => {
  if (questions.length === 0) {
    return [];
  }

  const requirementText = requirements
    .map(
      (requirement) =>
        `${requirement.id}: ${requirement.text} | priority=${requirement.priority}`
    )
    .join("\n");

  const questionText = questions
    .map(
      (question) => `
${question.id}
Requirement IDs: ${question.requirement_ids.join(", ")}
Question: ${question.prompt}
Answer outline: ${question.answer_outline}
`
    )
    .join("\n");

  const prompt = flashcardGenerationPrompt(
    role,
    requirementText,
    questionText
  );

  const rawResponse = await generateText(prompt);

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    throw new Error(
      "Gemini returned invalid JSON for flashcard generation"
    );
  }

  const validated =
    flashcardsSchema.safeParse(parsed);

  if (!validated.success) {
    console.error(
      "Flashcard validation error:",
      validated.error
    );

    throw new Error(
      "Invalid flashcard structure returned by Gemini"
    );
  }

  const validRequirementIds = new Set(
    requirements.map((requirement) => requirement.id)
  );

  const invalidFlashcards =
    validated.data.flashcards.filter((flashcard) =>
      flashcard.requirement_ids.some(
        (id) => !validRequirementIds.has(id)
      )
    );

  if (invalidFlashcards.length > 0) {
    throw new Error(
      "Gemini generated flashcards with invalid requirement IDs"
    );
  }

  return validated.data.flashcards.map(
    (flashcard, index) => ({
      ...flashcard,
      id: `f${index + 1}`,
    })
  ) as GeneratedFlashcard[];
};