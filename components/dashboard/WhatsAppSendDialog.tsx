"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { Alert, Badge, Button, Select, TextField, Modal, ModalHeader, ModalBody, ModalFooter, type BadgeTone } from "@/components/ui";

export interface WaOptions {
  connected: boolean;
  accountOk?: boolean;
  fromPhone?: string;
  phone?: string | null;
  guestName?: string;
  templates?: { id: string; name: string; language: string; purpose: string; header: string; body: string; footer: string }[];
  history?: { id: string; templateName: string | null; toPhone: string | null; status: string; errorMessage: string | null; createdAt: string }[];
}

const STATUS_TONE: Record<string, BadgeTone> = { SENT: "info", DELIVERED: "brand", READ: "success", FAILED: "danger" };

export default function WhatsAppSendDialog({
  type, id, options, onClose,
}: { type: "reservation" | "invoice" | "receipt"; id: string; options: WaOptions; onClose: () => void }) {
  const t = useTranslations("share.whatsappApi");
  const tErr = useTranslations("settings.whatsapp.errors");
  const locale = useLocale();
  const templates = options.templates ?? [];
  const preferred = templates.find((x) => x.language.startsWith(locale)) ?? templates[0];
  const [templateId, setTemplateId] = useState(preferred?.id ?? "");
  const [to, setTo] = useState(options.phone ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ msg: string; detail?: string } | null>(null);
  const tpl = templates.find((x) => x.id === templateId);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, templateId, to }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t("sent"));
        onClose();
        return;
      }
      const key = String(data.error ?? "generic");
      setError({ msg: tErr.has(key) ? tErr(key) : tErr("generic"), detail: data.detail });
    } catch {
      setError({ msg: tErr("generic") });
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="md">
      <ModalHeader title={t("title")} subtitle={options.fromPhone ? t("from", { phone: `\u2066${options.fromPhone}\u2069` }) : undefined} />
      <ModalBody>
        <div className="space-y-4">
          {!options.accountOk && <Alert variant="warning" description={t("accountError")} />}
          {templates.length === 0 ? (
            <Alert variant="info" title={t("noTemplatesTitle")} description={t("noTemplatesDesc")} />
          ) : (
            <>
              <Select label={t("template")} value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                options={templates.map((x) => ({ value: x.id, label: `${x.name} · ${x.language}` }))} />
              <TextField label={t("to")} helperText={options.guestName ? t("toHelp", { name: options.guestName }) : undefined}
                dir="ltr" inputMode="tel" value={to} onChange={(e) => setTo(e.target.value)} />
              {tpl && (
                <div className="rounded-2xl bg-[#e7ece9] p-3">
                  <div dir={tpl.language.startsWith("ar") ? "rtl" : "ltr"} className="rounded-xl rounded-ss-sm bg-white p-3 shadow-sm">
                    {tpl.header && <p className="mb-1 font-bold text-gray-900">{tpl.header}</p>}
                    <p className="whitespace-pre-line text-sm text-gray-800">{tpl.body}</p>
                    {tpl.footer && <p className="mt-1.5 text-xs text-gray-500">{tpl.footer}</p>}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">{t("linkNote")}</p>
                </div>
              )}
            </>
          )}
          {error && <Alert variant="error" title={error.msg} description={error.detail} />}
          {!!options.history?.length && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t("history")}</p>
              <ul className="space-y-1.5">
                {options.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                    <span className="truncate"><span dir="ltr">{h.toPhone}</span> · <span dir="ltr">{h.templateName}</span></span>
                    <Badge tone={STATUS_TONE[h.status] ?? "neutral"} appearance="subtle" size="sm" dot title={h.errorMessage ?? undefined}>
                      {t.has(`status.${h.status}`) ? t(`status.${h.status}`) : h.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{t("cancel")}</Button>
        {templates.length > 0 && (
          <Button leftIcon={<PaperAirplaneIcon className="h-4 w-4" />} loading={sending}
            disabled={!templateId || to.replace(/\D/g, "").length < 8} onClick={send}>
            {t("send")}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
