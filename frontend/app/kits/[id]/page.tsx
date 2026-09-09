"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getKit, startKitGeneration } from "@/lib/kits";
import { getToken } from "@/lib/auth";
import apiRequest from "@/lib/api";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";

import QuestionCard from "@/components/kits/QuestionCard";
import Flashcard from "@/components/kits/Flashcard";
import ScheduleDay from "@/components/kits/ScheduleDay";

import type {
  InterviewKit,
  Question,
  Flashcard as FlashcardType,
} from "@/types/kit";

type RegenerateSection =
  | "company_brief"
  | "questions"
  | "technical"
  | "behavioral"
  | "system_design"
  | "coding"
  | "flashcards"
  | "schedule";

export default function KitDetailPage() {
  const params = useParams();
  const router = useRouter();

  const kitId = params.id as string;

  const [kit, setKit] = useState<InterviewKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [error, setError] = useState("");

  // Regeneration state
  const [regeneratingSection, setRegeneratingSection] =
    useState<RegenerateSection | null>(null);

  // Question builder state
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionSaveError, setQuestionSaveError] = useState("");
  const [questionSaveSuccess, setQuestionSaveSuccess] = useState("");

  // Flashcard builder state
  const [editingFlashcard, setEditingFlashcard] =
    useState<FlashcardType | null>(null);
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
  const [isAddingFlashcard, setIsAddingFlashcard] = useState(false);
  const [flashcardSaving, setFlashcardSaving] = useState(false);
  const [flashcardSaveError, setFlashcardSaveError] = useState("");
  const [flashcardSaveSuccess, setFlashcardSaveSuccess] = useState("");

  const [flashcardForm, setFlashcardForm] = useState({
    front: "",
    back: "",
    requirement_ids: [] as string[],
  });

  const [questionForm, setQuestionForm] = useState({
    prompt: "",
    answer_outline: "",
    category: "technical" as Question["category"],
    difficulty: 2 as Question["difficulty"],
    requirement_ids: [] as string[],
  });

  /*
   * Fetch the current kit.
   */
  const fetchKit = useCallback(async () => {
    try {
      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await getKit(kitId, token);
      const fetchedKit = response.kit;

      setKit(fetchedKit);

      const isCurrentlyGenerating =
        fetchedKit.generation?.status === "generating";

      setGenerating(isCurrentlyGenerating);

      if (!isCurrentlyGenerating) {
        setRegeneratingSection(null);
      }

      setError("");
    } catch (err) {
      console.error("Failed to fetch kit:", err);

      setError(
        err instanceof Error ? err.message : "Failed to load interview kit.",
      );
    } finally {
      setLoading(false);
    }
  }, [kitId, router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchKit();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchKit]);

  /*
   * Poll backend while generation is running.
   */
  useEffect(() => {
    if (!kit || kit.generation?.status !== "generating") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchKit();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [kit, fetchKit]);

  /*
   * Allow Escape to close modals.
   */
  useEffect(() => {
    if (
      (!isQuestionModalOpen && !isFlashcardModalOpen) ||
      questionSaving ||
      flashcardSaving
    ) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (questionSaving || flashcardSaving) {
        return;
      }

      setIsQuestionModalOpen(false);
      setEditingQuestion(null);
      setIsAddingQuestion(false);
      setQuestionSaveError("");

      setIsFlashcardModalOpen(false);
      setEditingFlashcard(null);
      setIsAddingFlashcard(false);
      setFlashcardSaveError("");
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isQuestionModalOpen,
    isFlashcardModalOpen,
    questionSaving,
    flashcardSaving,
  ]);

  /*
   * Start / retry full kit generation.
   */
  const handleGenerate = async () => {
    try {
      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      setGenerating(true);
      setError("");

      const response = await startKitGeneration(kitId, token);

      setKit(response.kit);
    } catch (err) {
      console.error("Failed to start generation:", err);

      setGenerating(false);

      setError(
        err instanceof Error ? err.message : "Failed to start kit generation.",
      );
    }
  };

  /*
   * Regenerate a specific section.
   */
  const handleRegenerateSection = async (section: RegenerateSection) => {
    if (!kit || kit.generation?.status === "generating") {
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const sectionLabels: Record<RegenerateSection, string> = {
      company_brief: "company brief",
      questions: "all questions",
      technical: "technical questions",
      behavioral: "behavioral questions",
      system_design: "system design questions",
      coding: "coding questions",
      flashcards: "flashcards",
      schedule: "schedule",
    };

    const confirmed = window.confirm(
      `Regenerate ${sectionLabels[section]}?\n\nEdited and pinned content will be preserved where supported.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setRegeneratingSection(section);
      setGenerating(true);

      const response = await apiRequest<{
        success: boolean;
        message: string;
        kit: InterviewKit;
      }>(`/kits/${kitId}/regenerate`, {
        method: "POST",
        token,
        body: {
          section,
        },
      });

      setKit(response.kit);
    } catch (err) {
      console.error("Failed to regenerate section:", err);

      setGenerating(false);
      setRegeneratingSection(null);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to start section regeneration.",
      );
    }
  };

  /*
   * Open question editor.
   */
  const handleEditQuestion = (question: Question) => {
    if (kit?.generation?.status === "generating") {
      return;
    }

    setEditingQuestion(question);
    setIsAddingQuestion(false);

    setQuestionForm({
      prompt: question.prompt,
      answer_outline: question.answer_outline,
      category: question.category,
      difficulty: question.difficulty,
      requirement_ids: [...question.requirement_ids],
    });

    setQuestionSaveError("");
    setQuestionSaveSuccess("");
    setIsQuestionModalOpen(true);
  };

  /*
   * Open add question form.
   */
  const handleAddQuestion = () => {
    if (kit?.generation?.status === "generating") {
      return;
    }

    setEditingQuestion(null);
    setIsAddingQuestion(true);

    setQuestionForm({
      prompt: "",
      answer_outline: "",
      category: "technical",
      difficulty: 2,
      requirement_ids: [],
    });

    setQuestionSaveError("");
    setQuestionSaveSuccess("");
    setIsQuestionModalOpen(true);
  };

  /*
   * Close question modal.
   */
  const handleCloseQuestionModal = () => {
    if (questionSaving) {
      return;
    }

    setIsQuestionModalOpen(false);
    setEditingQuestion(null);
    setIsAddingQuestion(false);
    setQuestionSaveError("");
    setQuestionSaveSuccess("");
  };

  /*
   * Toggle requirement mapping for question.
   */
  const handleRequirementToggle = (requirementId: string) => {
    setQuestionForm((current) => {
      const exists = current.requirement_ids.includes(requirementId);

      return {
        ...current,
        requirement_ids: exists
          ? current.requirement_ids.filter((id) => id !== requirementId)
          : [...current.requirement_ids, requirementId],
      };
    });
  };

  /*
   * Save question changes.
   */
  const handleSaveQuestion = async () => {
    if (!kit) {
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const prompt = questionForm.prompt.trim();
    const answerOutline = questionForm.answer_outline.trim();

    if (!prompt) {
      setQuestionSaveError("Question prompt is required.");
      return;
    }

    if (!answerOutline) {
      setQuestionSaveError("Answer outline is required.");
      return;
    }

    if (questionForm.requirement_ids.length === 0) {
      setQuestionSaveError("Select at least one related job requirement.");
      return;
    }

    const validRequirementIds = new Set(
      kit.role?.requirements?.map((requirement) => requirement.id) ?? [],
    );

    const hasInvalidRequirement = questionForm.requirement_ids.some(
      (requirementId) => !validRequirementIds.has(requirementId),
    );

    if (hasInvalidRequirement) {
      setQuestionSaveError(
        "One or more selected requirements are no longer valid.",
      );
      return;
    }

    setQuestionSaving(true);
    setQuestionSaveError("");
    setQuestionSaveSuccess("");

    try {
      let updatedQuestions: Question[];

      if (isAddingQuestion) {
        const newQuestion: Question = {
          id: `q-${Date.now()}`,
          requirement_ids: [...questionForm.requirement_ids],
          category: questionForm.category,
          prompt,
          answer_outline: answerOutline,
          difficulty: questionForm.difficulty,
          is_edited: false,
          is_pinned: false,
        };

        updatedQuestions = [...kit.questions, newQuestion];
      } else {
        if (!editingQuestion) {
          throw new Error("No question selected for editing.");
        }

        updatedQuestions = kit.questions.map((question) =>
          question.id === editingQuestion.id
            ? {
                ...question,
                prompt,
                answer_outline: answerOutline,
                category: questionForm.category,
                difficulty: questionForm.difficulty,
                requirement_ids: [...questionForm.requirement_ids],

                // Mark as manually edited.
                is_edited: true,
              }
            : question,
        );
      }

      const response = await apiRequest<{
        message: string;
        kit: InterviewKit;
      }>(`/kits/${kitId}`, {
        method: "PUT",
        token,
        body: {
          questions: updatedQuestions,
        },
      });

      setKit(response.kit);

      setQuestionSaveSuccess(
        isAddingQuestion
          ? "Question added successfully."
          : "Question updated successfully.",
      );

      window.setTimeout(() => {
        setIsQuestionModalOpen(false);
        setEditingQuestion(null);
        setIsAddingQuestion(false);
        setQuestionSaveSuccess("");
      }, 700);
    } catch (err) {
      console.error("Failed to save question:", err);

      setQuestionSaveError(
        err instanceof Error ? err.message : "Failed to save question.",
      );
    } finally {
      setQuestionSaving(false);
    }
  };

  /*
   * Delete question.
   */
  const handleDeleteQuestion = async (questionId: string) => {
    if (!kit || kit.generation?.status === "generating") {
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const question = kit.questions.find((item) => item.id === questionId);

    if (!question) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this question?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const updatedQuestions = kit.questions.filter(
        (item) => item.id !== questionId,
      );

      const response = await apiRequest<{
        message: string;
        kit: InterviewKit;
      }>(`/kits/${kitId}`, {
        method: "PUT",
        token,
        body: {
          questions: updatedQuestions,
        },
      });

      setKit(response.kit);
    } catch (err) {
      console.error("Failed to delete question:", err);

      setError(
        err instanceof Error ? err.message : "Failed to delete question.",
      );
    }
  };

  /*
   * Pin / unpin question.
   */
  const handleToggleQuestionPin = async (questionId: string) => {
    if (!kit || kit.generation?.status === "generating") {
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const updatedQuestions = kit.questions.map((question) =>
      question.id === questionId
        ? {
            ...question,
            is_pinned: !question.is_pinned,
          }
        : question,
    );

    try {
      setError("");

      const response = await apiRequest<{
        message: string;
        kit: InterviewKit;
      }>(`/kits/${kitId}`, {
        method: "PUT",
        token,
        body: {
          questions: updatedQuestions,
        },
      });

      setKit(response.kit);
    } catch (err) {
      console.error("Failed to toggle question pin:", err);

      setError(
        err instanceof Error ? err.message : "Failed to update question pin.",
      );
    }
  };

  /*
   * Move question up.
   */
  const handleMoveQuestionUp = async (questionId: string) => {
    if (!kit || kit.generation?.status === "generating") {
      return;
    }

    const currentIndex = kit.questions.findIndex(
      (question) => question.id === questionId,
    );

    if (currentIndex <= 0) {
      return;
    }

    const updatedQuestions = [...kit.questions];

    [updatedQuestions[currentIndex - 1], updatedQuestions[currentIndex]] = [
      updatedQuestions[currentIndex],
      updatedQuestions[currentIndex - 1],
    ];

    await persistQuestionOrder(updatedQuestions);
  };

  /*
   * Move question down.
   */
  const handleMoveQuestionDown = async (questionId: string) => {
    if (!kit || kit.generation?.status === "generating") {
      return;
    }

    const currentIndex = kit.questions.findIndex(
      (question) => question.id === questionId,
    );

    if (currentIndex === -1 || currentIndex >= kit.questions.length - 1) {
      return;
    }

    const updatedQuestions = [...kit.questions];

    [updatedQuestions[currentIndex], updatedQuestions[currentIndex + 1]] = [
      updatedQuestions[currentIndex + 1],
      updatedQuestions[currentIndex],
    ];

    await persistQuestionOrder(updatedQuestions);
  };

  /*
   * Persist question order.
   */
  const persistQuestionOrder = async (updatedQuestions: Question[]) => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setError("");

      const response = await apiRequest<{
        message: string;
        kit: InterviewKit;
      }>(`/kits/${kitId}`, {
        method: "PUT",
        token,
        body: {
          questions: updatedQuestions,
        },
      });

      setKit(response.kit);
    } catch (err) {
      console.error("Failed to reorder questions:", err);

      setError(
        err instanceof Error ? err.message : "Failed to reorder questions.",
      );
    }
  };

  /*
   * Open flashcard editor.
   */
  const handleEditFlashcard = (flashcard: FlashcardType) => {
    if (kit?.generation?.status === "generating") {
      return;
    }

    setEditingFlashcard(flashcard);
    setIsAddingFlashcard(false);

    setFlashcardForm({
      front: flashcard.front,
      back: flashcard.back,
      requirement_ids: [...flashcard.requirement_ids],
    });

    setFlashcardSaveError("");
    setFlashcardSaveSuccess("");
    setIsFlashcardModalOpen(true);
  };

  /*
   * Open add flashcard form.
   */
  const handleAddFlashcard = () => {
    if (kit?.generation?.status === "generating") {
      return;
    }

    setEditingFlashcard(null);
    setIsAddingFlashcard(true);

    setFlashcardForm({
      front: "",
      back: "",
      requirement_ids: [],
    });

    setFlashcardSaveError("");
    setFlashcardSaveSuccess("");
    setIsFlashcardModalOpen(true);
  };

  /*
   * Close flashcard modal.
   */
  const handleCloseFlashcardModal = () => {
    if (flashcardSaving) {
      return;
    }

    setIsFlashcardModalOpen(false);
    setEditingFlashcard(null);
    setIsAddingFlashcard(false);
    setFlashcardSaveError("");
    setFlashcardSaveSuccess("");
  };

  /*
   * Toggle flashcard requirement.
   */
  const handleFlashcardRequirementToggle = (requirementId: string) => {
    setFlashcardForm((current) => {
      const exists = current.requirement_ids.includes(requirementId);

      return {
        ...current,
        requirement_ids: exists
          ? current.requirement_ids.filter((id) => id !== requirementId)
          : [...current.requirement_ids, requirementId],
      };
    });
  };

  /*
   * Save flashcard.
   */
  const handleSaveFlashcard = async () => {
    if (!kit) {
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const front = flashcardForm.front.trim();
    const back = flashcardForm.back.trim();

    if (!front) {
      setFlashcardSaveError("Flashcard front is required.");
      return;
    }

    if (!back) {
      setFlashcardSaveError("Flashcard answer is required.");
      return;
    }

    if (flashcardForm.requirement_ids.length === 0) {
      setFlashcardSaveError("Select at least one related job requirement.");
      return;
    }

    const validRequirementIds = new Set(
      kit.role?.requirements?.map((requirement) => requirement.id) ?? [],
    );

    const hasInvalidRequirement = flashcardForm.requirement_ids.some(
      (requirementId) => !validRequirementIds.has(requirementId),
    );

    if (hasInvalidRequirement) {
      setFlashcardSaveError(
        "One or more selected requirements are no longer valid.",
      );
      return;
    }

    setFlashcardSaving(true);
    setFlashcardSaveError("");
    setFlashcardSaveSuccess("");

    try {
      let updatedFlashcards: FlashcardType[];

      if (isAddingFlashcard) {
        const newFlashcard: FlashcardType = {
          id: `f-${Date.now()}`,
          front,
          back,
          requirement_ids: [...flashcardForm.requirement_ids],
          is_edited: false,
          is_pinned: false,
        };

        updatedFlashcards = [...kit.flashcards, newFlashcard];
      } else {
        if (!editingFlashcard) {
          throw new Error("No flashcard selected for editing.");
        }

        updatedFlashcards = kit.flashcards.map((flashcard) =>
          flashcard.id === editingFlashcard.id
            ? {
                ...flashcard,
                front,
                back,
                requirement_ids: [...flashcardForm.requirement_ids],
                is_edited: true,
              }
            : flashcard,
        );
      }

      const response = await apiRequest<{
        message: string;
        kit: InterviewKit;
      }>(`/kits/${kitId}`, {
        method: "PUT",
        token,
        body: {
          flashcards: updatedFlashcards,
        },
      });

      setKit(response.kit);

      setFlashcardSaveSuccess(
        isAddingFlashcard
          ? "Flashcard added successfully."
          : "Flashcard updated successfully.",
      );

      window.setTimeout(() => {
        setIsFlashcardModalOpen(false);
        setEditingFlashcard(null);
        setIsAddingFlashcard(false);
        setFlashcardSaveSuccess("");
      }, 700);
    } catch (err) {
      console.error("Failed to save flashcard:", err);

      setFlashcardSaveError(
        err instanceof Error ? err.message : "Failed to save flashcard.",
      );
    } finally {
      setFlashcardSaving(false);
    }
  };

  /*
   * Delete flashcard.
   */
  const handleDeleteFlashcard = async (flashcardId: string) => {
    if (!kit || kit.generation?.status === "generating") {
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this flashcard?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const updatedFlashcards = kit.flashcards.filter(
        (flashcard) => flashcard.id !== flashcardId,
      );

      const response = await apiRequest<{
        message: string;
        kit: InterviewKit;
      }>(`/kits/${kitId}`, {
        method: "PUT",
        token,
        body: {
          flashcards: updatedFlashcards,
        },
      });

      setKit(response.kit);
    } catch (err) {
      console.error("Failed to delete flashcard:", err);

      setError(
        err instanceof Error ? err.message : "Failed to delete flashcard.",
      );
    }
  };

  /*
   * Pin / unpin flashcard.
   */
  const handleToggleFlashcardPin = async (flashcardId: string) => {
    if (!kit || kit.generation?.status === "generating") {
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const updatedFlashcards = kit.flashcards.map((flashcard) =>
      flashcard.id === flashcardId
        ? {
            ...flashcard,
            is_pinned: !flashcard.is_pinned,
          }
        : flashcard,
    );

    try {
      setError("");

      const response = await apiRequest<{
        message: string;
        kit: InterviewKit;
      }>(`/kits/${kitId}`, {
        method: "PUT",
        token,
        body: {
          flashcards: updatedFlashcards,
        },
      });

      setKit(response.kit);
    } catch (err) {
      console.error("Failed to toggle flashcard pin:", err);

      setError(
        err instanceof Error ? err.message : "Failed to update flashcard pin.",
      );
    }
  };

  /*
   * Loading state.
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Sidebar />

        <div className="lg:ml-64">
          <Header
            title="Interview Kit"
            description="Loading your preparation kit..."
            onMenuClick={() => setMobileNavOpen(true)}
          />

          <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
            <Spinner />
          </main>
        </div>

        <MobileNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />
      </div>
    );
  }

  /*
   * Kit not found.
   */
  if (!kit) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Sidebar />

        <div className="lg:ml-64">
          <Header
            title="Interview Kit"
            description="Your interview preparation workspace"
            onMenuClick={() => setMobileNavOpen(true)}
          />

          <main className="p-6">
            <div className="mx-auto max-w-4xl">
              <Card>
                <div className="p-8 text-center">
                  <h1 className="text-xl font-semibold text-slate-900">
                    Interview Kit Not Found
                  </h1>

                  <p className="mt-2 text-sm text-slate-500">
                    The requested interview kit could not be found.
                  </p>

                  <div className="mt-5">
                    <Button onClick={() => router.push("/dashboard")}>
                      Back to Dashboard
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </main>
        </div>

        <MobileNav
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />
      </div>
    );
  }

  const requirements = kit.role?.requirements ?? [];
  const questions = kit.questions ?? [];
  const flashcards = kit.flashcards ?? [];
  const scheduleDays = kit.schedule?.days ?? [];

  const uncoveredRequirements = kit.coverage?.uncovered_requirement_ids ?? [];

  const coveredRequirements = Math.max(
    0,
    requirements.length - uncoveredRequirements.length,
  );

  const coveragePercentage =
    requirements.length > 0
      ? Math.round((coveredRequirements / requirements.length) * 100)
      : 0;

  const generationStatus = kit.generation?.status;

  const isGenerating = generationStatus === "generating";
  const isCompleted = generationStatus === "completed";
  const isFailed = generationStatus === "failed";

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <div className="lg:ml-64">
        <Header
          title={kit.source.role || "Interview Kit"}
          description={`${kit.source.company || "Company"} • Interview preparation`}
          onMenuClick={() => setMobileNavOpen(true)}
        />

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {/* Back + Title */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="mb-4 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                ← Back to Dashboard
              </button>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {kit.source.company}
                    </h2>

                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      {kit.source.role}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    {kit.source.location && (
                      <span>📍 {kit.source.location}</span>
                    )}

                    <span>📅 {kit.schedule?.days_available ?? 0} days</span>
                  </div>

                  {kit.source.company_url && (
                    <a
                      href={kit.source.company_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Visit company website ↗
                    </a>
                  )}
                </div>

                {!isGenerating && !isCompleted && (
                  <Button onClick={handleGenerate} disabled={generating}>
                    {generating
                      ? "Generating..."
                      : isFailed
                        ? "Try Again"
                        : "Generate Kit"}
                  </Button>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-700">{error}</p>
              </div>
            )}

            {/* Generation Progress */}
            {isGenerating && (
              <Card className="mb-6">
                <div className="p-6">
                  <div className="flex items-center gap-4">
                    <Spinner />

                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {regeneratingSection
                          ? `Regenerating ${
                              regeneratingSection === "company_brief"
                                ? "company brief"
                                : regeneratingSection === "flashcards"
                                  ? "flashcards"
                                  : regeneratingSection === "schedule"
                                    ? "schedule"
                                    : regeneratingSection === "technical"
                                      ? "technical questions"
                                      : regeneratingSection === "behavioral"
                                        ? "behavioral questions"
                                        : regeneratingSection ===
                                            "system_design"
                                          ? "system design questions"
                                          : regeneratingSection === "coding"
                                            ? "coding questions"
                                            : "questions"
                            }`
                          : "Generating your interview kit"}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {kit.generation?.current_step ||
                          "Researching the company and creating personalized preparation material..."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>Generation progress</span>

                      <span className="font-semibold text-slate-700">
                        {kit.generation?.progress ?? 0}%
                      </span>
                    </div>

                    <div
                      className="h-2 overflow-hidden rounded-full bg-slate-200"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={kit.generation?.progress ?? 0}
                      aria-label="Interview kit generation progress"
                    >
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                        style={{
                          width: `${kit.generation?.progress ?? 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Generation Failed */}
            {isFailed && (
              <Card className="mb-6">
                <div className="border-l-4 border-red-500 p-6">
                  <h3 className="font-semibold text-red-700">
                    Generation Failed
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {kit.generation?.error ||
                      "Something went wrong while generating the kit."}
                  </p>

                  <div className="mt-4">
                    <Button onClick={handleGenerate}>Try Again</Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Summary Stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card>
                <div className="p-5">
                  <p className="text-sm text-slate-500">Requirements</p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {requirements.length}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="p-5">
                  <p className="text-sm text-slate-500">Questions</p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {questions.length}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="p-5">
                  <p className="text-sm text-slate-500">Flashcards</p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {flashcards.length}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="p-5">
                  <p className="text-sm text-slate-500">Coverage</p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {coveragePercentage}%
                  </p>
                </div>
              </Card>
            </div>

            {/* Company Brief */}
            <Card className="mb-6">
              <div className="p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    Company Brief
                  </h2>

                  <Button
                    onClick={() => handleRegenerateSection("company_brief")}
                    disabled={isGenerating}
                  >
                    Regenerate Brief
                  </Button>
                </div>

                <div className="mt-5 space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">
                      Summary
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {kit.company_brief?.summary ||
                        "No company summary available."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">
                      What They Do
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {kit.company_brief?.what_they_do ||
                        "No company information available."}
                    </p>
                  </div>

                  {kit.company_brief?.sources?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">
                        Research Sources
                      </h3>

                      <div className="mt-2 space-y-1">
                        {kit.company_brief.sources.map((source, index) => (
                          <a
                            key={`${source}-${index}`}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block break-all text-sm text-indigo-600 hover:underline"
                          >
                            {source}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Role Breakdown */}
            <Card className="mb-6">
              <div className="p-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Role Breakdown
                </h2>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Role
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {kit.role?.title || kit.source.role}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Seniority
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {kit.role?.seniority || "Not specified"}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Responsibilities
                  </h3>

                  {kit.role?.responsibilities?.length ? (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                      {kit.role.responsibilities.map(
                        (responsibility, index) => (
                          <li key={index}>{responsibility}</li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      No specific responsibilities were extracted.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Requirements */}
            <Card className="mb-6">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    Requirements
                  </h2>

                  <span className="text-sm text-slate-500">
                    {requirements.length} total
                  </span>
                </div>

                {requirements.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    No requirements were extracted.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {requirements.map((requirement) => (
                      <div
                        key={requirement.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-mono text-slate-600">
                                {requirement.id}
                              </span>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  requirement.priority === "must"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                              >
                                {requirement.priority}
                              </span>

                              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                {requirement.kind}
                              </span>
                            </div>

                            <p className="mt-3 text-sm leading-6 text-slate-700">
                              {requirement.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Questions */}
            <section className="mb-6">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Interview Questions
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Questions generated from the role requirements. You can
                    edit, pin, reorder, delete, or add your own questions.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                    {questions.length}
                  </span>

                  <Button
                    onClick={() => handleRegenerateSection("questions")}
                    disabled={isGenerating}
                  >
                    Regenerate
                  </Button>

                  <Button onClick={handleAddQuestion} disabled={isGenerating}>
                    + Add Question
                  </Button>
                </div>
              </div>

              {/* Category regeneration */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleRegenerateSection("technical")}
                  disabled={isGenerating}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Regenerate Technical
                </button>

                <button
                  type="button"
                  onClick={() => handleRegenerateSection("behavioral")}
                  disabled={isGenerating}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Regenerate Behavioral
                </button>

                <button
                  type="button"
                  onClick={() => handleRegenerateSection("system_design")}
                  disabled={isGenerating}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Regenerate System Design
                </button>

                <button
                  type="button"
                  onClick={() => handleRegenerateSection("coding")}
                  disabled={isGenerating}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Regenerate Coding
                </button>
              </div>

              {questions.length === 0 ? (
                <Card>
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-500">
                      No questions generated yet.
                    </p>

                    <div className="mt-4">
                      <Button
                        onClick={handleAddQuestion}
                        disabled={isGenerating}
                      >
                        + Add First Question
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      index={index}
                      totalQuestions={questions.length}
                      onEdit={handleEditQuestion}
                      onDelete={handleDeleteQuestion}
                      onTogglePin={handleToggleQuestionPin}
                      onMoveUp={handleMoveQuestionUp}
                      onMoveDown={handleMoveQuestionDown}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Flashcards */}
            <section className="mb-6">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Flashcards
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Quickly revise important interview concepts.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handleRegenerateSection("flashcards")}
                    disabled={isGenerating}
                  >
                    Regenerate
                  </Button>

                  <Button onClick={handleAddFlashcard} disabled={isGenerating}>
                    + Add Flashcard
                  </Button>
                </div>
              </div>

              {flashcards.length === 0 ? (
                <Card>
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-500">
                      No flashcards generated yet.
                    </p>

                    <div className="mt-4">
                      <Button
                        onClick={handleAddFlashcard}
                        disabled={isGenerating}
                      >
                        + Add First Flashcard
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {flashcards.map((flashcard, index) => (
                    <div key={flashcard.id} className="relative">
                      <Flashcard flashcard={flashcard} index={index} />

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {flashcard.is_edited && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            Edited
                          </span>
                        )}

                        {flashcard.is_pinned && (
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                            📌 Pinned
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleFlashcardPin(flashcard.id)}
                          disabled={isGenerating}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                            flashcard.is_pinned
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {flashcard.is_pinned ? "Unpin" : "Pin"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEditFlashcard(flashcard)}
                          disabled={isGenerating}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteFlashcard(flashcard.id)}
                          disabled={isGenerating}
                          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Schedule */}
            <section className="mb-6">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Preparation Schedule
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Your preparation plan for{" "}
                    {kit.schedule?.days_available ?? 0} days.
                  </p>
                </div>

                <Button
                  onClick={() => handleRegenerateSection("schedule")}
                  disabled={isGenerating}
                >
                  Regenerate Schedule
                </Button>
              </div>

              {scheduleDays.length === 0 ? (
                <Card>
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-500">
                      No preparation schedule available.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {scheduleDays.map((day) => (
                    <ScheduleDay
                      key={day.day}
                      day={day}
                      questions={questions}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Coverage */}
            <Card className="mb-8">
              <div className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Requirement Coverage
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      How well the generated questions cover the extracted
                      requirements.
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-3xl font-bold text-slate-900">
                      {coveragePercentage}%
                    </p>

                    <p className="text-xs text-slate-500">
                      {coveredRequirements}/{requirements.length} covered
                    </p>
                  </div>
                </div>

                <div
                  className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={coveragePercentage}
                  aria-label="Requirement coverage"
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${coveragePercentage}%`,
                    }}
                  />
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-slate-700">
                    Coverage passes
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {kit.coverage?.passes ?? 0}
                  </p>
                </div>

                {uncoveredRequirements.length > 0 ? (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">
                      Uncovered Requirements
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {uncoveredRequirements.map((requirementId) => (
                        <span
                          key={requirementId}
                          className="rounded-md bg-amber-100 px-2 py-1 text-xs font-mono text-amber-800"
                        >
                          {requirementId}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-700">
                      ✓ All extracted requirements are covered.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Generation Info */}
            {isCompleted && (
              <div className="mb-8 text-center">
                <p className="text-xs text-slate-400">
                  Interview kit generated successfully
                  {kit.source.researched_at
                    ? ` • ${new Date(
                        kit.source.researched_at,
                      ).toLocaleString()}`
                    : ""}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Question Editor Modal */}
      {isQuestionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseQuestionModal();
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-modal-title"
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="question-modal-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {isAddingQuestion ? "Add Question" : "Edit Question"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Customize this question for your interview preparation.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseQuestionModal}
                disabled={questionSaving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
                aria-label="Close question editor"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-5 p-5 sm:p-6">
              {/* Prompt */}
              <div>
                <label
                  htmlFor="question-prompt"
                  className="text-sm font-semibold text-slate-700"
                >
                  Question
                </label>

                <textarea
                  id="question-prompt"
                  value={questionForm.prompt}
                  onChange={(event) =>
                    setQuestionForm((current) => ({
                      ...current,
                      prompt: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Enter the interview question..."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Answer Outline */}
              <div>
                <label
                  htmlFor="answer-outline"
                  className="text-sm font-semibold text-slate-700"
                >
                  Answer Outline
                </label>

                <textarea
                  id="answer-outline"
                  value={questionForm.answer_outline}
                  onChange={(event) =>
                    setQuestionForm((current) => ({
                      ...current,
                      answer_outline: event.target.value,
                    }))
                  }
                  rows={6}
                  placeholder="Enter the key points that should be covered in the answer..."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Category + Difficulty */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="question-category"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Category
                  </label>

                  <select
                    id="question-category"
                    value={questionForm.category}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        category: event.target.value as Question["category"],
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="technical">Technical</option>
                    <option value="behavioral">Behavioral</option>
                    <option value="system_design">System Design</option>
                    <option value="coding">Coding</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="question-difficulty"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Difficulty
                  </label>

                  <select
                    id="question-difficulty"
                    value={questionForm.difficulty}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        difficulty: Number(
                          event.target.value,
                        ) as Question["difficulty"],
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value={1}>Easy</option>
                    <option value={2}>Medium</option>
                    <option value={3}>Hard</option>
                  </select>
                </div>
              </div>

              {/* Requirement Mapping */}
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Related Requirements
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Select which job requirements this question covers.
                </p>

                {requirements.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    No requirements available.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {requirements.map((requirement) => {
                      const selected = questionForm.requirement_ids.includes(
                        requirement.id,
                      );

                      return (
                        <label
                          key={requirement.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                            selected
                              ? "border-indigo-300 bg-indigo-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              handleRequirementToggle(requirement.id)
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-500">
                                {requirement.id}
                              </span>

                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  requirement.priority === "must"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {requirement.priority}
                              </span>
                            </div>

                            <p className="mt-1 text-sm leading-5 text-slate-700">
                              {requirement.text}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Errors / Success */}
              {questionSaveError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-700">
                    {questionSaveError}
                  </p>
                </div>
              )}

              {questionSaveSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-700">
                    ✓ {questionSaveSuccess}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={handleCloseQuestionModal}
                disabled={questionSaving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveQuestion}
                disabled={questionSaving}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {questionSaving
                  ? "Saving..."
                  : isAddingQuestion
                    ? "Add Question"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flashcard Editor Modal */}
      {isFlashcardModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseFlashcardModal();
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="flashcard-modal-title"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="flashcard-modal-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {isAddingFlashcard ? "Add Flashcard" : "Edit Flashcard"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Create a concise revision card for your interview preparation.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseFlashcardModal}
                disabled={flashcardSaving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
                aria-label="Close flashcard editor"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="space-y-5 p-5 sm:p-6">
              {/* Front */}
              <div>
                <label
                  htmlFor="flashcard-front"
                  className="text-sm font-semibold text-slate-700"
                >
                  Front
                </label>

                <textarea
                  id="flashcard-front"
                  value={flashcardForm.front}
                  onChange={(event) =>
                    setFlashcardForm((current) => ({
                      ...current,
                      front: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Example: What is JWT?"
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Back */}
              <div>
                <label
                  htmlFor="flashcard-back"
                  className="text-sm font-semibold text-slate-700"
                >
                  Back / Answer
                </label>

                <textarea
                  id="flashcard-back"
                  value={flashcardForm.back}
                  onChange={(event) =>
                    setFlashcardForm((current) => ({
                      ...current,
                      back: event.target.value,
                    }))
                  }
                  rows={6}
                  placeholder="Enter the concise answer..."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Requirements */}
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Related Requirements
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Select which requirements this flashcard helps revise.
                </p>

                {requirements.length === 0 ? (
                  <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                    No requirements available.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {requirements.map((requirement) => {
                      const selected = flashcardForm.requirement_ids.includes(
                        requirement.id,
                      );

                      return (
                        <label
                          key={requirement.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                            selected
                              ? "border-indigo-300 bg-indigo-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              handleFlashcardRequirementToggle(requirement.id)
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-500">
                                {requirement.id}
                              </span>

                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  requirement.priority === "must"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {requirement.priority}
                              </span>
                            </div>

                            <p className="mt-1 text-sm leading-5 text-slate-700">
                              {requirement.text}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Errors */}
              {flashcardSaveError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-700">
                    {flashcardSaveError}
                  </p>
                </div>
              )}

              {flashcardSaveSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-700">
                    ✓ {flashcardSaveSuccess}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                onClick={handleCloseFlashcardModal}
                disabled={flashcardSaving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveFlashcard}
                disabled={flashcardSaving}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {flashcardSaving
                  ? "Saving..."
                  : isAddingFlashcard
                    ? "Add Flashcard"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
