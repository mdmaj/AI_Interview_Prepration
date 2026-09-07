import dotenv from "dotenv";

dotenv.config();

const runTest = async (): Promise<void> => {
  try {
    const { researchInterview } = await import(
      "./interviewResearch.js"
    );

    const research = await researchInterview(
      "Microsoft",
      "Full Stack Developer"
    );

    console.log("\n🎯 Interview Research:\n");

    console.log(JSON.stringify(research, null, 2));
  } catch (error) {
    console.error("❌ Interview Research Error:", error);
  }
};

runTest();