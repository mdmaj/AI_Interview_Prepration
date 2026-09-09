import { describe, expect, it } from "vitest";

import {
  allocateSchedule,
  type ScheduleRequirement,
  type ScheduleQuestion,
} from "./scheduleAllocator.js";

import { validateSchedule } from "./scheduleValidator.js";

/*
 * ============================================================
 * Test Data
 * ============================================================
 */

const requirements: ScheduleRequirement[] = [
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
  {
    id: "r4",
    priority: "nice",
  },
];

const questions: ScheduleQuestion[] = [
  {
    id: "q1",
    requirement_ids: ["r1"],
    category: "coding",
    difficulty: 3,
  },
  {
    id: "q2",
    requirement_ids: ["r2"],
    category: "system_design",
    difficulty: 3,
  },
  {
    id: "q3",
    requirement_ids: ["r3"],
    category: "technical",
    difficulty: 2,
  },
  {
    id: "q4",
    requirement_ids: ["r4"],
    category: "behavioral",
    difficulty: 1,
  },
  {
    id: "q5",
    requirement_ids: ["r1", "r2"],
    category: "technical",
    difficulty: 2,
  },
];

/*
 * ============================================================
 * Helper
 * ============================================================
 */

const expectValidSchedule = (daysAvailable: number) => {
  const schedule = allocateSchedule(daysAvailable, requirements, questions);

  const validation = validateSchedule({
    days: schedule.days,
    questions,
    requirements,
    daysAvailable,
  });

  expect(validation.is_valid).toBe(true);

  expect(schedule.days).toHaveLength(daysAvailable);

  return schedule;
};

/*
 * ============================================================
 * Tests
 * ============================================================
 */

describe("Schedule Allocator", () => {
  /*
   * ----------------------------------------------------------
   * Test 1
   * 1 Day
   * ----------------------------------------------------------
   */

  it("should create a valid 1-day schedule", () => {
    const schedule = expectValidSchedule(1);

    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0].day).toBe(1);
  });

  /*
   * ----------------------------------------------------------
   * Test 2
   * 3 Days
   * ----------------------------------------------------------
   */

  it("should create a valid 3-day schedule", () => {
    const schedule = expectValidSchedule(3);

    expect(schedule.days).toHaveLength(3);
  });

  /*
   * ----------------------------------------------------------
   * Test 3
   * 5 Days
   * ----------------------------------------------------------
   */

  it("should create a valid 5-day schedule", () => {
    const schedule = expectValidSchedule(5);

    expect(schedule.days).toHaveLength(5);
  });

  /*
   * ----------------------------------------------------------
   * Test 4
   * 30 Days
   * ----------------------------------------------------------
   */

  it("should create a valid 30-day schedule", () => {
    const schedule = expectValidSchedule(30);

    expect(schedule.days).toHaveLength(30);

    expect(schedule.days[29].day).toBe(30);
  });

  /*
   * ----------------------------------------------------------
   * Test 5
   * 60 Days
   * ----------------------------------------------------------
   */

  it("should create a valid 60-day schedule", () => {
    const schedule = expectValidSchedule(60);

    expect(schedule.days).toHaveLength(60);

    expect(schedule.days[59].day).toBe(60);
  });

  /*
   * ----------------------------------------------------------
   * Test 6
   * Deterministic Schedule
   * ----------------------------------------------------------
   */

  it("should produce the same schedule for identical input", () => {
    const firstRun = allocateSchedule(30, requirements, questions);

    const secondRun = allocateSchedule(30, requirements, questions);

    expect(firstRun).toEqual(secondRun);
  });

  /*
   * ----------------------------------------------------------
   * Test 7
   * Invalid: 0 Days
   * ----------------------------------------------------------
   */

  it("should reject 0 days", () => {
    expect(() => allocateSchedule(0, requirements, questions)).toThrow(
      "daysAvailable must be between 1 and 60.",
    );
  });

  /*
   * ----------------------------------------------------------
   * Test 8
   * Invalid: 61 Days
   * ----------------------------------------------------------
   */

  it("should reject 61 days", () => {
    expect(() => allocateSchedule(61, requirements, questions)).toThrow(
      "daysAvailable must be between 1 and 60.",
    );
  });

  /*
   * ----------------------------------------------------------
   * Test 9
   * Must-have Requirement Coverage
   * ----------------------------------------------------------
   */

  it("should include every must-have requirement in the schedule", () => {
    const schedule = allocateSchedule(3, requirements, questions);

    const mustHaveRequirementIds = requirements
      .filter((requirement) => requirement.priority === "must")
      .map((requirement) => requirement.id);

    const scheduledQuestionIds = schedule.days.flatMap(
      (day) => day.question_ids,
    );

    const scheduledQuestions = questions.filter((question) =>
      scheduledQuestionIds.includes(question.id),
    );

    const scheduledRequirementIds = new Set(
      scheduledQuestions.flatMap((question) => question.requirement_ids),
    );

    for (const requirementId of mustHaveRequirementIds) {
      expect(scheduledRequirementIds.has(requirementId)).toBe(true);
    }
  });

  /*
   * ----------------------------------------------------------
   * Test 10
   * Exact Number of Days
   * ----------------------------------------------------------
   */

  it("should return exactly the requested number of days", () => {
    const requestedDays = 7;

    const schedule = allocateSchedule(requestedDays, requirements, questions);

    expect(schedule.days).toHaveLength(requestedDays);
  });

  /*
   * ----------------------------------------------------------
   * Test 11
   * Sequential Day Numbers
   * ----------------------------------------------------------
   */

  it("should use sequential day numbers starting from 1", () => {
    const schedule = allocateSchedule(7, requirements, questions);

    schedule.days.forEach((day, index) => {
      expect(day.day).toBe(index + 1);
    });
  });

  /*
   * ----------------------------------------------------------
   * Test 12
   * Valid Question IDs
   * ----------------------------------------------------------
   */

  it("should contain only valid question IDs", () => {
    const schedule = allocateSchedule(7, requirements, questions);

    const validQuestionIds = new Set(questions.map((question) => question.id));

    for (const day of schedule.days) {
      for (const questionId of day.question_ids) {
        expect(validQuestionIds.has(questionId)).toBe(true);
      }
    }
  });

  /*
   * ----------------------------------------------------------
   * Test 13
   * Integer Minutes
   * ----------------------------------------------------------
   */

  it("should generate non-negative integer minutes", () => {
    const schedule = allocateSchedule(7, requirements, questions);

    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);

      expect(day.minutes).toBeGreaterThanOrEqual(0);
    }
  });

  /*
   * ----------------------------------------------------------
   * Additional Test
   * Priority + Difficulty Ordering
   * ----------------------------------------------------------
   *
   * q1 = must + difficulty 3
   * q2 = must + difficulty 3
   * q5 = must + difficulty 2
   * q3 = nice + difficulty 2
   * q4 = nice + difficulty 1
   *
   * Therefore q1/q2 should appear before q3/q4.
   * ----------------------------------------------------------
   */

  it("should prioritize must-have and harder questions first", () => {
    const schedule = allocateSchedule(5, requirements, questions);

    const firstDayQuestionIds = schedule.days[0].question_ids;

    const allScheduledQuestionIds = schedule.days.flatMap(
      (day) => day.question_ids,
    );

    const q1Index = allScheduledQuestionIds.indexOf("q1");

    const q2Index = allScheduledQuestionIds.indexOf("q2");

    const q5Index = allScheduledQuestionIds.indexOf("q5");

    const q3Index = allScheduledQuestionIds.indexOf("q3");

    const q4Index = allScheduledQuestionIds.indexOf("q4");

    expect(firstDayQuestionIds).toContain("q1");

    expect(q1Index).toBeLessThan(q3Index);

    expect(q2Index).toBeLessThan(q3Index);

    expect(q5Index).toBeLessThan(q4Index);
  });

  /*
   * ----------------------------------------------------------
   * Additional Test
   * Review Days
   * ----------------------------------------------------------
   */

  it("should create review days when days exceed question count", () => {
    const schedule = allocateSchedule(30, requirements, questions);

    expect(schedule.days.length).toBe(30);

    const reviewDays = schedule.days.slice(5);

    expect(reviewDays.length).toBe(25);

    for (const day of reviewDays) {
      expect(day.focus).toBe("Review");

      expect(day.question_ids.length).toBeGreaterThan(0);

      expect(day.question_ids.length).toBeLessThanOrEqual(2);
    }
  });
});
