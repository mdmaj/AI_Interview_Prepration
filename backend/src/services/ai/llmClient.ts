import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.7-flash";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 15000;

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

interface GeminiErrorDetails {
  status?: number;
  message?: string;
  retryDelaySeconds?: number;
  isDailyQuotaExceeded?: boolean;
  isRateLimited?: boolean;
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

  const fullMessage = JSON.stringify(error).toLowerCase();

  const isDailyQuotaExceeded =
    fullMessage.includes("generaterequestsperdayperprojectpermodel") ||
    fullMessage.includes("requests per day") ||
    fullMessage.includes("quota exhausted") ||
    fullMessage.includes("daily quota") ||
    fullMessage.includes("perday");

  const isRateLimited =
    fullMessage.includes("rate limit") ||
    fullMessage.includes("ratelimit") ||
    fullMessage.includes("too many requests") ||
    status === 429;

  const retryDelayMatch =
    fullMessage.match(/retrydelay["']?\s*:\s*["']?(\d+(?:\.\d+)?)s/i) ??
    message?.match(/retrydelay["']?\s*:\s*["']?(\d+(?:\.\d+)?)s/i);

  const retryDelaySeconds = retryDelayMatch
    ? Number(retryDelayMatch[1])
    : undefined;

  return {
    status,
    message,
    retryDelaySeconds,
    isDailyQuotaExceeded,
    isRateLimited,
  };
};

const isRetryableError = (error: unknown): boolean => {
  const details = getErrorDetails(error);

  // Daily quota exhaustion cannot be solved by retrying.
  if (details.isDailyQuotaExceeded) {
    return false;
  }

  // Rate limits are retryable.
  if (details.isRateLimited) {
    return true;
  }

  // Temporary server/provider failures are retryable.
  if (
    details.status === 500 ||
    details.status === 502 ||
    details.status === 503 ||
    details.status === 504
  ) {
    return true;
  }

  const message = details.message?.toLowerCase() ?? "";

  return (
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable") ||
    message.includes("internal server error") ||
    message.includes("server error") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
};

const formatGeminiError = (error: unknown): string => {
  const details = getErrorDetails(error);

  if (details.isDailyQuotaExceeded) {
    return (
      "Gemini API daily quota has been exhausted. " +
      "Please wait for the quota to reset or use a Gemini API " +
      "project/model with available quota."
    );
  }

  if (details.isRateLimited) {
    return (
      "Gemini API rate limit reached. " + "Please wait a moment and try again."
    );
  }

  if (
    details.status === 500 ||
    details.status === 502 ||
    details.status === 503 ||
    details.status === 504
  ) {
    return (
      "Gemini API is temporarily unavailable. " +
      "Please try again in a moment."
    );
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (details.message) {
    return details.message;
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

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const ai = new GoogleGenAI({
    apiKey,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(
        `Gemini request attempt ${attempt}/${maxRetries + 1} using ${model}`,
      );

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
        rateLimited: details.isRateLimited,
        retryDelaySeconds: details.retryDelaySeconds,
      });

      // ---------------------------------------------------------
      // 1. Daily quota exhausted
      // ---------------------------------------------------------
      // Retrying won't help, so stop immediately.
      if (details.isDailyQuotaExceeded) {
        break;
      }

      // ---------------------------------------------------------
      // 2. Non-retryable error
      // ---------------------------------------------------------
      if (!isRetryableError(error)) {
        break;
      }

      // ---------------------------------------------------------
      // 3. Final attempt already failed
      // ---------------------------------------------------------
      if (attempt > maxRetries) {
        break;
      }

      // ---------------------------------------------------------
      // 4. Calculate retry delay
      // ---------------------------------------------------------
      const exponentialDelay = DEFAULT_INITIAL_DELAY_MS * 2 ** (attempt - 1);

      const providerDelay =
        details.retryDelaySeconds !== undefined
          ? details.retryDelaySeconds * 1000
          : exponentialDelay;

      const retryDelay = Math.min(providerDelay, MAX_RETRY_DELAY_MS);

      // Small jitter to avoid synchronized retries.
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
    `Failed to generate response from Gemini: ${formatGeminiError(lastError)}`,
  );
};
