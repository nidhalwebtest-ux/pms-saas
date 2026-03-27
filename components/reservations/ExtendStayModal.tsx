"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
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
  available: boolean;
  conflict?: {
    reservationNumber: string | null;
    guestFirstName: string;
    guestLastName: string;
    fromDate: string;
  };
  segments?: Segment[];
  extensionSubtotal: number;
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtOMR(v: number) {
  return v.toFixed(3) + " OMR";
}

export default function ExtendStayModal({
  reservationId,
  currentCheckOut,
  rateType,
  onClose,
  onSuccess,
}: Props) {
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
          setPreviewError(data.error ?? "Failed to load preview");
          setPreview(null);
          return;
        }
        setPreview(data as PreviewData);
        // Initialize unit map: all available units are extended by default
        const map = new Map<string, boolean>();
        for (const u of (data as PreviewData).units) {
          map.set(u.unitId, u.available);
        }
        setUnitExtendMap(map);
        // Pre-fill payment amount with balance due
        setPaymentAmount(((data as PreviewData).summary.newBalanceDue).toFixed(3));
      } catch {
        setPreviewError("Network error loading preview");
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    [reservationId],
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
      toast.error("No units selected for extension");
      return;
    }

    const body: Record<string, unknown> = {
      newCheckOutDate: newDate,
      unitExtensions,
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
        toast.error(data.error ?? "Extension failed");
        return;
      }
      toast.success(
        `Stay extended to ${fmtDate(data.newEndDate)}. Additional charges: ${fmtOMR(data.additionalCharges)}`,
      );
      onSuccess();
    } catch {
      toast.error("Network error. Please try again.");
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
          <h2 className="text-lg font-semibold text-white">Extend Stay</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-blue-700 transition-colors text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Current checkout info */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">Current checkout date</p>
            <p className="font-semibold text-gray-900 text-lg">{fmtDate(currentCheckOut)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {rateType === "monthly" ? "Monthly rate" : "Daily rate"} reservation
            </p>
          </div>

          {/* Date picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New checkout date <span className="text-red-500">*</span>
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
                New date must be after {fmtDate(currentCheckOut)}
              </p>
            )}
          </div>

          {/* Loading state */}
          {previewLoading && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-600">Checking availability and pricing…</span>
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
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Unit Availability</h3>
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
                              <span className="text-gray-500 font-normal ml-1">— {u.propertyName}</span>
                            </p>
                            {u.available ? (
                              <p className="text-xs text-green-700 mt-0.5">
                                Available {fmtDate(u.effectiveCheckOut)} → {fmtDate(preview.newCheckOut)}
                              </p>
                            ) : (
                              <p className="text-xs text-red-700 mt-0.5">
                                Conflict with{" "}
                                {u.conflict?.reservationNumber
                                  ? `#${u.conflict.reservationNumber}`
                                  : "another reservation"}{" "}
                                ({u.conflict?.guestFirstName} {u.conflict?.guestLastName})
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
                            <span className="text-xs text-gray-600">Extend</span>
                          </label>
                        )}
                      </div>

                      {/* Pricing segments for available units */}
                      {u.available && u.segments && u.segments.length > 0 && (
                        <div className="mt-3 border-t border-green-200 pt-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left font-medium pb-1">Date Range</th>
                                <th className="text-right font-medium pb-1">Nights</th>
                                <th className="text-right font-medium pb-1">Rate/Night</th>
                                <th className="text-right font-medium pb-1">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {u.segments.map((seg, i) => (
                                <tr key={i} className="text-gray-700">
                                  <td className="py-0.5">
                                    {fmtDate(seg.startDate)} – {fmtDate(seg.endDate)}
                                    {seg.priceName && (
                                      <span className="ml-1 text-orange-600">({seg.priceName})</span>
                                    )}
                                  </td>
                                  <td className="text-right py-0.5">{seg.nights}</td>
                                  <td className="text-right py-0.5">{seg.ratePerNight.toFixed(3)}</td>
                                  <td className="text-right py-0.5 font-medium">
                                    {seg.subtotal.toFixed(3)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex justify-between text-xs font-semibold text-gray-900 pt-2 border-t border-green-200 mt-2">
                            <span>Extension Subtotal</span>
                            <span>{fmtOMR(u.extensionSubtotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning for partial extends */}
              {someUnavailable && someAvailableToExtend && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  Some units are unavailable. The extension will apply only to the available units
                  you have selected.
                </div>
              )}

              {/* Financial summary */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Financial Summary</h3>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Previous Grand Total</span>
                  <span>{fmtOMR(preview.summary.previousGrandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-700">
                  <span>+ Extension Charges</span>
                  <span>+{fmtOMR(preview.summary.extensionTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-2">
                  <span>= New Grand Total</span>
                  <span>{fmtOMR(preview.summary.newGrandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Already Paid</span>
                  <span>−{fmtOMR(preview.summary.previousAmountPaid)}</span>
                </div>
                <div
                  className={`flex justify-between text-sm font-bold border-t border-gray-200 pt-2 ${
                    preview.summary.newBalanceDue > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  <span>= New Balance Due</span>
                  <span>{fmtOMR(preview.summary.newBalanceDue)}</span>
                </div>
              </div>

              {/* Optional payment */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollectPayment((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <span>Collect payment now?</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${collectPayment ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}>
                    {collectPayment ? "Yes" : "No"}
                  </span>
                </button>

                {collectPayment && (
                  <div className="px-4 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Amount (OMR)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder={preview.summary.newBalanceDue.toFixed(3)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        >
                          <option value="CASH">Cash</option>
                          <option value="CARD">Card</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Reference (optional)
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="Receipt #, transaction ID…"
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
                {submitting ? "Confirming Extension…" : "Confirm Extension"}
              </button>
            </div>
          )}

          {/* Empty state before date selection */}
          {!preview && !previewLoading && !previewError && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Select a new checkout date above to see availability and pricing
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
