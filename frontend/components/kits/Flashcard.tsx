"use client";

import { useState } from "react";
import type { InterviewKit } from "@/types/kit";

type Flashcard = NonNullable<
  InterviewKit["flashcards"]
>[number];

interface FlashcardProps {
  flashcard: Flashcard;
  index: number;
}

export default function Flashcard({
  flashcard,
  index,
}: FlashcardProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
          Flashcard {index + 1}
        </span>

        {flashcard.requirement_ids?.length > 0 && (
          <span className="text-xs text-slate-400">
            {flashcard.requirement_ids.length} requirement
            {flashcard.requirement_ids.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Front */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Front
        </p>

        <h3 className="mt-2 text-base font-semibold leading-6 text-slate-900">
          {flashcard.front}
        </h3>
      </div>

      {/* Answer */}
      {revealed && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Answer
          </p>

          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-emerald-900">
            {flashcard.back}
          </p>
        </div>
      )}

      {/* Action */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
        >
          {revealed ? "Hide Answer" : "Reveal Answer"}
        </button>
      </div>
    </article>
  );
}