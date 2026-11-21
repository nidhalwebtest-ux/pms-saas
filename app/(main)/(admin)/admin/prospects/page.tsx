import { Prisma } from "@prisma/client";
import { getTranslations, getLocale } from "next-intl/server";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { prisma } from "@/lib/prisma";
import { getAreaClassifications } from "../_lib/areas";
import { pickAreaLabel } from "../_lib/area-label";
import ProspectFilters from "./ProspectFilters";
import ProspectsView from "./ProspectsView";

// One row carries everything the list, the edit modal, and the row actions need.
export type ProspectRow = {
  id: string;
  businessName: string;
  contactPersonName: string | null;
  roleOfContact: string;
  phone: string | null;
  areaId: string | null;
  areaLabel: string; // locale-resolved name, "—" if unset
  areaColor: string | null;
  addressNotes: string | null;
  source: string;
  estimatedUnits: number | null;
  listedOnBooking: boolean;
  websiteOrSocial: string | null;
  scoreSize: number;
  scoreKhareefActivity: number;
  scorePainSignals: number;
  scoreDigitalComfort: number;
  scoreReachability: number;
  scoreTotal: number;
  tier: number;
  stage: string;
  interestLevel: string;
  mainPainNamed: string | null;
  nextFollowupDate: string | null; // ISO
  lostReason: string | null;
  notes: string | null;
  buildingPhoto: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string; // ISO
};

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const params = await searchParams;
  const q = params.q || "";
  const tier = params.tier || "all";
  const stage = params.stage || "";
  const area = params.area || "";
  const interest = params.interest || "";

  const where: Prisma.ProspectWhereInput = {
    ...(q && {
      OR: [
        { businessName: { contains: q, mode: "insensitive" } },
        { contactPersonName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(["1", "2", "3"].includes(tier) && { tier: parseInt(tier, 10) }),
    ...(stage && { stage: stage as never }),
    ...(area && { areaId: area }),
    ...(interest && { interestLevel: interest as never }),
  };

  const [areas, raw, allCount, t1, t2, t3] = await Promise.all([
    getAreaClassifications(),
    prisma.prospect.findMany({
      where,
      orderBy: [{ scoreTotal: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.prospect.count(),
    prisma.prospect.count({ where: { tier: 1 } }),
    prisma.prospect.count({ where: { tier: 2 } }),
    prisma.prospect.count({ where: { tier: 3 } }),
  ]);

  const areaById = new Map(areas.map((a) => [a.id, a]));

  const prospects: ProspectRow[] = raw.map((p) => {
    const a = p.areaId ? areaById.get(p.areaId) : undefined;
    return {
    id: p.id,
    businessName: p.businessName,
    contactPersonName: p.contactPersonName,
    roleOfContact: p.roleOfContact,
    phone: p.phone,
    areaId: p.areaId,
    areaLabel: a ? pickAreaLabel(locale, a.name, a.nameAr) : "—",
    areaColor: a?.color ?? null,
    addressNotes: p.addressNotes,
    source: p.source,
    estimatedUnits: p.estimatedUnits,
    listedOnBooking: p.listedOnBooking,
    websiteOrSocial: p.websiteOrSocial,
    scoreSize: p.scoreSize,
    scoreKhareefActivity: p.scoreKhareefActivity,
    scorePainSignals: p.scorePainSignals,
    scoreDigitalComfort: p.scoreDigitalComfort,
    scoreReachability: p.scoreReachability,
    scoreTotal: p.scoreTotal,
    tier: p.tier,
    stage: p.stage,
    interestLevel: p.interestLevel,
    mainPainNamed: p.mainPainNamed,
    nextFollowupDate: p.nextFollowupDate ? p.nextFollowupDate.toISOString() : null,
    lostReason: p.lostReason,
    notes: p.notes,
    buildingPhoto: p.buildingPhoto,
    latitude: p.latitude,
    longitude: p.longitude,
    createdAt: p.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <UserGroupIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-fg">{t("prospects.title")}</h2>
          <p className="text-sm text-fg-tertiary">
            {t("prospects.subtitle", { count: allCount })}
          </p>
        </div>
      </div>

      <ProspectFilters
        currentSearch={q}
        currentTier={tier}
        currentStage={stage}
        currentArea={area}
        currentInterest={interest}
        counts={{ all: allCount, t1, t2, t3 }}
        areas={areas}
      />

      <ProspectsView prospects={prospects} hasAnyProspects={allCount > 0} areas={areas} />
    </div>
  );
}
