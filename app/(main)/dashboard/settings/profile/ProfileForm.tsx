"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile, changePassword } from "./actions";
import {
  Alert,
  Button,
  PasswordField,
  TextField,
} from "@/components/ui";

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function StatusBanner({ state }: { state: { error?: string; success?: string } }) {
  if (state.success) return <Alert variant="success" description={state.success} />;
  if (state.error)   return <Alert variant="error"   description={state.error} />;
  return null;
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
          <TextField
            label={t("firstNameLabel")}
            name="firstName"
            defaultValue={firstName ?? ""}
            placeholder={t("firstNamePlaceholder")}
            required
            reserveMessageSpace={false}
          />
          <TextField
            label={t("lastNameLabel")}
            name="lastName"
            defaultValue={lastName ?? ""}
            placeholder={t("lastNamePlaceholder")}
            reserveMessageSpace={false}
          />
        </div>

        <TextField
          label={t("phoneLabel")}
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
          placeholder={t("phonePlaceholder")}
          autoComplete="tel"
          reserveMessageSpace={false}
        />

        <TextField
          label={t("emailLabel")}
          type="email"
          value={email}
          readOnly
          helperText={t("emailNote")}
        />

        <div className="flex justify-end pt-1">
          <Button type="submit" loading={isPending}>
            {t("saveButton")}
          </Button>
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
          required
          reserveMessageSpace={false}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <PasswordField
            label={t("newLabel")}
            name="newPassword"
            autoComplete="new-password"
            required
            reserveMessageSpace={false}
          />
          <PasswordField
            label={t("confirmLabel")}
            name="confirmPassword"
            autoComplete="new-password"
            required
            reserveMessageSpace={false}
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" loading={isPending}>
            {t("updateButton")}
          </Button>
        </div>
      </div>
    </form>
  );
}
