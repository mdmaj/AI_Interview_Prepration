// src/services/pipeline/generateInterviewKit.ts

import InterviewKit from "../../models/InterviewKit.js";

import { extractRequirements } from "../ai/requirementExtractor.js";
import { generateCompanyBrief } from "../ai/companyBrief.js";
import { generateQuestions } from "../ai/questionGenerator.js";
import { generateFlashcards } from "../ai/flashcardsGenerator.js";
import type { InterviewResearch } from "../ai/schemas.js";

import { crawlCompany } from "../crawler/index.js";
import { researchInterview } from "../research/interviewResearch.js";

import { runCoveragePipeline } from "./coveragePipeline.js";

import { allocateSchedule } from "../scheduling/scheduleAllocator.js";

import { validateFinalKit } from "../validation/kitValidator.js";

interface GenerationOptions {
  kitId: string;
  userId: string;
}

const MAX_RESEARCH_CHARS = 60000;

/**
 * Update generation progress in MongoDB.
 */
const updateGeneration = async (
  kitId: string,
  userId: string,
  progress: number,
  currentStep: string,
): Promise<void> => {
  await InterviewKit.findOneAndUpdate(
    {
      _id: kitId,
      user_id: userId,
    },
    {
      $set: {
        "generation.status": "generating",
        "generation.progress": progress,
        "generation.current_step": currentStep,
        "generation.error": null,
      },
    },
  );
};

/**
 * Generate complete interview preparation kit.
 *
 * Pipeline:
 *
 * 1. Load kit
 * 2. Start generation
 * 3. Extract requirements
 * 4. Crawl company website
 * 5. Save researched pages
 * 6. Prepare company research
 * 7. Generate company brief
 * 8. Save company brief
 * 9. Research public interview discussions
 * 10. Generate initial questions
 * 11. Coverage + second-pass missing questions
 * 12. Generate flashcards
 * 13. Generate deterministic schedule
 * 14. Final validation
 * 15. Save complete kit
 * 16. Mark generation completed
 */
export const generateInterviewKit = async ({
  kitId,
  userId,
}: GenerationOptions): Promise<void> => {
  try {
    // ==================================================
    // STEP 0: LOAD KIT
    // ==================================================

    const kit = await InterviewKit.findOne({
      _id: kitId,
      user_id: userId,
    });

    if (!kit) {
      throw new Error("Interview kit not found");
    }

    console.log(`\n🚀 Starting interview kit generation: ${kitId}`);

    // ==================================================
    // STEP 1: START GENERATION
    // ==================================================

    await updateGeneration(
      kitId,
      userId,
      10,
      "Starting interview kit generation",
    );

    console.log("Step 1: Generation started");

    // ==================================================
    // STEP 2: EXTRACT REQUIREMENTS
    // ==================================================

    await updateGeneration(
      kitId,
      userId,
      20,
      "Analyzing job description and extracting requirements",
    );

    console.log("Step 2: Extracting requirements from job description...");

    const extractedRole = await extractRequirements(kit.source.jd);

    console.log(`Requirements extracted: ${extractedRole.requirements.length}`);

    if (extractedRole.requirements.length === 0) {
      throw new Error(
        "No interview requirements could be extracted from the job description.",
      );
    }

    await InterviewKit.findOneAndUpdate(
      {
        _id: kitId,
        user_id: userId,
      },
      {
        $set: {
          "role.title": extractedRole.title,
          "role.seniority": extractedRole.seniority,
          "role.responsibilities": extractedRole.responsibilities,
          "role.requirements": extractedRole.requirements,
        },
      },
    );

    await updateGeneration(
      kitId,
      userId,
      30,
      "Job requirements extracted successfully",
    );

    // ==================================================
    // STEP 3: COMPANY WEBSITE RESEARCH
    // ==================================================

    await updateGeneration(kitId, userId, 40, "Researching company website");

    console.log(`Step 3: Crawling company website: ${kit.source.company_url}`);

    let companyResearch: {
      pages: Array<{
        url: string;
        title: string;
        text: string;
      }>;
      discoveredLinks: string[];
      failedUrls: string[];
    };

    try {
      companyResearch = await crawlCompany(kit.source.company_url);

      console.log("Company research completed.");
      console.log(`Pages researched: ${companyResearch.pages.length}`);
      console.log(`Failed URLs: ${companyResearch.failedUrls.length}`);
      console.log(
        `Discovered links: ${companyResearch.discoveredLinks.length}`,
      );
    } catch (error) {
      console.error("Company research failed:", error);

      /*
       * Company research is supporting information.
       *
       * The kit should still be generated using:
       * - Job description
       * - Extracted requirements
       * - Public interview research
       *
       * Therefore, crawling failure does NOT fail the complete pipeline.
       */
      companyResearch = {
        pages: [],
        discoveredLinks: [],
        failedUrls: [kit.source.company_url],
      };
    }

    // ==================================================
    // STEP 4: SAVE RESEARCHED PAGES
    // ==================================================

    const pagesUsed = companyResearch.pages.map((page) => page.url);

    await InterviewKit.findOneAndUpdate(
      {
        _id: kitId,
        user_id: userId,
      },
      {
        $set: {
          "source.pages_used": pagesUsed,
        },
      },
    );

    console.log(`Pages saved to kit: ${pagesUsed.length}`);

    // ==================================================
    // STEP 5: PREPARE COMPANY RESEARCH TEXT
    // ==================================================

    await updateGeneration(kitId, userId, 50, "Preparing company research");

    console.log("Step 5: Preparing company research text...");

    const fullResearchText = companyResearch.pages
      .map(
        (page) =>
          `URL: ${page.url}\n` +
          `TITLE: ${page.title}\n` +
          `CONTENT: ${page.text}`,
      )
      .join("\n\n");

    /*
     * If the company website could not be crawled,
     * still provide useful context to the LLM.
     *
     * This prevents an empty research payload from
     * unnecessarily breaking the generation pipeline.
     */
    const researchText =
      fullResearchText.trim().length > 0
        ? fullResearchText.length > MAX_RESEARCH_CHARS
          ? fullResearchText.slice(0, MAX_RESEARCH_CHARS)
          : fullResearchText
        : `No usable company website content was available.

Company: ${kit.source.company}

Company website:
${kit.source.company_url}

The company website could not be researched successfully.
Use only the available company name and other research sources.
Do not invent company-specific facts.`;

    console.log(`Full research text length: ${fullResearchText.length}`);
    console.log(`Research text sent to LLM: ${researchText.length}`);

    // ==================================================
    // STEP 6: GENERATE COMPANY BRIEF
    // ==================================================

    await updateGeneration(kitId, userId, 55, "Generating company brief");

    console.log("Step 6: Generating company brief...");

    const companyBrief = await generateCompanyBrief(
      kit.source.company,
      researchText,
    );

    console.log("Company brief generated successfully.");

    // ==================================================
    // STEP 7: SAVE COMPANY BRIEF
    // ==================================================

    const companyBriefSources = companyResearch.pages.map((page) => page.url);

    await InterviewKit.findOneAndUpdate(
      {
        _id: kitId,
        user_id: userId,
      },
      {
        $set: {
          "company_brief.summary": companyBrief.summary,
          "company_brief.what_they_do": companyBrief.what_they_do,
          "company_brief.sources": companyBriefSources,
        },
      },
    );

    console.log("Company brief saved successfully.");

    // ==================================================
    // STEP 8: PUBLIC INTERVIEW RESEARCH
    // ==================================================

    await updateGeneration(
      kitId,
      userId,
      65,
      "Researching public interview experiences",
    );

    console.log("Step 8: Searching public interview discussions...");

    let interviewResearch: InterviewResearch;

    try {
      interviewResearch = await researchInterview(
        kit.source.company,
        extractedRole.title,
      );

      console.log("Public interview research completed.");

      console.log(
        `Interview sources found: ${interviewResearch.sources.length}`,
      );

      console.log(
        `Reported questions found: ${interviewResearch.reported_questions.length}`,
      );

      console.log(
        `Common topics found: ${interviewResearch.common_topics.length}`,
      );

      console.log(`Research gaps: ${interviewResearch.gaps.length}`);
    } catch (error) {
      console.error("Interview research failed:", error);

      /*
       * Public interview research is optional.
       *
       * The rest of the pipeline can continue using
       * the JD + company research.
       */
      interviewResearch = {
        process: [],
        common_topics: [],
        reported_questions: [],
        sources: [],
        gaps: ["Public interview research could not be completed."],
      };
    }

    console.log("Interview research sources:", interviewResearch.sources);

    // ==================================================
    // STEP 9: GENERATE INITIAL QUESTIONS
    // ==================================================

    await updateGeneration(
      kitId,
      userId,
      75,
      "Generating personalized interview questions",
    );

    console.log("Step 9: Generating personalized interview questions...");

    const companyResearchForGeneration = {
      ...companyBrief,
      sources: companyBriefSources,
    };

    const initialQuestions = await generateQuestions(
      extractedRole.title,
      extractedRole.requirements,
      companyResearchForGeneration,
      interviewResearch,
    );

    console.log(`Initial questions generated: ${initialQuestions.length}`);

    if (initialQuestions.length === 0) {
      throw new Error("No interview questions were generated.");
    }

    // ==================================================
    // STEP 10: COVERAGE + SECOND PASS
    // ==================================================

    await updateGeneration(
      kitId,
      userId,
      80,
      "Checking requirement coverage and repairing missing must-have topics",
    );

    console.log("Step 10: Checking requirement coverage...");

    const coverageResult = await runCoveragePipeline(
      extractedRole.title,
      extractedRole.requirements,
      initialQuestions,
      companyResearchForGeneration,
      interviewResearch,
    );

    console.log(`Coverage pass count: ${coverageResult.passes}`);

    console.log(`Initial question count: ${initialQuestions.length}`);

    console.log(`Final question count: ${coverageResult.questions.length}`);

    console.log(
      `Uncovered requirements: ${coverageResult.coverage.uncovered_requirement_ids.length}`,
    );

    console.log(
      `Uncovered MUST-HAVE requirements: ${coverageResult.coverage.must_have_uncovered.length}`,
    );

    console.log(`Coverage complete: ${coverageResult.coverage.is_complete}`);

    /*
     * Every MUST-HAVE requirement must be covered
     * after the coverage repair loop.
     */
    if (coverageResult.coverage.must_have_uncovered.length > 0) {
      throw new Error(
        `Coverage incomplete after ${coverageResult.passes} passes. ` +
          `Uncovered MUST-HAVE requirements: ` +
          `${coverageResult.coverage.must_have_uncovered.join(", ")}`,
      );
    }

    const finalQuestions = coverageResult.questions;

    console.log(`Using ${finalQuestions.length} final questions.`);

    // ==================================================
    // STEP 11: GENERATE FLASHCARDS
    // ==================================================

    await updateGeneration(
      kitId,
      userId,
      85,
      "Generating interview flashcards",
    );

    console.log("Step 11: Generating interview flashcards...");

    /*
     * Flashcards use FINAL questions so questions created
     * during the coverage repair pass are also included.
     */
    const flashcards = await generateFlashcards(
      extractedRole.title,
      extractedRole.requirements,
      finalQuestions,
    );

    console.log(`Flashcards generated: ${flashcards.length}`);

    // ==================================================
    // STEP 12: DETERMINISTIC SCHEDULE
    // ==================================================

    await updateGeneration(
      kitId,
      userId,
      90,
      "Creating personalized interview preparation schedule",
    );

    console.log("Step 12: Creating deterministic interview schedule...");

    const schedule = allocateSchedule(
      kit.schedule.days_available,
      extractedRole.requirements,
      finalQuestions,
    );

    console.log(`Schedule created for ${schedule.days_available} days.`);

    console.log(`Schedule days generated: ${schedule.days.length}`);

    // ==================================================
    // STEP 13: BUILD FINAL KIT OBJECT
    // ==================================================

    await updateGeneration(
      kitId,
      userId,
      95,
      "Validating final interview preparation kit",
    );

    console.log("Step 13: Building final kit for validation...");

    const researchedAt = new Date().toISOString();

    const finalKit = {
      source: {
        company: kit.source.company,
        company_url: kit.source.company_url,
        role: kit.source.role,
        location: kit.source.location?.trim() || "Not specified",
        jd_chars: kit.source.jd_chars,
        researched_at: researchedAt,
        pages_used: pagesUsed,
      },

      company_brief: {
        summary: companyBrief.summary,
        what_they_do: companyBrief.what_they_do,
        sources: companyBriefSources,
      },

      role: {
        title: extractedRole.title,
        seniority: extractedRole.seniority,
        responsibilities: extractedRole.responsibilities,
        requirements: extractedRole.requirements,
      },

      questions: finalQuestions,

      flashcards,

      schedule,

      coverage: {
        uncovered_requirement_ids:
          coverageResult.coverage.uncovered_requirement_ids,

        passes: coverageResult.passes,
      },
    };

    // ==================================================
    // STEP 14: FINAL VALIDATION
    // ==================================================

    console.log("Step 14: Running final kit validation...");

    const validation = validateFinalKit(finalKit, kit.schedule.days_available);

    if (!validation.is_valid) {
      console.error("Final kit validation failed:", validation.errors);

      throw new Error(
        `Final kit validation failed: ${validation.errors.join(" | ")}`,
      );
    }

    console.log("Final kit validation passed.");

    // ==================================================
    // STEP 15: SAVE COMPLETE KIT
    // ==================================================

    await updateGeneration(
      kitId,
      userId,
      98,
      "Saving completed interview preparation kit",
    );

    console.log("Step 15: Saving complete kit to MongoDB...");

    await InterviewKit.findOneAndUpdate(
      {
        _id: kitId,
        user_id: userId,
      },
      {
        $set: {
          "source.location": kit.source.location?.trim() || "Not specified",

          "source.researched_at": researchedAt,

          "source.pages_used": pagesUsed,

          company_brief: {
            summary: companyBrief.summary,
            what_they_do: companyBrief.what_they_do,
            sources: companyBriefSources,
          },

          role: {
            title: extractedRole.title,
            seniority: extractedRole.seniority,
            responsibilities: extractedRole.responsibilities,
            requirements: extractedRole.requirements,
          },

          questions: finalQuestions,

          flashcards,

          schedule,

          coverage: {
            uncovered_requirement_ids:
              coverageResult.coverage.uncovered_requirement_ids,

            passes: coverageResult.passes,
          },
        },
      },
    );

    // ==================================================
    // STEP 16: MARK GENERATION COMPLETED
    // ==================================================

    await InterviewKit.findOneAndUpdate(
      {
        _id: kitId,
        user_id: userId,
      },
      {
        $set: {
          "generation.status": "completed",
          "generation.progress": 100,
          "generation.current_step": "Interview kit generated successfully",
          "generation.error": null,
        },
      },
    );

    console.log(
      `\n✅ Interview kit generation completed successfully: ${kitId}`,
    );

    console.log(`Requirements: ${extractedRole.requirements.length}`);

    console.log(`Questions: ${finalQuestions.length}`);

    console.log(`Flashcards: ${flashcards.length}`);

    console.log(`Schedule days: ${schedule.days.length}`);

    console.log(`Coverage passes: ${coverageResult.passes}`);
  } catch (error) {
    // ==================================================
    // GENERATION FAILURE
    // ==================================================

    console.error(`\n❌ Interview kit generation failed for ${kitId}:`, error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown generation error";

    await InterviewKit.findOneAndUpdate(
      {
        _id: kitId,
        user_id: userId,
      },
      {
        $set: {
          "generation.status": "failed",
          "generation.progress": 0,
          "generation.current_step": "Interview kit generation failed",
          "generation.error": errorMessage,
        },
      },
    );

    throw error;
  }
};
