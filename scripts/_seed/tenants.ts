/* ============================================================================
 *  Phase C — Tenants
 *
 *  Builds ~65 tenants:
 *    Al Noor:          60 (40 individual + 8 family + 7 corporate + 3 government,
 *                          2 VIP, 1 blacklisted, 10 with Arabic names)
 *    Salalah Suites:   5  (for multi-tenancy isolation testing)
 *
 *  Nationality distribution: 60% Omani / 20% Saudi+UAE / 10% Yemeni / 10% other.
 *  Phone format: +968 9XXX XXXX, deterministic.
 * ========================================================================= */

import { prisma } from "@/lib/prisma";
import {
  MALE_FIRST, FEMALE_FIRST, SURNAMES, ARABIC_NAMES,
  NATIONALITY_WEIGHTS, RESERVATION_SOURCES,
  CORPORATE_NAMES, GOVERNMENT_NAMES,
} from "./omani-names";
import { pick, weighted, rand, randInt, chance } from "./rand";
import type { SetupResult } from "./setup";

export interface TenantRef {
  id: string;
  organizationId: string;
  classification: "regular" | "vip" | "blacklisted";
  tenantType:     "individual" | "family" | "corporate" | "government";
  phone:          string;
}

export interface TenantsResult {
  tenants:    TenantRef[];
  /** The repeat-guest edge case (5+ historical reservations). */
  repeatGuestId: string;
}

/* Distribution per the spec (Al Noor only). */
type TenantTier = "individual" | "family" | "corporate" | "government";
const AL_NOOR_DISTRIBUTION: ReadonlyArray<readonly [TenantTier, number]> = [
  ["individual", 40],
  ["family",      8],
  ["corporate",   7],
  ["government",  3],
];
const VIP_COUNT         = 2;
const BLACKLISTED_COUNT = 1;
const ARABIC_NAME_COUNT = 10;

export async function runTenants(setup: SetupResult): Promise<TenantsResult> {
  console.log("⚙︎  Phase C — tenants");

  const alNoor        = setup.orgs.find((o) => o.name === "Al Noor Property Management")!;
  const salalahSuites = setup.orgs.find((o) => o.name === "Salalah Suites")!;
  const creator       = setup.users.find((u) => u.role === "OWNER" && u.organizationId === alNoor.id)!;
  const ssCreator     = setup.users.find((u) => u.organizationId === salalahSuites.id)!;

  const tenants: TenantRef[] = [];
  let phoneCounter = 9_100_0000; // deterministic +968 9XXX XXXX

  /* ── Al Noor tenants ─────────────────────────────────────────────── */
  const alNoorTiers: TenantTier[] = [];
  for (const [tier, count] of AL_NOOR_DISTRIBUTION) {
    for (let i = 0; i < count; i++) alNoorTiers.push(tier);
  }

  for (let i = 0; i < alNoorTiers.length; i++) {
    const tier = alNoorTiers[i]!;
    const nationality = weighted(NATIONALITY_WEIGHTS);
    const source = weighted(RESERVATION_SOURCES);

    let firstName: string;
    let lastName: string;
    let arabicName: string | null = null;
    const useArabicName = i < ARABIC_NAME_COUNT;

    if (useArabicName) {
      const ar = ARABIC_NAMES[i]!;
      arabicName = ar.full;
      const parts = ar.en.split(" ");
      firstName = parts[0]!;
      lastName  = parts.slice(1).join(" ");
    } else if (tier === "corporate" || tier === "government") {
      // Pick the corporate contact's name; the corporate name lives separately.
      firstName = pick(MALE_FIRST);
      lastName  = pick(SURNAMES);
    } else {
      const isMale = chance(0.55);
      firstName = isMale ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
      lastName  = pick(SURNAMES);
    }

    /* Classification: first 2 → VIP, next 1 → blacklisted, rest → regular. */
    let classification: TenantRef["classification"] = "regular";
    if (i < VIP_COUNT)                                classification = "vip";
    else if (i < VIP_COUNT + BLACKLISTED_COUNT)       classification = "blacklisted";

    const phone = `+968 9${String(phoneCounter).padStart(7, "0").slice(0, 3)} ${String(phoneCounter).slice(3, 7)}`;
    phoneCounter += randInt(11, 47);

    const idType = tier === "individual" || tier === "family"
      ? (nationality === "Omani" ? "national_id" : "passport")
      : "national_id";

    const created = await prisma.tenant.create({
      data: {
        firstName,
        lastName,
        fullNameArabic:  arabicName,
        nationality,
        idType,
        idNumber:        idType === "national_id"
          ? `12${String(10_000_000 + i).slice(0, 8)}`
          : `${nationality.slice(0, 1).toUpperCase()}${String(100_000 + i).slice(0, 6)}`,
        gender:          chance(0.55) ? "M" : "F",
        phone,
        whatsappNumber:  phone,
        email:           tier === "individual" && chance(0.6)
          ? `${firstName}.${lastName}.${i}@example.test`.toLowerCase().replace(/ /g, "")
          : null,
        country:         nationality === "Omani" ? "Oman"
                          : nationality === "Saudi" ? "Saudi Arabia"
                          : nationality === "Emirati" ? "UAE"
                          : nationality,
        city:            nationality === "Omani" ? pick(["Salalah", "Muscat", "Sohar", "Nizwa"]) : "Other",
        tenantType:      tier,
        source,
        classification,
        corporateName:   tier === "corporate"  ? pick(CORPORATE_NAMES)
                        : tier === "government" ? pick(GOVERNMENT_NAMES)
                        : null,
        corporateContact: tier === "corporate" || tier === "government" ? phone : null,
        tags:            classification === "vip" ? ["VIP", "Priority"]
                        : classification === "blacklisted" ? ["Watchlist"]
                        : [],
        internalNotes:   classification === "blacklisted"
          ? "Past payment disputes — manager approval required for any new booking."
          : null,
        isActive:        true,
        organizationId:  alNoor.id,
        createdById:     creator.id,
      },
      select: { id: true, organizationId: true, phone: true },
    });

    tenants.push({
      id:             created.id,
      organizationId: created.organizationId,
      classification,
      tenantType:     tier,
      phone:          created.phone,
    });
  }

  /* The repeat guest = first individual tenant. The reservations phase will
   * give them 6+ historical reservations. */
  const repeatGuestId = tenants.find((t) => t.tenantType === "individual")!.id;

  /* ── Salalah Suites tenants — 5 simple individuals ───────────────── */
  for (let i = 0; i < 5; i++) {
    const nationality = weighted(NATIONALITY_WEIGHTS);
    const firstName = chance(0.55) ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
    const lastName  = pick(SURNAMES);
    const phone = `+968 9${String(phoneCounter).padStart(7, "0").slice(0, 3)} ${String(phoneCounter).slice(3, 7)}`;
    phoneCounter += randInt(11, 47);

    const created = await prisma.tenant.create({
      data: {
        firstName,
        lastName,
        nationality,
        idType:          "national_id",
        idNumber:        `13${String(20_000_000 + i).slice(0, 8)}`,
        phone,
        whatsappNumber:  phone,
        country:         nationality === "Omani" ? "Oman" : nationality,
        city:            "Salalah",
        tenantType:      "individual",
        source:          "walk_in",
        classification:  "regular",
        isActive:        true,
        organizationId:  salalahSuites.id,
        createdById:     ssCreator.id,
      },
      select: { id: true, organizationId: true, phone: true },
    });

    tenants.push({
      id: created.id,
      organizationId: created.organizationId,
      classification: "regular",
      tenantType: "individual",
      phone: created.phone,
    });
  }

  console.log(`   • ${tenants.length} tenants (${tenants.filter((t) => t.organizationId === alNoor.id).length} Al Noor, ${tenants.filter((t) => t.organizationId === salalahSuites.id).length} Salalah Suites)`);
  console.log("");

  return { tenants, repeatGuestId };
}

// Avoid unused-import warning on rand: keep imported for future tuning.
void rand;
