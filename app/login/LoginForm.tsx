"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { login, signup, signInWithGoogle } from "./actions";
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  XMarkIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { Alert } from "@/components/ui";

// ─── Error keys ────────────────────────────────────────────────────────────────

type ServerErrorKey =
  | "invalid_credentials"
  | "email_exists"
  | "email_not_confirmed"
  | "oauth_error"
  | "auth_error"
  | "server_error"
  | "session_expired";

type ServerWarnKey = "email_send_failed";

// ─── Password strength ─────────────────────────────────────────────────────────

const PASSWORD_REQUIREMENTS = [
  { key: "minLength", test: (p: string) => p.length >= 8 },
  { key: "uppercase", test: (p: string) => /[A-Z]/.test(p) },
  { key: "number",    test: (p: string) => /[0-9]/.test(p) },
  { key: "special",   test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

function getStrength(password: string) {
  const score = PASSWORD_REQUIREMENTS.filter((r) => r.test(password)).length;
  const keys  = ["", "weak", "fair", "good", "strong"] as const;
  const bar   = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500"];
  const text  = ["", "text-red-600", "text-orange-600", "text-yellow-600", "text-green-600"];
  return { score, labelKey: keys[score], barColor: bar[score], textColor: text[score] };
}

// ─── Lockout countdown banner ─────────────────────────────────────────────────

function LockoutBanner({ until }: { until: number }) {
  const t = useTranslations("auth.login");
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const diff = until - Date.now();
      if (diff <= 0) { setTimeLeft(""); return; }
      const m = Math.floor(diff / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  return (
    <Alert
      variant="error"
      className="mb-5"
      icon={<ShieldExclamationIcon className="h-5 w-5 text-error-600 flex-shrink-0" aria-hidden="true" />}
      title={t("lockoutTitle")}
      description={
        timeLeft === ""
          ? t("lockoutBodyNow")
          : timeLeft
            ? t.rich("lockoutBodyIn", {
                time: timeLeft,
                b: (chunks) => <span className="font-mono font-semibold ltr-numbers">{chunks}</span>,
              })
            : null
      }
    />
  );
}

// ─── Google Icon ───────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginForm({
  initialMode = "signin",
  initialError,
  initialWarn,
  lockoutUntil,
}: {
  initialMode?: "signin" | "signup";
  initialError?: string;
  initialWarn?: string;
  lockoutUntil?: number;   // Unix ms — when the lockout expires
}) {
  const t        = useTranslations("auth.login");
  const tBrand   = useTranslations("auth.brand");
  const tCommon  = useTranslations("auth.common");
  const tReq     = useTranslations("auth.login.passwordReq");
  const tStr     = useTranslations("auth.login.strength");
  const tErr     = useTranslations("auth.login.serverErrors");
  const tWarn    = useTranslations("auth.login.serverWarnings");

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [googlePending] = useState(false);

  const knownErrorKeys: ServerErrorKey[] = [
    "invalid_credentials", "email_exists", "email_not_confirmed",
    "oauth_error", "auth_error", "server_error", "session_expired",
  ];
  const knownWarnKeys: ServerWarnKey[] = ["email_send_failed"];
  const isLockedOut = initialError === "too_many_attempts" && !!lockoutUntil;
  const serverError = (initialError && !isLockedOut)
    ? (knownErrorKeys.includes(initialError as ServerErrorKey)
        ? tErr(initialError as ServerErrorKey)
        : null)
    : null;
  const serverWarn = initialWarn && knownWarnKeys.includes(initialWarn as ServerWarnKey)
    ? tWarn(initialWarn as ServerWarnKey)
    : null;
  const strength = getStrength(password);

  // Reset form state when switching modes
  const switchMode = (m: "signin" | "signup") => {
    setMode(m);
    setPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    setShowPassword(false);
    setShowConfirm(false);
  };

  // Clear field error on change
  const clearError = (field: string) =>
    setFieldErrors((e) => { const n = { ...e }; delete n[field]; return n; });

  // Client-side validation
  const validate = (email: string, pw: string, confirm: string) => {
    const errs: Record<string, string> = {};

    if (!email.trim()) {
      errs.email = t("validation.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = t("validation.emailInvalid");
    }

    if (!pw) {
      errs.password = t("validation.passwordRequired");
    } else if (mode === "signup") {
      if (pw.length < 8)         errs.password = t("validation.passwordTooShort");
      else if (!/[A-Z]/.test(pw)) errs.password = t("validation.passwordNeedsUpper");
      else if (!/[0-9]/.test(pw)) errs.password = t("validation.passwordNeedsNumber");
      else if (!/[^A-Za-z0-9]/.test(pw)) errs.password = t("validation.passwordNeedsSpecial");
    }

    if (mode === "signup" && !errs.password && pw !== confirm) {
      errs.confirmPassword = t("validation.passwordsMismatch");
    }

    return errs;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    const errs = validate(email, password, confirmPassword);
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

  const isLoading = isPending || googlePending;

  return (
    <div
      className="w-full max-w-md"
      style={{ animation: "heroFadeUp 0.6s cubic-bezier(.4,0,.2,1) 0.1s both" }}
    >
      {/* ── Branding ──────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/binaya-logo-horizontal-white.svg" alt="Binaya" className="h-12 w-auto" />
        <p className="text-sm text-slate-400">{tBrand("tagline")}</p>
      </div>

      {/* ── Card ──────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-white/5">

        {/* Mode tabs */}
        <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200 ${
                mode === m
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m === "signin" ? t("tabs.signIn") : t("tabs.signUp")}
            </button>
          ))}
        </div>

        {/* Lockout countdown */}
        {isLockedOut && lockoutUntil && <LockoutBanner until={lockoutUntil} />}

        {serverError && (
          <Alert variant="error" className="mb-5" description={serverError} />
        )}

        {serverWarn && (
          <Alert variant="warning" className="mb-5" description={serverWarn} />
        )}

        {/* ── Google OAuth button ────────────────────────────── */}
        <form action={signInWithGoogle}>
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googlePending ? (
              <svg className="h-4 w-4 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <GoogleIcon />
            )}
            {t("google")}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-400">{t("or")}</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* ── Email / Password form ──────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              {t("emailLabel")}
            </label>
            <div className="relative">
              <EnvelopeIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                disabled={isLoading}
                onChange={() => clearError("email")}
                className={`w-full rounded-lg border py-2.5 ps-9 pe-4 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
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
              {t("passwordLabel")}
            </label>
            <div className="relative">
              <LockClosedIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "signup" ? t("passwordPlaceholderSignup") : t("passwordPlaceholderSignin")}
                disabled={isLoading}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError("password");
                }}
                className={`w-full rounded-lg border py-2.5 ps-9 pe-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                  fieldErrors.password
                    ? "border-red-300 bg-red-50 focus:ring-red-400"
                    : "border-slate-200 bg-white focus:border-blue-500 focus:ring-blue-500/30"
                }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                aria-label={showPassword ? tCommon("hidePassword") : tCommon("showPassword")}
              >
                {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>

            {/* Password strength meter — signup only */}
            {mode === "signup" && password.length > 0 && (
              <div className="mt-2.5 space-y-2">
                {/* Strength bars */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i < strength.score ? strength.barColor : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  {strength.labelKey && (
                    <span className={`text-xs font-semibold ${strength.textColor}`}>
                      {tStr(strength.labelKey)}
                    </span>
                  )}
                </div>

                {/* Requirements checklist */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {PASSWORD_REQUIREMENTS.map((req) => {
                    const met = req.test(password);
                    return (
                      <div
                        key={req.key}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                          met ? "text-green-600" : "text-slate-400"
                        }`}
                      >
                        {met ? (
                          <CheckIcon className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <XMarkIcon className="h-3 w-3 flex-shrink-0" />
                        )}
                        {tReq(req.key)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {fieldErrors.password && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                <ExclamationCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password — signup only */}
          {mode === "signup" && (
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("confirmPasswordLabel")}
              </label>
              <div className="relative">
                <LockClosedIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("confirmPasswordPlaceholder")}
                  disabled={isLoading}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearError("confirmPassword");
                  }}
                  className={`w-full rounded-lg border py-2.5 ps-9 pe-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                    fieldErrors.confirmPassword
                      ? "border-red-300 bg-red-50 focus:ring-red-400"
                      : confirmPassword && confirmPassword === password
                        ? "border-green-300 bg-green-50 focus:ring-green-400"
                        : "border-slate-200 bg-white focus:border-blue-500 focus:ring-blue-500/30"
                  }`}
                />
                <div className="absolute end-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {/* Match indicator */}
                  {confirmPassword && (
                    confirmPassword === password ? (
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <XMarkIcon className="h-4 w-4 text-red-400" />
                    )
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showConfirm ? tCommon("hidePassword") : tCommon("showPassword")}
                  >
                    {showConfirm ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                  <ExclamationCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {/* Remember Me — signin only */}
          {mode === "signin" && (
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 select-none">
                <input
                  type="checkbox"
                  name="rememberMe"
                  value="on"
                  disabled={isLoading || isLockedOut}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-slate-600">{t("rememberMe")}</span>
              </label>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || isLockedOut}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {mode === "signin" ? t("signingIn") : t("creatingAccount")}
              </>
            ) : mode === "signin" ? (
              t("submitSignIn")
            ) : (
              t("submitSignUp")
            )}
          </button>

          {/* Resend / forgot links */}
          {mode === "signin" && (
            <p className="text-center text-xs text-slate-500">
              {t("didntGetEmail")}{" "}
              <Link href="/verify-email" className="font-medium text-blue-600 hover:underline">
                {t("resendIt")}
              </Link>
            </p>
          )}
        </form>

        {/* Terms — signup only */}
        {mode === "signup" && (
          <p className="mt-4 text-center text-xs text-slate-400">
            {t.rich("terms", {
              terms:   (chunks) => <span className="text-blue-600 cursor-pointer hover:underline">{chunks}</span>,
              privacy: (chunks) => <span className="text-blue-600 cursor-pointer hover:underline">{chunks}</span>,
            })}
          </p>
        )}
      </div>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />
          {tCommon("backToHome")}
        </Link>
      </div>
    </div>
  );
}