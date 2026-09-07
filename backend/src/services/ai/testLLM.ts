import dotenv from "dotenv";

dotenv.config();

const runTest = async (): Promise<void> => {
  try {
    const { generateText } = await import("./llmClient.js");

    const response = await generateText(
      "Explain what a Full Stack Developer does in one simple sentence.",
    );

    console.log("🤖 Gemini Response:");
    console.log(response);
  } catch (error) {
    console.error("❌ Gemini Error:", error);
  }
};

runTest();
