import dotenv from "dotenv";
import { crawlCompany } from "../crawler/index.js";
import { generateCompanyBrief } from "./companyBrief.js";

dotenv.config();

const run = async () => {
  const company = "Microsoft";
  const companyUrl = "https://www.microsoft.com/";

  console.log("🔎 Crawling company website...");

  const research = await crawlCompany(companyUrl);

  const researchText = research.pages
    .map(
      (page) =>
        `URL: ${page.url}\n` +
        `TITLE: ${page.title}\n` +
        `CONTENT: ${page.text}`,
    )
    .join("\n\n");

  console.log(
    `📄 Research pages: ${research.pages.length}`,
  );

  console.log("🤖 Generating company brief...");

  const brief = await generateCompanyBrief(
    company,
    researchText,
  );

  console.log("\n🏢 Company Brief\n");

  console.log(
    JSON.stringify(brief, null, 2),
  );
};

run().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});