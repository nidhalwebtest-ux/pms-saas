"use client";

/* ============================================================================
 *  ImportProgress — big counter + bar for Step 5. No design-system primitive
 *  for this exists yet (audit confirmed); built here as the dedicated piece
 *  the spec calls for ("Row 340 of 1,200 imported").
 * ========================================================================= */

export function ImportProgress({
  processed, total, success, error, elapsedSeconds,
}: {
  processed: number;
  total: number;
  success: number;
  error: number;
  elapsedSeconds: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-4xl font-bold text-fg tabular-nums ltr-numbers">
            {processed.toLocaleString()} <span className="text-xl font-medium text-fg-tertiary">/ {total.toLocaleString()}</span>
          </p>
          <p className="mt-1 text-sm text-fg-secondary">rows processed</p>
        </div>
        <div className="text-end text-sm text-fg-tertiary tabular-nums ltr-numbers">
          {mins}:{secs.toString().padStart(2, "0")} elapsed
        </div>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-subtle">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="flex items-center gap-5 text-sm">
        <span className="flex items-center gap-1.5 text-success-700">
          <span className="h-2 w-2 rounded-full bg-success-500" />
          {success.toLocaleString()} succeeded
        </span>
        {error > 0 && (
          <span className="flex items-center gap-1.5 text-error-700">
            <span className="h-2 w-2 rounded-full bg-error-500" />
            {error.toLocaleString()} failed
          </span>
        )}
      </div>
    </div>
  );
}
