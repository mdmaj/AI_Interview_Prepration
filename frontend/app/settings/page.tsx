"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getToken, removeToken } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";

interface UserData {
  name?: string;
  email?: string;
}

export default function SettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const storedUser = localStorage.getItem("user");
    let timeoutId: number | undefined;

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as UserData;

        timeoutId = window.setTimeout(() => {
          setUser(parsedUser);
        }, 0);
      } catch (error) {
        console.error("Failed to parse user data:", error);
      }
    }

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [router]);

  const handleLogout = () => {
    removeToken();
    localStorage.removeItem("user");

    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      <Sidebar />

      <Header
        title="Settings"
        description="Manage your account and application preferences"
        onMenuClick={() => setMobileNavOpen(true)}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Settings
          </h1>

          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Manage your account and application preferences.
          </p>
        </div>

        <div className="space-y-6">
          {/* Account */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold text-slate-900">Account</h2>

              <p className="mt-1 text-sm text-slate-500">
                Your account information.
              </p>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                {/* Avatar */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-xl font-bold text-indigo-700">
                  {getInitials(user?.name || user?.email || "U")}
                </div>

                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-900">
                    {user?.name || "User"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {user?.email || "No email available"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Application */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Application
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Information about your interview preparation workspace.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              <SettingRow
                title="AI Interview Prep Kit"
                description="Personalized interview preparation powered by AI."
                value="Active"
              />

              <SettingRow
                title="Interview Kits"
                description="Create and manage preparation kits for multiple roles."
                value="Enabled"
              />

              <SettingRow
                title="Practice"
                description="Practice questions and flashcards from your kits."
                value="Enabled"
              />
            </div>
          </section>

          {/* Navigation shortcuts */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Quickly access the main areas of your workspace.
              </p>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
              <QuickAction
                title="My Kits"
                description="View your interview kits"
                onClick={() => router.push("/kits")}
              />

              <QuickAction
                title="Practice"
                description="Practice flashcards"
                onClick={() => router.push("/practice")}
              />

              <QuickAction
                title="Schedule"
                description="View your study plan"
                onClick={() => router.push("/schedule")}
              />
            </div>
          </section>

          {/* Danger Zone */}
          <section className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
            <div className="border-b border-red-100 px-5 py-5 sm:px-6">
              <h2 className="text-lg font-semibold text-red-700">
                Account Actions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Manage your current session.
              </p>
            </div>

            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="font-medium text-slate-900">Sign out</p>

                <p className="mt-1 text-sm text-slate-500">
                  Sign out of your AI Interview Prep Kit account.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-fit rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                Sign Out
              </button>
            </div>
          </section>

          {/* Version */}
          <div className="pb-4 text-center text-xs text-slate-400">
            AI Interview Prep Kit • v1.0
          </div>
        </div>
      </main>

      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </div>
  );
}

function SettingRow({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <p className="font-medium text-slate-900">{title}</p>

        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <span className="w-fit rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        {value}
      </span>
    </div>
  );
}

function QuickAction({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50"
    >
      <p className="font-semibold text-slate-900">{title}</p>

      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </button>
  );
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}
