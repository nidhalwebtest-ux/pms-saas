"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { tierLabel } from "./_lib/crm-options";

export type MapProspect = {
  id: string;
  businessName: string;
  latitude: number;
  longitude: number;
  areaLabel: string;
  areaColor: string | null;
  tier: number;
  stage: string;
};

// Salalah city center — fallback when no prospects are pinned.
const SALALAH: [number, number] = [17.0194, 54.0897];
const DEFAULT_COLOR = "#185FA5";

/** Colored teardrop divIcon (no external image requests). */
function pinIcon(color: string) {
  return L.divIcon({
    className: "crm-map-pin",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#ffffff"/></svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(points, { padding: [36, 36] });
  }, [map, points]);
  return null;
}

export default function ProspectsMap({ prospects }: { prospects: MapProspect[] }) {
  const t = useTranslations("admin");
  const points = useMemo<[number, number][]>(
    () => prospects.map((p) => [p.latitude, p.longitude]),
    [prospects],
  );
  const center = points[0] ?? SALALAH;

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      style={{ height: "380px", width: "100%" }}
      className="z-0 rounded-xl"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FitBounds points={points} />
      {prospects.map((p) => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={pinIcon(p.areaColor ?? DEFAULT_COLOR)}>
          <Popup>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-fg">{p.businessName}</p>
              <p className="text-xs text-fg-tertiary">
                {p.areaLabel} · {tierLabel(p.tier)} · {t(`enums.stage.${p.stage}`)}
              </p>
              <Link href={`/admin/prospects/${p.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                {t("map.openProfile")}
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
