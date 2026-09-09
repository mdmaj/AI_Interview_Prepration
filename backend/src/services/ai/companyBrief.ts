import { generateText } from "./llmClient.js";
import { companyBriefSchema, type CompanyBrief } from "./schemas.js";
import { companyBriefPrompt } from "./prompts.js";

const parseJsonResponse = (rawResponse: string): unknown => {
  const cleaned = rawResponse
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(
      "Gemini returned invalid JSON while generating company brief",
    );
  }
};

const normalizeSources = (
  value: unknown,
  fallbackSources: string[],
): string[] => {
  /*
   * Prefer sources returned by the model when they are valid.
   */
  if (Array.isArray(value)) {
    const validSources = value.filter(
      (source): source is string =>
        typeof source === "string" && source.trim().length > 0,
    );

    if (validSources.length > 0) {
      return validSources;
    }
  }

  /*
   * If Gemini omitted sources, use the actual pages that were
   * crawled by our application.
   */
  return fallbackSources.filter(
    (source): source is string =>
      typeof source === "string" && source.trim().length > 0,
  );
};

export const generateCompanyBrief = async (
  companyName: string,
  researchText: string,
  sourceUrls: string[] = [],
): Promise<CompanyBrief> => {
  if (!companyName.trim()) {
    throw new Error("Company name cannot be empty");
  }

  if (!researchText.trim()) {
    throw new Error("Company research cannot be empty");
  }

  const prompt = companyBriefPrompt(companyName, researchText);

  const rawResponse = await generateText(prompt);

  const parsedResponse = parseJsonResponse(rawResponse);

  /*
   * Gemini sometimes returns a valid brief but omits `sources`.
   *
   * Normalize that field before schema validation instead of
   * failing the entire generation.
   */
  if (
    typeof parsedResponse !== "object" ||
    parsedResponse === null ||
    Array.isArray(parsedResponse)
  ) {
    throw new Error("Gemini returned an invalid company brief structure");
  }

  const responseObject = parsedResponse as Record<string, unknown>;

  const normalizedResponse = {
    ...responseObject,
    sources: normalizeSources(responseObject.sources, sourceUrls),
  };

  /*
   * If no sources are available at all, keep the field as an
   * empty array rather than inventing URLs.
   *
   * This is especially important for inaccessible/invalid
   * company websites.
   */
  const validationResult = companyBriefSchema.safeParse(normalizedResponse);

  if (!validationResult.success) {
    console.error(
      "Company brief validation failed:",
      validationResult.error.flatten(),
    );

    throw new Error("Gemini returned an invalid company brief structure");
  }

  return validationResult.data;
};
