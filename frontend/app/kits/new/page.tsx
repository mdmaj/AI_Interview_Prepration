"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import Input from "@/components/ui/Input";

import { createKit } from "@/lib/kits";

export default function NewKitPage() {
  const router = useRouter();

  // Form state
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");

    // Get authentication token
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    // -----------------------------
    // Client-side validation
    // -----------------------------

    if (!company.trim()) {
      setError("Please enter the company name.");
      return;
    }

    if (!role.trim()) {
      setError("Please enter the job role.");
      return;
    }

    if (!jd.trim()) {
      setError("Please enter the job description.");
      return;
    }

    if (!companyUrl.trim()) {
      setError("Please enter the company website URL.");
      return;
    }

    if (days < 1 || days > 60) {
      setError("Interview days must be between 1 and 60.");
      return;
    }

    try {
      setLoading(true);

      // Create kit in backend
      const response = await createKit(
        {
          company: company.trim(),
          company_url: companyUrl.trim(),
          role: role.trim(),
          jd: jd.trim(),
          days_available: days,
        },
        token,
      );

      // Redirect to created kit
      router.push(`/kits/${response.kit._id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create interview kit.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      {/* Desktop Sidebar */}
      <Sidebar />

      <div className="min-h-screen">
        {/* Header */}
        <Header
          title="Create Kit"
          description="Build your personalized interview preparation kit"
          onMenuClick={() => setIsMobileNavOpen(true)}
        />

        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Mobile navigation */}
          <MobileNav
            isOpen={isMobileNavOpen}
            onClose={() => setIsMobileNavOpen(false)}
          />

          {/* Page Header */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mb-4 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              ← Back to Dashboard
            </button>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Create Interview Prep Kit
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Add the job details below and we&apos;ll use them to create a
              personalized interview preparation kit.
            </p>
          </div>

          {/* Form Card */}
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Company + Role */}
              <div className="grid gap-6 md:grid-cols-2">
                <Input
                  label="Company Name"
                  type="text"
                  placeholder="e.g. Microsoft"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                />

                <Input
                  label="Job Role"
                  type="text"
                  placeholder="e.g. Python Developer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                />
              </div>

              {/* Job Description */}
              <div>
                <Textarea
                  label="Job Description"
                  placeholder="Paste the complete job description here..."
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  rows={12}
                  required
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Include responsibilities, required skills, experience,
                  qualifications, and preferred skills if available.
                </p>
              </div>

              {/* Company Website */}
              <div>
                <Input
                  label="Company Website"
                  type="url"
                  placeholder="https://example.com"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  required
                />

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  We&apos;ll research the company website and relevant hiring
                  information.
                </p>
              </div>

              {/* Preparation Days */}
              <div>
                <label
                  htmlFor="days"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Interview Preparation Days
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    id="days"
                    type="number"
                    min={1}
                    max={60}
                    value={days}
                    onChange={(e) => {
                      const value = Number(e.target.value);

                      if (Number.isNaN(value)) {
                        setDays(1);
                        return;
                      }

                      setDays(Math.min(60, Math.max(1, value)));
                    }}
                    className="
                      w-full
                      rounded-lg
                      border
                      border-slate-300
                      bg-white
                      px-3
                      py-2.5
                      text-sm
                      text-slate-900
                      outline-none
                      transition
                      placeholder:text-slate-400
                      focus:border-slate-500
                      focus:ring-2
                      focus:ring-slate-200
                      sm:w-32
                    "
                    required
                  />

                  <span className="text-sm text-slate-500">
                    days available for preparation
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Choose between 1 and 60 days.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  role="alert"
                  className="
                    rounded-lg
                    border
                    border-red-200
                    bg-red-50
                    px-4
                    py-3
                    text-sm
                    leading-5
                    text-red-700
                  "
                >
                  {error}
                </div>
              )}

              {/* Submit Section */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  disabled={loading}
                  className="
                    rounded-lg
                    px-4
                    py-2.5
                    text-sm
                    font-medium
                    text-slate-600
                    transition
                    hover:bg-slate-100
                    hover:text-slate-900
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  Cancel
                </button>

                <Button type="submit" disabled={loading}>
                  {loading ? "Creating Kit..." : "Create Interview Kit"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Helpful Information */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              What happens next?
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <div className="mb-2 text-lg">🔎</div>
                <h3 className="text-sm font-medium text-slate-900">
                  Company Research
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  We&apos;ll research the company and relevant hiring
                  information.
                </p>
              </div>

              <div>
                <div className="mb-2 text-lg">🤖</div>
                <h3 className="text-sm font-medium text-slate-900">
                  AI Preparation
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Your requirements will be converted into personalized
                  interview questions and flashcards.
                </p>
              </div>

              <div>
                <div className="mb-2 text-lg">📅</div>
                <h3 className="text-sm font-medium text-slate-900">
                  Study Schedule
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  A preparation schedule will be created for your available
                  days.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
