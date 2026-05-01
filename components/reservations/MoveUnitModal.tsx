"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
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
  rateType?: string;
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
  remainingMonths?: number;
  isMonthly?: boolean;
  periodEnd: string;
  fromUnit: { id: string; name: string; rateAmount: number };
  availableUnits: AvailableUnit[];
}

type PricingOption = "charge_difference" | "complimentary" | "apply_new_rate" | "keep_original_rate";

const REASON_KEYS: { value: string; key: string }[] = [
  { value: "Guest Request - Different Floor", key: "guestRequestFloor" },
  { value: "Guest Request - Larger Unit", key: "guestRequestLarger" },
  { value: "Guest Request - Smaller Unit", key: "guestRequestSmaller" },
  { value: "Maintenance Issue", key: "maintenance" },
  { value: "AC/Plumbing Problem", key: "acPlumbing" },
  { value: "Noise Complaint", key: "noise" },
  { value: "Management Decision", key: "management" },
  { value: "Complimentary Upgrade", key: "complimentary" },
  { value: "Other", key: "other" },
];

export default function MoveUnitModal({
  reservationId,
  reservationUnits,
  checkOutDate,
  rateType,
  onClose,
  onSuccess,
}: Props) {
  const t = useTranslations("reservations.moveUnitModal");
  const isMonthlyReservation = rateType === "monthly" || rateType === "MONTHLY";
  const tUnitTypes = useTranslations("reservations.detail.unitTypes");
  const locale = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;

  const fmtDate = (iso: string) =>
    format(new Date(iso), "d MMM yyyy", { locale: dateFnsLocale });

  const fmtUnitType = (type: string) => (tUnitTypes.has(type) ? tUnitTypes(type) : type);

  const fmtOMR = (v: number) => `${v.toFixed(3)} OMR`;

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
        setAvailError(data.error ?? t("errors.loadFailed"));
        return;
      }
      setAvailability(data as AvailabilityData);
      // Pre-fill custom rate with fromUnit's current rate
      setCustomRate((data as AvailabilityData).fromUnit.rateAmount.toFixed(3));
    } catch {
      setAvailError(t("errors.loadNetwork"));
    } finally {
      setAvailLoading(false);
    }
  }, [reservationId, selectedFromUnitId, moveDate, t]);

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
        toast.error(data.error ?? t("errors.moveFailed"));
        return;
      }
      toast.success(t("success.moved", { from: data.fromUnit, to: data.toUnit }));
      onSuccess();
    } catch {
      toast.error(t("errors.network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-blue-600 rounded-t-xl">
          <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
          <button
            onClick={onClose}
            aria-label={t("close")}
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
                {t("selectUnitToMove")} <span className="text-red-500">*</span>
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
                      <p className="text-xs text-gray-500 ltr-numbers">
                        {isMonthlyReservation
                          ? t("unitMetaFullMonthly", { floor: u.floor, type: fmtUnitType(u.unitType), rate: u.rateAmount.toFixed(3) })
                          : t("unitMetaFull",        { floor: u.floor, type: fmtUnitType(u.unitType), rate: u.rateAmount.toFixed(3) })}
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
              <p className="text-xs text-blue-600 font-medium">{t("movingUnit")}</p>
              <p className="font-semibold text-gray-900 text-sm">{selectedFromUnit.unitName}</p>
              <p className="text-xs text-gray-500 ltr-numbers">
                {(isMonthlyReservation ? t("unitMetaFullMonthly", {
                  floor: selectedFromUnit.floor,
                  type: fmtUnitType(selectedFromUnit.unitType),
                  rate: selectedFromUnit.rateAmount.toFixed(3),
                }) : t("unitMetaFull", {
                  floor: selectedFromUnit.floor,
                  type: fmtUnitType(selectedFromUnit.unitType),
                  rate: selectedFromUnit.rateAmount.toFixed(3),
                }))}
              </p>
            </div>
          )}

          {/* Step 2: Select move date */}
          {selectedFromUnitId && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t("moveDate")} <span className="text-red-500">*</span>
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
                {t("moveDateHelp")}
              </p>
            </div>
          )}

          {/* Loading */}
          {availLoading && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">{t("findingUnits")}</span>
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
                {t("availableUnitsHeading", { count: availability.remainingNights })}
              </h3>

              {availability.availableUnits.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
                  {t("noUnitsFound")}
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
                        className={`text-start p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold text-gray-900 text-sm">{unit.name}</p>
                          {isUpgrade && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">
                              {t("upgrade")}
                            </span>
                          )}
                          {isDowngrade && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium shrink-0">
                              {t("downgrade")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2 ltr-numbers">
                          {t("unitMetaShort", {
                            floor: unit.floor,
                            type: fmtUnitType(unit.unitType),
                            property: unit.propertyName,
                          })}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700 ltr-numbers">
                            {isMonthlyReservation
                              ? t("ratePerMonth", { amount: unit.rateAmount.toFixed(3) })
                              : t("ratePerNight", { amount: unit.rateAmount.toFixed(3) })}
                          </p>
                          {unit.rateDifference !== 0 && (
                            <p className={`text-xs font-medium ltr-numbers ${isUpgrade ? "text-green-700" : "text-orange-700"}`}>
                              {(isMonthlyReservation
                                ? t("rateDiffPerMonth", {
                                    amount: `${isUpgrade ? "+" : ""}${unit.rateDifference.toFixed(3)}`,
                                  })
                                : t("rateDiffPerNight", {
                                amount: `${isUpgrade ? "+" : ""}${unit.rateDifference.toFixed(3)}`,
                              }))}
                            </p>
                          )}
                        </div>
                        {unit.priceName && (
                          <p className="text-xs text-orange-600 mt-0.5">{unit.priceName}</p>
                        )}
                        {isSelected && (
                          <p className="text-xs text-blue-700 font-medium mt-2 ltr-numbers">
                            {t("subtotalFor", {
                              amount: fmtOMR(unit.subtotal),
                              count: availability.remainingNights,
                            })}
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
                  {t("reasonLabel")} <span className="text-red-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="">{t("selectReason")}</option>
                  {REASON_KEYS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {t(`reasons.${r.key}`)}
                    </option>
                  ))}
                </select>
              </div>

              {showNotes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("notesLabel")} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("notesPlaceholder")}
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
                  <ArrowRightIcon className="h-4 w-4 text-gray-400 rtl:rotate-180" />
                  <p className="text-sm font-medium text-blue-700">{selectedToUnit?.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                  <div>
                    <p className="text-gray-400">{t("originalRate")}</p>
                    <p className="font-medium text-gray-900 ltr-numbers">
                      {isMonthlyReservation
                        ? t("ratePerMonth", { amount: fromRateAmount.toFixed(3) })
                        : t("ratePerNight", { amount: fromRateAmount.toFixed(3) })}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">{t("newRate")}</p>
                    <p className={`font-medium ltr-numbers ${toRateAmount > fromRateAmount ? "text-green-700" : toRateAmount < fromRateAmount ? "text-orange-700" : "text-gray-900"}`}>
                      {isMonthlyReservation
                        ? t("ratePerMonth", { amount: toRateAmount.toFixed(3) })
                        : t("ratePerNight", { amount: toRateAmount.toFixed(3) })}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">{t("remainingNights")}</p>
                    <p className="font-medium text-gray-900 ltr-numbers">{remainingNights}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">{t("periodEnd")}</p>
                    <p className="font-medium text-gray-900 ltr-numbers">
                      {availability?.periodEnd ? fmtDate(availability.periodEnd) : "—"}
                    </p>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>{t("originalRemainingStay")}</span>
                    <span className="ltr-numbers">{fmtOMR(originalSubtotal)}</span>
                  </div>
                  {pricingOption !== "complimentary" && pricingOption !== "keep_original_rate" && adjustment !== 0 && (
                    <div className={`flex justify-between ${adjustment > 0 ? "text-red-600" : "text-green-600"}`}>
                      <span>{adjustment > 0 ? t("additionalCharge") : t("reduction")}</span>
                      <span className="ltr-numbers">{adjustment > 0 ? "+" : ""}{fmtOMR(adjustment)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
                    <span>{t("newRemainingSubtotal")}</span>
                    <span className="ltr-numbers">{fmtOMR(newSubtotal)}</span>
                  </div>
                </div>
              </div>

              {/* Custom rate input */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <label className="text-sm text-gray-700 shrink-0 font-medium">
                  {isMonthlyReservation ? t("rateForNewUnitMonthly") : t("rateForNewUnit")}
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ltr-numbers"
                />
                {customRate && Number(customRate) > 0 && (
                  <span className="text-xs text-blue-700 font-medium ltr-numbers">
                    {t("total", { amount: fmtOMR(Number(customRate) * remainingNights) })}
                  </span>
                )}
              </div>

              {/* Pricing options */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{t("pricingOption")}</h3>
                <div className="space-y-2">
                  {(
                    [
                      {
                        value: "charge_difference" as PricingOption,
                        label: t("options.chargeDifference.label"),
                        desc: t("options.chargeDifference.desc", {
                          diff: (toRateAmount - fromRateAmount).toFixed(3),
                          nights: remainingNights,
                        }),
                      },
                      {
                        value: "complimentary" as PricingOption,
                        label: t("options.complimentary.label"),
                        desc: t("options.complimentary.desc"),
                      },
                      {
                        value: "apply_new_rate" as PricingOption,
                        label: t("options.applyNewRate.label"),
                        desc: t("options.applyNewRate.desc", { rate: toRateAmount.toFixed(3) }),
                      },
                      {
                        value: "keep_original_rate" as PricingOption,
                        label: t("options.keepOriginalRate.label"),
                        desc: t("options.keepOriginalRate.desc", { rate: fromRateAmount.toFixed(3) }),
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
                {submitting ? t("processing") : t("confirmButton")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
