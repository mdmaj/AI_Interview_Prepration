import { describe, expect, it } from "vitest";

import {
  classifyError,
  getCompanyNameFromUrl,
  isCaseRetryable,
  validateEvaluationCase,
} from "./evaluationHelpers.js";

describe("evaluationHelpers", () => {
  describe("getCompanyNameFromUrl", () => {
    it("extracts company name from a normal domain", () => {
      expect(getCompanyNameFromUrl("https://www.google.com")).toBe("Google");
    });

    it("handles hyphenated domains", () => {
      expect(getCompanyNameFromUrl("https://my-company.com")).toBe(
        "My Company",
      );
    });

    it("returns Unknown Company for invalid URL", () => {
      expect(getCompanyNameFromUrl("not-a-valid-url")).toBe("Unknown Company");
    });
  });

  describe("validateEvaluationCase", () => {
    it("accepts a valid evaluation case", () => {
      const result = validateEvaluationCase({
        id: "case-01",
        jd: "Frontend Developer with React experience",
        company_url: "https://example.com",
        days: 5,
      });

      expect(result).toEqual({
        id: "case-01",
        jd: "Frontend Developer with React experience",
        company_url: "https://example.com",
        days: 5,
      });
    });

    it("rejects an empty JD", () => {
      expect(() =>
        validateEvaluationCase({
          id: "case-01",
          jd: "",
          company_url: "https://example.com",
          days: 5,
        }),
      ).toThrow("jd must be a non-empty string");
    });

    it("rejects an invalid company URL", () => {
      expect(() =>
        validateEvaluationCase({
          id: "case-01",
          jd: "Frontend Developer",
          company_url: "invalid-url",
          days: 5,
        }),
      ).toThrow("company_url must be a valid HTTP/HTTPS URL");
    });

    it("rejects days below 1", () => {
      expect(() =>
        validateEvaluationCase({
          id: "case-01",
          jd: "Frontend Developer",
          company_url: "https://example.com",
          days: 0,
        }),
      ).toThrow("days must be an integer between 1 and 60");
    });

    it("rejects days above 60", () => {
      expect(() =>
        validateEvaluationCase({
          id: "case-01",
          jd: "Frontend Developer",
          company_url: "https://example.com",
          days: 61,
        }),
      ).toThrow("days must be an integer between 1 and 60");
    });
  });

  describe("classifyError", () => {
    it("classifies LLM quota errors", () => {
      expect(
        classifyError(
          new Error(
            "LLM_RATE_LIMITED: Gemini API daily quota has been exhausted",
          ),
        ),
      ).toEqual({
        code: "LLM_RATE_LIMITED",
        message: "LLM_RATE_LIMITED: Gemini API daily quota has been exhausted",
      });
    });

    it("classifies provider unavailable errors", () => {
      expect(
        classifyError(
          new Error(
            "LLM_PROVIDER_UNAVAILABLE: Gemini API is temporarily unavailable",
          ),
        ),
      ).toEqual({
        code: "LLM_PROVIDER_UNAVAILABLE",
        message:
          "LLM_PROVIDER_UNAVAILABLE: Gemini API is temporarily unavailable",
      });
    });

    it("classifies invalid LLM output", () => {
      expect(classifyError(new Error("Invalid JSON returned by LLM"))).toEqual({
        code: "INVALID_LLM_OUTPUT",
        message: "Invalid JSON returned by LLM",
      });
    });

    it("classifies uncovered must-have requirements", () => {
      expect(
        classifyError(new Error("Must-have requirements remain uncovered: r2")),
      ).toEqual({
        code: "MUST_HAVE_UNCOVERED",
        message: "Must-have requirements remain uncovered: r2",
      });
    });

    it("classifies company unreachable errors", () => {
      expect(classifyError(new Error("fetch failed: ECONNREFUSED"))).toEqual({
        code: "COMPANY_UNREACHABLE",
        message: "fetch failed: ECONNREFUSED",
      });
    });

    it("classifies unknown errors as evaluation failures", () => {
      expect(classifyError(new Error("Something unexpected happened"))).toEqual(
        {
          code: "EVALUATION_CASE_FAILED",
          message: "Something unexpected happened",
        },
      );
    });
  });

  describe("isCaseRetryable", () => {
    it("does not retry LLM quota errors", () => {
      expect(
        isCaseRetryable(new Error("LLM_RATE_LIMITED: quota exhausted")),
      ).toBe(false);
    });

    it("does not retry invalid LLM output", () => {
      expect(isCaseRetryable(new Error("Invalid JSON returned by LLM"))).toBe(
        false,
      );
    });

    it("does not retry coverage failures", () => {
      expect(
        isCaseRetryable(new Error("Must-have requirements remain uncovered")),
      ).toBe(false);
    });

    it("retries temporary provider failures", () => {
      expect(
        isCaseRetryable(
          new Error("LLM_PROVIDER_UNAVAILABLE: service unavailable"),
        ),
      ).toBe(true);
    });

    it("does not retry generic failures", () => {
      expect(isCaseRetryable(new Error("Something unexpected happened"))).toBe(
        false,
      );
    });
  });
});
