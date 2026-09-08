import { generateText } from "./llmClient.js";
import {
  interviewResearchSchema,
  type InterviewResearch,
} from "./schemas.js";
import { interviewResearchPrompt } from "./researchPrompts.js";

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
      "Gemini returned invalid JSON while generating interview research",
    );
  }
};

export const generateInterviewResearch = async (
  companyName: string,
  roleTitle: string,
  researchText: string,
): Promise<InterviewResearch> => {
  if (!companyName.trim()) {
    throw new Error("Company name cannot be empty");
  }

  if (!roleTitle.trim()) {
    throw new Error("Role title cannot be empty");
  }

  if (!researchText.trim()) {
    throw new Error("Interview research input cannot be empty");
  }

  const prompt = interviewResearchPrompt(
    companyName,
    roleTitle,
    researchText,
  );

  const rawResponse = await generateText(prompt);

  const parsedResponse = parseJsonResponse(rawResponse);

  const validationResult =
    interviewResearchSchema.safeParse(parsedResponse);

  if (!validationResult.success) {
    console.error(
      "Interview research validation failed:",
      validationResult.error.flatten(),
    );

    throw new Error(
      "Gemini returned an invalid interview research structure",
    );
  }

  return validationResult.data;
};