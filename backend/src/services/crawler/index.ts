import { fetchPage } from "./fetchPage.js";
import { extractPage } from "./extractPage.js";
import { rankLinks } from "./linkDiscovery.js";
import { validateExternalUrl } from "./urlValidator.js";
import { canCrawl } from "./robots.js";

export interface ResearchPage {
  url: string;
  title: string;
  text: string;
}

export interface CompanyResearch {
  pages: ResearchPage[];
  discoveredLinks: string[];
  failedUrls: string[];
}

export const crawlCompany = async (
  companyUrl: string,
): Promise<CompanyResearch> => {
  // 1. Validate URL
  const validatedUrl = await validateExternalUrl(companyUrl);

  const normalizedUrl = validatedUrl.toString();

  // 2. Check robots.txt
  const allowed = await canCrawl(normalizedUrl);

  if (!allowed) {
    throw new Error("Company website crawling is blocked by robots.txt");
  }

  const pages: ResearchPage[] = [];
  const failedUrls: string[] = [];

  // 3. Fetch homepage
  let homepage;

  try {
    homepage = await fetchPage(normalizedUrl);
  } catch (error) {
    throw new Error(
      `Company site unreachable: ${
        error instanceof Error ? error.message : normalizedUrl
      }`,
    );
  }

  // 4. Extract homepage
  const homepageData = extractPage(homepage.html, normalizedUrl);

  pages.push({
    url: normalizedUrl,
    title: homepageData.title,
    text: homepageData.text,
  });

  // 5. Discover relevant links
  const rankedLinks = rankLinks(homepageData.links);

  const selectedLinks = rankedLinks.slice(0, 5).map((item) => item.url);

  // 6. Fetch selected pages
  for (const url of selectedLinks) {
    try {
      const pageAllowed = await canCrawl(url);

      if (!pageAllowed) {
        failedUrls.push(`${url} (blocked by robots.txt)`);
        continue;
      }

      const page = await fetchPage(url);

      const extracted = extractPage(page.html, url);

      pages.push({
        url,
        title: extracted.title,
        text: extracted.text,
      });
    } catch {
      failedUrls.push(url);
    }
  }

  return {
    pages,
    discoveredLinks: selectedLinks,
    failedUrls,
  };
};
