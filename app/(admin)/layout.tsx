import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { getSuperAdmin } from "@/lib/super-admin";
import AdminNav from "@/components/admin/AdminNav";

/**
 * Internal founder CRM shell. Separate from the customer dashboard chrome
 * (app/dashboard/layout.tsx) on purpose — this area is for the super-admin only.
 *
 * Gating: getSuperAdmin() checks the SUPER_ADMIN_EMAILS allowlist. Middleware
 * already guarantees an authenticated session for /admin; here we additionally
 * require super-admin and bounce everyone else back to the normal app.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getSuperAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-border-default bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-3 sm:px-6">
          {/* Top row: brand + identity */}
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
                <ShieldCheckIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-bold text-fg">Binaya Sales CRM</h1>
                  <span className="hidden rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 sm:inline">
                    Founder
                  </span>
                </div>
                <p className="truncate text-xs text-fg-tertiary">{admin.email}</p>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-subtle hover:text-fg"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to app</span>
              <span className="sm:hidden">App</span>
            </Link>
          </div>

          {/* Section tabs */}
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
