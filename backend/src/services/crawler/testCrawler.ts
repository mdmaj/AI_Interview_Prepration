import dotenv from "dotenv";

dotenv.config();

const runTest = async (): Promise<void> => {
  try {
    const { crawlCompany } = await import(
      "./index.js"
    );

    const result = await crawlCompany(
      "https://www.microsoft.com"
    );

    console.log("\n🏢 Company Research\n");

    console.log(
      "Pages fetched:",
      result.pages.length
    );

    console.log(
      "\nDiscovered pages:"
    );

    result.discoveredLinks.forEach((url) => {
      console.log("-", url);
    });

    console.log(
      "\nFailed pages:",
      result.failedUrls
    );

    console.log("\nPage titles:");

    result.pages.forEach((page) => {
      console.log(
        `- ${page.title} → ${page.url}`
      );
    });
  } catch (error) {
    console.error(
      "❌ Crawler Error:",
      error
    );
  }
};

runTest();