import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.7-flash";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_DELAY_MS = 2000;

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

interface GeminiErrorDetails {
  status?: number;
  message?: string;
  retryDelaySeconds?: number;
  isDailyQuotaExceeded?: boolean;
}

const getErrorDetails = (error: unknown): GeminiErrorDetails => {
  if (typeof error !== "object" || error === null) {
    return {};
  }

  const errorObject = error as Record<string, unknown>;

  const status =
    typeof errorObject.status === "number"
      ? errorObject.status
      : typeof errorObject.code === "number"
        ? errorObject.code
        : undefined;

  const message =
    typeof errorObject.message === "string"
      ? errorObject.message
      : error instanceof Error
        ? error.message
        : undefined;

  const fullMessage = message?.toLowerCase() ?? "";

  const isDailyQuotaExceeded =
    fullMessage.includes("generaterequestsperdayperprojectpermodel") ||
    fullMessage.includes("requests per day") ||
    fullMessage.includes("quota exhausted") ||
    fullMessage.includes("daily quota");

  const retryDelayMatch = message?.match(
    /retryDelay["']?\s*:\s*["']?(\d+)s/i,
  );

  const retryDelaySeconds = retryDelayMatch
    ? Number(retryDelayMatch[1])
    : undefined;

  return {
    status,
    message,
    retryDelaySeconds,
    isDailyQuotaExceeded,
  };
};

const isRetryableError = (error: unknown): boolean => {
  const details = getErrorDetails(error);

  if (details.isDailyQuotaExceeded) {
    return false;
  }

  return (
    details.status === 429 ||
    details.status === 500 ||
    details.status === 502 ||
    details.status === 503 ||
    details.status === 504
  );
};

const formatGeminiError = (error: unknown): string => {
  const details = getErrorDetails(error);

  if (details.isDailyQuotaExceeded) {
    return (
      "Gemini API daily quota has been exhausted. " +
      "Please wait for the quota to reset or use a Gemini API project/model " +
      "with available quota."
    );
  }

  if (details.status === 429) {
    return (
      "Gemini API rate limit reached. " +
      "Please wait a moment and try again."
    );
  }

  if (details.status === 503 || details.status === 500) {
    return (
      "Gemini API is temporarily unavailable. " +
      "Please try again in a moment."
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to generate response from Gemini.";
};

export const generateText = async (
  prompt: string,
  maxRetries = DEFAULT_MAX_RETRIES,
): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model =
    process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const ai = new GoogleGenAI({
    apiKey,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const text = response.text?.trim();

      if (!text) {
        throw new Error("Gemini returned an empty response");
      }

      return text;
    } catch (error) {
      lastError = error;

      const details = getErrorDetails(error);

      console.error("Gemini API error:", {
        status: details.status,
        message: details.message,
        attempt,
        model,
        dailyQuotaExceeded: details.isDailyQuotaExceeded,
      });

      // Daily quota cannot be fixed by retrying.
      if (details.isDailyQuotaExceeded) {
        break;
      }

      // Non-transient errors should fail immediately.
      if (!isRetryableError(error)) {
        break;
      }

      // No retry after the final attempt.
      if (attempt > maxRetries) {
        break;
      }

      const exponentialDelay =
        DEFAULT_INITIAL_DELAY_MS * 2 ** (attempt - 1);

      const retryDelay =
        details.retryDelaySeconds !== undefined
          ? details.retryDelaySeconds * 1000
          : exponentialDelay;

      // Small jitter prevents synchronized retries.
      const jitter = Math.floor(Math.random() * 500);

      const totalDelay = retryDelay + jitter;

      console.log(
        `Gemini request failed. ` +
          `Retrying ${attempt}/${maxRetries} ` +
          `after ${totalDelay}ms...`,
      );

      await sleep(totalDelay);
    }
  }

  throw new Error(
    `Failed to generate response from Gemini: ${formatGeminiError(
      lastError,
    )}`,
  );
};