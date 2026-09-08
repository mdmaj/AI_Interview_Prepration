"use client";

import type { Question } from "@/types/kit";

interface QuestionCardProps {
  question: Question;
  index?: number;
  onEdit?: (question: Question) => void;
  onDelete?: (questionId: string) => void;
}

export default function QuestionCard({
  question,
  index,
  onEdit,
  onDelete,
}: QuestionCardProps) {
  const difficultyLabel =
    question.difficulty === 1
      ? "Easy"
      : question.difficulty === 2
        ? "Medium"
        : "Hard";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          {index !== undefined && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {index + 1}
            </span>
          )}

          <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700">
            {question.category}
          </span>
        </div>

        <span
          className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${
            question.difficulty === 3
              ? "bg-red-50 text-red-700"
              : question.difficulty === 2
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {difficultyLabel}
        </span>
      </div>

      {/* Question */}
      <div className="mt-5">
        <p className="text-base font-semibold leading-7 text-slate-900">
          {question.prompt}
        </p>
      </div>

      {/* Answer Outline */}
      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Answer Outline
        </p>

        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
          {question.answer_outline || "No answer outline available."}
        </p>
      </div>

      {/* Requirement IDs */}
      {question.requirement_ids?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Related Requirements
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {question.requirement_ids.map((requirementId) => (
              <span
                key={requirementId}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
              >
                {requirementId}
              </span>
            ))}
          </div>
        </div>
      )}

      {(onEdit || onDelete) && (
        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(question)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Edit
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(question.id)}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}
