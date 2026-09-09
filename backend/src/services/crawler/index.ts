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

const MAX_DISCOVERED_PAGES = 5;

export const crawlCompany = async (
  companyUrl: string,
): Promise<CompanyResearch> => {
  // 1. Validate company URL
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
  const homepageData = extractPage(homepage.html, homepage.url);

  pages.push({
    url: homepage.url,
    title: homepageData.title,
    text: homepageData.text,
  });

  // 5. Discover relevant links
  const rankedLinks = rankLinks(homepageData.links);

  const selectedLinks: string[] = [];

  for (const item of rankedLinks) {
    if (selectedLinks.length >= MAX_DISCOVERED_PAGES) {
      break;
    }

    try {
      // Validate every discovered URL.
      const validatedLink = await validateExternalUrl(item.url);

      // For company research, stay on the same hostname.
      if (
        validatedLink.hostname.toLowerCase() !==
        validatedUrl.hostname.toLowerCase()
      ) {
        continue;
      }

      selectedLinks.push(validatedLink.toString());
    } catch {
      failedUrls.push(`${item.url} (blocked or invalid URL)`);
    }
  }

  // 6. Fetch selected pages
  for (const url of selectedLinks) {
    try {
      const pageAllowed = await canCrawl(url);

      if (!pageAllowed) {
        failedUrls.push(`${url} (blocked by robots.txt)`);
        continue;
      }

      const page = await fetchPage(url);

      const extracted = extractPage(page.html, page.url);

      pages.push({
        url: page.url,
        title: extracted.title,
        text: extracted.text,
      });
    } catch (error) {
      failedUrls.push(
        `${url}${error instanceof Error ? ` (${error.message})` : ""}`,
      );
    }
  }

  return {
    pages,
    discoveredLinks: selectedLinks,
    failedUrls,
  };
};
