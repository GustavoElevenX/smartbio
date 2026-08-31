import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const primaryLogo = "/brand/sobe-symbol.png";

type BrandProps = {
  tone?: "light" | "dark";
  compact?: boolean;
  size?: "sm" | "md";
  className?: string;
  preload?: boolean;
  asLink?: boolean;
};

export const sobePrimaryLogo = primaryLogo;

export function Brand({ tone, compact = false, size = "md", className, preload = false, asLink = true }: BrandProps) {
  const brand = (
    <span className={cn("brand", tone && `brand--${tone}`, compact && "brand--compact", size === "sm" && "brand--sm", !asLink && className)} aria-label="SOBE">
      <span className="brand__asset" aria-hidden="true">
        <Image
          className="brand__art"
          src={primaryLogo}
          alt=""
          width={1254}
          height={1254}
          sizes={compact ? "64px" : size === "sm" ? "28px" : "(max-width: 760px) 38px, 44px"}
          preload={preload}
          quality={90}
        />
      </span>
      {!compact && <span className="brand__name">SOBE</span>}
    </span>
  );

  if (!asLink) return brand;
  return <Link href="/" className={cn("focus-ring inline-flex rounded-lg", className)} aria-label="Sobe, início">{brand}</Link>;
}
