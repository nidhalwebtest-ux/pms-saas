import { notFound, redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  TagIcon,
  UserCircleIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import ExpenseActionPanel from "./ExpenseActionPanel";

const STATUS_STYLE: Record<string, { bg: string; text: string; ring: string; icon: typeof ClockIcon }> = {
  PENDING:   { bg: "bg-amber-50",    text: "text-amber-700",   ring: "ring-amber-200",   icon: ClockIcon },
  APPROVED:  { bg: "bg-blue-50",     text: "text-blue-700",    ring: "ring-blue-200",    icon: CheckCircleIcon },
  REJECTED:  { bg: "bg-red-50",      text: "text-red-700",     ring: "ring-red-200",     icon: XCircleIcon },
  PROCESSED: { bg: "bg-emerald-50",  text: "text-emerald-700", ring: "ring-emerald-200", icon: ClipboardDocumentCheckIcon },
};

function fullName(u: { firstName: string | null; lastName: string | null } | null) {
  if (!u) return "—";
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";
}

export default async function ExpenseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true, role: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      category: true,
      property: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy:  { select: { id: true, firstName: true, lastName: true } },
      processedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!expense || expense.organizationId !== dbUser.organizationId) {
    return notFound();
  }

  // STAFF can only see own
  if (dbUser.role === "STAFF" && expense.submittedById !== user.id) {
    return notFound();
  }

  const tDet = await getTranslations("expenses.detail");
  const tStatusFull = await getTranslations("expenses.statusFull");
  const tTimeline = await getTranslations("expenses.detail.timeline");
  const tPm = await getTranslations("expenses.detail.paymentMethods");
  const locale = await getLocale();
  const dfLoc = locale === "ar" ? arLocale : enLocale;

  const fmtDateTime = (d: Date | null) => {
    if (!d) return null;
    return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: dfLoc });
  };

  const cfg = STATUS_STYLE[expense.status] ?? STATUS_STYLE.PENDING;
  const StatusIcon = cfg.icon;

  const amount = Number(expense.amount);
  const isOwn = expense.submittedById === user.id;
  const canApprove = ["OWNER", "MANAGER"].includes(dbUser.role) && expense.status === "PENDING";
  const canProcess = ["OWNER", "ACCOUNTANT"].includes(dbUser.role) && expense.status === "APPROVED";
  const canEdit    = expense.status === "PENDING" && isOwn;
  const canDelete  = expense.status === "PENDING" && (isOwn || dbUser.role === "OWNER");

  const receipts = [expense.receiptImage, expense.receiptImage2].filter(Boolean) as string[];

  const tryT = (fn: (k: string) => string, key: string, fallback?: string) => {
    try { return fn(key); } catch { return fallback ?? key; }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/expenses" className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title={tDet("back")}>
          <ArrowLeftIcon className="h-5 w-5 text-gray-500 rtl:rotate-180" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 font-mono ltr-numbers">{expense.expenseNumber}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {tStatusFull(expense.status)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {tDet("submittedOn", { date: fmtDateTime(expense.submittedAt) ?? "—" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main column ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Amount card */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{tDet("amountLabel")}</p>
                <p className="mt-1 text-4xl font-bold text-red-600 tabular-nums ltr-numbers">
                  {amount.toFixed(3)}
                  <span className="text-sm text-gray-400 font-medium ms-1.5">OMR</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{expense.category.icon ?? "📋"}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{expense.category.name}</p>
                  {expense.category.nameAr && (
                    <p className="text-xs text-gray-500" dir="rtl">{expense.category.nameAr}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description + meta */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">{tDet("detailsHeading")}</h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{tDet("descriptionLabel")}</span>
                </div>
                <p className="text-sm text-gray-900 ps-6">{expense.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                <MetaItem icon={BuildingOffice2Icon} label={tDet("buildingLabel")} value={expense.property.name} />
                <MetaItem icon={TagIcon} label={tDet("categoryLabel")} value={`${expense.category.icon ?? ""} ${expense.category.name}`.trim()} />
                <MetaItem icon={UserCircleIcon} label={tDet("submittedByLabel")} value={fullName(expense.submittedBy)} />
                <MetaItem icon={CalendarDaysIcon} label={tDet("submittedAtLabel")} value={fmtDateTime(expense.submittedAt) ?? "—"} valueClass="ltr-numbers" />
              </div>

              {expense.notes && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{tDet("notesLabel")}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{expense.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Receipts */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">
                {receipts.length > 1 ? tDet("receiptHeadingPlural") : tDet("receiptHeading")}
              </h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {receipts.map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg overflow-hidden ring-1 ring-gray-200 hover:ring-blue-400 transition-all bg-gray-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${tDet("receiptHeading")} ${i + 1}`} className="w-full h-64 object-contain bg-gray-100" />
                </a>
              ))}
              {receipts.length === 0 && (
                <p className="col-span-full text-sm text-gray-400 text-center py-8">{tDet("noReceipt")}</p>
              )}
            </div>
          </div>

          {/* Rejection reason */}
          {expense.status === "REJECTED" && expense.rejectionReason && (
            <div className="bg-red-50 rounded-xl ring-1 ring-red-200 p-5">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    {tDet("rejectedLabel", { reason: expense.rejectionReason })}
                  </p>
                  {expense.notes && (
                    <p className="text-sm text-red-700 mt-1.5 whitespace-pre-wrap">{expense.notes}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Processing details */}
          {expense.status === "PROCESSED" && (
            <div className="bg-emerald-50 rounded-xl ring-1 ring-emerald-200 p-5">
              <div className="flex items-start gap-3">
                <ClipboardDocumentCheckIcon className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-900">
                    {tryT(tPm, expense.paymentMethod ?? "", expense.paymentMethod ?? "")}
                  </p>
                  {expense.bankReference && (
                    <p className="text-xs text-emerald-700 mt-1">
                      {tDet("referenceLabel", { ref: expense.bankReference })}
                    </p>
                  )}
                  {expense.processingNotes && (
                    <p className="text-sm text-emerald-700 mt-1.5 whitespace-pre-wrap">{expense.processingNotes}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Action panel */}
          {(canApprove || canProcess || canEdit || canDelete) && (
            <ExpenseActionPanel
              expense={{
                id: expense.id,
                expenseNumber: expense.expenseNumber,
                description: expense.description,
                amount,
              }}
              canApprove={canApprove}
              canProcess={canProcess}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}

          {/* Workflow timeline */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">{tDet("workflowHeading")}</h3>
            </div>
            <div className="px-5 py-4">
              <ol className="relative border-s-2 border-gray-200 ms-2 space-y-5">
                <TimelineItem
                  icon={DocumentTextIcon}
                  color="blue"
                  title={tTimeline("submitted")}
                  user={fullName(expense.submittedBy)}
                  at={fmtDateTime(expense.submittedAt)}
                  byUserLabel={tDet("byUser", { user: fullName(expense.submittedBy) })}
                  done
                />
                <TimelineItem
                  icon={expense.status === "REJECTED" ? XCircleIcon : CheckCircleIcon}
                  color={expense.status === "REJECTED" ? "red" : "blue"}
                  title={
                    expense.status === "REJECTED" ? tTimeline("rejected")
                    : expense.status === "PENDING" ? tTimeline("awaitingReview")
                    : tTimeline("approved")
                  }
                  user={expense.reviewedBy ? fullName(expense.reviewedBy) : undefined}
                  at={fmtDateTime(expense.reviewedAt)}
                  byUserLabel={expense.reviewedBy ? tDet("byUser", { user: fullName(expense.reviewedBy) }) : undefined}
                  done={expense.status !== "PENDING"}
                />
                {expense.status !== "REJECTED" && (
                  <TimelineItem
                    icon={BanknotesIcon}
                    color="emerald"
                    title={expense.status === "PROCESSED" ? tTimeline("processed") : tTimeline("awaitingProcessing")}
                    user={expense.processedBy ? fullName(expense.processedBy) : undefined}
                    at={fmtDateTime(expense.processedAt)}
                    byUserLabel={expense.processedBy ? tDet("byUser", { user: fullName(expense.processedBy) }) : undefined}
                    done={expense.status === "PROCESSED"}
                  />
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaItem({
  icon: Icon, label, value, valueClass = "",
}: { icon: typeof TagIcon; label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-sm text-gray-900 ps-6 ${valueClass}`}>{value}</p>
    </div>
  );
}

function TimelineItem({
  icon: Icon, color, title, user, at, done, byUserLabel,
}: {
  icon: typeof ClockIcon;
  color: "blue" | "emerald" | "red";
  title: string;
  user?: string;
  at: string | null;
  done: boolean;
  byUserLabel?: string;
}) {
  const dotColors = {
    blue:    done ? "bg-blue-500 ring-blue-100"      : "bg-gray-200 ring-gray-100",
    emerald: done ? "bg-emerald-500 ring-emerald-100": "bg-gray-200 ring-gray-100",
    red:     done ? "bg-red-500 ring-red-100"        : "bg-gray-200 ring-gray-100",
  };
  return (
    <li className="ms-4">
      <span className={`absolute -start-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ${dotColors[color]}`}>
        <Icon className="h-2.5 w-2.5 text-white" />
      </span>
      <p className={`text-sm font-semibold ${done ? "text-gray-900" : "text-gray-400"}`}>{title}</p>
      {at && <p className="text-xs text-gray-500 mt-0.5 ltr-numbers">{at}</p>}
      {user && byUserLabel && <p className="text-xs text-gray-600 mt-0.5">{byUserLabel}</p>}
    </li>
  );
}
