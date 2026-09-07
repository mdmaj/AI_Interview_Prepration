import axios from "axios";

export const canCrawl = async (
  targetUrl: string
): Promise<boolean> => {
  const url = new URL(targetUrl);

  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;

  try {
    const response = await axios.get<string>(
      robotsUrl,
      {
        timeout: 5000,
        headers: {
          "User-Agent":
            "AI-Interview-Prep-Kit/1.0",
        },
      }
    );

    const lines = response.data.split(/\r?\n/);

    let appliesToOurBot = false;
    let disallowedPaths: string[] = [];

    for (const line of lines) {
      const cleanLine = line
        .split("#")[0]
        .trim();

      if (!cleanLine) continue;

      const [directive, value] =
        cleanLine.split(":").map((part) =>
          part.trim()
        );

      if (!directive || value === undefined) {
        continue;
      }

      const lowerDirective =
        directive.toLowerCase();

      if (lowerDirective === "user-agent") {
        appliesToOurBot =
          value === "*" ||
          value.toLowerCase() ===
            "ai-interview-prep-kit";
      }

      if (
        lowerDirective === "disallow" &&
        appliesToOurBot &&
        value
      ) {
        disallowedPaths.push(value);
      }
    }

    const pathname = url.pathname;

    return !disallowedPaths.some((path) =>
      pathname.startsWith(path)
    );
  } catch {
    // If robots.txt is unavailable, don't block the
    // entire research process.
    return true;
  }
};