import { z } from "zod";

export const requirementSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(["technical", "behavioral", "other"]),
  priority: z.enum(["must", "nice"]),
});

export const extractedRoleSchema = z.object({
  title: z.string().min(1),
  seniority: z.string().min(1),
  responsibilities: z.array(z.string()),
  requirements: z.array(requirementSchema),
});

export const companyBriefSchema = z.object({
  summary: z.string().min(1),
  what_they_do: z.string().min(1),
});

export type CompanyBrief = z.infer<typeof companyBriefSchema>;

export type ExtractedRole = z.infer<typeof extractedRoleSchema>;
export type ExtractedRequirement = z.infer<typeof requirementSchema>;

export const interviewResearchSchema = z.object({
  process: z.array(z.string()),
  common_topics: z.array(z.string()),
  reported_questions: z.array(z.string()),
  sources: z.array(z.string()),
  gaps: z.array(z.string()),
});

export type InterviewResearch = z.infer<
  typeof interviewResearchSchema
>;


export const questionSchema = z.object({
  requirement_ids: z.array(z.string().min(1)),
  category: z.enum([
    "technical",
    "behavioral",
    "system_design",
    "coding",
    "other",
  ]),
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  difficulty: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
});

export const questionsSchema = z.object({
  questions: z.array(questionSchema),
});

export const flashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
});

export const flashcardsSchema = z.object({
  flashcards: z.array(flashcardSchema),
});

export type GeneratedQuestion = z.infer<
  typeof questionSchema
> & {
  id: string;
};

export type GeneratedFlashcard = z.infer<
  typeof flashcardSchema
> & {
  id: string;
};