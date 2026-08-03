import type { BrandPalette } from "@/types";

export function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((x) => x + x).join("") : value;
  const number = Number.parseInt(normalized, 16);
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export function readableForeground(background: string) {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#101114") ? "#FFFFFF" : "#101114";
}

export function mix(a: string, b: string, amount: number) {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  return rgbToHex(
    left.r + (right.r - left.r) * amount,
    left.g + (right.g - left.g) * amount,
    left.b + (right.b - left.b) * amount,
  );
}

export function saturation(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

export function buildPalette(colors: string[], mode: "faithful" | "balanced" | "bold" = "balanced"): BrandPalette {
  const source = colors.length ? colors : ["#6D5EF5", "#FF725E", "#19B88B"];
  const primary = source[0];
  const secondary = source[1] || mix(primary, "#FFFFFF", 0.28);
  const accent = source[2] || mix(primary, "#FFB020", 0.48);
  const isDark = mode === "bold" && luminance(primary) < 0.45;
  const background = isDark ? mix(primary, "#090A0E", 0.86) : mode === "faithful" ? mix(primary, "#FFFFFF", 0.94) : "#F7F7FA";
  const foreground = isDark ? "#F8F8FB" : "#17171C";
  const surface = isDark ? mix(primary, "#11131A", 0.8) : "#FFFFFF";
  return {
    sourceColors: source.slice(0, 6),
    primary,
    primaryForeground: readableForeground(primary),
    secondary,
    secondaryForeground: readableForeground(secondary),
    accent,
    accentForeground: readableForeground(accent),
    background,
    surface,
    surfaceElevated: isDark ? mix(surface, "#FFFFFF", 0.07) : "#FFFFFF",
    foreground,
    muted: isDark ? mix(surface, "#FFFFFF", 0.12) : mix(primary, "#FFFFFF", 0.9),
    mutedForeground: isDark ? "#A9A9B2" : "#676771",
    border: isDark ? mix(surface, "#FFFFFF", 0.16) : mix(primary, "#FFFFFF", 0.78),
    success: "#179C6B",
    warning: "#E59A18",
    destructive: "#D94B4B",
    gradientStart: primary,
    gradientEnd: mode === "bold" ? accent : secondary,
  };
}

export function ensureAccessiblePalette(palette: BrandPalette): BrandPalette {
  return {
    ...palette,
    primaryForeground: readableForeground(palette.primary),
    secondaryForeground: readableForeground(palette.secondary),
    accentForeground: readableForeground(palette.accent),
  };
}
