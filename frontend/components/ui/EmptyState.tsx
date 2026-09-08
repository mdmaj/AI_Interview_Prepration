import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export default function EmptyState({
  title,
  description,
  action,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex min-h-60 flex-col items-center justify-center
        rounded-xl border border-dashed border-slate-300
        bg-slate-50 px-6 py-10 text-center
        ${className}
      `}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
          {icon}
        </div>
      )}

      <h3 className="text-base font-semibold text-slate-900">
        {title}
      </h3>

      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}