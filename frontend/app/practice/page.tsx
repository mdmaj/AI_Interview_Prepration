"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getMyKits } from "@/lib/kits";
import { getToken } from "@/lib/auth";
import type { InterviewKit } from "@/types/kit";
import Spinner from "@/components/ui/Spinner";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

type Confidence = "low" | "medium" | "high";

interface FlashcardProgress {
  confidence?: Confidence;
  covered: boolean;
}

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
  const [error, setError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const loadKits = async () => {
      try {
        setLoading(true);

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

  const selectedKit = useMemo(
    () => kits.find((kit) => kit._id === selectedKitId),
    [kits, selectedKitId],
  );

  const flashcards = selectedKit?.flashcards ?? [];
  const currentFlashcard = flashcards[currentIndex];

  const currentProgress = currentFlashcard
    ? (progress[currentFlashcard.id] ?? { covered: false })
    : { covered: false };

  const coveredCount = flashcards.filter(
    (card) => progress[card.id]?.covered,
  ).length;

  const handleKitChange = (kitId: string) => {
    setSelectedKitId(kitId);
    setCurrentIndex(0);
    setRevealed(false);
  };

  const handleConfidence = (confidence: Confidence) => {
    if (!currentFlashcard) return;

    setProgress((current) => ({
      ...current,
      [currentFlashcard.id]: {
        ...current[currentFlashcard.id],
        confidence,
      },
    }));
  };

  const handleCovered = () => {
    if (!currentFlashcard) return;

    setProgress((current) => ({
      ...current,
      [currentFlashcard.id]: {
        ...current[currentFlashcard.id],
        covered: true,
      },
    }));
  };

  const handleNext = () => {
    if (currentIndex >= flashcards.length - 1) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex((index) => index + 1);
    }

    setRevealed(false);
  };

  const handlePrevious = () => {
    if (currentIndex <= 0) return;

    setCurrentIndex((index) => index - 1);
    setRevealed(false);
  };

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

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      <Sidebar />

      <Header
        title="Practice"
        description="Practice your interview concepts with personalized flashcards"
        onMenuClick={() => setMobileNavOpen(true)}
      />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
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

        {/* Practice */}
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

            {/* No Flashcards */}
            {flashcards.length === 0 ? (
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
                {/* Progress */}
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">
                    Flashcard {currentIndex + 1} of {flashcards.length}
                  </p>

                  <p className="text-sm font-semibold text-indigo-600">
                    {coveredCount}/{flashcards.length} covered
                  </p>
                </div>

                <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{
                      width: `${
                        ((currentIndex + 1) / flashcards.length) * 100
                      }%`,
                    }}
                  />
                </div>

                {/* Flashcard */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
                  <div className="mb-8 flex items-center justify-between">
                    <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                      Flashcard
                    </span>

                    {currentProgress.covered && (
                      <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        ✓ Covered
                      </span>
                    )}
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
                          onClick={() => handleConfidence("low")}
                        />

                        <ConfidenceButton
                          label="Medium"
                          active={currentProgress.confidence === "medium"}
                          onClick={() => handleConfidence("medium")}
                        />

                        <ConfidenceButton
                          label="High"
                          active={currentProgress.confidence === "high"}
                          onClick={() => handleConfidence("high")}
                        />
                      </div>

                      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleCovered}
                          className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          {currentProgress.covered
                            ? "✓ Covered"
                            : "Mark as Covered"}
                        </button>

                        <button
                          type="button"
                          onClick={handlePrevious}
                          disabled={currentIndex === 0}
                          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ← Previous
                        </button>

                        <button
                          type="button"
                          onClick={handleNext}
                          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                          {currentIndex === flashcards.length - 1
                            ? "Start Again"
                            : "Next →"}
                        </button>
                      </div>
                    </div>
                  )}
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

function ConfidenceButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
