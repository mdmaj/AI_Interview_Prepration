import dotenv from "dotenv";

dotenv.config();

const runTest = async (): Promise<void> => {
  try {
    const { crawlCompany } = await import(
      "../crawler/index.js"
    );

    const { generateCompanyBrief } =
      await import("./companyBrief.js");

    console.log("🔎 Crawling Microsoft...");

    const research = await crawlCompany(
      "https://www.microsoft.com"
    );

    console.log(
      `📄 Pages collected: ${research.pages.length}`
    );

    const brief = await generateCompanyBrief(
      "Microsoft",
      research.pages
    );

    console.log("\n🏢 Company Brief:\n");

    console.log(
      JSON.stringify(brief, null, 2)
    );
  } catch (error) {
    console.error(
      "❌ Company Brief Error:",
      error
    );
  }
};

runTest();