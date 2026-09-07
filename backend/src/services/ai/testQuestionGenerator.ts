import dotenv from "dotenv";

dotenv.config();

const runTest = async (): Promise<void> => {
  try {
    const { generateQuestions } = await import(
      "./questionGenerator.js"
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

    const companyResearch = {
      summary:
        "Microsoft develops software, cloud computing, AI, hardware, gaming, and productivity products.",
      what_they_do:
        "Microsoft provides software, cloud services, AI solutions, hardware, advertising, and gaming platforms.",
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
        "Design a webpage and backend API for a student country knowledge test.",
      ],
      sources: [
        "https://www.jointaro.com/",
        "https://medium.com/",
      ],
      gaps: [
        "Interview structure varies by team and level.",
      ],
    };

    const questions = await generateQuestions(
      "Full Stack Developer",
      requirements,
      companyResearch,
      interviewResearch
    );

    console.log("\n🎯 Generated Questions:\n");

    console.log(JSON.stringify(questions, null, 2));

    console.log(
      `\n✅ Total Questions: ${questions.length}`
    );
  } catch (error) {
    console.error(
      "\n❌ Question Generation Error:",
      error
    );
  }
};

runTest();