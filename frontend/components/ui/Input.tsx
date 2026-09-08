import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({
  label,
  error,
  hint,
  className = "",
  id,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}

      <input
        id={id}
        {...props}
        className={`
          w-full rounded-lg border bg-white px-3.5 py-2.5
          text-sm text-slate-900
          outline-none transition-all duration-200
          placeholder:text-slate-400
          focus:ring-2
          disabled:cursor-not-allowed disabled:bg-slate-100
          ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
              : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-100"
          }
          ${className}
        `}
      />

      {error && (
        <p className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}

      {!error && hint && (
        <p className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}