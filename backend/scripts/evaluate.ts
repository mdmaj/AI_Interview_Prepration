
import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyError,
  getCompanyNameFromUrl,
  isCaseRetryable,
  validateEvaluationCase,
  type EvaluationCase,
} from "./evaluationHelpers.js";
import { extractRequirements } from "../src/services/ai/requirementExtractor.js";
import { generateCompanyBrief } from "../src/services/ai/companyBrief.js";
import { generateQuestions } from "../src/services/ai/questionGenerator.js";
import { generateFlashcards } from "../src/services/ai/flashcardsGenerator.js";
import { researchInterview } from "../src/services/research/interviewResearch.js";
import { crawlCompany } from "../src/services/crawler/index.js";
import { runCoveragePipeline } from "../src/services/pipeline/coveragePipeline.js";
import { allocateSchedule } from "../src/services/scheduling/scheduleAllocator.js";

import {
  validateFinalKit,
  type FinalKit,
} from "../src/services/validation/kitValidator.js";



interface EvaluationOutput {
  version: "1.0";
  generated_at: string;
  kits: Array<{
    id: string;
    status: "ok" | "failed";
    kit: FinalKit | null;
    error: {
      code: string;
      message: string;
    } | null;
  }>;
}

interface ResearchPage {
  url: string;
  text: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT = path.resolve(
  __dirname,
  "../evaluation/cases.json",
);

const DEFAULT_OUTPUT = path.resolve(
  __dirname,
  "../evaluation/kits.json",
);

const MAX_RESEARCH_CHARS = 60_000;

/*
 * The evaluator itself should not perform aggressive retries.
 *
 * Individual Gemini calls already have controlled retries inside
 * llmClient.ts.
 *
 * We only allow ONE complete-case retry for transient provider
 * failures.
 *
 * Quota, invalid output, coverage and validation failures are
 * not retried at the case level.
 */
const MAX_CASE_ATTEMPTS = 2;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getArg = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
};





const readCases = async (
  inputPath: string,
): Promise<EvaluationCase[]> => {
  const raw = await fs.readFile(
    inputPath,
    "utf-8",
  );

  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Evaluation input must be a JSON array",
    );
  }

  if (parsed.length === 0) {
    throw new Error(
      "Evaluation input cannot be empty",
    );
  }

  return parsed.map(validateEvaluationCase);
};

const getResearchText = (
  pages: ResearchPage[],
): string => {
  return pages
    .map(
      (page) =>
        `SOURCE: ${page.url}\n${page.text}`,
    )
    .join("\n\n")
    .slice(0, MAX_RESEARCH_CHARS);
};

const createFallbackInterviewResearch = () => ({
  process: [],
  common_topics: [],
  reported_questions: [],
  sources: [],
  gaps: [
    "Public interview research was unavailable.",
  ],
});


const runCase = async (
  evaluationCase: EvaluationCase,
): Promise<FinalKit> => {
  const companyName =
    getCompanyNameFromUrl(
      evaluationCase.company_url,
    );

  console.log(
    `\n[${evaluationCase.id}] Starting...`,
  );

  /*
   * ---------------------------------------------------------
   * 1. REQUIREMENT EXTRACTION
   * ---------------------------------------------------------
   */

  console.log(
    `[${evaluationCase.id}] Extracting requirements...`,
  );

  const extractedRole =
    await extractRequirements(
      evaluationCase.jd,
    );

  console.log(
    `[${evaluationCase.id}] Requirements: ${extractedRole.requirements.length}`,
  );

  /*
   * ---------------------------------------------------------
   * 2. COMPANY CRAWL
   * ---------------------------------------------------------
   *
   * Crawl failure is intentionally handled as partial
   * research.
   *
   * Thin/partial research can still produce an "ok" kit
   * if the rest of the pipeline succeeds.
   */

  let pagesUsed: string[] = [];
  let researchText = "";

  try {
    console.log(
      `[${evaluationCase.id}] Crawling company...`,
    );

    const crawlResult =
      await crawlCompany(
        evaluationCase.company_url,
      );

    pagesUsed = crawlResult.pages.map(
      (page) => page.url,
    );

    researchText =
      getResearchText(
        crawlResult.pages,
      );

    console.log(
      `[${evaluationCase.id}] Pages used: ${pagesUsed.length}`,
    );
  } catch (error) {
    console.warn(
      `[${evaluationCase.id}] Company crawl failed. Continuing with thin research.`,
    );

    console.warn(error);
  }

  if (!researchText.trim()) {
    researchText =
      `No accessible company research was available for ${companyName}.`;
  }

  /*
   * ---------------------------------------------------------
   * 3. COMPANY BRIEF
   * ---------------------------------------------------------
   */

  console.log(
    `[${evaluationCase.id}] Generating company brief...`,
  );

  const companyBrief =
    await generateCompanyBrief(
      companyName,
      researchText,
      pagesUsed,
    );

  /*
   * ---------------------------------------------------------
   * 4. INTERVIEW RESEARCH
   * ---------------------------------------------------------
   */

  console.log(
    `[${evaluationCase.id}] Researching interview information...`,
  );

  let interviewResearch;

  try {
    interviewResearch =
      await researchInterview(
        companyName,
        extractedRole.title,
      );
  } catch (error) {
    console.warn(
      `[${evaluationCase.id}] Interview research failed. Continuing.`,
    );

    console.warn(error);

    interviewResearch =
      createFallbackInterviewResearch();
  }

  /*
   * ---------------------------------------------------------
   * 5. INITIAL QUESTIONS
   * ---------------------------------------------------------
   */

  console.log(
    `[${evaluationCase.id}] Generating questions...`,
  );

  const initialQuestions =
    await generateQuestions(
      extractedRole.title,
      extractedRole.requirements,
      companyBrief,
      interviewResearch,
    );

  console.log(
    `[${evaluationCase.id}] Initial questions: ${initialQuestions.length}`,
  );

  /*
   * ---------------------------------------------------------
   * 6. COVERAGE PIPELINE
   * ---------------------------------------------------------
   *
   * runCoveragePipeline performs:
   *
   * Initial coverage check
   * +
   * One repair/second pass
   * ---------------------------------------------------------
   */

  console.log(
    `[${evaluationCase.id}] Running coverage pipeline...`,
  );

  const coverageResult =
    await runCoveragePipeline(
      extractedRole.title,
      extractedRole.requirements,
      initialQuestions,
      companyBrief,
      interviewResearch,
    );

  console.log(
    `[${evaluationCase.id}] Coverage passes: ${coverageResult.passes}`,
  );

  /*
   * IMPORTANT:
   *
   * Only MUST-HAVE requirements should cause the
   * evaluation case to fail.
   *
   * Nice-to-have requirements are allowed to remain
   * uncovered.
   */

  if (
    coverageResult.coverage
      .must_have_uncovered.length > 0
  ) {
    throw new Error(
      `Must-have requirements remain uncovered: ${coverageResult.coverage.must_have_uncovered.join(", ")}`,
    );
  }

  /*
   * ---------------------------------------------------------
   * 7. FLASHCARDS
   * ---------------------------------------------------------
   */

  console.log(
    `[${evaluationCase.id}] Generating flashcards...`,
  );

  const flashcards =
    await generateFlashcards(
      extractedRole.title,
      extractedRole.requirements,
      coverageResult.questions,
    );

  console.log(
    `[${evaluationCase.id}] Flashcards: ${flashcards.length}`,
  );

  /*
   * ---------------------------------------------------------
   * 8. SCHEDULE
   * ---------------------------------------------------------
   */

  console.log(
    `[${evaluationCase.id}] Allocating schedule...`,
  );

  const schedule =
    allocateSchedule(
      evaluationCase.days,
      extractedRole.requirements,
      coverageResult.questions,
    );

  /*
   * ---------------------------------------------------------
   * 9. FINAL KIT
   * ---------------------------------------------------------
   */

  const kit: FinalKit = {
    source: {
      company: companyName,
      company_url:
        evaluationCase.company_url,
      role: extractedRole.title,
      location: "Not specified",
      jd_chars:
        evaluationCase.jd.length,
      researched_at:
        new Date().toISOString(),
      pages_used: pagesUsed,
    },

    company_brief: companyBrief,

    role: extractedRole,

    questions:
      coverageResult.questions,

    flashcards,

    schedule,

    coverage: {
      uncovered_requirement_ids:
        coverageResult.coverage
          .uncovered_requirement_ids,
      passes:
        coverageResult.passes,
    },
  };

  /*
   * ---------------------------------------------------------
   * 10. FINAL STRUCTURE VALIDATION
   * ---------------------------------------------------------
   */

  const validation =
    validateFinalKit(
      kit,
      evaluationCase.days,
    );

  if (!validation.is_valid) {
    throw new Error(
      `Final kit validation failed: ${validation.errors.join("; ")}`,
    );
  }

  console.log(
    `[${evaluationCase.id}] Final kit validation passed.`,
  );

  return kit;
};

const runWithRetry = async (
  evaluationCase: EvaluationCase,
): Promise<FinalKit> => {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= MAX_CASE_ATTEMPTS;
    attempt++
  ) {
    try {
      return await runCase(
        evaluationCase,
      );
    } catch (error) {
      lastError = error;

      console.error(
        `[${evaluationCase.id}] Attempt ${attempt}/${MAX_CASE_ATTEMPTS} failed.`,
      );

      console.error(error);

      /*
       * Do not retry quota, invalid output,
       * coverage or other deterministic failures.
       */

      if (!isCaseRetryable(error)) {
        console.log(
          `[${evaluationCase.id}] Error is not retryable. Moving to next case.`,
        );

        break;
      }

      if (
        attempt < MAX_CASE_ATTEMPTS
      ) {
        const delay = 2000;

        console.log(
          `[${evaluationCase.id}] Temporary provider failure. Retrying once after ${delay}ms...`,
        );

        await sleep(delay);
      }
    }
  }

  throw lastError;
};

const main = async (): Promise<void> => {
  const inputPath =
    getArg("--input") ??
    DEFAULT_INPUT;

  const outputPath =
    getArg("--output") ??
    DEFAULT_OUTPUT;

  console.log(
    "========================================",
  );

  console.log(
    "AI Interview Prep Kit - Batch Evaluator",
  );

  console.log(
    "========================================",
  );

  console.log(
    `Input: ${inputPath}`,
  );

  console.log(
    `Output: ${outputPath}`,
  );

  const cases =
    await readCases(inputPath);

  console.log(
    `Loaded ${cases.length} evaluation cases.`,
  );

  const startedAt = Date.now();

  const results:
    EvaluationOutput["kits"] = [];

  /*
   * Sequential execution is intentional.
   *
   * It reduces pressure on the Gemini free tier and
   * avoids concurrent provider rate limits.
   */

  for (
    const evaluationCase of cases
  ) {
    try {
      const kit =
        await runWithRetry(
          evaluationCase,
        );

      results.push({
        id: evaluationCase.id,
        status: "ok",
        kit,
        error: null,
      });

      console.log(
        `[${evaluationCase.id}] ✅ Completed`,
      );
    } catch (error) {
      const classified =
        classifyError(error);

      results.push({
        id: evaluationCase.id,
        status: "failed",
        kit: null,
        error: classified,
      });

      console.error(
        `[${evaluationCase.id}] ❌ Failed: ${classified.code}`,
      );

      console.error(
        classified.message,
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * APPENDIX B OUTPUT
   * ---------------------------------------------------------
   */

  const output: EvaluationOutput = {
    version: "1.0",
    generated_at:
      new Date().toISOString(),

    kits: results,
  };

  await fs.mkdir(
    path.dirname(outputPath),
    {
      recursive: true,
    },
  );

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      output,
      null,
      2,
    ),
    "utf-8",
  );

  const durationSeconds =
    (Date.now() - startedAt) /
    1000;

  const successful =
    results.filter(
      (result) =>
        result.status === "ok",
    ).length;

  const failed =
    results.filter(
      (result) =>
        result.status === "failed",
    ).length;

  console.log(
    "\n========================================",
  );

  console.log(
    "Evaluation completed",
  );

  console.log(
    "========================================",
  );

  console.log(
    `Total: ${results.length}`,
  );

  console.log(
    `Successful: ${successful}`,
  );

  console.log(
    `Failed: ${failed}`,
  );

  console.log(
    `Duration: ${durationSeconds.toFixed(1)} seconds`,
  );

  console.log(
    `Output: ${outputPath}`,
  );
};

main().catch((error) => {
  console.error(
    "\nEvaluator could not start:",
  );

  console.error(error);

  process.exit(1);
});

