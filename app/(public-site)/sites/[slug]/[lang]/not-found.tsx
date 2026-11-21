/**
 * Public-site 404 — unknown/unpublished sites and missing buildings or units.
 * Bilingual and self-contained (rendered inside the site layout when the site
 * exists, or a bare document when it doesn't).
 */
export default function SiteNotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white">
        404
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Page not available</h1>
        <p className="mt-1 text-slate-500" dir="rtl">هذه الصفحة غير متاحة</p>
      </div>
      <p className="max-w-sm text-sm text-slate-500">
        The page or booking site you’re looking for doesn’t exist or isn’t live yet. Please check the address and try again.
      </p>
      <a href="/" className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700">
        Home · الرئيسية
      </a>
    </main>
  );
}
