"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowPathIcon, LinkIcon, PaperAirplaneIcon, PlusIcon, SparklesIcon, TrashIcon, QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import {
  Alert, Badge, Button, Select, TextField, Modal, ModalHeader, ModalBody, ModalFooter, useConfirmDialog,
  type BadgeTone,
} from "@/components/ui";
import type { AccountView, TemplateView } from "@/lib/whatsapp/service";
import { namedFromPositional, type TemplateLanguage, type TemplatePurpose } from "@/lib/whatsapp/template-model";
import {
  connectWhatsApp, refreshWhatsApp, disconnectWhatsApp, syncWhatsAppTemplates, addStarterTemplates,
  deleteWhatsAppTemplate, setWhatsAppTemplatePurpose, sendWhatsAppTest, type ActionResult,
} from "./actions";
import TemplateEditor from "./TemplateEditor";

const PURPOSES: TemplatePurpose[] = ["RESERVATION_CONFIRMATION", "ARRIVAL_REMINDER", "INVOICE", "RECEIPT", "CUSTOM"];

const STATUS_TONE: Record<string, BadgeTone> = {
  APPROVED: "success", PENDING: "warning", IN_APPEAL: "warning", REJECTED: "danger", PAUSED: "danger", DISABLED: "neutral",
};
const QUALITY_TONE: Record<string, BadgeTone> = { GREEN: "success", YELLOW: "warning", RED: "danger" };

interface Props {
  account: AccountView;
  templates: TemplateView[];
  canEdit: boolean;
  serverReady: boolean;
  webhookUrl: string;
}

export default function WhatsAppSettings({ account, templates, canEdit, serverReady, webhookUrl }: Props) {
  const t = useTranslations("settings.whatsapp");
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [busy, setBusy] = useState<string | null>(null);
  const pending = busy !== null;
  const [form, setForm] = useState({ wabaId: "", phoneNumberId: "", accessToken: "" });
  const [formError, setFormError] = useState<{ msg: string; detail?: string } | null>(null);
  const [showHelp, setShowHelp] = useState(!account.connected);
  const [editorOpen, setEditorOpen] = useState(false);
  const [startersOpen, setStartersOpen] = useState(false);
  const [starterLangs, setStarterLangs] = useState<TemplateLanguage[]>(["ar", "en"]);
  const [testFor, setTestFor] = useState<TemplateView | null>(null);
  const [testPhone, setTestPhone] = useState("");

  const errText = (r: { error: string; detail?: string }) => {
    const key = `errors.${r.error}`;
    return t.has(key) ? t(key) : t("errors.generic");
  };

  async function run<T>(id: string, fn: () => Promise<ActionResult<T>>, onOk?: (r: ActionResult<T> & { ok: true }) => void) {
    setBusy(id);
    let r: ActionResult<T>;
    try { r = await fn(); } catch { r = { ok: false, error: "generic" }; }
    setBusy(null);
    if (r.ok) { onOk?.(r); router.refresh(); }
    else toast.error(errText(r), { description: r.detail });
  }

  async function handleConnect() {
    setFormError(null);
    setBusy("connect");
    let r: ActionResult;
    try { r = await connectWhatsApp(form); } catch { r = { ok: false, error: "generic" }; }
    setBusy(null);
    if (r.ok) {
      toast.success(t("account.connectedToast"));
      setForm({ wabaId: "", phoneNumberId: "", accessToken: "" });
      router.refresh();
    } else {
      setFormError({ msg: errText(r), detail: r.detail });
    }
  }

  async function handleDisconnect() {
    const { confirmed } = await confirm({
      title: t("account.disconnectTitle"),
      description: t("account.disconnectDesc"),
      tone: "destructive",
      confirmLabel: t("account.disconnectConfirm"),
    });
    if (confirmed) run("disconnect", disconnectWhatsApp, () => toast.success(t("account.disconnected")));
  }

  async function handleDelete(tpl: TemplateView) {
    const { confirmed } = await confirm({
      title: t("templates.deleteTitle"),
      description: t("templates.deleteDesc", { name: `${tpl.name} (${tpl.language})` }),
      tone: "destructive",
      confirmLabel: t("templates.deleteConfirm"),
    });
    if (confirmed) run(`del-${tpl.id}`, () => deleteWhatsAppTemplate(tpl.id), () => toast.success(t("templates.deleted")));
  }

  const bodyText = (tpl: TemplateView) => {
    const body = (tpl.components as { type?: string; text?: string }[]).find((c) => c.type === "BODY")?.text ?? "";
    return tpl.variableMap ? namedFromPositional(body, tpl.variableMap.body) : body;
  };
  const fieldLabel = (txt: string) =>
    txt.replace(/\{\{([a-z_]+)\}\}/g, (_m, k: string) => (t.has(`fields.${k}`) ? `«${t(`fields.${k}`)}»` : `{{${k}}}`));

  if (!serverReady) {
    return <Alert variant="warning" title={t("serverNotReady.title")} description={t("serverNotReady.desc")} />;
  }

  return (
    <div className="space-y-6">
      {/* ── Connection ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t("account.title")}</h2>
            <p className="text-sm text-gray-500">{account.connected ? t("account.connectedDesc") : t("connect.desc")}</p>
          </div>
          {account.connected && (
            <Badge tone={account.status === "CONNECTED" ? "success" : "danger"} appearance="subtle" dot>
              {account.status === "CONNECTED" ? t("account.connected") : t("account.error")}
            </Badge>
          )}
        </div>

        {account.connected ? (
          <>
            {account.status !== "CONNECTED" && account.lastError && (
              <Alert variant="error" title={t("account.errorTitle")} description={account.lastError} />
            )}
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label={t("account.number")} value={<span dir="ltr">{account.displayPhone}</span>} />
              <Info label={t("account.name")} value={account.verifiedName || "—"} />
              <Info
                label={t("account.quality")}
                value={
                  <Badge tone={QUALITY_TONE[account.qualityRating ?? ""] ?? "neutral"} appearance="subtle" size="sm" dot>
                    {t(`account.quality${["GREEN", "YELLOW", "RED"].includes(account.qualityRating ?? "") ? account.qualityRating : "UNKNOWN"}`)}
                  </Badge>
                }
              />
              <Info
                label={t("account.webhook")}
                value={
                  <Badge tone={account.webhookSubscribed ? "success" : "warning"} appearance="subtle" size="sm" dot>
                    {account.webhookSubscribed ? t("account.webhookOn") : t("account.webhookOff")}
                  </Badge>
                }
              />
              <Info label={t("account.wabaId")} value={<span dir="ltr" className="font-mono text-xs">{account.wabaId}</span>} />
              <Info label={t("account.phoneId")} value={<span dir="ltr" className="font-mono text-xs">{account.phoneNumberId}</span>} />
              <Info label={t("account.token")} value={<span dir="ltr" className="font-mono text-xs">••••{account.tokenLast4}</span>} />
            </dl>
            {canEdit && (
              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <Button variant="secondary" size="sm" leftIcon={<ArrowPathIcon className="h-4 w-4" />} loading={busy === "refresh"} disabled={pending}
                  onClick={() => run("refresh", refreshWhatsApp, () => toast.success(t("account.refreshed")))}>
                  {t("account.refresh")}
                </Button>
                <Button variant="ghost" size="sm" loading={busy === "disconnect"} disabled={pending} onClick={handleDisconnect}
                  className="text-error-600">
                  {t("account.disconnect")}
                </Button>
              </div>
            )}
          </>
        ) : canEdit ? (
          <div className="space-y-4">
            {formError && <Alert variant="error" title={formError.msg} description={formError.detail} />}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label={t("connect.wabaId")} helperText={t("connect.wabaIdHelp")} required dir="ltr" inputMode="numeric"
                value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value })} />
              <TextField label={t("connect.phoneId")} helperText={t("connect.phoneIdHelp")} required dir="ltr" inputMode="numeric"
                value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} />
            </div>
            <TextField label={t("connect.token")} helperText={t("connect.tokenHelp")} required dir="ltr" type="password" autoComplete="off"
              value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setShowHelp((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
                <QuestionMarkCircleIcon className="h-4 w-4" /> {t("connect.helpTitle")}
              </button>
              <Button leftIcon={<LinkIcon className="h-4 w-4" />} loading={busy === "connect"}
                disabled={pending || !form.wabaId || !form.phoneNumberId || !form.accessToken} onClick={handleConnect}>
                {t("connect.submit")}
              </Button>
            </div>
            {showHelp && (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
                <ol className="list-decimal space-y-1.5 ps-5">
                  {[1, 2, 3, 4, 5].map((i) => <li key={i}>{t(`connect.step${i}`)}</li>)}
                </ol>
                <div className="pt-2 border-t border-gray-200">
                  <p className="font-medium text-gray-800">{t("connect.webhookTitle")}</p>
                  <p className="text-gray-600">{t("connect.webhookDesc")}</p>
                  <code dir="ltr" className="mt-1 block rounded bg-white px-2 py-1 font-mono text-xs text-gray-800 ring-1 ring-gray-200">{webhookUrl}</code>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t("account.notConnectedReadOnly")}</p>
        )}
      </section>

      {/* ── Templates ──────────────────────────────────────────────────── */}
      {account.connected && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{t("templates.title")}</h2>
              <p className="text-sm text-gray-500">{t("templates.desc")}</p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" leftIcon={<ArrowPathIcon className="h-4 w-4" />} loading={busy === "sync"} disabled={pending}
                  onClick={() => run("sync", syncWhatsAppTemplates, (r) => toast.success(t("templates.synced", { count: r.data?.count ?? 0 })))}>
                  {t("templates.sync")}
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<SparklesIcon className="h-4 w-4" />} disabled={pending} onClick={() => setStartersOpen(true)}>
                  {t("templates.starters")}
                </Button>
                <Button size="sm" leftIcon={<PlusIcon className="h-4 w-4" />} disabled={pending} onClick={() => setEditorOpen(true)}>
                  {t("templates.create")}
                </Button>
              </div>
            )}
          </div>

          {templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">{t("templates.empty")}</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {templates.map((tpl) => (
                <li key={tpl.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span dir="ltr" className="font-mono text-sm font-semibold text-gray-900">{tpl.name}</span>
                      <Badge tone="neutral" appearance="outline" size="sm">{t.has(`lang.${tpl.language}`) ? t(`lang.${tpl.language}`) : tpl.language}</Badge>
                      <Badge tone="info" appearance="subtle" size="sm">{t.has(`category.${tpl.category}`) ? t(`category.${tpl.category}`) : tpl.category}</Badge>
                      <Badge tone={STATUS_TONE[tpl.status] ?? "neutral"} appearance="subtle" size="sm" dot>
                        {t.has(`status.${tpl.status}`) ? t(`status.${tpl.status}`) : tpl.status}
                      </Badge>
                      {!tpl.variableMap && bodyText(tpl).includes("{{") && (
                        <Badge tone="warning" appearance="outline" size="sm">{t("templates.notMapped")}</Badge>
                      )}
                    </div>
                    <p dir={tpl.language.startsWith("ar") ? "rtl" : "ltr"} className="whitespace-pre-line text-sm text-gray-600 line-clamp-3">{fieldLabel(bodyText(tpl))}</p>
                    {tpl.status === "REJECTED" && tpl.rejectedReason && (
                      <p className="text-xs text-error-600">{t("templates.reason")}: {tpl.rejectedReason}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <div className="w-52">
                      <Select size="sm" label={t("templates.purpose")} value={tpl.purpose} disabled={!canEdit || pending}
                        options={PURPOSES.map((p) => ({ value: p, label: t(`purpose.${p}`) }))}
                        onChange={(e) => run(`p-${tpl.id}`, () => setWhatsAppTemplatePurpose(tpl.id, e.target.value as TemplatePurpose), () => toast.success(t("templates.purposeSaved")))} />
                    </div>
                    {canEdit && (
                      <>
                        <Button variant="secondary" size="sm" leftIcon={<PaperAirplaneIcon className="h-4 w-4" />} disabled={pending || tpl.status !== "APPROVED"}
                          onClick={() => { setTestFor(tpl); setTestPhone(""); }}>
                          {t("templates.test")}
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t("templates.delete")} loading={busy === `del-${tpl.id}`} disabled={pending} onClick={() => handleDelete(tpl)}>
                          <TrashIcon className="h-4 w-4 text-error-600" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {editorOpen && (
        <TemplateEditor open={editorOpen} onClose={() => setEditorOpen(false)} onCreated={() => { setEditorOpen(false); router.refresh(); }} />
      )}

      <Modal open={startersOpen} onClose={() => setStartersOpen(false)} size="md">
        <ModalHeader title={t("templates.startersTitle")} subtitle={t("templates.startersDesc")} />
        <ModalBody>
          <div className="space-y-3">
            <ul className="list-disc space-y-1 ps-5 text-sm text-gray-700">
              {(["RESERVATION_CONFIRMATION", "ARRIVAL_REMINDER", "INVOICE", "RECEIPT"] as const).map((p) => <li key={p}>{t(`purpose.${p}`)}</li>)}
            </ul>
            <div className="flex gap-4">
              {(["ar", "en"] as const).map((l) => (
                <label key={l} className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" className="h-4 w-4 rounded text-brand-600" checked={starterLangs.includes(l)}
                    onChange={(e) => setStarterLangs(e.target.checked ? [...starterLangs, l] : starterLangs.filter((x) => x !== l))} />
                  {t(`lang.${l}`)}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">{t("templates.startersNote")}</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setStartersOpen(false)}>{t("editor.cancel")}</Button>
          <Button loading={busy === "starters"} disabled={pending || starterLangs.length === 0}
            onClick={() => run("starters", () => addStarterTemplates(starterLangs), (r) => {
              setStartersOpen(false);
              const d = r.data;
              toast.success(t("templates.startersDone", { created: d?.created ?? 0, skipped: d?.skipped ?? 0 }));
              if (d?.failed.length) toast.error(t("errors.createFailed"), { description: d.failed.join("\n") });
            })}>
            {t("templates.startersAdd")}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={!!testFor} onClose={() => setTestFor(null)} size="sm">
        <ModalHeader title={t("test.title")} subtitle={testFor ? `${testFor.name} (${testFor.language})` : undefined} />
        <ModalBody>
          <div className="space-y-2">
            <TextField label={t("test.phone")} helperText={t("test.phoneHelp")} dir="ltr" inputMode="tel" value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)} />
            <p className="text-xs text-gray-500">{t("test.desc")}</p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setTestFor(null)}>{t("editor.cancel")}</Button>
          <Button leftIcon={<PaperAirplaneIcon className="h-4 w-4" />} loading={busy === "test"} disabled={pending || testPhone.replace(/\D/g, "").length < 8}
            onClick={() => testFor && run("test", () => sendWhatsAppTest(testFor.id, testPhone), () => { setTestFor(null); toast.success(t("test.sent")); })}>
            {t("test.send")}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value}</dd>
    </div>
  );
}
