import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.7-flash";

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 10000;

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

interface GeminiErrorDetails {
  status?: number;
  message?: string;
  retryDelaySeconds?: number;
  isDailyQuotaExceeded?: boolean;
  isRateLimited?: boolean;
  isTemporaryServerError?: boolean;
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

  let serializedError = "";

  try {
    serializedError = JSON.stringify(errorObject).toLowerCase();
  } catch {
    serializedError = message?.toLowerCase() ?? "";
  }

  const normalizedMessage = `${serializedError} ${message ?? ""}`.toLowerCase();

  /*
   * Gemini daily quota errors are NOT retryable.
   *
   * Example:
   * GenerateRequestsPerDayPerProjectPerModel-FreeTier
   */
  const isDailyQuotaExceeded =
    normalizedMessage.includes("generaterequestsperdayperprojectpermodel") ||
    normalizedMessage.includes("requests per day") ||
    normalizedMessage.includes("daily quota") ||
    normalizedMessage.includes("quota exhausted") ||
    normalizedMessage.includes("perday");

  const isRateLimited =
    status === 429 ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("ratelimit") ||
    normalizedMessage.includes("too many requests") ||
    normalizedMessage.includes("resource_exhausted");

  const isTemporaryServerError =
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    normalizedMessage.includes("temporarily unavailable") ||
    normalizedMessage.includes("service unavailable") ||
    normalizedMessage.includes("internal server error") ||
    normalizedMessage.includes("overloaded") ||
    normalizedMessage.includes("server error");

  /*
   * Gemini may return retryDelay in different formats.
   *
   * Examples:
   * retryDelay: "5s"
   * retryDelay: "2.5s"
   */
  const retryDelayMatch =
    normalizedMessage.match(/retrydelay["']?\s*:\s*["']?(\d+(?:\.\d+)?)s/i) ??
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
    isTemporaryServerError,
  };
};

const isRetryableError = (error: unknown): boolean => {
  const details = getErrorDetails(error);

  // Daily quota cannot be fixed by retrying.
  if (details.isDailyQuotaExceeded) {
    return false;
  }

  // Temporary rate limit can recover.
  if (details.isRateLimited) {
    return true;
  }

  // Temporary Gemini/provider failures can recover.
  if (details.isTemporaryServerError) {
    return true;
  }

  const message = details.message?.toLowerCase() ?? "";

  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection reset") ||
    message.includes("network error")
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

  if (details.isTemporaryServerError) {
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
        temporaryServerError: details.isTemporaryServerError,
        retryDelaySeconds: details.retryDelaySeconds,
      });

      // ---------------------------------------------------------
      // 1. Daily quota exhausted
      // ---------------------------------------------------------
      // NEVER retry this.
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
      // 3. No retries remaining
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

      // Small jitter.
      const jitter = Math.floor(Math.random() * 300);

      const totalDelay = retryDelay + jitter;

      console.log(
        `Gemini request failed. ` + `Retrying after ${totalDelay}ms...`,
      );

      await sleep(totalDelay);
    }
  }

  const details = getErrorDetails(lastError);

  /*
   * Add machine-readable prefixes.
   *
   * The evaluator can now classify errors reliably without
   * depending on Gemini's exact raw error message.
   */
  if (details.isDailyQuotaExceeded) {
    throw new Error(`LLM_RATE_LIMITED: ${formatGeminiError(lastError)}`);
  }

  if (details.isRateLimited) {
    throw new Error(`LLM_RATE_LIMITED: ${formatGeminiError(lastError)}`);
  }

  if (details.isTemporaryServerError) {
    throw new Error(
      `LLM_PROVIDER_UNAVAILABLE: ${formatGeminiError(lastError)}`,
    );
  }

  throw new Error(`LLM_GENERATION_FAILED: ${formatGeminiError(lastError)}`);
};
