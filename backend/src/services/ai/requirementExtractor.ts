import { generateText } from "./llmClient.js";
import {
  extractedRoleSchema,
  type ExtractedRole,
} from "./schemas.js";
import { requirementExtractionPrompt } from "./prompts.js";

export interface ExtractedRoleWithIds extends ExtractedRole {
  requirements: Array<{
    id: string;
    text: string;
    kind: "technical" | "behavioral" | "other";
    priority: "must" | "nice";
  }>;
}

export const extractRequirements = async (
  jd: string
): Promise<ExtractedRoleWithIds> => {
  if (!jd.trim()) {
    throw new Error("Job description cannot be empty");
  }

  const prompt = requirementExtractionPrompt(jd);

  const rawResponse = await generateText(prompt);

  let parsedResponse: unknown;

  try {
    parsedResponse = JSON.parse(rawResponse);
  } catch {
    throw new Error(
      "Gemini returned invalid JSON while extracting requirements"
    );
  }

  const validationResult =
    extractedRoleSchema.safeParse(parsedResponse);

  if (!validationResult.success) {
    console.error(
      "Requirement extraction validation failed:",
      validationResult.error.flatten()
    );

    throw new Error(
      "Gemini returned an invalid requirement structure"
    );
  }

  const role = validationResult.data;

  const requirements = role.requirements.map(
    (requirement, index) => ({
      id: `r${index + 1}`,
      ...requirement,
    })
  );

  return {
    ...role,
    requirements,
  };
};