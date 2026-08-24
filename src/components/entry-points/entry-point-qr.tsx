"use client";

import { Download } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

const filename = (name: string) => `qr-${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.svg`;

export function EntryPointQr({ url, name }: { url: string; name: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    void QRCode.toString(url, { type: "svg", width: 220, margin: 2, color: { dark: "#07172f", light: "#ffffff" }, errorCorrectionLevel: "M" }).then((svg) => {
      if (active) setSource(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    });
    return () => { active = false; };
  }, [url]);
  return <div className="border border-[#dfe5eb] bg-white p-4 text-center [clip-path:polygon(0_0,calc(100%-12px)_0,100%_12px,100%_100%,0_100%)]">{source ? <img src={source} alt={`QR code para ${name}`} width={160} height={160} className="mx-auto size-40" /> : <div className="mx-auto size-40 animate-pulse bg-[#edf0f3]" aria-label="Gerando QR code" />}<a href={source || undefined} download={filename(name)} aria-disabled={!source} className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-bold text-[#0054fc]"><Download size={14} /> Baixar QR em SVG</a><p className="mt-1 text-[11px] text-[#667487]">Gerado neste dispositivo. A URL não é enviada a terceiros.</p></div>;
}
