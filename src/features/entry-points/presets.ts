import type { EntryPoint } from "@/types";

export interface EntryChannelPreset {
  key: EntryPoint["channel"];
  label: string;
  utmSource?: string;
  utmMedium?: string;
  needsContent?: boolean;
}

export const ENTRY_CHANNEL_PRESETS: readonly EntryChannelPreset[] = [
  { key: "bio", label: "Instagram · Bio", utmSource: "instagram", utmMedium: "organic_social" },
  { key: "story", label: "Instagram · Story", utmSource: "instagram", utmMedium: "organic_social", needsContent: true },
  { key: "instagram_reel", label: "Instagram · Reel", utmSource: "instagram", utmMedium: "organic_social", needsContent: true },
  { key: "tiktok", label: "TikTok", utmSource: "tiktok", utmMedium: "organic_social", needsContent: true },
  { key: "youtube", label: "YouTube", utmSource: "youtube", utmMedium: "organic_video", needsContent: true },
  { key: "linkedin", label: "LinkedIn", utmSource: "linkedin", utmMedium: "organic_social", needsContent: true },
  { key: "ad", label: "Mídia paga", utmMedium: "paid_social", needsContent: true },
  { key: "qr", label: "QR code", utmMedium: "offline" },
  { key: "other", label: "Outro" },
] as const;

export function entryChannelPreset(channel: EntryPoint["channel"]) {
  return ENTRY_CHANNEL_PRESETS.find((preset) => preset.key === channel) ?? ENTRY_CHANNEL_PRESETS.at(-1)!;
}

export function applyEntryChannelPreset(entry: EntryPoint, channel: EntryPoint["channel"]): EntryPoint {
  const preset = entryChannelPreset(channel);
  return {
    ...entry,
    channel,
    utmSource: preset.utmSource,
    utmMedium: preset.utmMedium,
    // Campaign is intentionally never fixed by a preset.
    utmCampaign: entry.utmCampaign,
  };
}
