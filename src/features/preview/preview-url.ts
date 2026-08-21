export function experiencePreviewUrl(slug: string, previewAs: string) {
  const path = `/${encodeURIComponent(slug)}/preview`;
  const separatorIndex = previewAs.indexOf(":");
  if (separatorIndex < 1) return path;

  const kind = previewAs.slice(0, separatorIndex);
  const value = previewAs.slice(separatorIndex + 1);
  if (!value || (kind !== "entry" && kind !== "goal")) return path;

  const search = new URLSearchParams({ [kind]: value });
  return `${path}?${search.toString()}`;
}
