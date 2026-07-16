/**
 * Branded "site not found" — shown for unknown, unpublished, or disabled slugs.
 * Bilingual and self-contained (no org context available here).
 */
export default function SiteNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white">
        ب
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Site not found</h1>
        <p className="mt-1 text-slate-500" dir="rtl">هذا الموقع غير متاح</p>
      </div>
      <p className="max-w-sm text-sm text-slate-500">
        This booking site doesn’t exist or isn’t live yet. Please check the address and try again.
      </p>
      <a
        href="https://binaya.app"
        className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Powered by Binaya
      </a>
    </main>
  );
}
