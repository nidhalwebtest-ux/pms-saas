"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPinIcon, ArrowTopRightOnSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui";
import { updateLocation } from "../actions";

// Leaflet touches `window`, so load it browser-only.
const LeafletPicker = dynamic(() => import("./LeafletPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] w-full items-center justify-center rounded-lg bg-subtle text-sm text-fg-tertiary">
      Loading map…
    </div>
  ),
});

export default function LocationCard({
  prospectId,
  latitude,
  longitude,
}: {
  prospectId: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null,
  );
  const [pending, startTransition] = useTransition();

  const persist = (lat: number | null, lng: number | null) =>
    startTransition(async () => {
      const res = await updateLocation(prospectId, lat, lng);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  const pick = (lat: number, lng: number) => {
    const r = (n: number) => Math.round(n * 1e6) / 1e6; // ~0.1m precision
    setCoords({ lat: r(lat), lng: r(lng) });
    persist(r(lat), r(lng));
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation isn't available on this device");
      return;
    }
    toast.loading("Getting your location…", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss("geo");
        pick(pos.coords.latitude, pos.coords.longitude);
        toast.success("Location captured");
      },
      (err) => {
        toast.dismiss("geo");
        toast.error(err.message || "Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const clear = () => {
    setCoords(null);
    persist(null, null);
    toast.success("Location cleared");
  };

  const gmaps = coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}` : null;

  return (
    <div className="rounded-2xl border border-border-default bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Location</h3>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<MapPinIcon className="h-4 w-4" />}
          onClick={useMyLocation}
          loading={pending}
        >
          Use my location
        </Button>
      </div>

      <LeafletPicker lat={coords?.lat ?? null} lng={coords?.lng ?? null} onPick={pick} />

      <p className="mt-2 text-xs text-fg-tertiary">
        Tap the map to drop a pin, or drag it to fine-tune. Use “Use my location” when you’re
        standing at the building.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {coords ? (
          <span className="font-mono text-xs text-fg-secondary" dir="ltr">
            {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </span>
        ) : (
          <span className="text-xs text-fg-tertiary">No location saved yet</span>
        )}
        <div className="flex items-center gap-3">
          {gmaps && (
            <a
              href={gmaps}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" /> Open in Google Maps
            </a>
          )}
          {coords && (
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs font-medium text-error-600 hover:text-error-700 disabled:opacity-50"
            >
              <TrashIcon className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
