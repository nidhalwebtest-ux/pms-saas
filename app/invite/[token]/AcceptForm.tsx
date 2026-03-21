"use client";

import { useActionState, useState } from "react";
import {
  EyeIcon, EyeSlashIcon, ExclamationCircleIcon,
  CheckIcon, XMarkIcon,
} from "@heroicons/react/24/outline";

const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters",  test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter",   test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number",             test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character",  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

function PasswordField({
  label, name, value, onChange, autoComplete,
}: {
  label: string; name: string; value: string;
  onChange: (v: string) => void; autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label} <span className="text-blue-400">*</span>
      </label>
      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
        >
          {show ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function AcceptForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [password, setPassword]       = useState("");
  const [confirmPw, setConfirmPw]     = useState("");

  const boundAction = acceptInvitationWithToken.bind(null, token);
  const [state, formAction, isPending] = useActionState(boundAction, {});

  const strength = PASSWORD_REQUIREMENTS.filter((r) => r.test(password)).length;
  const strengthColors = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500"];
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthTextColors = ["", "text-red-400", "text-orange-400", "text-yellow-400", "text-green-400"];

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">
          <ExclamationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {state.error}
        </div>
      )}

      {/* Read-only email */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full rounded-xl border border-slate-700 bg-slate-800/30 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
        />
      </div>

      {/* Name row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            First Name <span className="text-blue-400">*</span>
          </label>
          <input
            name="firstName"
            type="text"
            required
            autoComplete="given-name"
            placeholder="Ahmed"
            className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
          <input
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder="Al-Balushi"
            className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition"
          />
        </div>
      </div>

      {/* Password */}
      <PasswordField
        label="Create Password"
        name="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />

      {/* Password strength */}
      {password.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < strength ? strengthColors[strength] : "bg-slate-700"}`}
                />
              ))}
            </div>
            {strength > 0 && (
              <span className={`text-xs font-semibold ${strengthTextColors[strength]}`}>
                {strengthLabels[strength]}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {PASSWORD_REQUIREMENTS.map((req) => {
              const met = req.test(password);
              return (
                <div key={req.label} className={`flex items-center gap-1.5 text-xs ${met ? "text-green-400" : "text-slate-500"}`}>
                  {met ? <CheckIcon className="h-3 w-3 flex-shrink-0" /> : <XMarkIcon className="h-3 w-3 flex-shrink-0" />}
                  {req.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirm password */}
      <PasswordField
        label="Confirm Password"
        name="confirmPassword"
        value={confirmPw}
        onChange={setConfirmPw}
        autoComplete="new-password"
      />

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 hover:bg-blue-500 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Creating account…
          </>
        ) : (
          "Accept & Create Account"
        )}
      </button>
    </form>
  );
}

// Thin wrapper so useActionState can bind the token
import { acceptInvitation } from "./actions";
function acceptInvitationWithToken(
  token: string,
  prev: { error?: string },
  fd: FormData,
) {
  return acceptInvitation(token, prev, fd);
}
