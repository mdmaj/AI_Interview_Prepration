const relevantKeywords = [
  "about",
  "company",
  "who-we-are",
  "careers",
  "career",
  "jobs",
  "job",
  "hiring",
  "interview",
  "work-with-us",
  "join-us",
  "culture",
  "team",
];

export interface RankedLink {
  url: string;
  score: number;
}

export const rankLinks = (
  links: string[]
): RankedLink[] => {
  return links
    .map((url) => {
      const lowerUrl = url.toLowerCase();

      let score = 0;

      for (const keyword of relevantKeywords) {
        if (lowerUrl.includes(keyword)) {
          score += 10;
        }
      }

      return {
        url,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
};