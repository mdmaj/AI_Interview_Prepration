import dotenv from "dotenv";

dotenv.config();

const runTest = async (): Promise<void> => {
  try {
    const { extractRequirements } = await import(
      "./requirementExtractor.js"
    );

    const jd = `
We are looking for a Full Stack Developer.

Requirements:
- Strong knowledge of JavaScript and TypeScript
- Experience with React.js
- Experience with Node.js and Express.js
- Experience with MongoDB
- Knowledge of REST APIs
- Good communication and teamwork skills

Responsibilities:
- Build scalable web applications
- Develop frontend and backend features
- Design and integrate REST APIs
- Work with cross-functional teams
`;

    const result = await extractRequirements(jd);

    console.log(
      "🎯 Extracted Role:"
    );

    console.log(
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    console.error(
      "❌ Requirement Extraction Error:",
      error
    );
  }
};

runTest();