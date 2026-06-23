import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getAreaClassifications } from "../../_lib/areas";
import { pickAreaLabel } from "../../_lib/area-label";
import type { ProspectRow } from "../page";
import ProspectDetail from "./ProspectDetail";

export type VisitDTO = {
  id: string;
  visitDate: string;
  whoMet: string;
  outcomeNotes: string | null;
  objectionRaised: string | null;
  nextAction: string | null;
};

export type FollowupDTO = {
  id: string;
  dueDate: string;
  channel: string;
  purpose: string | null;
  completed: boolean;
  completedDate: string | null;
};

export type ProspectDetailData = ProspectRow & {
  visits: VisitDTO[];
  followups: FollowupDTO[];
};

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();

  const [p, areas] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id },
      include: {
        visits: { orderBy: { visitDate: "desc" } },
        followups: { orderBy: { dueDate: "asc" } },
      },
    }),
    getAreaClassifications(),
  ]);
  if (!p) notFound();

  const area = p.areaId ? areas.find((a) => a.id === p.areaId) : undefined;

  const data: ProspectDetailData = {
    id: p.id,
    businessName: p.businessName,
    contactPersonName: p.contactPersonName,
    roleOfContact: p.roleOfContact,
    phone: p.phone,
    areaId: p.areaId,
    areaLabel: area ? pickAreaLabel(locale, area.name, area.nameAr) : "—",
    areaColor: area?.color ?? null,
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
    visits: p.visits.map((v) => ({
      id: v.id,
      visitDate: v.visitDate.toISOString(),
      whoMet: v.whoMet,
      outcomeNotes: v.outcomeNotes,
      objectionRaised: v.objectionRaised,
      nextAction: v.nextAction,
    })),
    followups: p.followups.map((f) => ({
      id: f.id,
      dueDate: f.dueDate.toISOString(),
      channel: f.channel,
      purpose: f.purpose,
      completed: f.completed,
      completedDate: f.completedDate ? f.completedDate.toISOString() : null,
    })),
  };

  return <ProspectDetail prospect={data} areas={areas} />;
}
