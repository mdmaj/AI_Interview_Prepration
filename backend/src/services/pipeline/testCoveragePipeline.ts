import dotenv from "dotenv";

dotenv.config();

const runTest = async (): Promise<void> => {
  try {
    const { runCoveragePipeline } = await import(
      "./coveragePipeline.js"
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

    // Intentionally leaving r6 uncovered.
    const questions = [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "coding" as const,
        prompt:
          "How would you implement a string decompression algorithm in TypeScript?",
        answer_outline:
          "Use stacks to handle nested expressions and repeat counts.",
        difficulty: 2 as const,
      },
      {
        id: "q2",
        requirement_ids: ["r2", "r3", "r5"],
        category: "system_design" as const,
        prompt:
          "Design a React frontend with a Node.js and Express REST API.",
        answer_outline:
          "Discuss React architecture, REST endpoints, state management and error handling.",
        difficulty: 2 as const,
      },
      {
        id: "q3",
        requirement_ids: ["r3", "r4"],
        category: "technical" as const,
        prompt:
          "How would you handle concurrency in an Express application using MongoDB?",
        answer_outline:
          "Discuss atomic updates, indexes, transactions and connection pooling.",
        difficulty: 3 as const,
      },
    ];

    const companyResearch = {
      summary:
        "Microsoft develops software, cloud computing, AI, hardware, gaming and productivity products.",
      what_they_do:
        "Microsoft provides software, cloud services, AI solutions, hardware and productivity platforms.",
      sources: [
        "https://www.microsoft.com/",
        "https://careers.microsoft.com/",
      ],
    };

    const interviewResearch = {
      process: [
        "Online Assessment",
        "Technical coding rounds",
        "Behavioral and managerial rounds",
      ],
      common_topics: [
        "Data Structures and Algorithms",
        "Full-stack application design",
        "Project deep dive",
        "Behavioral questions",
      ],
      reported_questions: [
        "Given a compressed string like 'a2[bc]', decompress it.",
      ],
      sources: [
        "https://www.jointaro.com/",
        "https://medium.com/",
      ],
      gaps: [
        "Interview structure varies by team and level.",
      ],
    };

    console.log("\n🔄 Running Coverage Pipeline...\n");

    const result = await runCoveragePipeline(
      "Full Stack Developer",
      requirements,
      questions,
      companyResearch,
      interviewResearch
    );

    console.log("📊 Final Result:\n");

    console.log(JSON.stringify(result, null, 2));

    console.log("\n------------------------------");
    console.log(`Questions: ${result.questions.length}`);
    console.log(`Passes: ${result.passes}`);
    console.log(
      `Complete: ${result.coverage.is_complete}`
    );
    console.log(
      "Uncovered:",
      result.coverage.uncovered_requirement_ids
    );
    console.log("------------------------------\n");
  } catch (error) {
    console.error(
      "\n❌ Coverage Pipeline Error:",
      error
    );
  }
};

runTest();