/**
 * Seed script for creating a realistic demo organization for software demo videos.
 *
 * Creates:
 * 1. Demo Organization: "Dhofar Royal Property Management"
 * 2. User Account: "demo@dhofar-royal.com" / "Demo1234!" (Role: OWNER)
 * 3. 3 Properties in Salalah (Dhofar Royal Beach Tower, Khareef Oasis Apartments, Salalah Crown Plaza)
 * 4. 5 Units per Property (15 Units total: Studios, 1BR, 2BR, 3BR, Suites) with Default & Khareef seasonal pricing
 * 5. 5 Realistic Omani Tenants (VIP, Individual, Family, Corporate)
 * 6. Rich Operational Scenarios (Overdue Arrival, Due Checkout Unpaid, Overstay Paid, In House, Arriving Today)
 * 7. Invoices, Payments, and System Expenses for live dashboard counters & badges
 *
 * Run with:
 *   PRISMA_USE_DIRECT_URL=1 npx tsx --env-file=.env scripts/seed-demo-video-org.ts
 */

import { prisma } from "../lib/prisma";
import { createAdminClient } from "../utils/supabase/admin";
import { generateInvoicesForReservation } from "../lib/invoice-engine";

const DEMO_ORG_NAME = "Dhofar Royal Property Management";
const DEMO_USER_EMAIL = "demo@dhofar-royal.com";
const DEMO_USER_PASSWORD = "Demo1234!";

async function main() {
  console.log("🎬 Seeding Real-World Demo Data for Software Demo Video...\n");

  // 1. Cleanup existing demo org if already seeded (idempotent)
  const existingOrg = await prisma.organization.findFirst({
    where: { name: DEMO_ORG_NAME },
    select: { id: true },
  });

  if (existingOrg) {
    console.log(`🧹 Cleaning up previous demo organization (${existingOrg.id})...`);
    // Delete Supabase Auth users for this org
    const admin = createAdminClient();
    const dbUsers = await prisma.user.findMany({
      where: { organizationId: existingOrg.id },
      select: { id: true },
    });
    for (const u of dbUsers) {
      try {
        await admin.auth.admin.deleteUser(u.id);
      } catch (e) {
        // Ignore if user not found in auth
      }
    }

    // Cascade delete DB records
    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({ where: { organizationId: existingOrg.id }, data: { roleId: null } });
      await tx.paymentAllocation.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.invoiceLineItem.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.returnLineItem.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.return.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.bankStatementLine.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.bankTransaction.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.cashierSession.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.payment.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.invoice.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.reservationActivity.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.reservationCharge.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.reservationUnit.deleteMany({ where: { reservation: { organizationId: existingOrg.id } } });
      await tx.reservation.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.tenant.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.unitPrice.deleteMany({ where: { unit: { property: { organizationId: existingOrg.id } } } });
      await tx.expense.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.expenseCat.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.bankAccount.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.propertyAssignment.deleteMany({ where: { property: { organizationId: existingOrg.id } } });
      await tx.role.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.unit.deleteMany({ where: { property: { organizationId: existingOrg.id } } });
      await tx.property.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.user.deleteMany({ where: { organizationId: existingOrg.id } });
      await tx.organization.delete({ where: { id: existingOrg.id } });
    });
    console.log("   ✓ Cleaned up existing demo organization.\n");
  }

  // 2. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      phone: "+968 2321 9900",
      address: "Sultan Qaboos Street, Al Haffa, Salalah",
      city: "Salalah",
      area: "Al Haffa",
      currency: "OMR",
      timezone: "Asia/Muscat",
      plan: "FREE",
      subscriptionStatus: "ACTIVE",
      pdfBrandColor: "#185FA5",
    },
  });
  console.log(`🏢 Created Organization: ${org.name} (${org.id})`);

  // 3. Create User Account (Supabase Auth + Prisma User)
  const admin = createAdminClient();
  let authUserId: string;

  try {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        firstName: "Saeed",
        lastName: "Al Shanfari",
      },
    });

    if (authError && !authError.message.includes("already registered")) {
      throw authError;
    }

    if (authData.user) {
      authUserId = authData.user.id;
    } else {
      // Find existing user in auth
      const { data: listData } = await admin.auth.admin.listUsers();
      const existingUser = listData.users.find((u) => u.email === DEMO_USER_EMAIL);
      if (!existingUser) throw new Error("Could not create or find auth user");
      authUserId = existingUser.id;
      // Update password
      await admin.auth.admin.updateUserById(authUserId, { password: DEMO_USER_PASSWORD });
    }
  } catch (e) {
    console.error("Auth user creation failed:", e);
    throw e;
  }

  const user = await prisma.user.create({
    data: {
      id: authUserId,
      email: DEMO_USER_EMAIL,
      firstName: "Saeed",
      lastName: "Al Shanfari",
      phone: "+968 9500 1122",
      role: "OWNER",
      organizationId: org.id,
      preferredLanguage: "en",
    },
  });
  console.log(`👤 Created User: ${user.email} (Password: ${DEMO_USER_PASSWORD})`);

  // 4. Create System Expense Categories
  const expenseCategories = [
    { name: "Maintenance", nameAr: "صيانة", icon: "🔧" },
    { name: "Cleaning", nameAr: "تنظيف", icon: "🧹" },
    { name: "Supplies", nameAr: "مستلزمات", icon: "📦" },
    { name: "Utilities", nameAr: "خدمات", icon: "💡" },
    { name: "Transportation", nameAr: "نقل", icon: "🚗" },
    { name: "Food", nameAr: "طعام", icon: "🍽️" },
    { name: "Other", nameAr: "أخرى", icon: "📋" },
  ];

  await prisma.expenseCat.createMany({
    data: expenseCategories.map((c, i) => ({
      organizationId: org.id,
      name: c.name,
      nameAr: c.nameAr,
      icon: c.icon,
      isSystem: true,
      isActive: true,
      sortOrder: i,
    })),
  });

  const maintenanceCat = await prisma.expenseCat.findFirstOrThrow({
    where: { organizationId: org.id, name: "Maintenance" },
  });
  const cleaningCat = await prisma.expenseCat.findFirstOrThrow({
    where: { organizationId: org.id, name: "Cleaning" },
  });
  const utilitiesCat = await prisma.expenseCat.findFirstOrThrow({
    where: { organizationId: org.id, name: "Utilities" },
  });
  const suppliesCat = await prisma.expenseCat.findFirstOrThrow({
    where: { organizationId: org.id, name: "Supplies" },
  });
  const transportCat = await prisma.expenseCat.findFirstOrThrow({
    where: { organizationId: org.id, name: "Transportation" },
  });

  // 5. Create 3 Buildings (Properties)
  const propertiesData = [
    {
      name: "Dhofar Royal Beach Tower",
      type: "HOTEL" as const,
      city: "Al Haffa",
      address: "Al Haffa Beachfront, Salalah",
      totalFloors: 5,
      description: "Luxury seafront residence overlooking the Arabian Sea in Al Haffa.",
      amenities: ["Free Parking", "Wi-Fi", "Beach Access", "24/7 Reception", "Elevator", "Sea View"],
    },
    {
      name: "Khareef Oasis Apartments",
      type: "RESIDENTIAL" as const,
      city: "Al Dahariz",
      address: "Al Dahariz North, Salalah",
      totalFloors: 4,
      description: "Modern apartment complex surrounded by Khareef greenery.",
      amenities: ["Free Parking", "Wi-Fi", "Garden View", "Air Conditioning", "Balcony"],
    },
    {
      name: "Salalah Crown Plaza Residences",
      type: "MIXED" as const,
      city: "City Center",
      address: "Sultan Qaboos Street, Salalah",
      totalFloors: 3,
      description: "Prime city-center property for business travelers and vacation stays.",
      amenities: ["Free Parking", "Wi-Fi", "City Center Access", "Elevator", "Security"],
    },
  ];

  const createdProperties = [];
  for (const p of propertiesData) {
    const prop = await prisma.property.create({
      data: {
        name: p.name,
        type: p.type,
        organizationId: org.id,
        city: p.city,
        address: p.address,
        totalFloors: p.totalFloors,
        description: p.description,
        amenities: p.amenities,
        publicDescriptionEn: p.description,
        publicDescriptionAr: "مبنى فاخر ومريح في صلالة بتسهيلات متكاملة.",
      },
    });
    createdProperties.push(prop);
  }
  console.log(`🏨 Created 3 Buildings: ${createdProperties.map((p) => p.name).join(", ")}`);

  // 6. Create 5 Units per Building (15 Units total)
  const unitMix = [
    // Dhofar Royal Beach Tower (5 units)
    { propIndex: 0, name: "101", type: "STUDIO", floor: 1, beds: 0, baths: 1, daily: 45, monthly: 650 },
    { propIndex: 0, name: "201", type: "ONE_BR", floor: 2, beds: 1, baths: 1, daily: 65, monthly: 850 },
    { propIndex: 0, name: "301", type: "TWO_BR", floor: 3, beds: 2, baths: 2, daily: 95, monthly: 1300 },
    { propIndex: 0, name: "401", type: "THREE_BR", floor: 4, beds: 3, baths: 2, daily: 140, monthly: 1750 },
    { propIndex: 0, name: "PH1", type: "SUITE", floor: 5, beds: 3, baths: 3, daily: 210, monthly: 2400 },

    // Khareef Oasis Apartments (5 units)
    { propIndex: 1, name: "K-101", type: "STUDIO", floor: 1, beds: 0, baths: 1, daily: 38, monthly: 550 },
    { propIndex: 1, name: "K-201", type: "ONE_BR", floor: 2, beds: 1, baths: 1, daily: 58, monthly: 780 },
    { propIndex: 1, name: "K-202", type: "ONE_BR", floor: 2, beds: 1, baths: 1, daily: 58, monthly: 780 },
    { propIndex: 1, name: "K-301", type: "TWO_BR", floor: 3, beds: 2, baths: 2, daily: 88, monthly: 1200 },
    { propIndex: 1, name: "K-PH1", type: "SUITE", floor: 4, beds: 3, baths: 3, daily: 180, monthly: 2200 },

    // Salalah Crown Plaza Residences (5 units)
    { propIndex: 2, name: "C-101", type: "ONE_BR", floor: 1, beds: 1, baths: 1, daily: 52, monthly: 720 },
    { propIndex: 2, name: "C-102", type: "ONE_BR", floor: 1, beds: 1, baths: 1, daily: 52, monthly: 720 },
    { propIndex: 2, name: "C-201", type: "TWO_BR", floor: 2, beds: 2, baths: 2, daily: 82, monthly: 1150 },
    { propIndex: 2, name: "C-202", type: "TWO_BR", floor: 2, beds: 2, baths: 2, daily: 82, monthly: 1150 },
    { propIndex: 2, name: "C-301", type: "THREE_BR", floor: 3, beds: 3, baths: 2, daily: 125, monthly: 1600 },
  ];

  const createdUnits = [];
  const khareefStart = new Date("2026-07-01T00:00:00.000Z");
  const khareefEnd = new Date("2026-08-31T23:59:59.999Z");

  for (const u of unitMix) {
    const prop = createdProperties[u.propIndex];
    const unit = await prisma.unit.create({
      data: {
        name: u.name,
        unitType: u.type,
        floor: u.floor,
        bedrooms: u.beds,
        bathrooms: u.baths,
        basePrice: u.daily,
        propertyId: prop.id,
        status: "AVAILABLE",
        amenities: ["Air conditioning", "Wi-Fi", "Kitchen", "Washing machine", "TV"],
      },
    });

    // Default & Khareef seasonal price
    await prisma.unitPrice.createMany({
      data: [
        {
          priceType: "DEFAULT",
          dailyRate: u.daily,
          monthlyRate: u.monthly,
          priority: 1,
          isActive: true,
          unitId: unit.id,
        },
        {
          priceType: "SEASONAL",
          name: "Khareef 2026 Peak Rate",
          dailyRate: Math.round(u.daily * 1.6 * 1000) / 1000,
          monthlyRate: u.monthly,
          startDate: khareefStart,
          endDate: khareefEnd,
          priority: 20,
          isActive: true,
          unitId: unit.id,
        },
      ],
    });

    createdUnits.push({ ...unit, propertyName: prop.name, dailyRate: u.daily, monthlyRate: u.monthly });
  }
  console.log(`🔑 Created 15 Units across 3 buildings with Khareef pricing rules.`);

  // 7. Create 5 Tenants
  const tenantsData = [
    {
      firstName: "Mohammed",
      lastName: "Al Amri",
      fullNameArabic: "محمد بن سالم العامري",
      phone: "+968 9123 4567",
      email: "m.alamri@example.com",
      nationality: "Omani",
      nationalId: "782194012",
      classification: "vip",
      tenantType: "individual",
      totalStays: 4,
      totalSpent: 1450.0,
      notes: "Frequent VIP guest visiting during Khareef seasons.",
    },
    {
      firstName: "Salim",
      lastName: "Al Kathiri",
      fullNameArabic: "سالم بخيت الكثيري",
      phone: "+968 9988 7766",
      email: "s.alkathiri@example.com",
      nationality: "Omani",
      nationalId: "654129840",
      classification: "regular",
      tenantType: "family",
      totalStays: 2,
      totalSpent: 680.0,
      notes: "Family booking, prefers ground floor or 1st floor units.",
    },
    {
      firstName: "Al Maha Trading",
      lastName: "Co.",
      fullNameArabic: "شركة المها للتجارة ش.م.م",
      phone: "+968 9234 5678",
      email: "info@almahatrading.om",
      nationality: "Omani",
      classification: "regular",
      tenantType: "corporate",
      corporateName: "Al Maha Trading Co.",
      corporateContact: "Tariq Al Zadjali",
      totalStays: 5,
      totalSpent: 3200.0,
      notes: "Corporate contract tenant with monthly billing.",
    },
    {
      firstName: "Fatima",
      lastName: "Al Rawas",
      fullNameArabic: "فاطمة بنت أحمد الرواس",
      phone: "+968 9345 6789",
      email: "fatima.rawas@example.com",
      nationality: "Omani",
      nationalId: "912348501",
      classification: "regular",
      tenantType: "individual",
      totalStays: 1,
      totalSpent: 240.0,
      notes: "Weekend short-stay guest.",
    },
    {
      firstName: "Dr. Khalid",
      lastName: "Al Barwani",
      fullNameArabic: "د. خالد بن سعيد البرواني",
      phone: "+968 9456 7890",
      email: "dr.khalid@example.com",
      nationality: "Omani",
      nationalId: "543219087",
      classification: "vip",
      tenantType: "individual",
      totalStays: 3,
      totalSpent: 920.0,
      notes: "Prefers high floor suites with sea view.",
    },
  ];

  const createdTenants = [];
  for (const t of tenantsData) {
    const tenant = await prisma.tenant.create({
      data: {
        firstName: t.firstName,
        lastName: t.lastName,
        fullNameArabic: t.fullNameArabic,
        phone: t.phone,
        email: t.email,
        nationality: t.nationality,
        nationalId: t.nationalId,
        classification: t.classification,
        tenantType: t.tenantType,
        corporateName: t.corporateName,
        corporateContact: t.corporateContact,
        totalStays: t.totalStays,
        totalSpent: t.totalSpent,
        organizationId: org.id,
        createdById: user.id,
      },
    });
    createdTenants.push(tenant);
  }
  console.log(`👥 Created 5 Tenants: ${createdTenants.map((t) => `${t.firstName} ${t.lastName}`).join(", ")}`);

  // 8. Create Realistic Reservations & Financial Records for Live Video Scenarios
  const now = new Date();

  // --- Dhofar Royal Beach Tower Scenarios ---

  // Scenario 1: Active Stay Checked in (Mohammed Al Amri) in Unit 101
  const u101 = createdUnits[0]; // Unit 101 Beach Tower
  const res1Start = new Date(now.valueOf() - 2 * 24 * 3600 * 1000);
  const res1End = new Date(now.valueOf() + 3 * 24 * 3600 * 1000);

  const res1 = await prisma.reservation.create({
    data: {
      reservationNumber: "RES-2026-00101",
      organizationId: org.id,
      startDate: res1Start,
      endDate: res1End,
      actualCheckIn: res1Start,
      status: "CHECKED_IN",
      frequency: "DAILY",
      rateType: "daily",
      source: "walk_in",
      totalNights: 5,
      amount: 225.0,
      totalAmount: 225.0,
      grandTotal: 225.0,
      amountPaid: 225.0,
      tenantId: createdTenants[0].id,
      unitId: u101.id,
      createdById: user.id,
    },
  });
  await prisma.reservationUnit.create({
    data: { reservationId: res1.id, unitId: u101.id, rateType: "daily", rateAmount: 45.0, rateSource: "DEFAULT", nights: 5, subtotal: 225.0 },
  });
  await prisma.unit.update({ where: { id: u101.id }, data: { status: "OCCUPIED" } });
  await generateInvoicesForReservation(res1.id, org.id, user.id);
  const inv1 = await prisma.invoice.findFirst({ where: { reservationId: res1.id } });
  if (inv1) {
    const pay1 = await prisma.payment.create({
      data: {
        paymentNumber: "PAY-2026-00001", organizationId: org.id, tenantId: createdTenants[0].id,
        reservationId: res1.id, invoiceId: inv1.id, amount: 225.0, method: "CARD", reference: "AUTH-89210",
        notes: "Full payment collected at check-in", receivedById: user.id,
      },
    });
    await prisma.paymentAllocation.create({ data: { paymentId: pay1.id, invoiceId: inv1.id, organizationId: org.id, amount: 225.0 } });
    await prisma.invoice.update({ where: { id: inv1.id }, data: { status: "PAID", amountPaid: 225.0, balanceDue: 0, paidDate: new Date() } });
  }

  // Scenario 2: Overdue Arrival (Late Check-in from 2 days ago) in Unit 201 (Fatima Al Rawas)
  const u201 = createdUnits[1]; // Unit 201 Beach Tower
  const res2Start = new Date(now.valueOf() - 2 * 24 * 3600 * 1000); // Start 2 days ago
  const res2End = new Date(now.valueOf() + 3 * 24 * 3600 * 1000);   // End 3 days from now

  const res2 = await prisma.reservation.create({
    data: {
      reservationNumber: "RES-2026-00102",
      organizationId: org.id,
      startDate: res2Start,
      endDate: res2End,
      status: "CONFIRMED", // CONFIRMED & startDate < today = OVERDUE ARRIVAL
      frequency: "DAILY",
      rateType: "daily",
      source: "booking_com",
      totalNights: 5,
      amount: 325.0,
      totalAmount: 325.0,
      grandTotal: 325.0,
      amountPaid: 0,
      tenantId: createdTenants[3].id,
      unitId: u201.id,
      notes: "Guest delayed flight from Muscat — overdue arrival.",
      createdById: user.id,
    },
  });
  await prisma.reservationUnit.create({
    data: { reservationId: res2.id, unitId: u201.id, rateType: "daily", rateAmount: 65.0, rateSource: "DEFAULT", nights: 5, subtotal: 325.0 },
  });
  await generateInvoicesForReservation(res2.id, org.id, user.id);

  // Scenario 3: Due Checkout Today & NOT Paid in Unit 401 (Al Maha Trading Co.)
  const u401 = createdUnits[3]; // Unit 401 Beach Tower
  const res3Start = new Date(now.valueOf() - 3 * 24 * 3600 * 1000); // 3 days ago
  const res3End = new Date(now.valueOf());                            // Ends today (Due Checkout)

  const res3 = await prisma.reservation.create({
    data: {
      reservationNumber: "RES-2026-00103",
      organizationId: org.id,
      startDate: res3Start,
      endDate: res3End,
      actualCheckIn: res3Start,
      status: "CHECKED_IN",
      frequency: "DAILY",
      rateType: "daily",
      source: "corporate",
      totalNights: 3,
      amount: 420.0,
      totalAmount: 420.0,
      grandTotal: 420.0,
      amountPaid: 0, // NOT PAID
      tenantId: createdTenants[2].id,
      unitId: u401.id,
      notes: "Corporate guest checking out today — awaiting company bank transfer.",
      createdById: user.id,
    },
  });
  await prisma.reservationUnit.create({
    data: { reservationId: res3.id, unitId: u401.id, rateType: "daily", rateAmount: 140.0, rateSource: "DEFAULT", nights: 3, subtotal: 420.0 },
  });
  await prisma.unit.update({ where: { id: u401.id }, data: { status: "OCCUPIED" } });
  await generateInvoicesForReservation(res3.id, org.id, user.id);

  // Scenario 4: Overstay (Ended 2 days ago) & Paid for stay in Unit PH1 (Dr. Khalid Al Barwani)
  const uPH1 = createdUnits[4]; // Penthouse PH1 Beach Tower
  const res4Start = new Date(now.valueOf() - 6 * 24 * 3600 * 1000); // 6 days ago
  const res4End = new Date(now.valueOf() - 2 * 24 * 3600 * 1000);   // Ended 2 days ago (Overstay!)

  const res4 = await prisma.reservation.create({
    data: {
      reservationNumber: "RES-2026-00104",
      organizationId: org.id,
      startDate: res4Start,
      endDate: res4End,
      actualCheckIn: res4Start,
      status: "CHECKED_IN", // Still CHECKED_IN past endDate = OVERSTAY
      frequency: "DAILY",
      rateType: "daily",
      source: "phone",
      totalNights: 4,
      amount: 840.0,
      totalAmount: 840.0,
      grandTotal: 840.0,
      amountPaid: 840.0, // Original stay is paid
      tenantId: createdTenants[4].id,
      unitId: uPH1.id,
      notes: "Guest requested 2 extra days extension — overstay in progress.",
      createdById: user.id,
    },
  });
  await prisma.reservationUnit.create({
    data: { reservationId: res4.id, unitId: uPH1.id, rateType: "daily", rateAmount: 210.0, rateSource: "DEFAULT", nights: 4, subtotal: 840.0 },
  });
  await prisma.unit.update({ where: { id: uPH1.id }, data: { status: "OCCUPIED" } });
  await generateInvoicesForReservation(res4.id, org.id, user.id);
  const inv4 = await prisma.invoice.findFirst({ where: { reservationId: res4.id } });
  if (inv4) {
    const pay4 = await prisma.payment.create({
      data: {
        paymentNumber: "PAY-2026-00003", organizationId: org.id, tenantId: createdTenants[4].id,
        reservationId: res4.id, invoiceId: inv4.id, amount: 840.0, method: "CARD", reference: "AUTH-99120",
        notes: "Initial 4 nights paid in full", receivedById: user.id,
      },
    });
    await prisma.paymentAllocation.create({ data: { paymentId: pay4.id, invoiceId: inv4.id, organizationId: org.id, amount: 840.0 } });
    await prisma.invoice.update({ where: { id: inv4.id }, data: { status: "PAID", amountPaid: 840.0, balanceDue: 0, paidDate: new Date() } });
  }

  // --- Other Buildings Scenarios ---

  // Scenario 5: Arriving Today (Salim Al Kathiri) in Khareef Oasis Unit K-301
  const uK301 = createdUnits[8];
  const res5Start = new Date(now.valueOf());
  const res5End = new Date(now.valueOf() + 4 * 24 * 3600 * 1000);

  const res5 = await prisma.reservation.create({
    data: {
      reservationNumber: "RES-2026-00105",
      organizationId: org.id,
      startDate: res5Start,
      endDate: res5End,
      status: "CONFIRMED",
      frequency: "DAILY",
      rateType: "daily",
      source: "booking_com",
      totalNights: 4,
      amount: 352.0,
      totalAmount: 352.0,
      grandTotal: 352.0,
      amountPaid: 100.0,
      tenantId: createdTenants[1].id,
      unitId: uK301.id,
      createdById: user.id,
    },
  });
  await prisma.reservationUnit.create({
    data: { reservationId: res5.id, unitId: uK301.id, rateType: "daily", rateAmount: 88.0, rateSource: "DEFAULT", nights: 4, subtotal: 352.0 },
  });
  await generateInvoicesForReservation(res5.id, org.id, user.id);
  const inv5 = await prisma.invoice.findFirst({ where: { reservationId: res5.id } });
  if (inv5) {
    const pay5 = await prisma.payment.create({
      data: {
        paymentNumber: "PAY-2026-00004", organizationId: org.id, tenantId: createdTenants[1].id,
        reservationId: res5.id, invoiceId: inv5.id, amount: 100.0, method: "BANK_TRANSFER", reference: "BM-TR-44910",
        notes: "Deposit received via Bank Muscat", receivedById: user.id,
      },
    });
    await prisma.paymentAllocation.create({ data: { paymentId: pay5.id, invoiceId: inv5.id, organizationId: org.id, amount: 100.0 } });
    await prisma.invoice.update({ where: { id: inv5.id }, data: { status: "PARTIALLY_PAID", amountPaid: 100.0, balanceDue: 252.0 } });
  }

  // 9. Add Expenses across Categories & Statuses
  await prisma.expense.createMany({
    data: [
      {
        expenseNumber: "EXP-2026-00001",
        organizationId: org.id,
        categoryId: maintenanceCat.id,
        description: "AC Maintenance & Gas Refill for Dhofar Royal Beach Tower",
        amount: 125.0,
        propertyId: createdProperties[0].id,
        status: "PROCESSED",
        submittedById: user.id,
        reviewedById: user.id,
        processedById: user.id,
        paymentMethod: "petty_cash",
        notes: "Air conditioning serviced before Khareef peak season",
      },
      {
        expenseNumber: "EXP-2026-00002",
        organizationId: org.id,
        categoryId: cleaningCat.id,
        description: "Deep Cleaning Supplies & Linen Washing for Khareef Oasis",
        amount: 85.5,
        propertyId: createdProperties[1].id,
        status: "APPROVED",
        submittedById: user.id,
        reviewedById: user.id,
        notes: "Bulk cleaning products purchased",
      },
      {
        expenseNumber: "EXP-2026-00003",
        organizationId: org.id,
        categoryId: maintenanceCat.id,
        description: "Plumbing repair in Unit C-102",
        amount: 45.0,
        propertyId: createdProperties[2].id,
        status: "PENDING",
        submittedById: user.id,
        notes: "Faucet replacement in bathroom",
      },
      {
        expenseNumber: "EXP-2026-00004",
        organizationId: org.id,
        categoryId: utilitiesCat.id,
        description: "Water & Electricity monthly bill for Dhofar Royal Beach Tower",
        amount: 240.0,
        propertyId: createdProperties[0].id,
        status: "PROCESSED",
        submittedById: user.id,
        reviewedById: user.id,
        processedById: user.id,
        paymentMethod: "bank_transfer",
        bankReference: "NAMA-UTIL-9901",
        notes: "Nama Water & Electricity bill paid",
      },
      {
        expenseNumber: "EXP-2026-00005",
        organizationId: org.id,
        categoryId: suppliesCat.id,
        description: "Guest Amenities, Soaps & Towel Replacements Bulk Pack",
        amount: 110.0,
        propertyId: createdProperties[0].id,
        status: "APPROVED",
        submittedById: user.id,
        reviewedById: user.id,
        notes: "Luxury guest amenity kit for beach tower suites",
      },
      {
        expenseNumber: "EXP-2026-00006",
        organizationId: org.id,
        categoryId: transportCat.id,
        description: "Staff Airport Shuttle & Guest Transport Fuel Reimbursement",
        amount: 35.0,
        propertyId: createdProperties[0].id,
        status: "PENDING",
        submittedById: user.id,
        notes: "Fuel receipt for Salalah Airport pickup",
      },
    ],
  });

  console.log("📊 Generated Reservations, Invoices, Payments & Expenses for live demo KPIs.\n");

  console.log("════════════════════════════════════════════════════════════════");
  console.log("✨ RICH REAL-WORLD DEMO SCENARIOS SEEDED SUCCESSFULLY!");
  console.log("════════════════════════════════════════════════════════════════");
  console.log(`📌 Organization Name:  ${org.name}`);
  console.log(`📧 Login Email:       ${DEMO_USER_EMAIL}`);
  console.log(`🔑 Login Password:    ${DEMO_USER_PASSWORD}`);
  console.log(`🏨 Dhofar Royal Beach Scenarios:`);
  console.log(`   • Unit 101: In House (Checked in 2 days ago, Paid)`);
  console.log(`   • Unit 201: OVERDUE ARRIVAL (Started 2 days ago, Not checked in yet)`);
  console.log(`   • Unit 401: DUE CHECKOUT TODAY & UNPAID (Balance remaining)`);
  console.log(`   • Unit PH1: OVERSTAY (Ended 2 days ago, Original stay paid)`);
  console.log(`🧾 Expenses:         6 Expenses across Maintenance, Cleaning, Utilities, Supplies & Transport`);
  console.log("════════════════════════════════════════════════════════════════\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
