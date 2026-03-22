"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { resolveClientPrice } from "@/lib/pricing";
import {
  upsertDefaultPrice,
  createSeasonalPrice,
  updateUnitPrice,
  deleteUnitPrice,
  toggleUnitPrice,
} from "@/app/dashboard/units/[unitId]/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnitPrice {
  id:          string;
  priceType:   string;
  name:        string | null;
  dailyRate:   string;
  weeklyRate:  string | null;
  monthlyRate: string;
  startDate:   string | null;
  endDate:     string | null;
  priority:    number;
  isActive:    boolean;
}

interface Props {
  unitId:  string;
  prices:  UnitPrice[];
}

type ModalMode = "default" | "seasonal" | "edit-seasonal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: string | null) {
  if (!v) return "—";
  return `${Number(v).toFixed(3)} OMR`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── 30-Day Price Calendar ─────────────────────────────────────────────────────

function PriceCalendar({ prices }: { prices: UnitPrice[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        30-Day Price Preview
      </h4>
      <div className="grid grid-cols-6 gap-1 sm:grid-cols-10">
        {days.map((day) => {
          const ds = day.toISOString().slice(0, 10);
          const resolved = resolveClientPrice(prices, ds);
          const isDefault  = !resolved || resolved.priceType === "DEFAULT";
          const isSeasonal = resolved?.priceType === "SEASONAL";

          return (
            <div
              key={ds}
              title={`${ds}${resolved ? ` · ${resolved.rate.toFixed(3)} OMR${isSeasonal ? ` (${resolved.name})` : ""}` : " · No price"}`}
              className={`rounded-md p-1 text-center text-[10px] leading-tight cursor-default ${
                isSeasonal
                  ? "bg-violet-100 text-violet-800"
                  : resolved
                  ? "bg-blue-50 text-blue-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <div className="font-semibold">
                {day.getDate()}
              </div>
              <div className="truncate">
                {resolved ? `${resolved.rate.toFixed(1)}` : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-blue-100" /> Default
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-violet-100" /> Seasonal
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-gray-100" /> No price
        </span>
      </div>
    </div>
  );
}

// ── Default Price Card ────────────────────────────────────────────────────────

function DefaultPriceCard({
  price,
  unitId,
  onEdit,
}: {
  price: UnitPrice | undefined;
  unitId: string;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CurrencyDollarIcon className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">Default Price</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            Always active
          </span>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" />
          {price ? "Edit" : "Set price"}
        </button>
      </div>

      {price ? (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[
            { label: "Daily",   val: fmt(price.dailyRate) },
            { label: "Weekly",  val: fmt(price.weeklyRate) },
            { label: "Monthly", val: fmt(price.monthlyRate) },
          ].map(({ label, val }) => (
            <div key={label} className="rounded-lg bg-white px-3 py-2 shadow-sm">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-bold text-gray-900">{val}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-blue-700/70">
          No default price set. Click "Set price" to add one.
        </p>
      )}
    </div>
  );
}

// ── Seasonal Price Row ────────────────────────────────────────────────────────

function SeasonalRow({
  price,
  onEdit,
  onDelete,
  onToggle,
}: {
  price: UnitPrice;
  onEdit:   () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [deletePending, startDelete] = useTransition();
  const [togglePending, startToggle] = useTransition();

  return (
    <div className={`rounded-xl border p-4 transition-opacity ${price.isActive ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-900">{price.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              price.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
            }`}>
              {price.isActive ? "Active" : "Inactive"}
            </span>
            <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
              Priority {price.priority}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarDaysIcon className="h-3.5 w-3.5" />
            {fmtDate(price.startDate)} → {fmtDate(price.endDate)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => startToggle(async () => {
              const res = await toggleUnitPrice(price.id);
              if (res.error) toast.error(res.error);
            })}
            disabled={togglePending}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title={price.isActive ? "Deactivate" : "Activate"}
          >
            {price.isActive
              ? <XCircleIcon className="h-4 w-4" />
              : <CheckCircleIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => startDelete(async () => {
              const res = await deleteUnitPrice(price.id);
              if (res.error) toast.error(res.error);
              else toast.success("Seasonal price deleted.");
            })}
            disabled={deletePending}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "Daily",   val: fmt(price.dailyRate) },
          { label: "Weekly",  val: fmt(price.weeklyRate) },
          { label: "Monthly", val: fmt(price.monthlyRate) },
        ].map(({ label, val }) => (
          <div key={label} className="rounded-lg bg-gray-50 px-2 py-1.5">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-xs font-semibold text-gray-800">{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Price Modal ───────────────────────────────────────────────────────────────

function PriceModal({
  unitId,
  mode,
  editPrice,
  onClose,
}: {
  unitId:     string;
  mode:       ModalMode;
  editPrice?: UnitPrice;
  onClose:    () => void;
}) {
  const isEdit     = mode === "edit-seasonal";
  const isSeasonal = mode === "seasonal" || isEdit;
  const [pending, startTransition] = useTransition();

  const title = mode === "default"
    ? (editPrice ? "Edit Default Price" : "Set Default Price")
    : isEdit
    ? "Edit Seasonal Price"
    : "Add Seasonal Price";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      let res;
      if (mode === "default") {
        res = await upsertDefaultPrice(fd);
      } else if (isEdit && editPrice) {
        res = await updateUnitPrice(fd);
      } else {
        res = await createSeasonalPrice(fd);
      }
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(mode === "default" ? "Default price saved." : isEdit ? "Price updated." : "Seasonal price added.");
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <input type="hidden" name="unitId"  value={unitId} />
          {isEdit && editPrice && (
            <input type="hidden" name="priceId" value={editPrice.id} />
          )}
          {mode === "default" && editPrice && (
            <input type="hidden" name="priceId" value={editPrice.id} />
          )}

          {/* Seasonal-only: name + dates + priority */}
          {isSeasonal && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Season Name *</label>
                <input
                  name="name"
                  defaultValue={editPrice?.name ?? ""}
                  required
                  placeholder="e.g. Khareef 2026"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Start Date *</label>
                  <input
                    type="date"
                    name="startDate"
                    defaultValue={editPrice?.startDate ? editPrice.startDate.slice(0, 10) : ""}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">End Date *</label>
                  <input
                    type="date"
                    name="endDate"
                    defaultValue={editPrice?.endDate ? editPrice.endDate.slice(0, 10) : ""}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Priority</label>
                  <input
                    type="number"
                    name="priority"
                    defaultValue={editPrice?.priority ?? 10}
                    min={1}
                    max={100}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">Higher = wins overlap</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
                  <select
                    name="isActive"
                    defaultValue={editPrice?.isActive === false ? "false" : "true"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Rates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Daily Rate * (OMR)</label>
              <input
                type="number"
                name="dailyRate"
                step="0.001"
                min="0"
                defaultValue={editPrice?.dailyRate ?? ""}
                required
                placeholder="0.000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Weekly (OMR)</label>
              <input
                type="number"
                name="weeklyRate"
                step="0.001"
                min="0"
                defaultValue={editPrice?.weeklyRate ?? ""}
                placeholder="optional"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Monthly * (OMR)</label>
              <input
                type="number"
                name="monthlyRate"
                step="0.001"
                min="0"
                defaultValue={editPrice?.monthlyRate ?? ""}
                required
                placeholder="0.000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UnitPricingSection({ unitId, prices }: Props) {
  const defaultPrice   = prices.find((p) => p.priceType === "DEFAULT");
  const seasonalPrices = prices.filter((p) => p.priceType === "SEASONAL")
    .sort((a, b) => {
      if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
      return 0;
    });

  const [modal, setModal] = useState<{
    open: boolean;
    mode: ModalMode;
    editPrice?: UnitPrice;
  }>({ open: false, mode: "default" });

  function openDefault()              { setModal({ open: true, mode: "default",        editPrice: defaultPrice }); }
  function openAddSeasonal()          { setModal({ open: true, mode: "seasonal",       editPrice: undefined }); }
  function openEditSeasonal(p: UnitPrice) { setModal({ open: true, mode: "edit-seasonal", editPrice: p }); }
  function closeModal()               { setModal((m) => ({ ...m, open: false })); }

  return (
    <div className="space-y-5">
      {/* Default Price */}
      <DefaultPriceCard price={defaultPrice} unitId={unitId} onEdit={openDefault} />

      {/* Seasonal Prices */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Seasonal Prices</h3>
          <button
            onClick={openAddSeasonal}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add Season
          </button>
        </div>

        {seasonalPrices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
            <CalendarDaysIcon className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">No seasonal prices yet.</p>
            <p className="text-xs text-gray-400">Add a season to override the default for specific dates.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {seasonalPrices.map((p) => (
              <SeasonalRow
                key={p.id}
                price={p}
                onEdit={() => openEditSeasonal(p)}
                onDelete={() => {}}
                onToggle={() => {}}
              />
            ))}
          </div>
        )}
      </div>

      {/* 30-Day Calendar */}
      <PriceCalendar prices={prices} />

      {/* Modal */}
      {modal.open && (
        <PriceModal
          unitId={unitId}
          mode={modal.mode}
          editPrice={modal.editPrice}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
