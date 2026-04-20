"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { updateProfile, changePassword } from "./actions";

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function StatusBanner({ state }: { state: { error?: string; success?: string } }) {
  if (state.success)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
        {state.success}
      </div>
    );
  if (state.error)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
        {state.error}
      </div>
    );
  return null;
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  autoComplete,
  addon,
}: {
  label:         string;
  name:          string;
  type?:         string;
  defaultValue?: string;
  placeholder?:  string;
  required?:     boolean;
  autoComplete?: string;
  addon?:        React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete ?? "off"}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
        />
        {addon && (
          <div className="absolute end-3 top-1/2 -translate-y-1/2">{addon}</div>
        )}
      </div>
    </div>
  );
}

// ── Password field with show/hide ─────────────────────────────────────────────

function PasswordField({
  label,
  name,
  autoComplete,
}: {
  label:        string;
  name:         string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      name={name}
      type={show ? "text" : "password"}
      required
      autoComplete={autoComplete}
      addon={
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          {show ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      }
    />
  );
}

// ── Profile info card ─────────────────────────────────────────────────────────

export function ProfileInfoForm({
  firstName,
  lastName,
  phone,
  email,
}: {
  firstName?: string | null;
  lastName?:  string | null;
  phone?:     string | null;
  email:      string;
}) {
  const t = useTranslations("settings.profile.personal");
  const [state, action, isPending] = useActionState(updateProfile, {});

  return (
    <form action={action} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{t("title")}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="p-6 space-y-5">
        <StatusBanner state={state} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label={t("firstNameLabel")}
            name="firstName"
            defaultValue={firstName ?? ""}
            placeholder={t("firstNamePlaceholder")}
            required
          />
          <Field
            label={t("lastNameLabel")}
            name="lastName"
            defaultValue={lastName ?? ""}
            placeholder={t("lastNamePlaceholder")}
          />
        </div>

        <Field
          label={t("phoneLabel")}
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
          placeholder={t("phonePlaceholder")}
          autoComplete="tel"
        />

        {/* Email — read-only */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("emailLabel")}
          </label>
          <input
            type="email"
            value={email}
            disabled
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-400">{t("emailNote")}</p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? t("saving") : t("saveButton")}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Change password card ──────────────────────────────────────────────────────

export function ChangePasswordForm() {
  const t = useTranslations("settings.profile.password");
  const [state, action, isPending] = useActionState(changePassword, {});

  return (
    <form action={action} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900">{t("title")}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t("subtitle")}</p>
      </div>

      <div className="p-6 space-y-5">
        <StatusBanner state={state} />

        <PasswordField
          label={t("currentLabel")}
          name="currentPassword"
          autoComplete="current-password"
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <PasswordField
            label={t("newLabel")}
            name="newPassword"
            autoComplete="new-password"
          />
          <PasswordField
            label={t("confirmLabel")}
            name="confirmPassword"
            autoComplete="new-password"
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? t("updating") : t("updateButton")}
          </button>
        </div>
      </div>
    </form>
  );
}
