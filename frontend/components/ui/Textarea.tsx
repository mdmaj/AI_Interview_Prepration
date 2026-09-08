import type { TextareaHTMLAttributes } from "react";

interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Textarea({
  label,
  error,
  hint,
  className = "",
  id,
  ...props
}: TextareaProps) {
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

      <textarea
        id={id}
        {...props}
        className={`
          min-h-32 w-full resize-y rounded-lg border bg-white
          px-3.5 py-3 text-sm text-slate-900
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

      <div className="mt-1.5 flex items-start justify-between gap-4">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : hint ? (
          <p className="text-xs text-slate-500">{hint}</p>
        ) : (
          <span />
        )}

        {props.maxLength && (
          <span className="shrink-0 text-xs text-slate-400">
            {props.value?.toString().length ?? 0}/{props.maxLength}
          </span>
        )}
      </div>
    </div>
  );
}