"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { XMarkIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

interface ReservationUnitInfo {
  id: string;
  unitId: string;
  unitName: string;
  floor: number;
  unitType: string;
  rateAmount: number;
}

interface Props {
  reservationId: string;
  reservationUnits: ReservationUnitInfo[];
  checkOutDate: string; // ISO
  onClose: () => void;
  onSuccess: () => void;
}

interface AvailableUnit {
  id: string;
  name: string;
  floor: number;
  unitType: string;
  propertyName: string;
  propertyId: string;
  rateAmount: number;
  rateSource: string;
  priceName: string | null;
  rateDifference: number;
  segments: Array<{
    startDate: string;
    endDate: string;
    nights: number;
    ratePerNight: number;
    subtotal: number;
    priceName: string | null;
  }>;
  subtotal: number;
}

interface AvailabilityData {
  remainingNights: number;
  periodEnd: string;
  fromUnit: { id: string; name: string; rateAmount: number };
  availableUnits: AvailableUnit[];
}

type PricingOption = "charge_difference" | "complimentary" | "apply_new_rate" | "keep_original_rate";

const REASONS = [
  "Guest Request - Different Floor",
  "Guest Request - Larger Unit",
  "Guest Request - Smaller Unit",
  "Maintenance Issue",
  "AC/Plumbing Problem",
  "Noise Complaint",
  "Management Decision",
  "Complimentary Upgrade",
  "Other",
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtUnitType(t: string) {
  const map: Record<string, string> = {
    STUDIO: "Studio", ONE_BR: "1 BR", TWO_BR: "2 BR", THREE_BR: "3 BR",
    FOUR_BR: "4 BR", SUITE: "Suite", PENTHOUSE: "Penthouse", VILLA: "Villa",
  };
  return map[t] ?? t;
}

function fmtOMR(v: number) {
  return v.toFixed(3) + " OMR";
}

export default function MoveUnitModal({
  reservationId,
  reservationUnits,
  checkOutDate,
  onClose,
  onSuccess,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = (() => {
    const d = new Date(checkOutDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  // Step 1: Select which unit to move
  const [selectedFromUnitId, setSelectedFromUnitId] = useState<string>(
    reservationUnits.length === 1 ? reservationUnits[0].unitId : "",
  );
  const selectedFromUnit = reservationUnits.find((u) => u.unitId === selectedFromUnitId);

  // Step 2: Select move date
  const [moveDate, setMoveDate] = useState(today);

  // Step 3: Available units to move to
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  // Step 4: Selected destination unit
  const [selectedToUnitId, setSelectedToUnitId] = useState<string>("");
  const selectedToUnit = availability?.availableUnits.find((u) => u.id === selectedToUnitId);

  // Step 5: Reason + notes
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Step 6: Pricing option
  const [pricingOption, setPricingOption] = useState<PricingOption>("charge_difference");

  // Custom rate override (OMR/night) — pre-filled with fromUnit rate when availability loads
  const [customRate, setCustomRate] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);

  const fetchAvailability = useCallback(async () => {
    if (!selectedFromUnitId || !moveDate) return;
    setAvailLoading(true);
    setAvailError(null);
    setAvailability(null);
    setSelectedToUnitId("");
    try {
      const res = await fetch(
        `/api/units/available-for-move?reservationId=${reservationId}&fromUnitId=${selectedFromUnitId}&moveDate=${moveDate}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setAvailError(data.error ?? "Failed to load available units");
        return;
      }
      setAvailability(data as AvailabilityData);
      // Pre-fill custom rate with fromUnit's current rate
      setCustomRate((data as AvailabilityData).fromUnit.rateAmount.toFixed(3));
    } catch {
      setAvailError("Network error loading available units");
    } finally {
      setAvailLoading(false);
    }
  }, [reservationId, selectedFromUnitId, moveDate]);

  useEffect(() => {
    if (selectedFromUnitId && moveDate) {
      fetchAvailability();
    }
  }, [fetchAvailability]);

  // Pricing summary
  const fromRateAmount = selectedFromUnit?.rateAmount ?? 0;
  const toRateAmount = selectedToUnit?.rateAmount ?? 0;
  const remainingNights = availability?.remainingNights ?? 0;

  let newSubtotal = 0;
  let originalSubtotal = fromRateAmount * remainingNights;
  let adjustment = 0;

  switch (pricingOption) {
    case "apply_new_rate":
    case "charge_difference":
      newSubtotal = selectedToUnit?.subtotal ?? 0;
      adjustment = newSubtotal - originalSubtotal;
      break;
    case "complimentary":
    case "keep_original_rate":
      newSubtotal = fromRateAmount * remainingNights;
      adjustment = 0;
      break;
  }

  const showNotes = reason === "Maintenance Issue" || reason === "AC/Plumbing Problem" || reason === "Other";

  const canSubmit =
    selectedFromUnitId &&
    selectedToUnitId &&
    moveDate &&
    reason &&
    (!showNotes || notes.trim()) &&
    !submitting;

  async function handleConfirm() {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/move-unit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUnitId: selectedFromUnitId,
          toUnitId: selectedToUnitId,
          moveDate,
          reason,
          notes: notes || undefined,
          pricingOption,
          customRate: customRate && Number(customRate) > 0 ? Number(customRate) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Move failed");
        return;
      }
      toast.success(`Guest moved from ${data.fromUnit} to ${data.toUnit} successfully`);
      onSuccess();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-blue-600 rounded-t-xl">
          <h2 className="text-lg font-semibold text-white">Move Unit</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-blue-700 transition-colors text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Step 1: Select unit to move (only shown if multiple units) */}
          {reservationUnits.length > 1 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Select unit to move <span className="text-red-500">*</span>
              </h3>
              <div className="space-y-2">
                {reservationUnits.map((u) => (
                  <label
                    key={u.unitId}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedFromUnitId === u.unitId
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="fromUnit"
                      value={u.unitId}
                      checked={selectedFromUnitId === u.unitId}
                      onChange={() => setSelectedFromUnitId(u.unitId)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{u.unitName}</p>
                      <p className="text-xs text-gray-500">
                        Floor {u.floor} — {fmtUnitType(u.unitType)} — {u.rateAmount.toFixed(3)} OMR/night
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Auto-selected unit display (single unit case) */}
          {reservationUnits.length === 1 && selectedFromUnit && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 font-medium">Moving unit:</p>
              <p className="font-semibold text-gray-900 text-sm">{selectedFromUnit.unitName}</p>
              <p className="text-xs text-gray-500">
                Floor {selectedFromUnit.floor} — {fmtUnitType(selectedFromUnit.unitType)} — {selectedFromUnit.rateAmount.toFixed(3)} OMR/night
              </p>
            </div>
          )}

          {/* Step 2: Select move date */}
          {selectedFromUnitId && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Move date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={today}
                max={maxDate}
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
              <p className="text-xs text-gray-400 mt-1">
                Guest will move on this date. Today = immediate.
              </p>
            </div>
          )}

          {/* Loading */}
          {availLoading && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">Finding available units…</span>
            </div>
          )}

          {/* Error */}
          {availError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {availError}
            </div>
          )}

          {/* Step 3: Unit grid */}
          {availability && !availLoading && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Available Units ({availability.remainingNights} remaining nights)
              </h3>

              {availability.availableUnits.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
                  No available units found for this period. Try a different date.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availability.availableUnits.map((unit) => {
                    const isSelected = selectedToUnitId === unit.id;
                    const isUpgrade = unit.rateDifference > 0;
                    const isDowngrade = unit.rateDifference < 0;
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        onClick={() => setSelectedToUnitId(unit.id)}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold text-gray-900 text-sm">{unit.name}</p>
                          {isUpgrade && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">
                              ↑ Upgrade
                            </span>
                          )}
                          {isDowngrade && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium shrink-0">
                              ↓ Downgrade
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          Floor {unit.floor} — {fmtUnitType(unit.unitType)} — {unit.propertyName}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700">
                            {unit.rateAmount.toFixed(3)} OMR/night
                          </p>
                          {unit.rateDifference !== 0 && (
                            <p className={`text-xs font-medium ${isUpgrade ? "text-green-700" : "text-orange-700"}`}>
                              {isUpgrade ? "+" : ""}{unit.rateDifference.toFixed(3)}/night
                            </p>
                          )}
                        </div>
                        {unit.priceName && (
                          <p className="text-xs text-orange-600 mt-0.5">{unit.priceName}</p>
                        )}
                        {isSelected && (
                          <p className="text-xs text-blue-700 font-medium mt-2">
                            Subtotal: {fmtOMR(unit.subtotal)} for {availability.remainingNights} nights
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Reason */}
          {selectedToUnitId && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Reason for move <span className="text-red-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="">Select reason…</option>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {showNotes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Provide details about the reason…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 5: Pricing summary + option */}
          {selectedToUnitId && reason && (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-medium text-gray-700">
                    {availability?.fromUnit.name}
                  </p>
                  <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                  <p className="text-sm font-medium text-blue-700">{selectedToUnit?.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                  <div>
                    <p className="text-gray-400">Original rate</p>
                    <p className="font-medium text-gray-900">{fmtOMR(fromRateAmount)}/night</p>
                  </div>
                  <div>
                    <p className="text-gray-400">New rate</p>
                    <p className={`font-medium ${toRateAmount > fromRateAmount ? "text-green-700" : toRateAmount < fromRateAmount ? "text-orange-700" : "text-gray-900"}`}>
                      {fmtOMR(toRateAmount)}/night
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Remaining nights</p>
                    <p className="font-medium text-gray-900">{remainingNights}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Period end</p>
                    <p className="font-medium text-gray-900">
                      {availability?.periodEnd ? fmtDate(availability.periodEnd) : "—"}
                    </p>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Original remaining stay</span>
                    <span>{fmtOMR(originalSubtotal)}</span>
                  </div>
                  {pricingOption !== "complimentary" && pricingOption !== "keep_original_rate" && adjustment !== 0 && (
                    <div className={`flex justify-between ${adjustment > 0 ? "text-red-600" : "text-green-600"}`}>
                      <span>{adjustment > 0 ? "Additional charge" : "Reduction"}</span>
                      <span>{adjustment > 0 ? "+" : ""}{fmtOMR(adjustment)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
                    <span>New remaining subtotal</span>
                    <span>{fmtOMR(newSubtotal)}</span>
                  </div>
                </div>
              </div>

              {/* Custom rate input */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <label className="text-sm text-gray-700 shrink-0 font-medium">
                  Rate for new unit (OMR/night):
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                />
                {customRate && Number(customRate) > 0 && (
                  <span className="text-xs text-blue-700 font-medium">
                    Total: {fmtOMR(Number(customRate) * remainingNights)}
                  </span>
                )}
              </div>

              {/* Pricing options */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Pricing option</h3>
                <div className="space-y-2">
                  {(
                    [
                      {
                        value: "charge_difference" as PricingOption,
                        label: "Charge the difference",
                        desc: `Guest pays the rate difference (${(toRateAmount - fromRateAmount).toFixed(3)} OMR/night × ${remainingNights} nights)`,
                      },
                      {
                        value: "complimentary" as PricingOption,
                        label: "Complimentary upgrade — no charge",
                        desc: "Guest keeps original rate. No additional charges.",
                      },
                      {
                        value: "apply_new_rate" as PricingOption,
                        label: "Apply new unit rate",
                        desc: `Recalculate remaining stay at ${toRateAmount.toFixed(3)} OMR/night`,
                      },
                      {
                        value: "keep_original_rate" as PricingOption,
                        label: "Keep original rate",
                        desc: `Keep ${fromRateAmount.toFixed(3)} OMR/night regardless of new unit price`,
                      },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        pricingOption === opt.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="pricingOption"
                        value={opt.value}
                        checked={pricingOption === opt.value}
                        onChange={() => setPricingOption(opt.value)}
                        className="mt-0.5 h-4 w-4 text-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Confirm */}
              <button
                onClick={handleConfirm}
                disabled={!canSubmit}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? "Processing Move…" : "Confirm Unit Move"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
