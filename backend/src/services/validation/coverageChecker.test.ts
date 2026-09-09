import { describe, expect, it } from "vitest";

import {
  checkCoverage,
  type CoverageQuestion,
  type CoverageRequirement,
} from "./coverageChecker.js";

/*
 * ============================================================
 * Coverage Checker Tests
 * ============================================================
 *
 * Responsibilities being tested:
 *
 * 1. Detect complete coverage
 * 2. Detect uncovered must-have requirements
 * 3. Allow uncovered nice-to-have requirements
 * 4. Handle duplicate requirement coverage
 * 5. Handle empty question sets
 * 6. Ignore invalid requirement references
 * 7. Preserve requirement ordering
 * ============================================================
 */

describe("Coverage Checker", () => {
  /*
   * ----------------------------------------------------------
   * Test 1
   * All requirements covered
   * ----------------------------------------------------------
   */

  it("should report complete coverage when all requirements are covered", () => {
    const requirements: CoverageRequirement[] = [
      {
        id: "r1",
        priority: "must",
      },
      {
        id: "r2",
        priority: "must",
      },
      {
        id: "r3",
        priority: "nice",
      },
    ];

    const questions: CoverageQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
      },
      {
        id: "q2",
        requirement_ids: ["r2", "r3"],
      },
    ];

    const result = checkCoverage(requirements, questions);

    expect(result).toEqual({
      uncovered_requirement_ids: [],
      covered_requirement_ids: ["r1", "r2", "r3"],
      must_have_uncovered: [],
      is_complete: true,
    });
  });

  /*
   * ----------------------------------------------------------
   * Test 2
   * Must-have requirement uncovered
   * ----------------------------------------------------------
   */

  it("should detect uncovered must-have requirements", () => {
    const requirements: CoverageRequirement[] = [
      {
        id: "r1",
        priority: "must",
      },
      {
        id: "r2",
        priority: "must",
      },
      {
        id: "r3",
        priority: "nice",
      },
    ];

    const questions: CoverageQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
      },
    ];

    const result = checkCoverage(requirements, questions);

    expect(result.uncovered_requirement_ids).toEqual(["r2", "r3"]);

    expect(result.covered_requirement_ids).toEqual(["r1"]);

    expect(result.must_have_uncovered).toEqual(["r2"]);

    expect(result.is_complete).toBe(false);
  });

  /*
   * ----------------------------------------------------------
   * Test 3
   * Only nice-to-have uncovered
   * ----------------------------------------------------------
   */

  it("should remain complete when only nice-to-have requirements are uncovered", () => {
    const requirements: CoverageRequirement[] = [
      {
        id: "r1",
        priority: "must",
      },
      {
        id: "r2",
        priority: "must",
      },
      {
        id: "r3",
        priority: "nice",
      },
    ];

    const questions: CoverageQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1", "r2"],
      },
    ];

    const result = checkCoverage(requirements, questions);

    expect(result.covered_requirement_ids).toEqual(["r1", "r2"]);

    expect(result.uncovered_requirement_ids).toEqual(["r3"]);

    expect(result.must_have_uncovered).toEqual([]);

    expect(result.is_complete).toBe(true);
  });

  /*
   * ----------------------------------------------------------
   * Test 4
   * Duplicate requirement coverage
   * ----------------------------------------------------------
   */

  it("should handle multiple questions covering the same requirement", () => {
    const requirements: CoverageRequirement[] = [
      {
        id: "r1",
        priority: "must",
      },
      {
        id: "r2",
        priority: "must",
      },
    ];

    const questions: CoverageQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
      },
      {
        id: "q2",
        requirement_ids: ["r1"],
      },
      {
        id: "q3",
        requirement_ids: ["r2"],
      },
    ];

    const result = checkCoverage(requirements, questions);

    expect(result.covered_requirement_ids).toEqual(["r1", "r2"]);

    expect(result.uncovered_requirement_ids).toEqual([]);

    expect(result.must_have_uncovered).toEqual([]);

    expect(result.is_complete).toBe(true);
  });

  /*
   * ----------------------------------------------------------
   * Test 5
   * No questions
   * ----------------------------------------------------------
   */

  it("should mark must-have requirements as uncovered when there are no questions", () => {
    const requirements: CoverageRequirement[] = [
      {
        id: "r1",
        priority: "must",
      },
      {
        id: "r2",
        priority: "nice",
      },
    ];

    const questions: CoverageQuestion[] = [];

    const result = checkCoverage(requirements, questions);

    expect(result.covered_requirement_ids).toEqual([]);

    expect(result.uncovered_requirement_ids).toEqual(["r1", "r2"]);

    expect(result.must_have_uncovered).toEqual(["r1"]);

    expect(result.is_complete).toBe(false);
  });

  /*
   * ----------------------------------------------------------
   * Test 6
   * Invalid requirement references
   * ----------------------------------------------------------
   *
   * A question can reference an ID that doesn't exist
   * in the requirements list.
   *
   * The coverage checker should ignore that reference.
   * ----------------------------------------------------------
   */

  it("should ignore invalid requirement references", () => {
    const requirements: CoverageRequirement[] = [
      {
        id: "r1",
        priority: "must",
      },
      {
        id: "r2",
        priority: "nice",
      },
    ];

    const questions: CoverageQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1", "invalid-r99"],
      },
    ];

    const result = checkCoverage(requirements, questions);

    expect(result.covered_requirement_ids).toEqual(["r1"]);

    expect(result.uncovered_requirement_ids).toEqual(["r2"]);

    expect(result.must_have_uncovered).toEqual([]);

    expect(result.is_complete).toBe(true);
  });

  /*
   * ----------------------------------------------------------
   * Test 7
   * Multiple uncovered must-have requirements
   * ----------------------------------------------------------
   */

  it("should detect all uncovered must-have requirements", () => {
    const requirements: CoverageRequirement[] = [
      {
        id: "r1",
        priority: "must",
      },
      {
        id: "r2",
        priority: "must",
      },
      {
        id: "r3",
        priority: "must",
      },
      {
        id: "r4",
        priority: "nice",
      },
    ];

    const questions: CoverageQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r1"],
      },
    ];

    const result = checkCoverage(requirements, questions);

    expect(result.must_have_uncovered).toEqual(["r2", "r3"]);

    expect(result.is_complete).toBe(false);
  });

  /*
   * ----------------------------------------------------------
   * Test 8
   * Requirement ordering
   * ----------------------------------------------------------
   *
   * The returned lists should follow the order
   * of the requirements array, not question order.
   * ----------------------------------------------------------
   */

  it("should preserve requirement ordering in coverage results", () => {
    const requirements: CoverageRequirement[] = [
      {
        id: "r3",
        priority: "nice",
      },
      {
        id: "r1",
        priority: "must",
      },
      {
        id: "r2",
        priority: "must",
      },
    ];

    const questions: CoverageQuestion[] = [
      {
        id: "q1",
        requirement_ids: ["r2", "r1", "r3"],
      },
    ];

    const result = checkCoverage(requirements, questions);

    expect(result.covered_requirement_ids).toEqual(["r3", "r1", "r2"]);

    expect(result.uncovered_requirement_ids).toEqual([]);

    expect(result.is_complete).toBe(true);
  });

  /*
   * ----------------------------------------------------------
   * Test 9
   * No requirements
   * ----------------------------------------------------------
   */

  it("should report complete coverage when there are no requirements", () => {
    const requirements: CoverageRequirement[] = [];

    const questions: CoverageQuestion[] = [
      {
        id: "q1",
        requirement_ids: [],
      },
    ];

    const result = checkCoverage(requirements, questions);

    expect(result.covered_requirement_ids).toEqual([]);

    expect(result.uncovered_requirement_ids).toEqual([]);

    expect(result.must_have_uncovered).toEqual([]);

    expect(result.is_complete).toBe(true);
  });
});
