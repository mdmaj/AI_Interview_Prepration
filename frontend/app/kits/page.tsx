"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getMyKits, deleteKit } from "@/lib/kits";
import { getToken } from "@/lib/auth";
import type { InterviewKit } from "@/types/kit";

import KitCard from "@/components/kits/KitCard";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

export default function MyKitsPage() {
  const router = useRouter();

  const [kits, setKits] = useState<InterviewKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const loadKits = async () => {
      try {
        const token = getToken();

        if (!token) {
          router.push("/login");
          return;
        }

        const response = await getMyKits(token);

        setKits(response.kits || []);
      } catch (err) {
        console.error("Failed to load kits:", err);

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

  const handleDelete = async (kitId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this interview kit?",
    );

    if (!confirmed) return;

    try {
      const token = getToken();

      if (!token) {
        router.push("/login");
        return;
      }

      setDeletingId(kitId);

      await deleteKit(kitId, token);

      setKits((currentKits) => currentKits.filter((kit) => kit._id !== kitId));
    } catch (err) {
      console.error("Failed to delete kit:", err);

      alert(
        err instanceof Error
          ? err.message
          : "Failed to delete the interview kit.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 lg:pl-64">
        <Sidebar />
        <Header
          title="My Interview Kits"
          description="Manage your interview preparation kits"
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
        title="My Interview Kits"
        description="Manage and practice your personalized interview preparation kits"
        onMenuClick={() => setMobileNavOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My Interview Kits
            </h1>

            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Manage and practice your personalized interview preparation kits.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/kits/new")}
            className="inline-flex w-fit items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Create New Kit
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Empty */}
        {!error && kits.length === 0 && (
          <EmptyState
            title="No interview kits yet"
            description="Create your first interview kit by adding a job description and company URL."
            action={
              <button
                type="button"
                onClick={() => router.push("/kits/new")}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Create Your First Kit
              </button>
            }
          />
        )}

        {/* Kits */}
        {!error && kits.length > 0 && (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">
                {kits.length} {kits.length === 1 ? "kit" : "kits"}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {kits.map((kit) => {
                const kitId = kit._id;

                return (
                  <div key={kitId} className="relative">
                    <KitCard kit={kit} />

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/kits/${kitId}`)}
                        className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Open Kit
                      </button>

                      <button
                        type="button"
                        disabled={deletingId === kitId}
                        onClick={() => handleDelete(kitId)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === kitId ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
