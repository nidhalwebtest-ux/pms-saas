import MarketingPageShell from "@/components/marketing/MarketingPageShell";

export const metadata = {
  title: "Terms of Service — Binaya PMS",
  description: "The terms that govern your use of Binaya.",
};

export default function TermsPage() {
  return (
    <MarketingPageShell title="Terms of Service" subtitle="Last updated: June 2026">
      <p>
        These terms govern your access to and use of Binaya. By creating an
        account or using the service, you agree to them.
      </p>

      <h2>The service</h2>
      <p>
        Binaya is a property‑management platform provided on a software‑as‑a‑service
        basis. A free tier is available for a single building; additional capacity
        may require a paid plan.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Provide accurate account information and keep your credentials secure.</li>
        <li>Use the service lawfully and only for legitimate property‑management purposes.</li>
        <li>Ensure you have the right to store the data you enter, including data about your tenants.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        You may not misuse the service — including attempting to disrupt it, access
        other organizations&apos; data, or use it for unlawful activity.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep Binaya reliable and available, but the service is provided
        &quot;as is&quot; without warranties. We may update, change, or discontinue
        features over time.
      </p>

      <h2>Billing</h2>
      <p>
        Where paid plans apply, fees are charged in Omani Rial (OMR). Billing terms
        for a plan are presented before you subscribe.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Binaya is not liable for indirect or
        consequential losses arising from use of the service.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the service at any time. We may suspend or terminate
        access for breach of these terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Sultanate of Oman.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms; material changes will be posted here with a new
        &quot;last updated&quot; date.
      </p>
    </MarketingPageShell>
  );
}
