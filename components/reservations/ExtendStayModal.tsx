"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar as arLocale, enGB as enLocale } from "date-fns/locale";
import { XMarkIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface Props {
  reservationId: string;
  currentCheckOut: string; // ISO date string
  rateType: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Segment {
  startDate: string;
  endDate: string;
  nights: number;
  ratePerNight: number;
  subtotal: number;
  priceName: string | null;
}

interface UnitPreview {
  unitId: string;
  unitName: string;
  propertyName: string;
  effectiveCheckOut: string;
  existingRate: number;
  available: boolean;
  conflict?: {
    reservationNumber: string | null;
    guestFirstName: string;
    guestLastName: string;
    fromDate: string;
  };
  segments?: Segment[];
  extensionSubtotal: number;
  extensionNights: number;
}

interface PreviewData {
  reservationId: string;
  currentCheckOut: string;
  newCheckOut: string;
  units: UnitPreview[];
  summary: {
    allAvailable: boolean;
    someAvailable: boolean;
    extensionTotal: number;
    previousGrandTotal: number;
    previousAmountPaid: number;
    newGrandTotal: number;
    newBalanceDue: number;
  };
}

export default function ExtendStayModal({
  reservationId,
  currentCheckOut,
  rateType,
  onClose,
  onSuccess,
}: Props) {
  const t = useTranslations("reservations.extendStayModal");
  const tMethods = useTranslations("payments.methods");
  const locale = useLocale();
  const dateFnsLocale = locale === "ar" ? arLocale : enLocale;

  const fmtDate = (iso: string) =>
    format(new Date(iso), "d MMM yyyy", { locale: dateFnsLocale });

  const fmtOMR = (v: number) => `${v.toFixed(3)} OMR`;

  const minDate = (() => {
    const d = new Date(currentCheckOut);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const [newDate, setNewDate] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Unit extension overrides (for partial extends)
  const [unitExtendMap, setUnitExtendMap] = useState<Map<string, boolean>>(new Map());

  // Custom rate per unit (OMR/night) — pre-filled from existingRate, user-editable
  const [customRates, setCustomRates] = useState<Record<string, string>>({});

  // Payment
  const [collectPayment, setCollectPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentReference, setPaymentReference] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPreview = useCallback(
    async (date: string) => {
      if (!date) return;
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await fetch(
          `/api/reservations/${reservationId}/extend-preview?newCheckOutDate=${date}`,
        );
        const data = await res.json();
        if (!res.ok) {
          setPreviewError(data.error ?? t("errors.previewFailed"));
          setPreview(null);
          return;
        }
        setPreview(data as PreviewData);
        // Initialize unit map: all available units are extended by default
        const map = new Map<string, boolean>();
        const rates: Record<string, string> = {};
        for (const u of (data as PreviewData).units) {
          map.set(u.unitId, u.available);
          // Pre-fill custom rate with the existing reservation rate
          rates[u.unitId] = u.existingRate.toFixed(3);
        }
        setUnitExtendMap(map);
        setCustomRates(rates);
        // Pre-fill payment amount with balance due
        setPaymentAmount(((data as PreviewData).summary.newBalanceDue).toFixed(3));
      } catch {
        setPreviewError(t("errors.previewNetwork"));
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [reservationId, t],
  );

  useEffect(() => {
    if (!newDate) {
      setPreview(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview(newDate);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [newDate, fetchPreview]);

  async function handleConfirm() {
    if (!preview || !newDate) return;

    const unitExtensions = preview.units.map((u) => ({
      unitId: u.unitId,
      extend: unitExtendMap.get(u.unitId) ?? u.available,
    }));

    const extendingAny = unitExtensions.some((ue) => ue.extend);
    if (!extendingAny) {
      toast.error(t("errors.noUnits"));
      return;
    }

    // Build customRates map (only for units being extended, only if changed from default)
    const ratesPayload: Record<string, number> = {};
    for (const ue of unitExtensions) {
      if (!ue.extend) continue;
      const v = Number(customRates[ue.unitId]);
      if (v > 0) ratesPayload[ue.unitId] = v;
    }

    const body: Record<string, unknown> = {
      newCheckOutDate: newDate,
      unitExtensions,
      customRates: ratesPayload,
    };

    if (collectPayment && paymentAmount && Number(paymentAmount) > 0) {
      body.payment = {
        amount: Number(paymentAmount),
        method: paymentMethod,
        reference: paymentReference || null,
      };
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t("errors.extensionFailed"));
        return;
      }
      toast.success(
        t("success.extended", {
          date: fmtDate(data.newEndDate),
          amount: fmtOMR(data.additionalCharges),
        }),
      );
      onSuccess();
    } catch {
      toast.error(t("errors.network"));
    } finally {
      setSubmitting(false);
    }
  }

  const someUnavailable = preview ? preview.units.some((u) => !u.available) : false;
  const someAvailableToExtend = preview
    ? preview.units.some((u) => u.available && (unitExtendMap.get(u.unitId) ?? true))
    : false;

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
          {/* Current checkout info */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">{t("currentCheckoutDate")}</p>
            <p className="font-semibold text-gray-900 text-lg ltr-numbers">{fmtDate(currentCheckOut)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {t("rateTypeSuffix", {
                rate: rateType === "monthly" ? t("monthlyRate") : t("dailyRate"),
              })}
            </p>
          </div>

          {/* Date picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("newCheckoutDate")} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              min={minDate}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            />
            {newDate && newDate <= currentCheckOut.slice(0, 10) && (
              <p className="text-xs text-red-600 mt-1">
                {t("newDateMustBeAfter", { date: fmtDate(currentCheckOut) })}
              </p>
            )}
          </div>

          {/* Loading state */}
          {previewLoading && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">{t("checkingAvailability")}</span>
            </div>
          )}

          {/* Error */}
          {previewError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {previewError}
            </div>
          )}

          {/* Preview results */}
          {preview && !previewLoading && (
            <div className="space-y-4">
              {/* Per-unit availability */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("unitAvailability")}</h3>
                <div className="space-y-3">
                  {preview.units.map((u) => (
                    <div
                      key={u.unitId}
                      className={`rounded-xl border p-4 ${
                        u.available
                          ? "border-green-200 bg-green-50"
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          {u.available ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {u.unitName}
                              <span className="text-gray-500 font-normal ms-1">— {u.propertyName}</span>
                            </p>
                            {u.available ? (
                              <p className="text-xs text-green-700 mt-0.5">
                                {t("availableRange", {
                                  from: fmtDate(u.effectiveCheckOut),
                                  to: fmtDate(preview.newCheckOut),
                                })}
                              </p>
                            ) : (
                              <p className="text-xs text-red-700 mt-0.5">
                                {t("conflictWith", {
                                  other: u.conflict?.reservationNumber
                                    ? `#${u.conflict.reservationNumber}`
                                    : t("anotherReservation"),
                                  name: `${u.conflict?.guestFirstName ?? ""} ${u.conflict?.guestLastName ?? ""}`.trim(),
                                })}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Toggle for available units */}
                        {u.available && someUnavailable && (
                          <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={unitExtendMap.get(u.unitId) ?? true}
                              onChange={(e) => {
                                const map = new Map(unitExtendMap);
                                map.set(u.unitId, e.target.checked);
                                setUnitExtendMap(map);
                              }}
                              className="h-4 w-4 rounded text-blue-600"
                            />
                            <span className="text-xs text-gray-600">{t("extend")}</span>
                          </label>
                        )}
                      </div>

                      {/* Pricing segments for available units */}
                      {u.available && u.segments && u.segments.length > 0 && (
                        <div className="mt-3 border-t border-green-200 pt-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-start font-medium pb-1">{t("tableHeaders.dateRange")}</th>
                                <th className="text-end font-medium pb-1">{t("tableHeaders.nights")}</th>
                                <th className="text-end font-medium pb-1">{t("tableHeaders.rateNight")}</th>
                                <th className="text-end font-medium pb-1">{t("tableHeaders.subtotal")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {u.segments.map((seg, i) => (
                                <tr key={i} className="text-gray-700">
                                  <td className="py-0.5 ltr-numbers">
                                    {fmtDate(seg.startDate)} – {fmtDate(seg.endDate)}
                                    {seg.priceName && (
                                      <span className="ms-1 text-orange-600">({seg.priceName})</span>
                                    )}
                                  </td>
                                  <td className="text-end py-0.5 ltr-numbers">{seg.nights}</td>
                                  <td className="text-end py-0.5 ltr-numbers">{seg.ratePerNight.toFixed(3)}</td>
                                  <td className="text-end py-0.5 font-medium ltr-numbers">
                                    {seg.subtotal.toFixed(3)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex justify-between text-xs font-semibold text-gray-900 pt-2 border-t border-green-200 mt-2">
                            <span>{t("extensionSubtotal")}</span>
                            <span className="ltr-numbers">{fmtOMR(u.extensionSubtotal)}</span>
                          </div>
                        </div>
                      )}

                      {/* Custom rate override */}
                      {u.available && (
                        <div className="mt-3 border-t border-green-200 pt-3 flex items-center gap-3">
                          <label className="text-xs text-gray-600 shrink-0">
                            {t("overrideRate")}
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={customRates[u.unitId] ?? u.existingRate.toFixed(3)}
                            onChange={(e) =>
                              setCustomRates((prev) => ({ ...prev, [u.unitId]: e.target.value }))
                            }
                            className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ltr-numbers"
                          />
                          {customRates[u.unitId] && Number(customRates[u.unitId]) !== u.existingRate && (
                            <span className="text-xs text-blue-600 font-medium ltr-numbers">
                              → {fmtOMR(Number(customRates[u.unitId]) * u.extensionNights)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning for partial extends */}
              {someUnavailable && someAvailableToExtend && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  {t("partialExtendWarning")}
                </div>
              )}

              {/* Financial summary */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("financialSummary")}</h3>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{t("previousGrandTotal")}</span>
                  <span className="ltr-numbers">{fmtOMR(preview.summary.previousGrandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-700">
                  <span>{t("extensionCharges")}</span>
                  <span className="ltr-numbers">+{fmtOMR(preview.summary.extensionTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-2">
                  <span>{t("newGrandTotal")}</span>
                  <span className="ltr-numbers">{fmtOMR(preview.summary.newGrandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{t("alreadyPaid")}</span>
                  <span className="ltr-numbers">−{fmtOMR(preview.summary.previousAmountPaid)}</span>
                </div>
                <div
                  className={`flex justify-between text-sm font-bold border-t border-gray-200 pt-2 ${
                    preview.summary.newBalanceDue > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  <span>{t("newBalanceDue")}</span>
                  <span className="ltr-numbers">{fmtOMR(preview.summary.newBalanceDue)}</span>
                </div>
              </div>

              {/* Optional payment */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollectPayment((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors text-start"
                >
                  <span>{t("collectPayment")}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${collectPayment ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
                    {collectPayment ? t("yes") : t("no")}
                  </span>
                </button>

                {collectPayment && (
                  <div className="px-4 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {t("amountLabel")}
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder={preview.summary.newBalanceDue.toFixed(3)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 ltr-numbers"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {t("methodLabel")}
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        >
                          <option value="CASH">{tMethods("CASH")}</option>
                          <option value="CARD">{tMethods("CARD")}</option>
                          <option value="BANK_TRANSFER">{tMethods("BANK_TRANSFER")}</option>
                          <option value="CHEQUE">{tMethods("CHEQUE")}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {t("referenceLabel")}
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder={t("referencePlaceholder")}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm button */}
              <button
                onClick={handleConfirm}
                disabled={submitting || !someAvailableToExtend}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {submitting ? t("confirming") : t("confirmButton")}
              </button>
            </div>
          )}

          {/* Empty state before date selection */}
          {!preview && !previewLoading && !previewError && (
            <div className="text-center py-8 text-gray-400 text-sm">
              {t("emptyState")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
