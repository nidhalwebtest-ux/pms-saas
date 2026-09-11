"use client";

import Link from "next/link";
import {
  UsersIcon,
  BuildingOffice2Icon,
  HomeModernIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  BuildingOfficeIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { Badge, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { useTabParam } from "@/hooks/useTabParam";
import { waLink } from "@/utils/whatsapp";
import { fmtDate } from "../_lib/format";

const DEMO_EXPIRY_DAYS = 14;

export interface OrgListItem {
  id: string;
  name: string;
  city: string;
  createdAt: string; // ISO
  isDemo: boolean;
  demoCreatedAt: string | null; // ISO
  demoContactName: string | null;
  demoContactWhatsapp: string | null;
  counts: {
    users: number;
    buildings: number;
    units: number;
    tenants: number;
    reservations: number;
    invoices: number;
    payments: number;
    expenses: number;
  };
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

type FilterKey = "all" | "real" | "demo";

export function OrganizationsListClient({ orgs }: { orgs: OrgListItem[] }) {
  const t = useTranslations("admin.organizations");
  const [filter, setFilter] = useTabParam("filter", "all");

  const filtered = orgs.filter((o) => {
    if (filter === "real") return !o.isDemo;
    if (filter === "demo") return o.isDemo;
    return true;
  });

  const counts = {
    all: orgs.length,
    real: orgs.filter((o) => !o.isDemo).length,
    demo: orgs.filter((o) => o.isDemo).length,
  };

  const metrics = (o: OrgListItem) => [
    { key: "users", value: o.counts.users, Icon: UsersIcon, accent: "bg-brand-50 text-brand-700" },
    { key: "buildings", value: o.counts.buildings, Icon: BuildingOffice2Icon, accent: "bg-info-50 text-info-700" },
    { key: "units", value: o.counts.units, Icon: HomeModernIcon, accent: "bg-warning-50 text-warning-700" },
    { key: "tenants", value: o.counts.tenants, Icon: UserGroupIcon, accent: "bg-success-50 text-success-700" },
    { key: "reservations", value: o.counts.reservations, Icon: CalendarDaysIcon, accent: "bg-brand-100 text-brand-700" },
    { key: "invoices", value: o.counts.invoices, Icon: DocumentTextIcon, accent: "bg-info-50 text-info-700" },
    { key: "payments", value: o.counts.payments, Icon: BanknotesIcon, accent: "bg-success-50 text-success-700" },
    { key: "expenses", value: o.counts.expenses, Icon: ReceiptPercentIcon, accent: "bg-warning-50 text-warning-700" },
  ];

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <TabsList variant="underline" size="md" ariaLabel={t("filterAriaLabel")}>
          <TabsTrigger value="all" count={counts.all}>{t("filterAll")}</TabsTrigger>
          <TabsTrigger value="real" count={counts.real}>{t("filterReal")}</TabsTrigger>
          <TabsTrigger value="demo" count={counts.demo}>{t("filterDemo")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-default bg-surface p-10 text-center">
          <BuildingOfficeIcon className="mx-auto h-10 w-10 text-fg-tertiary/40" />
          <p className="mt-2 text-sm text-fg-tertiary">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((o) => {
            const expired =
              o.isDemo && o.demoCreatedAt && daysSince(o.demoCreatedAt) > DEMO_EXPIRY_DAYS;
            const whatsappHref = o.isDemo ? waLink(o.demoContactWhatsapp) : null;

            return (
              <div
                key={o.id}
                className={`rounded-2xl border bg-surface p-4 transition-all hover:border-brand-300 sm:p-5 ${
                  o.isDemo ? "border-brand-200 bg-brand-50/30" : "border-border-default"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/organizations/${o.id}`}
                    className="group flex items-center gap-x-3 min-w-0 flex-1"
                  >
                    <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm transition-transform group-hover:scale-105">
                      <BuildingOfficeIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="truncate text-base font-bold text-fg group-hover:text-brand-600">
                          {o.name}
                        </h3>
                        {o.isDemo && <Badge tone="brand" size="sm">{t("demoBadge")}</Badge>}
                        {expired && <Badge tone="neutral" size="sm">{t("expiredBadge")}</Badge>}
                      </div>
                      <p className="text-xs text-fg-tertiary">
                        {o.city} · {t("since", { date: fmtDate(o.createdAt) })}
                        {o.isDemo && o.demoCreatedAt && (
                          <> · {t("daysAgo", { n: daysSince(o.demoCreatedAt) })}</>
                        )}
                      </p>
                    </div>
                  </Link>
                  <Link
                    href={`/admin/organizations/${o.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-canvas px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface hover:text-brand-600"
                  >
                    <span>{t("viewDetails")}</span>
                    <ChevronRightIcon className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </div>

                {o.isDemo && (o.demoContactName || o.demoContactWhatsapp) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-xs">
                    <span className="font-medium text-fg-secondary">{o.demoContactName ?? "—"}</span>
                    {o.demoContactWhatsapp &&
                      (whatsappHref ? (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 rounded-md bg-success-50 px-2 py-1 font-medium text-success-700 hover:bg-success-100 ltr-numbers"
                        >
                          {o.demoContactWhatsapp}
                        </a>
                      ) : (
                        <span className="text-fg-tertiary ltr-numbers">{o.demoContactWhatsapp}</span>
                      ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {metrics(o).map(({ key, value, Icon, accent }) => (
                    <div key={key} className="flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-2.5">
                      <span className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${accent}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-bold tabular-nums leading-none text-fg">{value}</p>
                        <p className="mt-0.5 truncate text-[11px] text-fg-tertiary">{t(`metrics.${key}`)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
