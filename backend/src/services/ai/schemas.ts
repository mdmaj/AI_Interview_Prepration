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