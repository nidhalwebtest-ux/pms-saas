import { NextIntlClientProvider } from "next-intl";

/**
 * Gives a route subtree the FULL translation dictionary on the client.
 *
 * The root layout deliberately ships only a small public subset of messages
 * (see PUBLIC_MESSAGE_NAMESPACES in app/layout.tsx) so the landing page, login
 * and tenant booking sites don't download ~260–330 KB of dashboard strings.
 * App areas that render shared client components (onboarding, invite, admin,
 * dashboard) wrap themselves in this. Rendered on the server with no
 * `messages` prop, NextIntlClientProvider inherits every message from
 * i18n/request.ts (next-intl v4).
 */
export default function FullMessagesProvider({ children }: { children: React.ReactNode }) {
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}
