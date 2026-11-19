"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCardIcon } from "@heroicons/react/24/outline";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/form/TextField";
import { NumberField } from "@/components/ui/form/NumberField";
import { Select } from "@/components/ui/form/Select";
import { Toggle } from "@/components/ui/form/Toggle";
import {
  changeOrgPlan,
  extendOrgTrial,
  endOrgTrial,
  recordOrgPayment,
  setOrgPaidUntil,
  addOrgSubscriptionNote,
  type AdminResult,
} from "../../subscriptions/actions";

export type SubscriptionPanelData = {
  orgId: string;
  status: "TRIALING" | "ACTIVE" | "EXPIRED" | "DEMO";
  planId: string | null;
  planName: string;
  effectivePlanName: string;
  trialEndsAt: string | null;
  paidUntil: string | null;
  billingCycle: string;
  daysLeft: number | null;
  usage: { buildings: number; units: number; users: number };
  limits: { buildings: number | null; units: number | null; users: number | null };
  plans: { id: string; name: string; isActive: boolean; monthly: string; semiannual: string; yearly: string }[];
  events: {
    id: string; type: string; fromPlanKey: string | null; toPlanKey: string | null; amount: string | null;
    billingCycle: string | null; trialEndsAt: string | null; paidUntil: string | null; note: string | null; actor: string; createdAt: string;
  }[];
};

const STATUS_TONE: Record<SubscriptionPanelData["status"], BadgeTone> = { TRIALING: "info", ACTIVE: "success", EXPIRED: "danger", DEMO: "neutral" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Muscat" }) : "—");
const ACTIONS = ["plan", "trial", "payment", "paidUntil", "note"] as const;
type Action = (typeof ACTIONS)[number];
const ACTION_LABEL: Record<Action, string> = { plan: "Change plan", trial: "Trial", payment: "Record payment", paidUntil: "Set paid-until", note: "Add note" };

export default function SubscriptionPanel({ data }: { data: SubscriptionPanelData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [action, setAction] = useState<Action>("plan");
  const [planId, setPlanId] = useState(data.planId ?? data.plans[0]?.id ?? "");
  const [keepTrial, setKeepTrial] = useState(true);
  const [days, setDays] = useState(14);
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState(1);
  const [cycle, setCycle] = useState(data.billingCycle || "MONTHLY");
  const [date, setDate] = useState(data.paidUntil ? data.paidUntil.slice(0, 10) : "");
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<AdminResult>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(ok);
      setNote("");
      router.refresh();
    });

  // suggest the amount for the chosen plan/cycle/months (integer baisa math on the server; this is just a hint)
  const selectedPlan = data.plans.find((p) => p.id === data.planId);
  const perMonth = selectedPlan ? (cycle === "YEARLY" ? selectedPlan.yearly : cycle === "SEMIANNUAL" ? selectedPlan.semiannual : selectedPlan.monthly) : null;

  const usageRow = (label: string, used: number, limit: number | null) => {
    const over = limit !== null && used > limit;
    const full = limit !== null && used >= limit;
    return (
      <div className="rounded-xl bg-canvas p-3">
        <p className="text-xs text-fg-tertiary">{label}</p>
        <p className={`mt-0.5 font-semibold tabular-nums ${over ? "text-error-600" : full ? "text-warning-700" : "text-fg"}`}>
          {used} / {limit === null ? "∞" : limit}
        </p>
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-border-default bg-surface p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-base font-bold text-fg flex items-center gap-2">
          <CreditCardIcon className="h-5 w-5 text-brand-600" /> Subscription
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[data.status]} appearance="subtle" size="sm" dot>{data.status}</Badge>
          <Badge tone="brand" appearance="subtle" size="sm">{data.planName}</Badge>
          {data.status === "EXPIRED" && <Badge tone="neutral" appearance="subtle" size="sm">Limits: {data.effectivePlanName}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl bg-canvas p-3">
          <p className="text-xs text-fg-tertiary">Trial ends</p>
          <p className="mt-0.5 font-semibold text-fg">{fmt(data.trialEndsAt)}</p>
        </div>
        <div className="rounded-xl bg-canvas p-3">
          <p className="text-xs text-fg-tertiary">Paid until</p>
          <p className="mt-0.5 font-semibold text-fg">{fmt(data.paidUntil)}</p>
        </div>
        <div className="rounded-xl bg-canvas p-3">
          <p className="text-xs text-fg-tertiary">Days left · cycle</p>
          <p className="mt-0.5 font-semibold text-fg">{data.daysLeft ?? "—"} · {data.billingCycle.toLowerCase()}</p>
        </div>
        {usageRow("Buildings", data.usage.buildings, data.limits.buildings)}
        {usageRow("Units", data.usage.units, data.limits.units)}
        {usageRow("Users (+ invites)", data.usage.users, data.limits.users)}
      </div>

      {data.status !== "DEMO" && (
        <div className="rounded-xl border border-border-default p-4">
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={action === a}
                onClick={() => setAction(a)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  action === a ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border-default text-fg-secondary hover:text-fg"
                }`}
              >
                {ACTION_LABEL[a]}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {action === "plan" && (
              <>
                <Select
                  label="Plan"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  options={data.plans.map((p) => ({ value: p.id, label: `${p.name} — ${p.monthly} / mo${p.isActive ? "" : " (inactive)"}`, disabled: !p.isActive && p.id !== data.planId }))}
                />
                <Toggle label="Keep the current trial running" description="Off = the trial ends now" checked={keepTrial} onCheckedChange={setKeepTrial} />
              </>
            )}
            {action === "trial" && (
              <NumberField label="Extend trial by (days)" value={days} min={1} max={365} step={1} stepper onValueChange={(n) => setDays(n ?? 1)} helperText="Counted from the current trial end (or today if it already ended)" />
            )}
            {action === "payment" && (
              <>
                <TextField label="Amount received (OMR)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr"
                  helperText={perMonth ? `Plan price: ${perMonth} OMR / month on this cycle` : "Assign a plan first"} />
                <NumberField label="Months covered" value={months} min={1} max={36} step={1} stepper onValueChange={(n) => setMonths(n ?? 1)} />
                <Select label="Billing cycle" value={cycle} onChange={(e) => setCycle(e.target.value)}
                  options={[{ value: "MONTHLY", label: "Monthly" }, { value: "SEMIANNUAL", label: "6-month" }, { value: "YEARLY", label: "Yearly" }]} />
              </>
            )}
            {action === "paidUntil" && (
              <TextField label="Paid until (date)" type="date" value={date} onChange={(e) => setDate(e.target.value)} helperText="Empty = clear. Covers the whole day (Oman time)." />
            )}
            <TextField label={action === "note" ? "Note" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} className="sm:col-span-2" />
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {action === "trial" && data.status === "TRIALING" && (
              <Button variant="secondary" loading={pending} onClick={() => run(() => endOrgTrial(data.orgId, note), "Trial ended")}>End trial now</Button>
            )}
            <Button
              variant="primary"
              loading={pending}
              onClick={() => {
                if (action === "plan") run(() => changeOrgPlan(data.orgId, planId, keepTrial, note), "Plan changed");
                if (action === "trial") run(() => extendOrgTrial(data.orgId, days, note), "Trial extended");
                if (action === "payment") run(() => recordOrgPayment(data.orgId, { amount, months, cycle, note }), "Payment recorded");
                if (action === "paidUntil") run(() => setOrgPaidUntil(data.orgId, date, note), "Paid-until updated");
                if (action === "note") run(() => addOrgSubscriptionNote(data.orgId, note), "Note added");
              }}
            >
              {ACTION_LABEL[action]}
            </Button>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-fg">History</h4>
        {data.events.length === 0 ? (
          <p className="mt-2 text-xs text-fg-tertiary">No subscription events yet.</p>
        ) : (
          <ol className="mt-2 divide-y divide-border-default rounded-xl border border-border-default">
            {data.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-fg">{e.type.replace(/_/g, " ").toLowerCase()}</span>
                  {e.toPlanKey && <span className="text-fg-secondary"> · {e.fromPlanKey ? `${e.fromPlanKey} → ` : ""}{e.toPlanKey}</span>}
                  {e.amount && <span className="text-fg-secondary"> · {e.amount} OMR{e.billingCycle ? ` (${e.billingCycle.toLowerCase()})` : ""}</span>}
                  {e.trialEndsAt && <span className="text-fg-secondary"> · trial to {fmt(e.trialEndsAt)}</span>}
                  {e.paidUntil && <span className="text-fg-secondary"> · paid to {fmt(e.paidUntil)}</span>}
                  {e.note && <p className="mt-0.5 text-fg-tertiary">{e.note}</p>}
                </div>
                <span className="text-fg-tertiary whitespace-nowrap">{fmt(e.createdAt)} · {e.actor}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
