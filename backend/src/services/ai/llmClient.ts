import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_DELAY_MS = 1500;
const MAX_RETRY_DELAY_MS = 10000;

const MODEL_ALIASES: Record<string, string> = {
  "gemini-2.5-flash": DEFAULT_MODEL,
  "gemini-2.5-flash-lite": DEFAULT_FALLBACK_MODEL,
};

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

  const isDailyQuotaExceeded =
    normalizedMessage.includes("generaterequestsperdayperprojectpermodel") ||
    normalizedMessage.includes("requests per day") ||
    normalizedMessage.includes("daily quota") ||
    normalizedMessage.includes("quota exhausted") ||
    normalizedMessage.includes("perday") ||
    normalizedMessage.includes("free_tier_requests");

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

  if (details.isDailyQuotaExceeded) {
    return false;
  }

  if (details.isRateLimited) {
    return true;
  }

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
      "The configured model has no remaining free-tier requests."
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

const getModels = (): string[] => {
  const configuredPrimaryModel = process.env.GEMINI_MODEL?.trim();
  const configuredFallbackModel = process.env.GEMINI_FALLBACK_MODEL?.trim();

  const primaryModel =
    MODEL_ALIASES[configuredPrimaryModel ?? ""] ??
    configuredPrimaryModel ??
    DEFAULT_MODEL;

  const fallbackModel =
    MODEL_ALIASES[configuredFallbackModel ?? ""] ??
    configuredFallbackModel ??
    DEFAULT_FALLBACK_MODEL;

  return [...new Set([primaryModel, fallbackModel])];
};

const generateWithModel = async (
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  maxRetries: number,
): Promise<string> => {
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
        throw new Error(`Gemini returned an empty response from ${model}`);
      }

      console.log(`Gemini generation succeeded using ${model}`);

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

      /*
       * Daily quota is model-specific and cannot be fixed
       * by retrying the same model.
       */
      if (details.isDailyQuotaExceeded) {
        break;
      }

      if (!isRetryableError(error)) {
        break;
      }

      if (attempt > maxRetries) {
        break;
      }

      const exponentialDelay = DEFAULT_INITIAL_DELAY_MS * 2 ** (attempt - 1);

      const providerDelay =
        details.retryDelaySeconds !== undefined
          ? details.retryDelaySeconds * 1000
          : exponentialDelay;

      const retryDelay = Math.min(providerDelay, MAX_RETRY_DELAY_MS);

      const jitter = Math.floor(Math.random() * 300);

      const totalDelay = retryDelay + jitter;

      console.log(`Retrying ${model} after ${totalDelay}ms...`);

      await sleep(totalDelay);
    }
  }

  throw lastError ?? new Error("Gemini generation failed");
};

export const generateText = async (
  prompt: string,
  maxRetries = DEFAULT_MAX_RETRIES,
): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  if (!prompt.trim()) {
    throw new Error("Gemini prompt cannot be empty");
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const models = getModels();

  let lastError: unknown;

  for (let index = 0; index < models.length; index++) {
    const model = models[index];

    try {
      console.log(`Starting Gemini generation with model ${model}`);

      return await generateWithModel(ai, model, prompt, maxRetries);
    } catch (error) {
      lastError = error;

      const details = getErrorDetails(error);

      const hasAnotherModel = index < models.length - 1;

      /*
       * If the current model is exhausted or temporarily
       * unavailable, move to the fallback model.
       */
      if (hasAnotherModel) {
        console.warn(
          `Gemini model ${model} failed. ` +
            `Trying fallback model ${models[index + 1]}.`,
        );

        continue;
      }

      break;
    }
  }

  const details = getErrorDetails(lastError);

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
