import axios from "axios";
import { validateExternalUrl } from "./urlValidator.js";

export interface FetchedPage {
  url: string;
  html: string;
}

const MAX_CONTENT_LENGTH = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const sleep = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const isRetryableStatus = (status: number): boolean => {
  return status === 408 || status === 425 || status === 429 || status >= 500;
};

const fetchSingleUrl = async (
  url: URL,
  timeout: number,
): Promise<
  | {
      type: "success";
      html: string;
      finalUrl: string;
    }
  | {
      type: "redirect";
      location: string;
    }
> => {
  const response = await axios.get<string>(url.toString(), {
    timeout,

    // Never allow axios/follow-redirects to automatically
    // follow an unvalidated redirect.
    maxRedirects: 0,

    maxContentLength: MAX_CONTENT_LENGTH,
    maxBodyLength: MAX_CONTENT_LENGTH,

    responseType: "text",

    headers: {
      "User-Agent": "AI-Interview-Prep-Kit/1.0 (+assessment crawler)",
      Accept: "text/html,application/xhtml+xml",
    },

    validateStatus: (status) => status >= 200 && status < 400,
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.location;

    if (!location) {
      throw new Error(`Redirect response without Location header: ${url}`);
    }

    return {
      type: "redirect",
      location,
    };
  }

  const contentType = String(
    response.headers["content-type"] ?? "",
  ).toLowerCase();

  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
  }

  if (typeof response.data !== "string") {
    throw new Error("Unexpected response body");
  }

  return {
    type: "success",
    html: response.data,
    finalUrl: url.toString(),
  };
};

export const fetchPage = async (
  url: string,
  timeout = 10000,
  maxRetries = 3,
): Promise<FetchedPage> => {
  let currentUrl = await validateExternalUrl(url);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      for (
        let redirectCount = 0;
        redirectCount <= MAX_REDIRECTS;
        redirectCount++
      ) {
        // Validate the URL immediately before every request.
        // This is important for SSRF protection.
        currentUrl = await validateExternalUrl(currentUrl.toString());

        const result = await fetchSingleUrl(currentUrl, timeout);

        if (result.type === "success") {
          return {
            url: result.finalUrl,
            html: result.html,
          };
        }

        // Resolve relative redirects safely.
        const redirectUrl = new URL(result.location, currentUrl);

        // Validate the redirect target BEFORE making the next request.
        currentUrl = await validateExternalUrl(redirectUrl.toString());
      }

      throw new Error(`Too many redirects: ${url}`);
    } catch (error) {
      lastError = error;

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        // Don't retry obvious client errors such as 400/401/403/404.
        if (status && !isRetryableStatus(status)) {
          break;
        }
      }

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
    if (lastError.code === "ECONNABORTED" || lastError.code === "ETIMEDOUT") {
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
