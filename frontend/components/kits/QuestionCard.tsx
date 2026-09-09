"use client";

import { Question } from "@/types/kit";

interface QuestionCardProps {
  question: Question;
  index?: number;
  totalQuestions?: number;
  onEdit?: (question: Question) => void;
  onDelete?: (questionId: string) => void;
  onTogglePin?: (questionId: string) => void;
  onMoveUp?: (questionId: string) => void;
  onMoveDown?: (questionId: string) => void;
}

const categoryLabels: Record<Question["category"], string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  system_design: "System Design",
  coding: "Coding",
  other: "Other",
};

function getDifficultyLabel(difficulty: Question["difficulty"]) {
  if (difficulty === 1) return "Easy";
  if (difficulty === 2) return "Medium";
  return "Hard";
}

export default function QuestionCard({
  question,
  index = 0,
  totalQuestions = 1,
  onEdit,
  onDelete,
  onTogglePin,
  onMoveUp,
  onMoveDown,
}: QuestionCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-sm font-bold text-indigo-700">
            {index + 1}
          </span>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {categoryLabels[question.category] ?? question.category}
          </span>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            Difficulty {question.difficulty} ·{" "}
            {getDifficultyLabel(question.difficulty)}
          </span>

          {question.is_edited && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Edited
            </span>
          )}

          {question.is_pinned && (
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              📌 Pinned
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(question.id)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                question.is_pinned
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {question.is_pinned ? "Unpin" : "Pin"}
            </button>
          )}

          {onMoveUp && (
            <button
              type="button"
              onClick={() => onMoveUp(question.id)}
              disabled={index === 0}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              title="Move up"
            >
              ↑
            </button>
          )}

          {onMoveDown && (
            <button
              type="button"
              onClick={() => onMoveDown(question.id)}
              disabled={index === totalQuestions - 1}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              title="Move down"
            >
              ↓
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(question)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Edit
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(question.id)}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Question */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Question
        </p>

        <p className="mt-2 text-sm font-medium leading-6 text-gray-900">
          {question.prompt}
        </p>
      </div>

      {/* Answer */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Answer Outline
        </p>

        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
          {question.answer_outline}
        </p>
      </div>

      {/* Requirements */}
      {question.requirement_ids?.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Related Requirements
          </p>

          <div className="flex flex-wrap gap-2">
            {question.requirement_ids.map((requirementId) => (
              <span
                key={requirementId}
                className="rounded-md bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600"
              >
                {requirementId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
