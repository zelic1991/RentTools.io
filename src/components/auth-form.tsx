"use client";

import { ButtonHTMLAttributes, forwardRef, InputHTMLAttributes, ReactNode } from "react";

export const AuthInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function AuthInput({ className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`h-11 w-full rounded-md border border-[var(--line-2)] bg-[var(--bg)] px-3 text-[14px] text-[var(--ink)] placeholder-[var(--ink-4)] outline-none focus:border-[var(--auth-focus)] focus:ring-2 focus:ring-[var(--auth-focus)]/20 transition-colors ${className}`}
        {...rest}
      />
    );
  },
);

export function AuthLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label className="text-[13px] font-medium text-[var(--ink-2)]" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

interface AuthSubmitProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function AuthSubmit({ loading, disabled, children, className = "", ...rest }: AuthSubmitProps) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={`h-11 w-full rounded-md bg-[var(--m-accent)] text-[14px] font-medium text-[var(--auth-button-text)] transition-colors hover:bg-[var(--m-accent-2)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-[var(--auth-error)]/30 bg-[var(--auth-error-soft)] px-3 py-2 text-[13px] text-[var(--auth-error)]"
    >
      {message}
    </div>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
      <span className="h-px flex-1 bg-[var(--line)]" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}
