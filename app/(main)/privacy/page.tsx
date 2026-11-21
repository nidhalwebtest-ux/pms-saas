import MarketingPageShell from "@/components/marketing/MarketingPageShell";

export const metadata = {
  title: "Privacy Policy — Binaya PMS",
  description: "How Binaya collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <MarketingPageShell title="Privacy Policy" subtitle="Last updated: June 2026">
      <p>
        This policy explains what information Binaya (&quot;we&quot;, &quot;us&quot;)
        collects, how we use it, and the choices you have. It applies to the Binaya
        property‑management platform.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account data</strong> — your name, email, and organization details.</li>
        <li><strong>Operational data you enter</strong> — buildings, units, tenants, reservations, invoices, payments, and expenses.</li>
        <li><strong>Usage &amp; technical data</strong> — log data and device information needed to operate and secure the service.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        We use your data only to provide and improve the service: running your
        account, generating documents, and keeping the platform secure. We do not
        sell your data.
      </p>

      <h2>Data you enter about others</h2>
      <p>
        Information you record about your tenants is yours. You act as the
        controller of that data; we process it on your behalf to deliver the
        service.
      </p>

      <h2>Where your data is stored</h2>
      <p>
        Binaya runs on established cloud infrastructure (database and authentication
        via Supabase, hosting via Vercel, transactional email via Resend). Data is
        hosted in the European Union region. Each organization&apos;s data is isolated
        from every other organization.
      </p>

      <h2>Cookies</h2>
      <p>
        We use essential cookies for sign‑in/session management and to remember
        your language preference. We do not use advertising cookies.
      </p>

      <h2>Retention &amp; your rights</h2>
      <p>
        We keep your data while your account is active. You can request access,
        correction, or deletion of your data, and we will delete your organization&apos;s
        data on account closure, subject to any legal retention requirements.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy from time to time. Material changes will be
        reflected here with a new &quot;last updated&quot; date.
      </p>
    </MarketingPageShell>
  );
}
