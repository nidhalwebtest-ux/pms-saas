"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Salalah city center — sensible default when a prospect has no pin yet.
const SALALAH: [number, number] = [17.0194, 54.0897];

// Brand-coloured teardrop pin (divIcon → no external marker-image requests,
// which also sidesteps Leaflet's classic bundler icon-path problem).
const pinIcon = L.divIcon({
  className: "crm-map-pin",
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#185FA5" stroke="#ffffff" stroke-width="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#ffffff"/></svg>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Recenters the map when the coordinates change from outside (e.g. GPS). */
function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], Math.max(15, map.getZoom()));
    }
  }, [lat, lng, map]);
  return null;
}

export default function LeafletPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const hasPin = lat != null && lng != null;
  const center: [number, number] = hasPin ? [lat, lng] : SALALAH;

  return (
    <MapContainer
      center={center}
      zoom={hasPin ? 15 : 12}
      scrollWheelZoom
      style={{ height: "260px", width: "100%" }}
      className="z-0 rounded-lg"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ClickToPlace onPick={onPick} />
      <Recenter lat={lat} lng={lng} />
      {hasPin && (
        <Marker
          position={[lat, lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const m = (e.target as L.Marker).getLatLng();
              onPick(m.lat, m.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
