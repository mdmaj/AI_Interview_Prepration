"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";

import KitCard from "@/components/kits/KitCard";

import { getMyKits, deleteKit } from "@/lib/kits";
import type { InterviewKit } from "@/types/kit";

export default function DashboardPage() {
  const router = useRouter();

  const [kits, setKits] = useState<InterviewKit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [deletingKitId, setDeletingKitId] = useState<string | null>(null);

  /**
   * Load user's interview kits
   */
  useEffect(() => {
    let isMounted = true;

    const loadKits = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        setIsLoading(true);
        setError("");

        const response = await getMyKits(token);

        if (!isMounted) return;

        setKits(response.kits ?? []);
      } catch (err) {
        if (!isMounted) return;

        const message =
          err instanceof Error ? err.message : "Failed to load interview kits.";

        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadKits();

    return () => {
      isMounted = false;
    };
  }, [router]);

  /**
   * Delete kit
   */
  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this interview kit?",
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      setDeletingKitId(id);

      await deleteKit(id, token);

      setKits((currentKits) => currentKits.filter((kit) => kit._id !== id));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete interview kit.";

      window.alert(message);
    } finally {
      setDeletingKitId(null);
    }
  };

  /**
   * Dashboard statistics
   */
  const totalQuestions = kits.reduce(
    (total, kit) => total + (kit.questions?.length ?? 0),
    0,
  );

  const totalFlashcards = kits.reduce(
    (total, kit) => total + (kit.flashcards?.length ?? 0),
    0,
  );

  const completedKits = kits.filter(
    (kit) => kit.generation?.status === "completed",
  ).length;

  /**
   * Main layout
   */
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* 
        Desktop content area.

        Sidebar is fixed on desktop, so we only need
        horizontal padding here.
      */}
      <div className="min-h-screen lg:pl-64">
        {/* Header */}
        <Header
          title="Dashboard"
          description="Your personalized interview preparation workspace"
          onMenuClick={() => setIsMobileNavOpen(true)}
        />

        {/* Main Content */}
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            {/* =====================================================
                Welcome Section
            ====================================================== */}
            <section className="mb-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-indigo-600">
                    AI Interview Prep Kit
                  </p>

                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    Prepare smarter. Interview better.
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                    Create personalized preparation kits from job descriptions
                    and company research.
                  </p>
                </div>

                <div className="shrink-0">
                  <Button size="md" onClick={() => router.push("/kits/new")}>
                    <span className="mr-1 text-lg leading-none">+</span>
                    Create New Kit
                  </Button>
                </div>
              </div>
            </section>

            {/* =====================================================
                Statistics
            ====================================================== */}
            <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Interview Kits" value={kits.length} icon="▣" />

              <StatCard label="Questions" value={totalQuestions} icon="?" />

              <StatCard label="Flashcards" value={totalFlashcards} icon="◆" />

              <StatCard label="Completed Kits" value={completedKits} icon="✓" />
            </section>

            {/* =====================================================
                Interview Kits
            ====================================================== */}
            <section>
              {/* Section Header */}
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Your Interview Kits
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review and continue your preparation.
                  </p>
                </div>

                {kits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => router.push("/kits")}
                    className="shrink-0 text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
                  >
                    View all
                  </button>
                )}
              </div>

              {/* =================================================
                  Loading
              ================================================== */}
              {isLoading && (
                <Card padding="lg">
                  <div className="flex min-h-52 items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner size="lg" />

                      <p className="text-sm text-slate-500">
                        Loading your interview kits...
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* =================================================
                  Error
              ================================================== */}
              {!isLoading && error && (
                <Card padding="lg">
                  <div className="flex min-h-52 flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-lg font-bold text-red-600">
                      !
                    </div>

                    <h3 className="font-semibold text-slate-900">
                      Unable to load your kits
                    </h3>

                    <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                      {error}
                    </p>

                    <Button
                      className="mt-5"
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      Try Again
                    </Button>
                  </div>
                </Card>
              )}

              {/* =================================================
                  Empty State
              ================================================== */}
              {!isLoading && !error && kits.length === 0 && (
                <Card padding="lg">
                  <EmptyState
                    title="No interview kits yet"
                    description="Create your first personalized interview preparation kit using a job description and company website."
                    action={
                      <Button onClick={() => router.push("/kits/new")}>
                        Create Your First Kit
                      </Button>
                    }
                  />
                </Card>
              )}

              {/* =================================================
                  Kits Grid
              ================================================== */}
              {!isLoading && !error && kits.length > 0 && (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {kits.map((kit, index) => {
                    /*
                     * Prefer database ID.
                     * Fallback prevents React key warning
                     * if an old/incomplete kit has no ID.
                     */
                    const kitKey =
                      kit._id ??
                      `kit-${index}-${kit.source?.company ?? "unknown"}-${
                        kit.source?.role ?? "role"
                      }`;

                    return (
                      <div
                        key={kitKey}
                        className={
                          deletingKitId === kit._id
                            ? "pointer-events-none opacity-50 transition-opacity"
                            : "transition-opacity"
                        }
                      >
                        <KitCard kit={kit} onDelete={handleDelete} />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   Statistics Card
============================================================ */

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-500">{label}</p>

          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-600">
          {icon}
        </div>
      </div>
    </Card>
  );
}
