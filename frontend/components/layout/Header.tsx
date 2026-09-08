"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

interface HeaderProps {
  title?: string;
  description?: string;
  onMenuClick?: () => void;
}

interface StoredUser {
  name?: string;
  email?: string;
}

const subscribe = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
};

const getSnapshot = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("user");
};

const getServerSnapshot = (): string | null => {
  return null;
};

export default function Header({
  title = "Dashboard",
  description = "Your interview preparation workspace",
  onMenuClick,
}: HeaderProps) {
  const router = useRouter();

  const storedUser = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  let user: StoredUser | null = null;

  if (storedUser) {
    try {
      user = JSON.parse(storedUser) as StoredUser;
    } catch {
      user = null;
    }
  }

  const displayName = user?.name?.trim() || "User";
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white">
      <div className="flex min-h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left section */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* Mobile menu */}
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open navigation menu"
              className="
                flex h-9 w-9 shrink-0 items-center justify-center
                rounded-lg text-slate-500
                transition-colors
                hover:bg-slate-100 hover:text-slate-900
                focus:outline-none focus:ring-2 focus:ring-indigo-500
                lg:hidden
              "
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
          )}

          {/* Page title */}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">
              {title}
            </h1>

            {description && (
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right section */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {/* Notification */}
          <button
            type="button"
            aria-label="Notifications"
            className="
              relative flex h-9 w-9 items-center justify-center
              rounded-lg text-slate-500
              transition-colors
              hover:bg-slate-100 hover:text-slate-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>

            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-indigo-600" />
          </button>

          {/* Divider */}
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />

          {/* User */}
          <div className="flex items-center gap-2">
            <div
              className="
                flex h-9 w-9 shrink-0 items-center justify-center
                rounded-full bg-indigo-100
                text-sm font-semibold text-indigo-700
              "
            >
              {initial}
            </div>

            <div className="hidden max-w-32 sm:block">
              <p className="truncate text-sm font-medium text-slate-800">
                {displayName}
              </p>

              <p className="truncate text-xs text-slate-500">
                {user?.email || "Interview candidate"}
              </p>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="
                ml-1 flex h-9 w-9 shrink-0 items-center justify-center
                rounded-lg text-slate-400
                transition-colors
                hover:bg-red-50 hover:text-red-600
                focus:outline-none focus:ring-2 focus:ring-red-500
              "
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M21 19V5a2 2 0 0 0-2-2h-5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
