"use client";

import type { Question } from "@/types/kit";

interface ScheduleDayData {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

interface ScheduleDayProps {
  day: ScheduleDayData;
  questions: Question[];
}

export default function ScheduleDay({ day, questions }: ScheduleDayProps) {
  const scheduledQuestions = day.question_ids
    .map((questionId) =>
      questions.find((question) => question.id === questionId),
    )
    .filter((question): question is Question => Boolean(question));

  const unavailableQuestionIds = day.question_ids.filter(
    (questionId) => !questions.some((question) => question.id === questionId),
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Day Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
              {day.day}
            </span>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Day {day.day}
              </p>

              <h3 className="mt-0.5 text-base font-bold text-slate-900">
                {day.focus || "Interview Preparation"}
              </h3>
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-slate-900">{day.minutes}</p>

          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            minutes
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Questions</h4>

          <span className="text-xs text-slate-400">
            {scheduledQuestions.length} question
            {scheduledQuestions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {scheduledQuestions.length > 0 ? (
          <div className="space-y-2">
            {scheduledQuestions.map((question, index) => (
              <div
                key={question.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-xs font-semibold text-slate-500">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-5 text-slate-700">
                      {question.prompt}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold capitalize text-indigo-700">
                        {question.category.replace("_", " ")}
                      </span>

                      <span className="text-[10px] font-medium text-slate-400">
                        Difficulty {question.difficulty}/3
                      </span>

                      <span className="font-mono text-[10px] text-slate-400">
                        {question.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">
              No questions are currently assigned to this day.
            </p>
          </div>
        )}

        {/* Only show this if backend schedule contains an invalid question ID */}
        {unavailableQuestionIds.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-700">
              {unavailableQuestionIds.length} scheduled question
              {unavailableQuestionIds.length !== 1 ? "s" : ""} could not be
              found.
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {unavailableQuestionIds.map((questionId) => (
                <span
                  key={questionId}
                  className="rounded-md bg-amber-100 px-2 py-1 font-mono text-[10px] text-amber-800"
                >
                  {questionId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
