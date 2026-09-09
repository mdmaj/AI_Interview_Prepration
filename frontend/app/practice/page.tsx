"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getMyKits,
  getPracticeProgress,
  updateFlashcardPractice,
  type PracticeConfidence,
} from "@/lib/kits";
import { getToken } from "@/lib/auth";
import type { InterviewKit } from "@/types/kit";

import Spinner from "@/components/ui/Spinner";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

type Confidence = PracticeConfidence;

interface FlashcardProgress {
  confidence: Confidence;
  covered: boolean;
}

const confidencePriority: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export default function PracticePage() {
  const router = useRouter();

  const [kits, setKits] = useState<InterviewKit[]>([]);
  const [selectedKitId, setSelectedKitId] = useState("");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const [progress, setProgress] = useState<Record<string, FlashcardProgress>>(
    {},
  );

  const [loading, setLoading] = useState(true);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Load kits                                                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const loadKits = async () => {
      try {
        setLoading(true);
        setError("");

        const token = getToken();

        if (!token) {
          router.push("/login");
          return;
        }

        const response = await getMyKits(token);
        const loadedKits = response.kits ?? [];

        setKits(loadedKits);

        if (loadedKits.length > 0) {
          setSelectedKitId(loadedKits[0]._id);
        }
      } catch (err) {
        console.error("Failed to load practice kits:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load your interview kits.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadKits();
  }, [router]);

  /* ---------------------------------------------------------------------- */
  /* Selected kit                                                            */
  /* ---------------------------------------------------------------------- */

  const selectedKit = useMemo(
    () => kits.find((kit) => kit._id === selectedKitId),
    [kits, selectedKitId],
  );

  const flashcards = useMemo(
    () => selectedKit?.flashcards ?? [],
    [selectedKit],
  );

  /* ---------------------------------------------------------------------- */
  /* Load saved practice progress                                           */
  /* ---------------------------------------------------------------------- */

  const loadPracticeProgress = useCallback(async () => {
    if (!selectedKitId) {
      setProgress({});
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setPracticeLoading(true);
      setSaveError("");

      const response = await getPracticeProgress(selectedKitId, token);

      const savedProgress: Record<string, FlashcardProgress> = {};

      for (const item of response.practice?.flashcards ?? []) {
        savedProgress[item.flashcard_id] = {
          confidence: item.confidence,
          covered: item.is_covered,
        };
      }

      setProgress(savedProgress);
    } catch (err) {
      console.error("Failed to load practice progress:", err);

      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to load your practice progress.",
      );

      setProgress({});
    } finally {
      setPracticeLoading(false);
    }
  }, [selectedKitId, router]);

  useEffect(() => {
    if (!selectedKitId) return;

    const timeoutId = window.setTimeout(() => {
      void loadPracticeProgress();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [selectedKitId, loadPracticeProgress]);

  /* ---------------------------------------------------------------------- */
  /* Ordered flashcards                                                      */
  /* ---------------------------------------------------------------------- */

  const orderedFlashcards = useMemo(() => {
    return flashcards
      .map((card, originalIndex) => {
        const cardProgress = progress[card.id];

        /*
         * Cards without a saved practice record are considered
         * "unattempted", not automatically "low confidence".
         *
         * Priority:
         *   0 = low + uncovered
         *   1 = low + covered
         *   2 = medium + uncovered
         *   3 = medium + covered
         *   4 = high + uncovered
         *   5 = high + covered
         *   6 = unattempted
         */
        let priority = 6;

        if (cardProgress) {
          const confidence = confidencePriority[cardProgress.confidence];

          priority = confidence * 2 + (cardProgress.covered ? 1 : 0);
        }

        return {
          card,
          originalIndex,
          priority,
        };
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }

        // Preserve original generated order when priority is equal.
        return a.originalIndex - b.originalIndex;
      })
      .map((item) => item.card);
  }, [flashcards, progress]);

  const currentFlashcard = orderedFlashcards[currentIndex];

  const currentProgress = currentFlashcard
    ? (progress[currentFlashcard.id] ?? {
        confidence: "low" as Confidence,
        covered: false,
      })
    : {
        confidence: "low" as Confidence,
        covered: false,
      };

  /* ---------------------------------------------------------------------- */
  /* Statistics                                                              */
  /* ---------------------------------------------------------------------- */

  const coveredCount = flashcards.filter(
    (card) => progress[card.id]?.covered,
  ).length;

  const lowConfidenceCount = flashcards.filter(
    (card) => progress[card.id]?.confidence === "low",
  ).length;

  const mediumConfidenceCount = flashcards.filter(
    (card) => progress[card.id]?.confidence === "medium",
  ).length;

  const highConfidenceCount = flashcards.filter(
    (card) => progress[card.id]?.confidence === "high",
  ).length;

  const unattemptedCount = flashcards.filter(
    (card) => !progress[card.id],
  ).length;

  const uncoveredCount = flashcards.filter(
    (card) => !progress[card.id]?.covered,
  ).length;

  const progressPercentage =
    flashcards.length > 0
      ? Math.round((coveredCount / flashcards.length) * 100)
      : 0;

  /* ---------------------------------------------------------------------- */
  /* Save practice progress                                                  */
  /* ---------------------------------------------------------------------- */

  const saveFlashcardProgress = async (
    flashcardId: string,
    data: {
      confidence?: Confidence;
      is_covered?: boolean;
    },
  ) => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setSaving(true);
      setSaveError("");

      const response = await updateFlashcardPractice(
        selectedKitId,
        flashcardId,
        data,
        token,
      );

      const updatedProgress = response.practice?.flashcards ?? [];

      setProgress((current) => {
        const next = { ...current };

        for (const item of updatedProgress) {
          next[item.flashcard_id] = {
            confidence: item.confidence,
            covered: item.is_covered,
          };
        }

        return next;
      });
    } catch (err) {
      console.error("Failed to save flashcard progress:", err);

      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to save your practice progress.",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Kit change                                                              */
  /* ---------------------------------------------------------------------- */

  const handleKitChange = (kitId: string) => {
    setSelectedKitId(kitId);
    setCurrentIndex(0);
    setRevealed(false);
    setProgress({});
    setSaveError("");
  };

  /* ---------------------------------------------------------------------- */
  /* Confidence                                                              */
  /* ---------------------------------------------------------------------- */

  const handleConfidence = async (confidence: Confidence) => {
    if (!currentFlashcard || saving) return;

    setProgress((current) => ({
      ...current,
      [currentFlashcard.id]: {
        confidence,
        covered: current[currentFlashcard.id]?.covered ?? false,
      },
    }));

    await saveFlashcardProgress(currentFlashcard.id, {
      confidence,
    });
  };

  /* ---------------------------------------------------------------------- */
  /* Covered                                                                 */
  /* ---------------------------------------------------------------------- */

  const handleCovered = async () => {
    if (!currentFlashcard || saving) return;

    setProgress((current) => ({
      ...current,
      [currentFlashcard.id]: {
        confidence:
          current[currentFlashcard.id]?.confidence ?? ("low" as Confidence),
        covered: true,
      },
    }));

    await saveFlashcardProgress(currentFlashcard.id, {
      is_covered: true,
    });
  };

  /* ---------------------------------------------------------------------- */
  /* Navigation                                                              */
  /* ---------------------------------------------------------------------- */

  const handleNext = () => {
    if (orderedFlashcards.length === 0) return;

    if (currentIndex >= orderedFlashcards.length - 1) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex((index) => index + 1);
    }

    setRevealed(false);
    setSaveError("");
  };

  const handlePrevious = () => {
    if (currentIndex <= 0) return;

    setCurrentIndex((index) => index - 1);
    setRevealed(false);
    setSaveError("");
  };

  /* ---------------------------------------------------------------------- */
  /* Loading                                                                 */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 lg:pl-64">
        <Sidebar />

        <Header
          title="Practice"
          description="Practice your interview concepts with personalized flashcards"
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

  /* ---------------------------------------------------------------------- */
  /* Main UI                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      <Sidebar />

      <Header
        title="Practice"
        description="Practice your interview concepts with personalized flashcards"
        onMenuClick={() => setMobileNavOpen(true)}
      />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Practice
          </h1>

          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Practice your interview concepts with personalized flashcards.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">
              Something went wrong
            </p>

            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* No Kits */}
        {!error && kits.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-slate-900">
              No interview kits available
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Create an interview kit first to start practicing.
            </p>

            <button
              type="button"
              onClick={() => router.push("/kits/new")}
              className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create Interview Kit
            </button>
          </div>
        )}

        {!error && selectedKit && (
          <>
            {/* Kit Selector */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <label
                htmlFor="kit"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Select Interview Kit
              </label>

              <select
                id="kit"
                value={selectedKitId}
                onChange={(event) => handleKitChange(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {kits.map((kit) => (
                  <option key={kit._id} value={kit._id}>
                    {kit.source?.company || "Company"} —{" "}
                    {kit.source?.role ||
                      kit.role?.title ||
                      "Interview Preparation"}
                  </option>
                ))}
              </select>
            </div>

            {saveError && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">
                  Progress sync issue
                </p>

                <p className="mt-1 text-sm text-amber-700">{saveError}</p>
              </div>
            )}

            {practiceLoading ? (
              <div className="flex min-h-75 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <div className="text-center">
                  <Spinner />

                  <p className="mt-4 text-sm text-slate-500">
                    Loading your practice progress...
                  </p>
                </div>
              </div>
            ) : flashcards.length === 0 ? (
              /* No Flashcards */
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  No flashcards available
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  This kit does not have any generated flashcards yet.
                </p>
              </div>
            ) : (
              <>
                {/* Progress + Weak Spots */}
                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                  {/* Overall Progress */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Practice Progress
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {coveredCount} of {flashcards.length} covered
                        </p>
                      </div>

                      <span className="text-lg font-bold text-indigo-600">
                        {progressPercentage}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{
                          width: `${progressPercentage}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Weak Spots */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Weak Spots
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Areas that need more practice
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <StatItem label="Low" value={lowConfidenceCount} />

                      <StatItem label="Medium" value={mediumConfidenceCount} />

                      <StatItem label="Uncovered" value={uncoveredCount} />

                      <StatItem label="Unattempted" value={unattemptedCount} />
                    </div>
                  </div>
                </div>

                {/* Confidence Summary */}
                <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      Confidence Overview
                    </p>

                    <span className="text-xs text-slate-500">
                      {highConfidenceCount} high confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <ConfidenceSummary label="Low" value={lowConfidenceCount} />

                    <ConfidenceSummary
                      label="Medium"
                      value={mediumConfidenceCount}
                    />

                    <ConfidenceSummary
                      label="High"
                      value={highConfidenceCount}
                    />
                  </div>
                </div>

                {/* Current Flashcard Counter */}
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">
                    Flashcard {currentIndex + 1} of {orderedFlashcards.length}
                  </p>

                  <p className="text-sm font-semibold text-indigo-600">
                    {coveredCount}/{flashcards.length} covered
                  </p>
                </div>

                {/* Card Position */}
                <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{
                      width: `${
                        ((currentIndex + 1) / orderedFlashcards.length) * 100
                      }%`,
                    }}
                  />
                </div>

                {/* Flashcard */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
                  {/* Card Header */}
                  <div className="mb-8 flex items-center justify-between">
                    <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                      Flashcard
                    </span>

                    <div className="flex items-center gap-2">
                      {currentProgress.confidence && (
                        <span
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            currentProgress.confidence === "low"
                              ? "bg-red-50 text-red-700"
                              : currentProgress.confidence === "medium"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {currentProgress.confidence.charAt(0).toUpperCase() +
                            currentProgress.confidence.slice(1)}
                        </span>
                      )}

                      {currentProgress.covered && (
                        <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                          ✓ Covered
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question */}
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Question
                    </p>

                    <h2 className="text-xl font-bold leading-relaxed text-slate-900 sm:text-2xl">
                      {currentFlashcard.front}
                    </h2>
                  </div>

                  {/* Answer */}
                  {revealed && (
                    <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500">
                        Answer
                      </p>

                      <p className="text-sm leading-7 text-slate-700 sm:text-base">
                        {currentFlashcard.back}
                      </p>
                    </div>
                  )}

                  {/* Reveal */}
                  {!revealed && (
                    <button
                      type="button"
                      onClick={() => setRevealed(true)}
                      className="mt-10 w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                    >
                      Reveal Answer
                    </button>
                  )}

                  {/* Controls */}
                  {revealed && (
                    <div className="mt-8">
                      <p className="mb-3 text-sm font-semibold text-slate-700">
                        How confident are you?
                      </p>

                      <div className="grid grid-cols-3 gap-3">
                        <ConfidenceButton
                          label="Low"
                          active={currentProgress.confidence === "low"}
                          disabled={saving}
                          onClick={() => handleConfidence("low")}
                        />

                        <ConfidenceButton
                          label="Medium"
                          active={currentProgress.confidence === "medium"}
                          disabled={saving}
                          onClick={() => handleConfidence("medium")}
                        />

                        <ConfidenceButton
                          label="High"
                          active={currentProgress.confidence === "high"}
                          disabled={saving}
                          onClick={() => handleConfidence("high")}
                        />
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleCovered}
                          disabled={saving}
                          className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving
                            ? "Saving..."
                            : currentProgress.covered
                              ? "✓ Covered"
                              : "Mark as Covered"}
                        </button>

                        <button
                          type="button"
                          onClick={handlePrevious}
                          disabled={currentIndex === 0 || saving}
                          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ← Previous
                        </button>

                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={saving}
                          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {currentIndex === orderedFlashcards.length - 1
                            ? "Start Again"
                            : "Next →"}
                        </button>
                      </div>

                      {saving && (
                        <p className="mt-4 text-center text-xs text-slate-400">
                          Saving your progress...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Practice Strategy */}
                <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
                  <p className="text-sm font-semibold text-indigo-900">
                    Practice Strategy
                  </p>

                  <p className="mt-1 text-sm leading-6 text-indigo-700">
                    Your weaker flashcards are prioritized first. Low-confidence
                    and uncovered cards appear before stronger cards so you can
                    focus your preparation where it matters most.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small UI Components                                                        */
/* -------------------------------------------------------------------------- */

function ConfidenceButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>

      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ConfidenceSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
      <p className="text-xs font-medium text-slate-500">{label}</p>

      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
