"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getMyKits } from "@/lib/kits";
import { getToken } from "@/lib/auth";
import type { InterviewKit } from "@/types/kit";
import Spinner from "@/components/ui/Spinner";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

interface ScheduleDayData {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

interface ScheduleQuestion {
  id: string;
  prompt: string;
}

export default function SchedulePage() {
  const router = useRouter();

  const [kits, setKits] = useState<InterviewKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await getMyKits(token);

      setKits(response.kits ?? []);
    } catch (err) {
      console.error("Failed to load schedules:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load your preparation schedules.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSchedules();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSchedules]);

  const totalMinutes = useMemo(() => {
    return kits.reduce((total, kit) => {
      const days = kit.schedule?.days ?? [];

      return (
        total +
        days.reduce((dayTotal, day) => dayTotal + Number(day.minutes || 0), 0)
      );
    }, 0);
  }, [kits]);

  const totalDays = useMemo(() => {
    return kits.reduce((total, kit) => {
      return total + (kit.schedule?.days?.length ?? 0);
    }, 0);
  }, [kits]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 lg:pl-64">
        <Sidebar />

        <Header
          title="Preparation Schedule"
          description="Follow your personalized interview preparation plan"
          onMenuClick={() => setMobileNavOpen(true)}
        />

        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
          <Spinner />
        </main>

        <MobileNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      <Sidebar />

      <Header
        title="Preparation Schedule"
        description="Follow your personalized interview preparation plan"
        onMenuClick={() => setMobileNavOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Preparation Schedule
          </h1>

          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Follow your personalized interview preparation plan day by day.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <div>
              <p className="text-sm font-semibold text-red-800">
                Something went wrong
              </p>

              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => void loadSchedules()}
              className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        )}

        {/* Summary */}
        {!error && kits.length > 0 && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Interview Kits"
              value={kits.length}
              icon="briefcase"
            />

            <SummaryCard
              label="Preparation Days"
              value={totalDays}
              icon="calendar"
            />

            <SummaryCard
              label="Total Study Time"
              value={formatMinutes(totalMinutes)}
              icon="clock"
            />
          </div>
        )}

        {/* Empty State */}
        {!error && kits.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <CalendarIcon />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              No preparation schedule yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Create an interview kit to generate a personalized day-by-day
              preparation schedule.
            </p>

            <button
              type="button"
              onClick={() => router.push("/kits/new")}
              className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Create Interview Kit
            </button>
          </div>
        )}

        {/* Schedules */}
        {!error && kits.length > 0 && (
          <div className="space-y-8">
            {kits.map((kit) => {
              const schedule = kit.schedule?.days ?? [];

              const questions: ScheduleQuestion[] = (kit.questions ?? []).map(
                (question) => ({
                  id: question.id,
                  prompt: question.prompt,
                }),
              );

              return (
                <section
                  key={kit._id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Kit Header */}
                  <div className="border-b border-slate-100 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                            Interview Kit
                          </span>

                          {kit.coverage?.uncovered_requirement_ids?.length ===
                            0 && (
                            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Coverage Complete
                            </span>
                          )}
                        </div>

                        <h2 className="text-xl font-bold text-slate-900">
                          {kit.source?.company || "Company"}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {kit.source?.role ||
                            kit.role?.title ||
                            "Interview Preparation"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => router.push(`/kits/${kit._id}`)}
                        className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Open Kit
                      </button>
                    </div>
                  </div>

                  {/* Schedule */}
                  {schedule.length === 0 ? (
                    <div className="p-6 text-sm text-slate-500">
                      No schedule has been generated for this kit yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {schedule.map((day) => (
                        <ScheduleDay
                          key={`${kit._id}-day-${day.day}`}
                          day={day}
                          questions={questions}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </div>
  );
}

/* =========================================================
   Schedule Day
   ========================================================= */

function ScheduleDay({
  day,
  questions,
}: {
  day: ScheduleDayData;
  questions: ScheduleQuestion[];
}) {
  return (
    <div className="p-5 sm:p-6">
      <div className="flex gap-4">
        {/* Day Number */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
          {day.day}
        </div>

        {/* Day Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Day {day.day}
              </p>

              <h3 className="mt-1 text-base font-semibold text-slate-900">
                {day.focus || "Interview Preparation"}
              </h3>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {day.question_ids?.length ?? 0} questions
              </span>

              <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                {day.minutes} min
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{
                width: `${Math.min(
                  Math.max((Number(day.minutes || 0) / 120) * 100, 5),
                  100,
                )}%`,
              }}
            />
          </div>

          {/* Questions */}
          {day.question_ids?.length > 0 && (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Questions
                </p>

                <span className="text-xs text-slate-400">
                  {day.question_ids.length} assigned
                </span>
              </div>

              <div className="space-y-2">
                {day.question_ids.map((questionId, index) => {
                  const question = questions.find(
                    (item) => item.id === questionId,
                  );

                  return (
                    <div
                      key={questionId}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
                    >
                      <div className="flex items-start gap-3">
                        {/* Question Number */}
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700">
                          {index + 1}
                        </div>

                        {/* Question Text */}
                        <div className="min-w-0 flex-1">
                          {question ? (
                            <p className="text-sm leading-6 text-slate-700">
                              {question.prompt}
                            </p>
                          ) : (
                            <p className="text-sm leading-6 text-slate-500">
                              This question is no longer available in the
                              current kit.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Questions */}
          {(!day.question_ids || day.question_ids.length === 0) && (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">
                No questions assigned for this day.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Summary Card
   ========================================================= */

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: "briefcase" | "calendar" | "clock";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon === "briefcase" && <BriefcaseIcon />}
          {icon === "calendar" && <CalendarIcon />}
          {icon === "clock" && <ClockIcon />}
        </div>
      </div>

      <p className="mt-4 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

/* =========================================================
   Format Minutes
   ========================================================= */

function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/* =========================================================
   Icons
   ========================================================= */

function CalendarIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18M10 12v2h4v-2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
