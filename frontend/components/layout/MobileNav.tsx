"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "▦",
  },
  {
    label: "Create Kit",
    href: "/kits/new",
    icon: "+",
  },
  {
    label: "My Kits",
    href: "/kits",
    icon: "▤",
  },
  {
    label: "Practice",
    href: "/practice",
    icon: "▷",
  },
  {
    label: "Schedule",
    href: "/schedule",
    icon: "□",
  },
];

export default function MobileNav({
  isOpen,
  onClose,
}: MobileNavProps) {
  const pathname = usePathname();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
      />

      {/* Drawer */}
      <aside
        className="
          relative flex h-full w-72 max-w-[85vw]
          flex-col bg-white shadow-2xl
        "
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
              AI
            </div>

            <div>
              <p className="text-sm font-bold text-slate-900">
                Interview Kit
              </p>

              <p className="text-[11px] text-slate-500">
                AI-powered preparation
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="
              flex h-9 w-9 items-center justify-center
              rounded-lg text-slate-400
              hover:bg-slate-100 hover:text-slate-700
              focus:outline-none focus:ring-2 focus:ring-indigo-500
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-5">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>

          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 rounded-lg
                  px-3 py-3 text-sm font-medium
                  transition-colors
                  ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }
                `}
              >
                <span
                  className={`
                    flex h-7 w-7 items-center justify-center
                    rounded-md text-base
                    ${
                      isActive
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-slate-100 text-slate-500"
                    }
                  `}
                >
                  {item.icon}
                </span>

                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-slate-200 p-4">
          <Link
            href="/settings"
            onClick={onClose}
            className="
              flex items-center gap-3 rounded-lg
              px-3 py-3 text-sm font-medium
              text-slate-600
              hover:bg-slate-50 hover:text-slate-900
            "
          >
            <span className="text-lg">⚙</span>
            Settings
          </Link>
        </div>
      </aside>
    </div>
  );
}