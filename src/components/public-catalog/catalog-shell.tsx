"use client";

import { useEffect, useState } from "react";
import { CatalogCategoryFilter } from "./catalog-category-filter";
import { CatalogEmptyState } from "./catalog-empty-state";
import { CatalogGrid } from "./catalog-grid";
import { CatalogSearch } from "./catalog-search";
import type { PublicCatalogItem, PublicCatalogPage } from "./catalog.types";
import { ProductDetail } from "./product-detail";
import { StickyCart } from "./sticky-cart";
import { useConversionLauncher } from "@/components/public-presence/conversion-launcher";

export function PublicCatalogShell({ projectId, pageId, sectionId, goalId }: { projectId: string; pageId: string; sectionId: string; goalId?: string }) {
  const launcher = useConversionLauncher();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [data, setData] = useState<PublicCatalogPage>();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PublicCatalogItem>();
  const [choiceCount, setChoiceCount] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const search = new URLSearchParams({ limit: "24" });
      if (query) search.set("q", query);
      if (category) search.set("categoryId", category);
      const response = await fetch(`/api/public/catalog/${encodeURIComponent(projectId)}?${search}`, { signal: controller.signal });
      const payload = await response.json() as { data?: PublicCatalogPage };
      if (response.ok) setData(payload.data);
      setLoading(false);
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [category, projectId, query]);
  async function loadMore() {
    if (!data?.pageInfo.nextCursor) return;
    const search = new URLSearchParams({ limit: "24", cursor: data.pageInfo.nextCursor });
    if (query) search.set("q", query);
    if (category) search.set("categoryId", category);
    const response = await fetch(`/api/public/catalog/${encodeURIComponent(projectId)}?${search}`);
    const payload = await response.json() as { data?: PublicCatalogPage };
    if (payload.data) setData({ ...payload.data, items: [...data.items, ...payload.data.items] });
  }
  function choose(item: PublicCatalogItem) { setChoiceCount((count) => count + 1); setSelected(undefined); launcher.open({ pageId, sectionId, goalId, catalogItemId: item.id }); }
  return <section aria-label="Catálogo" className="mx-auto max-w-7xl px-5 py-10 md:px-8"><div className="mb-6 flex flex-col gap-4"><CatalogSearch value={query} onChange={setQuery} /><CatalogCategoryFilter categories={data?.categories || []} value={category} onChange={setCategory} /></div>{loading && !data ? <div role="status" className="grid min-h-72 place-items-center text-sm text-black/55">Carregando catálogo…</div> : data?.items.length ? <><CatalogGrid items={data.items} onOpen={setSelected} onChoose={choose} />{data.pageInfo.hasMore ? <div className="mt-8 text-center"><button type="button" onClick={loadMore} className="min-h-12 rounded-2xl border border-black/15 bg-white px-6 font-bold">Carregar mais</button></div> : null}</> : <CatalogEmptyState />}{selected ? <ProductDetail item={selected} onClose={() => setSelected(undefined)} onChoose={() => choose(selected)} /> : null}<StickyCart count={choiceCount} onOpen={() => undefined} /></section>;
}
