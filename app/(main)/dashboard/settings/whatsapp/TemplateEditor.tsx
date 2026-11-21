"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Alert, Button, Select, TextArea, TextField, Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui";
import {
  FIELD_SAMPLES, FIELDS_BY_DOC, PURPOSE_DOC, renderText, validateDraft,
  type PmsField, type TemplateButton, type TemplateDraft, type TemplateLanguage, type TemplatePurpose, type TemplateCategory,
} from "@/lib/whatsapp/template-model";
import { createWhatsAppTemplate } from "./actions";

const PURPOSES: TemplatePurpose[] = ["RESERVATION_CONFIRMATION", "ARRIVAL_REMINDER", "INVOICE", "RECEIPT", "CUSTOM"];
const DEFAULT_NAME: Record<TemplatePurpose, string> = {
  RESERVATION_CONFIRMATION: "reservation_confirmation", ARRIVAL_REMINDER: "arrival_reminder",
  INVOICE: "invoice_notice", RECEIPT: "payment_receipt", CUSTOM: "custom_message",
};

/** Fields every document type the purpose can be sent from is able to fill. */
function fieldsFor(purpose: TemplatePurpose): PmsField[] {
  const docs = PURPOSE_DOC[purpose];
  return FIELDS_BY_DOC[docs[0]].filter((f) => docs.every((d) => FIELDS_BY_DOC[d].includes(f)));
}

export default function TemplateEditor({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const t = useTranslations("settings.whatsapp");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<TemplateDraft>({
    name: DEFAULT_NAME.RESERVATION_CONFIRMATION, language: "ar", category: "UTILITY", purpose: "RESERVATION_CONFIRMATION",
    header: "", body: "", footer: "", buttons: [],
  });
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<{ msg: string; detail?: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const headerRef = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState<"header" | "body">("body");

  const errors = useMemo(() => validateDraft(draft), [draft]);
  const allowed = fieldsFor(draft.purpose);
  const usedNotAllowed = [...(draft.header ?? "").matchAll(/\{\{([a-z_]+)\}\}/g), ...draft.body.matchAll(/\{\{([a-z_]+)\}\}/g)]
    .map((m) => m[1]).filter((f) => !allowed.includes(f as PmsField));
  const samples = FIELD_SAMPLES[draft.language];
  const rtl = draft.language === "ar";

  const set = <K extends keyof TemplateDraft>(k: K, v: TemplateDraft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setServerError(null); };

  function insertField(f: PmsField) {
    const token = `{{${f}}}`;
    const el = focus === "header" ? headerRef.current : bodyRef.current;
    const key = focus === "header" ? "header" : "body";
    const cur = (draft[key] ?? "") as string;
    const s = el?.selectionStart ?? cur.length, e = el?.selectionEnd ?? cur.length;
    const next = cur.slice(0, s) + token + cur.slice(e);
    set(key, next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + token.length, s + token.length); });
  }

  function setButton(i: number, patch: Partial<TemplateButton>) {
    set("buttons", (draft.buttons ?? []).map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  function submit() {
    setTouched(true);
    if (errors.length || usedNotAllowed.length) {
      bodyRef.current?.closest("[class*='overflow-y']")?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    void (async () => {
      setPending(true);
      const clean: TemplateDraft = {
        ...draft,
        header: draft.header?.trim() || undefined,
        footer: draft.footer?.trim() || undefined,
        buttons: draft.buttons?.length ? draft.buttons : undefined,
      };
      let r;
      try { r = await createWhatsAppTemplate(clean); } catch { r = { ok: false as const, error: "generic" }; }
      setPending(false);
      if (r.ok) { toast.success(t("editor.created")); onCreated(); return; }
      const key = `errors.${r.error}`;
      setServerError({ msg: t.has(key) ? t(key) : t("errors.generic"), detail: r.detail });
    })();
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" variant="top-aligned">
      <ModalHeader title={t("editor.title")} subtitle={t("editor.subtitle")} />
      <ModalBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ── Form ── */}
          <div className="space-y-4 lg:col-span-3">
            {serverError && <Alert variant="error" title={serverError.msg} description={serverError.detail} />}
            {touched && (errors.length > 0 || usedNotAllowed.length > 0) && (
              <Alert variant="error" title={t("editor.fixErrors")}>
                <ul className="list-disc ps-5 text-sm">
                  {errors.filter((e) => e !== "nameFormat").map((e) => <li key={e}>{t(`draftErrors.${e}`)}</li>)}
                  {usedNotAllowed.length > 0 && <li>{t("draftErrors.fieldNotForPurpose", { fields: usedNotAllowed.join(", ") })}</li>}
                </ul>
              </Alert>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label={t("editor.purpose")} helperText={t("editor.purposeHelp")} value={draft.purpose}
                options={PURPOSES.map((p) => ({ value: p, label: t(`purpose.${p}`) }))}
                onChange={(e) => {
                  const p = e.target.value as TemplatePurpose;
                  setDraft((d) => ({ ...d, purpose: p, name: d.name === DEFAULT_NAME[d.purpose] ? DEFAULT_NAME[p] : d.name }));
                }} />
              <TextField label={t("editor.name")} helperText={t("editor.nameHelp")} dir="ltr" value={draft.name}
                error={touched && errors.includes("nameFormat") ? t("draftErrors.nameFormat") : undefined}
                onChange={(e) => set("name", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} />
              <Select label={t("editor.language")} value={draft.language}
                options={(["ar", "en"] as const).map((l) => ({ value: l, label: t(`lang.${l}`) }))}
                onChange={(e) => set("language", e.target.value as TemplateLanguage)} />
              <Select label={t("editor.category")} helperText={t("editor.categoryHelp")} value={draft.category}
                options={(["UTILITY", "MARKETING"] as const).map((c) => ({ value: c, label: t(`category.${c}`) }))}
                onChange={(e) => set("category", e.target.value as TemplateCategory)} />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700">{t("editor.insertField")}</p>
              <div className="flex flex-wrap gap-1.5">
                {allowed.map((f) => (
                  <button key={f} type="button" onClick={() => insertField(f)}
                    className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100">
                    + {t(`fields.${f}`)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">{t("editor.insertFieldHelp")}</p>
            </div>

            <TextField ref={headerRef} label={<>{t("editor.header")} <span className="text-xs font-normal text-gray-500">({t("editor.optional")})</span></>} helperText={t("editor.headerHelp")} dir={rtl ? "rtl" : "ltr"}
              value={draft.header ?? ""} onFocus={() => setFocus("header")} maxLength={60}
              error={touched && (errors.includes("headerTooLong") || errors.includes("headerVars")) ? t(`draftErrors.${errors.includes("headerVars") ? "headerVars" : "headerTooLong"}`) : undefined}
              onChange={(e) => set("header", e.target.value)} />
            <TextArea ref={bodyRef} label={t("editor.body")} helperText={t("editor.bodyHelp")} required rows={6} dir={rtl ? "rtl" : "ltr"}
              value={draft.body} onFocus={() => setFocus("body")} maxLength={1024}
              onChange={(e) => set("body", e.target.value)} />
            <TextField label={<>{t("editor.footer")} <span className="text-xs font-normal text-gray-500">({t("editor.optional")})</span></>} helperText={t("editor.footerHelp")} dir={rtl ? "rtl" : "ltr"} maxLength={60}
              value={draft.footer ?? ""} onChange={(e) => set("footer", e.target.value)} />

            {/* Buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{t("editor.buttons")} <span className="text-xs font-normal text-gray-500">({t("editor.optional")})</span></p>
                {(draft.buttons?.length ?? 0) < 3 && (
                  <Button variant="ghost" size="sm" leftIcon={<PlusIcon className="h-4 w-4" />}
                    onClick={() => set("buttons", [...(draft.buttons ?? []), { type: "QUICK_REPLY", text: "" }])}>
                    {t("editor.addButton")}
                  </Button>
                )}
              </div>
              {(draft.buttons ?? []).map((b, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-[150px_1fr_1fr_auto] sm:items-end">
                  <Select size="sm" label={t("editor.buttonType")} value={b.type}
                    options={(["QUICK_REPLY", "URL", "PHONE_NUMBER"] as const).map((x) => ({ value: x, label: t(`editor.${x}`) }))}
                    onChange={(e) => setButton(i, { type: e.target.value as TemplateButton["type"] })} />
                  <TextField size="sm" label={t("editor.buttonText")} maxLength={25} value={b.text} onChange={(e) => setButton(i, { text: e.target.value })} />
                  {b.type === "URL" ? (
                    <TextField size="sm" label={t("editor.buttonUrl")} dir="ltr" placeholder="https://" value={b.url ?? ""} onChange={(e) => setButton(i, { url: e.target.value })} />
                  ) : b.type === "PHONE_NUMBER" ? (
                    <TextField size="sm" label={t("editor.buttonPhone")} dir="ltr" placeholder="+968…" value={b.phone ?? ""} onChange={(e) => setButton(i, { phone: e.target.value })} />
                  ) : <div />}
                  <Button variant="ghost" size="icon" aria-label={t("editor.remove")}
                    onClick={() => set("buttons", (draft.buttons ?? []).filter((_, j) => j !== i))}>
                    <XMarkIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

          </div>

          {/* ── Live preview ── */}
          <div className="lg:col-span-2 lg:sticky lg:top-0 lg:self-start">
            <p className="mb-2 text-sm font-medium text-gray-700">{t("editor.preview")}</p>
            <div className="rounded-2xl bg-[#e7ece9] p-4 min-h-[280px]">
              <div dir={rtl ? "rtl" : "ltr"} className="max-w-[92%] rounded-xl rounded-ss-sm bg-white p-3 shadow-sm">
                {draft.header?.trim() && <p className="mb-1 font-bold text-gray-900">{renderText(draft.header, samples)}</p>}
                <p className="whitespace-pre-line text-sm text-gray-800">{draft.body.trim() ? renderText(draft.body, samples) : <span className="text-gray-400">{t("editor.previewEmpty")}</span>}</p>
                {draft.footer?.trim() && <p className="mt-1.5 text-xs text-gray-500">{draft.footer}</p>}
                <p dir="ltr" className="mt-1 text-end text-[10px] text-gray-400">10:42</p>
              </div>
              {(draft.buttons ?? []).filter((b) => b.text.trim()).map((b, i) => (
                <div key={i} dir={rtl ? "rtl" : "ltr"} className="mt-1 max-w-[92%] rounded-xl bg-white px-3 py-2 text-center text-sm font-medium text-[#1c7cd5] shadow-sm">
                  {b.text}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">{t("editor.previewNote")}</p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>{t("editor.cancel")}</Button>
        <Button loading={pending} onClick={submit}>{t("editor.submit")}</Button>
      </ModalFooter>
    </Modal>
  );
}
