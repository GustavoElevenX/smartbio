"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, ImagePlus, Loader2, RefreshCcw, Sparkles, WandSparkles } from "lucide-react";
import type { DesignKit, VisualSpec, VisualTarget } from "@/features/visual-engine/schema";

interface Artwork { id: string; group_id: string; spec_json: VisualSpec; version: number; status: string; output_asset_id: string | null; updated_at: string }
interface Media { id: string; url?: string; originalName: string }
interface Page { id: string; name: string; hasHero: boolean }
interface StudioData { kit: DesignKit; artworks: Artwork[]; media: Media[]; pages: Page[] }
const targets: { id: VisualTarget; label: string }[] = [
  { id: "hero", label: "Destaque do site" }, { id: "offer", label: "Oferta" }, { id: "card", label: "Card vertical" },
  { id: "social", label: "Post quadrado" }, { id: "story", label: "Story" }, { id: "og", label: "Prévia de link" },
];
const layouts: VisualSpec["layout"][] = ["full_bleed", "editorial", "product_hero", "minimal_premium", "promotional", "lifestyle"];
const inputClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Não foi possível concluir a ação.");
  return body.data as T;
}

export function VisualStudio({ projectId }: { projectId: string }) {
  const base = `/api/projects/${projectId}/visuals`;
  const [data, setData] = useState<StudioData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<VisualTarget>("card");
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [subheading, setSubheading] = useState("");
  const [cta, setCta] = useState("");
  const [price, setPrice] = useState("");
  const [imageAssetId, setImageAssetId] = useState("");
  const [edit, setEdit] = useState<VisualSpec | null>(null);
  const [kitEdit, setKitEdit] = useState<DesignKit | null>(null);
  const [pageId, setPageId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const result = await requestJson<StudioData>(base);
    setData(result); setKitEdit(result.kit);
    return result;
  }, [base]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  const art = data?.artworks.find(item => item.id === selected) || null;
  useEffect(() => { setEdit(art?.spec_json || null); }, [art?.spec_json]);
  async function run(label: string, task: () => Promise<void>) {
    setBusy(label); setError(""); setNotice("");
    try { await task(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Ocorreu um erro."); }
    finally { setBusy(""); }
  }
  async function create() {
    await run("create", async () => {
      const rows = await requestJson<Artwork[]>(base, { method: "POST", body: JSON.stringify({ target, subject: subject || undefined, headline: headline || undefined, subheading: subheading || undefined, cta: cta || undefined, price: price || undefined, imageAssetId: imageAssetId || null }) });
      const result = await load(); setSelected(rows[0].id);
      setNotice(`${rows.length} alternativas criadas. Escolha uma e ajuste o texto se precisar.`);
      if (!result.artworks.some(item => item.id === rows[0].id)) setError("As artes foram salvas, mas não apareceram na lista. Atualize a página.");
    });
  }
  async function saveEdit() {
    if (!art || !edit) return;
    await run("edit", async () => {
      await requestJson(`${base}/${art.id}`, { method: "PATCH", body: JSON.stringify({ currentVersion: art.version, patch: { headline: edit.headline, subheading: edit.subheading, cta: edit.cta, price: edit.price, layout: edit.layout, imageAssetId: edit.imageAssetId } }) });
      await load(); setNotice("Alterações salvas. A prévia e o PNG foram atualizados.");
    });
  }
  async function approve() {
    if (!art) return;
    await run("approve", async () => { const result = await requestJson<{ assetId: string | null }>(`${base}/${art.id}/approve`, { method: "POST" }); await load(); setNotice(result.assetId ? "Arte aprovada e adicionada à biblioteca de mídia." : "Arte aprovada nesta demonstração."); });
  }
  async function aiImage() {
    if (!art) return;
    await run("image", async () => { await requestJson(`${base}/${art.id}/image`, { method: "POST" }); await load(); setNotice("Imagem criada por IA. Revise a arte antes de aprovar."); });
  }
  async function apply() {
    if (!art || !pageId) return;
    await run("apply", async () => { await requestJson(`${base}/${art.id}/apply`, { method: "POST", body: JSON.stringify({ pageId }) }); setNotice("Arte aplicada ao rascunho da página. Abra o editor para conferir e publicar quando quiser."); });
  }
  async function saveKit() {
    if (!kitEdit) return;
    await run("kit", async () => { await requestJson(`${base}/kit`, { method: "PATCH", body: JSON.stringify({ primary: kitEdit.primary, secondary: kitEdit.secondary, accent: kitEdit.accent, surface: kitEdit.surface, ink: kitEdit.ink, font: kitEdit.font, photoStyle: kitEdit.photoStyle }) }); await load(); setNotice("Design Kit salvo. As novas artes seguirão essa identidade."); });
  }
  if (!data) return <div className="flex min-h-56 items-center justify-center text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} /> Carregando Motor Visual…</div>;
  const preview = art ? `${base}/${art.id}/render?v=${art.version}-${data.kit.version}` : "";
  return <div className="mx-auto max-w-7xl space-y-6 pb-20">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">SOBE • Estúdio</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Artes para o seu negócio</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Sua identidade já está pronta. Crie três opções, ajuste o texto, escolha uma imagem e aplique no site.</p></div>
      <Link href={`/app/projects/${projectId}/editor`} className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>Abrir editor do site</Link>
    </div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Criar novas artes</h2><p className="mt-1 text-xs text-slate-500">O nome e os fatos do negócio entram automaticamente.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-700">Formato<select value={target} onChange={e => setTarget(e.target.value as VisualTarget)} className={`${inputClass} mt-1`}>{targets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-700">Produto ou serviço anunciado<input value={subject} onChange={e => setSubject(e.target.value)} maxLength={160} placeholder="Ex.: suco de laranja em embalagem de 1 litro" className={`${inputClass} mt-1`} /></label>
            <label className="block text-xs font-semibold text-slate-700">Título (opcional)<input value={headline} onChange={e => setHeadline(e.target.value)} maxLength={120} placeholder="A SOBE sugere a partir da empresa" className={`${inputClass} mt-1`} /></label>
            <label className="block text-xs font-semibold text-slate-700">Apoio (opcional)<textarea value={subheading} onChange={e => setSubheading(e.target.value)} maxLength={240} rows={2} placeholder="Descrição curta" className={`${inputClass} mt-1`} /></label>
            <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold text-slate-700">Botão<input value={cta} onChange={e => setCta(e.target.value)} maxLength={70} placeholder="Saiba mais" className={`${inputClass} mt-1`} /></label><label className="block text-xs font-semibold text-slate-700">Preço, se houver<input value={price} onChange={e => setPrice(e.target.value)} maxLength={50} placeholder="Opcional" className={`${inputClass} mt-1`} /></label></div>
            <label className="block text-xs font-semibold text-slate-700">Foto existente (opcional)<select value={imageAssetId} onChange={e => setImageAssetId(e.target.value)} className={`${inputClass} mt-1`}><option value="">Usar composição sem foto</option>{data.media.map(item => <option key={item.id} value={item.id}>{item.originalName}</option>)}</select></label>
            <button disabled={Boolean(busy)} onClick={create} className={`${buttonClass} w-full bg-blue-600 text-white hover:bg-blue-700`}>{busy === "create" ? <Loader2 size={16} className="animate-spin" /> : <WandSparkles size={16} />} Gerar três alternativas grátis</button>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-950">Design Kit</h2><p className="mt-1 text-xs text-slate-500">Criado com as cores e o logo já cadastrados. Versão {data.kit.version}.</p>
          <div className="mt-4 grid grid-cols-5 gap-2">{(["primary", "secondary", "accent", "surface", "ink"] as const).map(name => <label key={name} className="text-center text-[10px] font-semibold text-slate-600"><input type="color" value={kitEdit?.[name] || data.kit[name]} onChange={e => setKitEdit(current => current ? { ...current, [name]: e.target.value } : current)} aria-label={`Cor ${name}`} className="h-10 w-full cursor-pointer rounded border-0 bg-transparent" />{name}</label>)}</div>
          <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-slate-700">Tipografia<select className={`${inputClass} mt-1`} value={kitEdit?.font || "sans"} onChange={e => setKitEdit(current => current ? { ...current, font: e.target.value as DesignKit["font"] } : current)}><option value="sans">Moderna</option><option value="serif">Editorial</option></select></label><label className="text-xs font-semibold text-slate-700">Fotografia<select className={`${inputClass} mt-1`} value={kitEdit?.photoStyle || "natural"} onChange={e => setKitEdit(current => current ? { ...current, photoStyle: e.target.value as DesignKit["photoStyle"] } : current)}><option value="natural">Natural</option><option value="studio">Estúdio</option><option value="editorial">Editorial</option></select></label></div>
          <button disabled={Boolean(busy)} onClick={saveKit} className={`${buttonClass} mt-3 w-full border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100`}>Salvar identidade</button>
          {data.kit.referenceArtworkId && <p className="mt-3 text-xs text-slate-500">Uma arte aprovada serve de referência para as próximas composições.</p>}
        </section>
      </div>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Minhas artes</h2><span className="text-xs text-slate-500">{data.artworks.length} salvas</span></div>
          {data.artworks.length === 0 ? <div className="mt-4 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">Escolha um formato e gere suas primeiras alternativas.</div> : <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">{data.artworks.map(item => <button key={item.id} onClick={() => setSelected(item.id)} className={`overflow-hidden rounded-xl border-2 text-left transition ${selected === item.id ? "border-blue-600 shadow-md" : "border-slate-100 hover:border-blue-200"}`}><img src={`${base}/${item.id}/render?v=${item.version}-${data.kit.version}`} alt={`Prévia da arte ${item.spec_json.variant + 1}`} className="aspect-[4/5] w-full bg-slate-100 object-cover" /><span className="block truncate px-2 py-2 text-[11px] font-semibold text-slate-700">{item.status === "approved" ? "✓ " : ""}{item.spec_json.headline}</span></button>)}</div>}
        </section>
        {art && edit && <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:grid-cols-[minmax(0,1fr)_310px]">
          <div><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-950">Alternativa {art.spec_json.variant + 1}</h2><span className="text-xs text-slate-500">{targets.find(item => item.id === art.spec_json.target)?.label}</span></div><div className="mt-4 flex max-h-[670px] justify-center overflow-hidden rounded-xl bg-slate-100"><img src={preview} alt="Prévia atual da arte" className="max-h-[670px] max-w-full object-contain" /></div><a href={`${base}/${art.id}/render?download=1`} className={`${buttonClass} mt-3 w-full border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}><Download size={16} /> Baixar PNG</a><p className="mt-2 text-center text-xs text-slate-500">A prévia usa o mesmo arquivo PNG da exportação.</p></div>
          <div className="space-y-3"><h3 className="font-bold text-slate-900">Editar esta arte</h3>
            {edit.direction && <div className="border-y border-slate-200 py-3 text-xs text-slate-700"><p className="font-bold text-slate-900">{edit.direction.creativeConcept}</p><p className="mt-1">{edit.direction.composition}</p><p className="mt-1 text-slate-500">Produto: {edit.direction.protagonist}</p></div>}
            <label className="block text-xs font-semibold text-slate-700">Título<input className={`${inputClass} mt-1`} value={edit.headline} maxLength={120} onChange={e => setEdit({ ...edit, headline: e.target.value })} /></label>
            <label className="block text-xs font-semibold text-slate-700">Descrição<textarea className={`${inputClass} mt-1`} rows={3} value={edit.subheading} maxLength={240} onChange={e => setEdit({ ...edit, subheading: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2"><label className="block text-xs font-semibold text-slate-700">Botão<input className={`${inputClass} mt-1`} value={edit.cta} maxLength={70} onChange={e => setEdit({ ...edit, cta: e.target.value })} /></label><label className="block text-xs font-semibold text-slate-700">Preço<input className={`${inputClass} mt-1`} value={edit.price} maxLength={50} onChange={e => setEdit({ ...edit, price: e.target.value })} /></label></div>
            <label className="block text-xs font-semibold text-slate-700">Composição<select className={`${inputClass} mt-1`} value={edit.layout} onChange={e => setEdit({ ...edit, layout: e.target.value as VisualSpec["layout"] })}>{layouts.map(layout => <option key={layout} value={layout}>{layout}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-700">Imagem de apoio<select className={`${inputClass} mt-1`} value={edit.imageAssetId || ""} onChange={e => setEdit({ ...edit, imageAssetId: e.target.value || null })}><option value="">Sem imagem</option>{data.media.map(item => <option key={item.id} value={item.id}>{item.originalName}</option>)}</select></label>
            <button disabled={Boolean(busy)} onClick={saveEdit} className={`${buttonClass} w-full bg-slate-900 text-white hover:bg-slate-800`}><RefreshCcw size={16} /> Salvar e regenerar</button>
            <button disabled={Boolean(busy)} onClick={aiImage} className={`${buttonClass} w-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}><ImagePlus size={16} /> Gerar imagem com IA</button>
            <p className="text-xs text-slate-500">A IA cria apenas a foto de apoio. Textos e marca são renderizados pela SOBE. Há limite diário de uso.</p>
            <button disabled={Boolean(busy)} onClick={approve} className={`${buttonClass} w-full bg-blue-600 text-white hover:bg-blue-700`}><Sparkles size={16} /> Aprovar esta arte</button>
            {art.status === "approved" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-900">Arte aprovada</p><label className="mt-3 block text-xs font-semibold text-emerald-950">Aplicar no destaque da página<select className={`${inputClass} mt-1`} value={pageId} onChange={e => setPageId(e.target.value)}><option value="">Selecione a página</option>{data.pages.filter(page => page.hasHero).map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label><button disabled={Boolean(busy) || !pageId} onClick={apply} className={`${buttonClass} mt-2 w-full bg-emerald-700 text-white hover:bg-emerald-800`}>Aplicar no rascunho</button></div>}
          </div>
        </section>}
      </div>
    </div>
  </div>;
}
