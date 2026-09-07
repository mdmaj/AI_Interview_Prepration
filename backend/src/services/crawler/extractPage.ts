import * as cheerio from "cheerio";

export interface ExtractedPage {
  title: string;
  text: string;
  links: string[];
}

export const extractPage = (
  html: string,
  baseUrl: string
): ExtractedPage => {
  const $ = cheerio.load(html);

  $("script, style, noscript, svg").remove();

  const title = $("title").text().trim();

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30000);

  const links = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href) return;

    try {
      const absoluteUrl = new URL(
        href,
        baseUrl
      ).toString();

      const parsed = new URL(absoluteUrl);

      if (
        parsed.protocol === "http:" ||
        parsed.protocol === "https:"
      ) {
        parsed.hash = "";

        links.add(parsed.toString());
      }
    } catch {
      // Ignore invalid URLs
    }
  });

  return {
    title,
    text,
    links: Array.from(links),
  };
};