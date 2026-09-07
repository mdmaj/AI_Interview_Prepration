import { generateText } from "./llmClient.js";
import {
  companyBriefSchema,
  type CompanyBrief,
} from "./schemas.js";
import { companyBriefPrompt } from "./prompts.js";

interface ResearchPage {
  url: string;
  title: string;
  text: string;
}

export interface GeneratedCompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export const generateCompanyBrief = async (
  companyName: string,
  pages: ResearchPage[]
): Promise<GeneratedCompanyBrief> => {
  if (pages.length === 0) {
    throw new Error(
      "No company research pages available"
    );
  }

  const researchText = pages
    .map(
      (page) =>
        `
SOURCE URL: ${page.url}
PAGE TITLE: ${page.title}

CONTENT:
${page.text}
`
    )
    .join("\n\n");

  const prompt = companyBriefPrompt(
    companyName,
    researchText
  );

  const rawResponse = await generateText(prompt);

  let parsedResponse: unknown;

  try {
    parsedResponse = JSON.parse(rawResponse);
  } catch {
    throw new Error(
      "Gemini returned invalid JSON for company brief"
    );
  }

  const validationResult =
    companyBriefSchema.safeParse(
      parsedResponse
    );

  if (!validationResult.success) {
    console.error(
      "Company brief validation failed:",
      validationResult.error.flatten()
    );

    throw new Error(
      "Gemini returned an invalid company brief"
    );
  }

  const brief: CompanyBrief =
    validationResult.data;

  const sources = pages.map(
    (page) => page.url
  );

  return {
    ...brief,
    sources,
  };
};