import { getTranslations } from "next-intl/server";
import { getSuperAdmin } from "@/lib/super-admin";
import { redirect } from "next/navigation";
import { getCrmSettings } from "../_lib/crm-settings";
import SettingsForm from "./SettingsForm";

export default async function AdminSettingsPage() {
  // Layout already gates, but settings writes goals — double-check here.
  if (!(await getSuperAdmin())) redirect("/dashboard");

  const t = await getTranslations("admin.settings");
  const settings = await getCrmSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-fg">{t("title")}</h2>
        <p className="text-sm text-fg-tertiary">{t("subtitle")}</p>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
