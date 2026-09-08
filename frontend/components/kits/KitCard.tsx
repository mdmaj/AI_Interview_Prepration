"use client";

import Link from "next/link";
import type { InterviewKit } from "@/types/kit";

interface KitCardProps {
  kit: InterviewKit;
  onDelete?: (id: string) => void;
}

export default function KitCard({ kit, onDelete }: KitCardProps) {
  const requirementCount = kit.role?.requirements?.length ?? 0;
  const questionCount = kit.questions?.length ?? 0;
  const flashcardCount = kit.flashcards?.length ?? 0;

  const coveredCount =
    requirementCount - (kit.coverage?.uncovered_requirement_ids?.length ?? 0);

  const coveragePercentage =
    requirementCount > 0
      ? Math.round((coveredCount / requirementCount) * 100)
      : 0;

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              Interview Kit
            </span>

            {kit.coverage?.uncovered_requirement_ids?.length === 0 && (
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Complete
              </span>
            )}
          </div>

          <h3 className="truncate text-lg font-semibold text-slate-900">
            {kit.source?.company || "Company"}
          </h3>

          <p className="mt-1 truncate text-sm text-slate-500">
            {kit.source?.role || kit.role?.title || "Interview Preparation"}
          </p>
        </div>

        <div className="shrink-0 rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
          </svg>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <Stat value={questionCount} label="Questions" />

        <Stat value={flashcardCount} label="Flashcards" />

        <Stat value={requirementCount} label="Requirements" />
      </div>

      {/* Coverage */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            Requirement coverage
          </span>

          <span className="font-semibold text-indigo-600">
            {coveragePercentage}%
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{
              width: `${coveragePercentage}%`,
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-400">
          {kit.schedule?.days_available ?? 0} days preparation
        </div>

        <div className="flex gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(kit._id)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Delete
            </button>
          )}

          <Link
            href={`/kits/${kit._id}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Open Kit
          </Link>
        </div>
      </div>
    </article>
  );
}

interface StatProps {
  value: number;
  label: string;
}

function Stat({ value, label }: StatProps) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
      <p className="text-lg font-bold text-slate-900">{value}</p>

      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}
