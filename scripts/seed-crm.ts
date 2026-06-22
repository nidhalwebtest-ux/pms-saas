/**
 * Seed sample CRM prospects for the internal founder sales tool.
 *
 * Run with the direct (non-pooled) connection:
 *   PRISMA_USE_DIRECT_URL=1 npx tsx --env-file=.env scripts/seed-crm.ts
 *
 * Idempotent: it removes only the prospects it owns (by businessName) and
 * recreates them, so it never touches real prospects you've added by hand.
 * Placeholder Salalah businesses — not real companies.
 */

import { prisma } from "../lib/prisma";
import { computeScoring } from "../utils/crm-scoring";

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

type Seed = {
  businessName: string;
  contactPersonName: string;
  roleOfContact: "OWNER" | "MANAGER" | "RECEPTIONIST" | "UNKNOWN";
  phone: string;
  area: "AL_HAFFA" | "AL_DAHARIZ" | "CITY_CENTER" | "OTHER";
  source: "GOOGLE_MAPS" | "BOOKING_COM" | "AIRBNB" | "INSTAGRAM" | "REFERRAL" | "OTHER";
  estimatedUnits: number;
  listedOnBooking: boolean;
  websiteOrSocial?: string;
  scores: [number, number, number, number, number]; // size, khareef, pain, digital, reach
  stage: "NOT_CONTACTED" | "VISITED" | "DEMO_DONE" | "INTERESTED" | "SIGNED" | "ACTIVE" | "LOST";
  interestLevel: "HOT" | "WARM" | "COLD" | "UNKNOWN";
  mainPainNamed?: string;
  nextFollowupOffset?: number | null; // days from now
  notes?: string;
  visits?: {
    offset: number; // days ago (negative)
    whoMet: "OWNER" | "MANAGER" | "RECEPTIONIST" | "NOBODY";
    outcomeNotes?: string;
    objectionRaised?: string;
    nextAction?: string;
  }[];
  followups?: { offset: number; channel: "WHATSAPP" | "CALL" | "VISIT" | "OTHER"; purpose: string; completed?: boolean }[];
};

const SEEDS: Seed[] = [
  {
    businessName: "Salalah Bay Apartments",
    contactPersonName: "Salim Al-Maashani",
    roleOfContact: "OWNER",
    phone: "96891234567",
    area: "AL_DAHARIZ",
    source: "BOOKING_COM",
    estimatedUnits: 26,
    listedOnBooking: true,
    websiteOrSocial: "instagram.com/salalahbay",
    scores: [5, 5, 5, 3, 5], // 23 → Tier 1
    stage: "INTERESTED",
    interestLevel: "HOT",
    mainPainNamed: "Double-bookings during Khareef and no clear daily cash picture",
    nextFollowupOffset: 0,
    notes: "Very keen — wants to be a founding member if onboarding is quick.",
    visits: [
      {
        offset: -3,
        whoMet: "OWNER",
        outcomeNotes: "Walked through the double-booking problem. Loved the availability calendar.",
        objectionRaised: "Worried staff won't adopt a new system",
        nextAction: "Send a short demo video, schedule live demo",
      },
    ],
    followups: [
      { offset: 0, channel: "WHATSAPP", purpose: "Send demo video + confirm live demo time" },
      { offset: 3, channel: "CALL", purpose: "Follow up after demo" },
      { offset: -2, channel: "WHATSAPP", purpose: "Thank-you + recap", completed: true },
    ],
  },
  {
    businessName: "Al Haffa Beach Residences",
    contactPersonName: "Mona Al-Rawas",
    roleOfContact: "OWNER",
    phone: "96899887766",
    area: "AL_HAFFA",
    source: "AIRBNB",
    estimatedUnits: 18,
    listedOnBooking: true,
    websiteOrSocial: "airbnb.com/alhaffabeach",
    scores: [3, 5, 5, 5, 5], // 23 → Tier 1
    stage: "DEMO_DONE",
    interestLevel: "HOT",
    mainPainNamed: "Manual spreadsheets break every Khareef when volume spikes",
    nextFollowupOffset: 1,
    visits: [
      {
        offset: -6,
        whoMet: "OWNER",
        outcomeNotes: "Gave full demo. Asked great questions about monthly invoicing.",
        objectionRaised: "Price — wants to know founding-member discount",
        nextAction: "Send pricing + founding-member offer",
      },
    ],
    followups: [
      { offset: 1, channel: "WHATSAPP", purpose: "Send founding-member pricing" },
      { offset: -1, channel: "CALL", purpose: "Check decision timeline" },
    ],
  },
  {
    businessName: "Dhofar Stay Homes",
    contactPersonName: "Khalid (front desk)",
    roleOfContact: "RECEPTIONIST",
    phone: "96892223344",
    area: "CITY_CENTER",
    source: "GOOGLE_MAPS",
    estimatedUnits: 11,
    listedOnBooking: false,
    scores: [3, 3, 3, 3, 1], // 13 → Tier 2
    stage: "VISITED",
    interestLevel: "WARM",
    mainPainNamed: "Owner hard to reach; receptionist juggles a paper diary",
    nextFollowupOffset: 2,
    visits: [
      {
        offset: -2,
        whoMet: "RECEPTIONIST",
        outcomeNotes: "Owner was out. Left brochure with receptionist.",
        objectionRaised: "Need to speak to the owner first",
        nextAction: "Get owner's direct number, revisit",
      },
    ],
    followups: [{ offset: 2, channel: "VISIT", purpose: "Revisit to catch the owner" }],
  },
  {
    businessName: "Mountain View Guesthouse",
    contactPersonName: "Aisha Al-Shanfari",
    roleOfContact: "MANAGER",
    phone: "96895556677",
    area: "OTHER",
    source: "INSTAGRAM",
    estimatedUnits: 6,
    listedOnBooking: false,
    scores: [1, 1, 3, 1, 3], // 9 → Tier 3
    stage: "NOT_CONTACTED",
    interestLevel: "COLD",
    nextFollowupOffset: 7,
    notes: "Small operation — revisit later in season.",
  },
  {
    businessName: "Qaboos Heights Suites",
    contactPersonName: "Hassan Al-Ghassani",
    roleOfContact: "OWNER",
    phone: "96893334455",
    area: "CITY_CENTER",
    source: "REFERRAL",
    estimatedUnits: 22,
    listedOnBooking: true,
    scores: [5, 3, 5, 5, 5], // 23 → Tier 1
    stage: "SIGNED",
    interestLevel: "HOT",
    mainPainNamed: "Wanted proper monthly invoicing + receipts for long-stay tenants",
    nextFollowupOffset: 5,
    notes: "Founding member #1. Onboarding scheduled.",
    visits: [
      {
        offset: -10,
        whoMet: "OWNER",
        outcomeNotes: "Signed as founding member after the demo. Referred by Salim.",
        nextAction: "Kick off onboarding, import units",
      },
    ],
    followups: [{ offset: 5, channel: "CALL", purpose: "Onboarding check-in" }],
  },
];

async function main() {
  const names = SEEDS.map((s) => s.businessName);
  // Remove only previously-seeded rows (cascades visits + followups).
  const removed = await prisma.prospect.deleteMany({ where: { businessName: { in: names } } });
  console.log(`Cleared ${removed.count} previously-seeded prospect(s).`);

  for (const s of SEEDS) {
    const { scoreTotal, tier } = computeScoring({
      scoreSize: s.scores[0],
      scoreKhareefActivity: s.scores[1],
      scorePainSignals: s.scores[2],
      scoreDigitalComfort: s.scores[3],
      scoreReachability: s.scores[4],
    });

    await prisma.prospect.create({
      data: {
        businessName: s.businessName,
        contactPersonName: s.contactPersonName,
        roleOfContact: s.roleOfContact,
        phone: s.phone,
        area: s.area,
        source: s.source,
        estimatedUnits: s.estimatedUnits,
        listedOnBooking: s.listedOnBooking,
        websiteOrSocial: s.websiteOrSocial ?? null,
        scoreSize: s.scores[0],
        scoreKhareefActivity: s.scores[1],
        scorePainSignals: s.scores[2],
        scoreDigitalComfort: s.scores[3],
        scoreReachability: s.scores[4],
        scoreTotal,
        tier,
        stage: s.stage,
        interestLevel: s.interestLevel,
        mainPainNamed: s.mainPainNamed ?? null,
        nextFollowupDate: s.nextFollowupOffset == null ? null : daysFromNow(s.nextFollowupOffset),
        notes: s.notes ?? null,
        visits: s.visits
          ? {
              create: s.visits.map((v) => ({
                visitDate: daysFromNow(v.offset),
                whoMet: v.whoMet,
                outcomeNotes: v.outcomeNotes ?? null,
                objectionRaised: v.objectionRaised ?? null,
                nextAction: v.nextAction ?? null,
              })),
            }
          : undefined,
        followups: s.followups
          ? {
              create: s.followups.map((f) => ({
                dueDate: daysFromNow(f.offset),
                channel: f.channel,
                purpose: f.purpose,
                completed: f.completed ?? false,
                completedDate: f.completed ? daysFromNow(f.offset) : null,
              })),
            }
          : undefined,
      },
    });
    console.log(`  + ${s.businessName}  (T${tier}, ${scoreTotal}/25, ${s.stage})`);
  }

  console.log(`Seeded ${SEEDS.length} prospects.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
