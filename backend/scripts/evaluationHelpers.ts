export interface EvaluationCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export interface ClassifiedError {
  code: string;
  message: string;
}

export const getCompanyNameFromUrl = (companyUrl: string): string => {
  try {
    const url = new URL(companyUrl);

    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    const parts = hostname.split(".").filter(Boolean);

    const domain = parts.length > 0 ? parts[0] : "";

    if (!domain) {
      return "Unknown Company";
    }

    return domain
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "Unknown Company";
  }
};

export const validateEvaluationCase = (value: unknown): EvaluationCase => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Each evaluation case must be an object");
  }

  const item = value as Record<string, unknown>;

  if (typeof item.id !== "string" || !item.id.trim()) {
    throw new Error("Evaluation case id must be a non-empty string");
  }

  if (typeof item.jd !== "string" || !item.jd.trim()) {
    throw new Error(`Case ${item.id}: jd must be a non-empty string`);
  }

  if (typeof item.company_url !== "string" || !item.company_url.trim()) {
    throw new Error(`Case ${item.id}: company_url must be a non-empty string`);
  }

  try {
    const url = new URL(item.company_url);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error(
      `Case ${item.id}: company_url must be a valid HTTP/HTTPS URL`,
    );
  }

  if (
    typeof item.days !== "number" ||
    !Number.isInteger(item.days) ||
    item.days < 1 ||
    item.days > 60
  ) {
    throw new Error(
      `Case ${item.id}: days must be an integer between 1 and 60`,
    );
  }

  return {
    id: item.id,
    jd: item.jd,
    company_url: item.company_url,
    days: item.days,
  };
};

export const classifyError = (error: unknown): ClassifiedError => {
  const message = error instanceof Error ? error.message : String(error);

  const normalized = message.toLowerCase();

  if (
    normalized.includes("llm_rate_limited") ||
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("429") ||
    normalized.includes("generaterequestsperdayperprojectpermodel")
  ) {
    return {
      code: "LLM_RATE_LIMITED",
      message,
    };
  }

  if (
    normalized.includes("llm_provider_unavailable") ||
    normalized.includes("gemini api is temporarily unavailable") ||
    normalized.includes("service unavailable") ||
    normalized.includes("overloaded")
  ) {
    return {
      code: "LLM_PROVIDER_UNAVAILABLE",
      message,
    };
  }

  if (
    normalized.includes("invalid json") ||
    normalized.includes("invalid structure") ||
    normalized.includes("invalid input") ||
    normalized.includes("validation failed")
  ) {
    return {
      code: "INVALID_LLM_OUTPUT",
      message,
    };
  }

  if (
    normalized.includes("must-have requirements remain uncovered") ||
    (normalized.includes("coverage") && normalized.includes("uncovered"))
  ) {
    return {
      code: "MUST_HAVE_UNCOVERED",
      message,
    };
  }

  if (
    normalized.includes("cannot reach") ||
    normalized.includes("unreachable") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound") ||
    normalized.includes("err_name_not_resolved")
  ) {
    return {
      code: "COMPANY_UNREACHABLE",
      message,
    };
  }

  return {
    code: "EVALUATION_CASE_FAILED",
    message,
  };
};

export const isCaseRetryable = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  if (
    message.includes("llm_rate_limited") ||
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("429")
  ) {
    return false;
  }

  if (
    message.includes("invalid json") ||
    message.includes("invalid structure") ||
    message.includes("validation failed")
  ) {
    return false;
  }

  if (
    message.includes("must-have requirements remain uncovered") ||
    message.includes("uncovered")
  ) {
    return false;
  }

  if (message.includes("llm_generation_failed")) {
    return false;
  }

  if (
    message.includes("llm_provider_unavailable") ||
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable") ||
    message.includes("overloaded")
  ) {
    return true;
  }

  return false;
};
