import axios from "axios";

export interface FetchedPage {
  url: string;
  html: string;
}

const sleep = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

export const fetchPage = async (
  url: string,
  timeout = 10000,
  maxRetries = 3,
): Promise<FetchedPage> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get<string>(url, {
        timeout,
        maxContentLength: 2 * 1024 * 1024,
        maxBodyLength: 2 * 1024 * 1024,
        headers: {
          "User-Agent": "AI-Interview-Prep-Kit/1.0 (+assessment crawler)",
          Accept: "text/html,application/xhtml+xml",
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const contentType = String(
        response.headers["content-type"] ?? "",
      ).toLowerCase();

      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      return {
        url,
        html: response.data,
      };
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const delay = 500 * 2 ** (attempt - 1);

      console.log(
        `Retry ${attempt}/${maxRetries - 1} for ${url} after ${delay}ms`,
      );

      await sleep(delay);
    }
  }

  if (axios.isAxiosError(lastError)) {
    if (lastError.code === "ECONNABORTED") {
      throw new Error(`Request timed out after ${maxRetries} attempts: ${url}`);
    }

    throw new Error(
      `Failed to fetch ${url} after ${maxRetries} attempts: ${
        lastError.response?.status || lastError.message
      }`,
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch ${url}`);
};
