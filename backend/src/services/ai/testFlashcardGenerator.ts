import dotenv from "dotenv";

dotenv.config();

const runTest = async (): Promise<void> => {
  try {
    const { generateFlashcards } = await import(
      "./flashcardsGenerator.js"
    );

    const requirements = [
      {
        id: "r1",
        text: "Strong knowledge of JavaScript and TypeScript",
        kind: "technical" as const,
        priority: "must" as const,
      },
      {
        id: "r2",
        text: "Experience with React.js",
        kind: "technical" as const,
        priority: "must" as const,
      },
      {
        id: "r3",
        text: "Experience with Node.js and Express.js",
        kind: "technical" as const,
        priority: "must" as const,
      },
      {
        id: "r4",
        text: "Experience with MongoDB",
        kind: "technical" as const,
        priority: "must" as const,
      },
      {
        id: "r5",
        text: "Knowledge of REST APIs",
        kind: "technical" as const,
        priority: "must" as const,
      },
      {
        id: "r6",
        text: "Good communication and teamwork skills",
        kind: "behavioral" as const,
        priority: "must" as const,
      },
    ];

    const questions = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "coding",
        prompt:
          "How would you implement a string decompression algorithm in TypeScript?",
        answer_outline:
          "Use stacks to handle nested expressions and repeat counts.",
        difficulty: 2 as const,
      },
      {
        id: "q2",
        requirement_ids: ["r2", "r3", "r5"],
        category: "system_design",
        prompt:
          "Design a React frontend with a Node.js/Express REST API.",
        answer_outline:
          "Discuss React architecture, REST endpoints, state management and error handling.",
        difficulty: 2 as const,
      },
      {
        id: "q3",
        requirement_ids: ["r3", "r4"],
        category: "technical",
        prompt:
          "How would you handle concurrency in an Express application using MongoDB?",
        answer_outline:
          "Discuss atomic updates, indexes, transactions and connection pooling.",
        difficulty: 3 as const,
      },
      {
        id: "q4",
        requirement_ids: ["r6"],
        category: "behavioral",
        prompt:
          "Tell me about a technical disagreement you had with a teammate.",
        answer_outline:
          "Use STAR and explain communication, trade-offs and final outcome.",
        difficulty: 1 as const,
      },
    ];

    const flashcards = await generateFlashcards(
      "Full Stack Developer",
      requirements,
      questions
    );

    console.log("\n🧠 Generated Flashcards:\n");

    console.log(JSON.stringify(flashcards, null, 2));

    console.log(
      `\n✅ Total Flashcards: ${flashcards.length}`
    );
  } catch (error) {
    console.error(
      "\n❌ Flashcard Generation Error:",
      error
    );
  }
};

runTest();