"use client";

import { useState, useTransition } from "react";
import { login, signup } from "./actions";
import Link from "next/link";
import {
  BuildingOfficeIcon,
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

const SERVER_ERRORS: Record<string, string> = {
  "Could not authenticate user": "Invalid email or password. Please check your credentials and try again.",
  "Could not create user": "Could not create your account. This email may already be registered.",
  invalid_credentials: "Invalid email or password. Please try again.",
  server_error: "Something went wrong. Please try again later.",
};

export default function LoginForm({
  initialError,
  initialSuccess,
}: {
  initialError?: string;
  initialSuccess?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isPending, startTransition] = useTransition();

  const serverError = initialError ? (SERVER_ERRORS[initialError] ?? initialError) : null;
  const serverSuccess = initialSuccess ?? null;

  const validate = (email: string, password: string) => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Enter a valid email address.";
    }
    if (!password) {
      errs.password = "Password is required.";
    } else if (mode === "signup" && password.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }
    return errs;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const errs = validate(email, password);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    startTransition(() => {
      if (mode === "signin") login(formData);
      else signup(formData);
    });
  };

  return (
    <div className="w-full max-w-md" style={{ animation: "heroFadeUp 0.6s cubic-bezier(.4,0,.2,1) 0.1s both" }}>
      {/* Branding */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/40">
          <BuildingOfficeIcon className="h-8 w-8 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">OmRent</h1>
          <p className="text-sm text-slate-400">Property Management System</p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-white/5">
        {/* Mode tabs */}
        <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setFieldErrors({});
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200 ${
                mode === m
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Server error banner */}
        {serverError && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <ExclamationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Server success banner */}
        {serverSuccess && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{serverSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email address
            </label>
            <div className="relative">
              <EnvelopeIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                onChange={() => fieldErrors.email && setFieldErrors((e) => ({ ...e, email: undefined }))}
                className={`w-full rounded-lg border py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
                  fieldErrors.email
                    ? "border-red-300 bg-red-50 focus:ring-red-400"
                    : "border-slate-200 bg-white focus:border-blue-500 focus:ring-blue-500/30"
                }`}
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                <ExclamationCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"}
                onChange={() => fieldErrors.password && setFieldErrors((e) => ({ ...e, password: undefined }))}
                className={`w-full rounded-lg border py-2.5 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 ${
                  fieldErrors.password
                    ? "border-red-300 bg-red-50 focus:ring-red-400"
                    : "border-slate-200 bg-white focus:border-blue-500 focus:ring-blue-500/30"
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                <ExclamationCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {mode === "signin" ? "Signing in…" : "Creating account…"}
              </>
            ) : mode === "signin" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>
      </div>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </div>
    </div>
  );
}