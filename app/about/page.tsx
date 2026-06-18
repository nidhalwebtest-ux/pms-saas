import MarketingPageShell from "@/components/marketing/MarketingPageShell";

export const metadata = {
  title: "About — Binaya PMS",
  description:
    "Binaya is property management software built in Salalah for property managers across Oman.",
};

export default function AboutPage() {
  return (
    <MarketingPageShell
      title="About Binaya"
      subtitle="Property management software built in Salalah, for property managers across Oman."
    >
      <p>
        Binaya helps property management companies run their day‑to‑day operations
        in one place — reservations, tenants, invoicing, payments, expenses, and
        reporting — across short‑term and long‑term rentals.
      </p>

      <h2>Why we built it</h2>
      <p>
        Property managers in Oman juggle seasonal demand (especially the Khareef
        season), multiple buildings, and bilingual paperwork. Most tools are built
        for other markets and don&apos;t fit how teams here actually work. Binaya is
        designed around the receptionist&apos;s daily workflow, full Arabic/English
        support, and the OMR currency — down to the baisa.
      </p>

      <h2>What matters to us</h2>
      <ul>
        <li>Fast, reliable workflows for the people using the system all day.</li>
        <li>Accurate money handling — no rounding surprises.</li>
        <li>Bilingual, right‑to‑left first‑class support.</li>
        <li>Clear roles &amp; permissions so every team member sees just what they need.</li>
      </ul>

      <h2>Get started</h2>
      <p>
        Binaya is free for a single building. <a href="/login?mode=signup">Create an
        account</a> to try it, or <a href="/login">sign in</a> if you already have one.
      </p>
    </MarketingPageShell>
  );
}
