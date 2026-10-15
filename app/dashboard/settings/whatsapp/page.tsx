import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { requireOrgUser } from "@/lib/tenant";
import { getSessionAccess } from "@/lib/access";
import { getAccountView, listTemplateViews } from "@/lib/whatsapp/service";
import WhatsAppSettings from "./WhatsAppSettings";

export default async function WhatsAppSettingsPage() {
  let u;
  try { u = await requireOrgUser(); } catch { redirect("/login"); }
  const access = await getSessionAccess();
  const t = await getTranslations("settings.whatsapp");

  const serverReady = !!process.env.WHATSAPP_TOKEN_KEY;
  const account = serverReady ? await getAccountView(u.organizationId) : { connected: false };
  const templates = serverReady && account.connected ? await listTemplateViews(u.organizationId) : [];
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "binaya.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return (
    <div className="mx-auto max-w-5xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-success-50 rounded-lg">
          <ChatBubbleLeftRightIcon className="h-6 w-6 text-success-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
      </div>
      <WhatsAppSettings
        account={account}
        templates={templates}
        canEdit={!!access?.can("settingsWhatsapp", "EDIT")}
        serverReady={serverReady}
        webhookUrl={`${proto}://${host}/api/whatsapp/webhook`}
      />
    </div>
  );
}
