import MarketingPageShell from "@/components/marketing/MarketingPageShell";

export const metadata = {
  title: "Contact — Binaya PMS",
  description: "Get in touch with the Binaya team.",
};

export default function ContactPage() {
  return (
    <MarketingPageShell
      title="Get in touch"
      subtitle="We'd love to hear from property managers across Oman."
    >
      <p>
        Binaya is based in Salalah, Oman. Whether you have a question about
        features, pricing, or getting your buildings set up, we&apos;re happy to help.
      </p>

      <h2>Already using Binaya?</h2>
      <p>
        Sign in and reach out from inside the app — we can see your account and
        help you faster. <a href="/login">Sign in</a>.
      </p>

      <h2>New here?</h2>
      <p>
        The quickest way to evaluate Binaya is to try it — it&apos;s free for one
        building. <a href="/login?mode=signup">Create an account</a> and explore.
      </p>

      <p className="text-gray-500">
        Dedicated support channels are coming soon.
      </p>
    </MarketingPageShell>
  );
}
