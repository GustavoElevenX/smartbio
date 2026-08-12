"use client";

import { useState } from "react";
import { LocateFixed, LoaderCircle } from "lucide-react";

export function NearestLocationButton({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  async function locate() {
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch("/api/public/routing/nearest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, latitude: coords.latitude, longitude: coords.longitude, fulfillment: "in_person" }) });
        const payload = await response.json() as { data?: { destination?: { value?: string }; location?: { externalUrl?: string } } };
        const target = payload.data?.location?.externalUrl || payload.data?.destination?.value;
        if (!response.ok || !target) throw new Error();
        window.open(target.startsWith("http") ? target : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`, "_blank", "noopener,noreferrer");
        setStatus("idle");
      } catch { setStatus("error"); }
    }, () => setStatus("error"), { enableHighAccuracy: false, timeout: 8000 });
  }
  return <div><button type="button" onClick={locate} disabled={status === "loading"} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm font-extrabold"><>{status === "loading" ? <LoaderCircle className="animate-spin" size={17} /> : <LocateFixed size={17} />}</>Encontrar mais próxima</button>{status === "error" ? <p role="alert" className="mt-2 text-xs text-red-700">Não foi possível usar sua localização. Confira a permissão do navegador.</p> : null}</div>;
}
