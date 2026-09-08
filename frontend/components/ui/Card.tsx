import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

export default function Card({
  padding = "md",
  hover = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={`
        rounded-xl border border-slate-200
        bg-white shadow-sm
        ${paddingStyles[padding]}
        ${
          hover
            ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            : ""
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
}