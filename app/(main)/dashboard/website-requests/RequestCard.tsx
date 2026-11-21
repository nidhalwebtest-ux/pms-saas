"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckIcon, XMarkIcon, ExclamationTriangleIcon, CalendarDaysIcon,
  UserGroupIcon, HomeModernIcon, PhoneIcon,
} from "@heroicons/react/24/outline";
import { Badge, Button, type BadgeTone } from "@/components/ui";
import { formatMoney, waNumber, nightsBetween } from "@/lib/public-site/format";
import { confirmWebsiteRequest, rejectWebsiteRequest, type ConfirmResult } from "./actions";

export type RequestVM = {
  id: string;
  status: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  guests: number;
  checkIn: string;
  checkOut: string;
  notes: string | null;
  quotedTotal: number;
  reservationId: string | null;
  unitName: string;
  buildingName: string;
  createdAt: string;
};

const TONE: Record<string, BadgeTone> = { PENDING: "warning", CONFIRMED: "success", REJECTED: "neutral", EXPIRED: "neutral" };

export default function RequestCard({ req, currency }: { req: RequestVM; currency: string }) {
  const t = useTranslations("websiteRequests");
  const [status, setStatus] = useState(req.status);
  const [reservationId, setReservationId] = useState(req.reservationId);
  const [conflict, setConflict] = useState<Extract<ConfirmResult, { ok: false }> | null>(null);
  const [pending, start] = useTransition();

  const nights = nightsBetween(req.checkIn, req.checkOut);
  const wa = waNumber(req.guestPhone);
  const waMsg =
    `${t("wa.greeting", { name: req.guestName })}\n` +
    `${req.unitName} · ${req.checkIn} → ${req.checkOut} · ${req.guests} ${t("guestsWord")}`;

  const confirm = () =>
    start(async () => {
      setConflict(null);
      const res = await confirmWebsiteRequest(req.id);
      if (res.ok) {
        setStatus("CONFIRMED"); setReservationId(res.reservationId);
        toast.success(t("confirmedToast", { num: res.reservationNumber ?? "" }));
      } else if (res.error === "conflict") {
        setConflict(res); toast.error(t("conflictToast"));
      } else {
        toast.error(t("errorToast"));
      }
    });

  const reject = () =>
    start(async () => {
      const res = await rejectWebsiteRequest(req.id);
      if (res.ok) { setStatus("REJECTED"); toast(t("rejectedToast")); }
      else toast.error(t("errorToast"));
    });

  const Row = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="inline-flex items-center gap-1.5 text-sm text-gray-600">{icon}{children}</div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">{req.guestName}</h3>
          <a href={`tel:${req.guestPhone}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700" dir="ltr">
            <PhoneIcon className="h-3.5 w-3.5" /> {req.guestPhone}
          </a>
        </div>
        <Badge tone={TONE[status] ?? "neutral"} appearance="subtle">{t(`status.${status}`)}</Badge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Row icon={<HomeModernIcon className="h-4 w-4 text-gray-400" />}>{req.unitName} · {req.buildingName}</Row>
        <Row icon={<CalendarDaysIcon className="h-4 w-4 text-gray-400" />}>{req.checkIn} → {req.checkOut} ({nights} {t("nightsWord")})</Row>
        <Row icon={<UserGroupIcon className="h-4 w-4 text-gray-400" />}>{req.guests} {t("guestsWord")}</Row>
        <div className="text-sm font-semibold text-gray-900">{formatMoney(req.quotedTotal, currency, "en")}</div>
      </div>

      {req.notes && <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">“{req.notes}”</p>}

      {/* Conflict + alternatives */}
      {conflict && conflict.error === "conflict" && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <ExclamationTriangleIcon className="h-4 w-4" /> {t("conflictTitle")}
          </p>
          {conflict.conflict && (
            <p className="mt-1 text-xs text-amber-700">
              {t("conflictBy", { guest: conflict.conflict.guestName, ref: conflict.conflict.reservationNumber ?? "—" })}
            </p>
          )}
          {conflict.alternatives && conflict.alternatives.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              {t("alternatives")}: {conflict.alternatives.map((a) => a.name).join("، ")}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        {status === "PENDING" && (
          <>
            <Button variant="primary" size="sm" loading={pending} onClick={confirm} leftIcon={<CheckIcon className="h-4 w-4" />}>
              {t("confirm")}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={reject} leftIcon={<XMarkIcon className="h-4 w-4" />}>
              {t("reject")}
            </Button>
          </>
        )}
        {status === "CONFIRMED" && reservationId && (
          <Link href={`/dashboard/reservations/${reservationId}`} className="text-sm font-semibold text-blue-600 hover:underline">
            {t("viewReservation")} →
          </Link>
        )}
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(waMsg)}`}
            target="_blank" rel="noreferrer"
            className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 2a10 10 0 00-8.6 15l-1.4 5 5.1-1.3A10 10 0 1012 2z" /></svg>
            {t("whatsapp")}
          </a>
        )}
      </div>
    </div>
  );
}
