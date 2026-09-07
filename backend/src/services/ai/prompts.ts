export const requirementExtractionPrompt = (jd: string): string => {
  return `
You are an expert technical recruiter and interview preparation assistant.

Analyze the following job description and extract the role information.

JOB DESCRIPTION:
${jd}

Return ONLY valid JSON with this exact structure:

{
  "title": "string",
  "seniority": "string",
  "responsibilities": [
    "string"
  ],
  "requirements": [
    {
      "text": "string",
      "kind": "technical | behavioral | other",
      "priority": "must | nice"
    }
  ]
}

Rules:

1. Extract the actual job title from the job description.
2. Determine seniority only from evidence in the job description.
3. Extract the main responsibilities.
4. Extract specific skills, qualifications, experience requirements and other expectations.
5. Classify each requirement:
   - technical: programming languages, frameworks, databases, APIs, cloud, tools, system design, etc.
   - behavioral: communication, leadership, teamwork, problem solving, collaboration, etc.
   - other: requirements that don't fit the above categories.
6. Mark a requirement as "must" when the job description clearly presents it as required, mandatory, essential, or a core qualification.
7. Mark it as "nice" when the job description presents it as preferred, bonus, plus, or desirable.
8. Do not invent requirements that are not supported by the job description.
9. Keep requirements specific and useful for generating interview questions.
10. Avoid duplicate requirements.
11. If the job description is very short, extract only what is actually supported by it.
12. Return JSON only. Do not include markdown fences or explanations.

JOB DESCRIPTION:
${jd}
`;
};

export const companyBriefPrompt = (
  companyName: string,
  researchText: string
): string => {
  return `
You are an expert company research assistant.

Create a concise company brief using ONLY the research content provided below.

Company:
${companyName}

RESEARCH CONTENT:
${researchText}

Return ONLY valid JSON:

{
  "summary": "string",
  "what_they_do": "string"
}

Rules:

1. Explain what the company does.
2. Summarize the company's business/products/services.
3. Use only information supported by the research content.
4. Do not invent facts.
5. Do not guess about the company.
6. If the research is limited, keep the summary limited.
7. Do not include URLs.
8. Do not include markdown.
9. Return JSON only.
`;
};