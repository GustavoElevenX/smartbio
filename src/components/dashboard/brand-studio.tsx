"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ImagePlus,
  LoaderCircle,
  Palette,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Label, Select } from "@/components/ui/field";
import { ExperienceCanvas } from "@/components/public-experience/public-experience";
import { analyzeBrandFile } from "@/features/brand-intelligence/brand-analyzer";
import { ensureAccessiblePalette } from "@/features/brand-intelligence/colors";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { BrandPalette, Project } from "@/types";

const colorLabels: Array<[keyof BrandPalette, string]> = [
  ["primary", "Principal"],
  ["secondary", "Secundária"],
  ["accent", "Acento"],
  ["background", "Fundo"],
  ["surface", "Superfície"],
  ["foreground", "Texto"],
  ["muted", "Suave"],
  ["border", "Borda"],
  ["success", "Sucesso"],
  ["warning", "Alerta"],
  ["destructive", "Erro"],
];

export function BrandStudio({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [tab, setTab] = useState<
    "identity" | "colors" | "typography" | "style"
  >("identity");
  const [analyzing, setAnalyzing] = useState(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void projectRepository.getProject(projectId).then((found) => setProject(found || null)).catch(() => setProject(null)); }, [projectId]);
  function update(next: Project) {
    setProject(next);
    setSaved(false);
    void projectRepository.saveProject(next).then(() => setSaved(true)).catch(() => setError("Não foi possível salvar a identidade."));
  }
  async function logoChanged(file?: File) {
    if (!file || !project) return;
    setAnalyzing(true);
    setError("");
    try {
      const brand = await analyzeBrandFile(file);
      update({
        ...project,
        brand: { ...brand, brandPersonality: project.brand.brandPersonality },
        designSystem: { ...project.designSystem, colors: brand.activePalette },
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível analisar a logo.",
      );
    } finally {
      setAnalyzing(false);
    }
  }
  if (project === undefined)
    return (
      <div className="grid min-h-[600px] place-items-center">
        <LoaderCircle className="animate-spin text-[#6d5ef5]" />
      </div>
    );
  if (!project)
    return (
      <div className="rounded-[24px] bg-white p-10 text-center">
        <h1 className="font-extrabold">Projeto não encontrado</h1>
      </div>
    );
  const applyColor = (key: keyof BrandPalette, value: string) =>
    update({
      ...project,
      brand: {
        ...project.brand,
        activePalette: ensureAccessiblePalette({
          ...project.brand.activePalette,
          [key]: value,
        }),
      },
      designSystem: {
        ...project.designSystem,
        colors: ensureAccessiblePalette({
          ...project.designSystem.colors,
          [key]: value,
        }),
      },
    });
  return (
    <div className="animate-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/app/projects"
            className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#6f6f79]"
          >
            <ArrowLeft size={14} /> Projetos
          </Link>
          <p className="text-sm font-semibold text-[#6d5ef5]">{project.name}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-.04em]">
            Brand Studio
          </h1>
          <p className="mt-2 text-sm text-[#72727d]">
            A identidade completa aplicada em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#73737d]">
            {saved ? (
              <>
                <Check size={14} className="text-[#15966c]" /> Salvo
              </>
            ) : (
              <>
                <LoaderCircle size={14} className="animate-spin" /> Salvando…
              </>
            )}
          </span>
          <Link
            href={`/app/projects/${project.id}/editor`}
            className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-[#17171c] px-4 text-sm font-bold text-white"
          >
            Voltar ao editor
          </Link>
        </div>
      </div>
      <div className="mt-7 grid overflow-hidden rounded-[26px] border border-[#e3e2e9] bg-white xl:grid-cols-[minmax(480px,1fr)_460px]">
        <section>
          <div className="flex overflow-x-auto border-b border-[#e6e5ec] px-4">
            {[
              ["identity", "Identidade"],
              ["colors", "Cores"],
              ["typography", "Tipografia"],
              ["style", "Estilo"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value as typeof tab)}
                className={`min-h-14 border-b-2 px-4 text-xs font-bold ${tab === value ? "border-[#6d5ef5] text-[#5d50d2]" : "border-transparent text-[#74747e]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-6 sm:p-8">
            {tab === "identity" && (
              <div>
                <div className="flex items-center gap-2">
                  <ImagePlus size={18} className="text-[#6255d8]" />
                  <h2 className="font-extrabold">Logos e favicon</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#74747e]">
                  O original é preservado. O corte existe apenas no preview.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="focus-within:ring-4 focus-within:ring-[#6d5ef5]/10 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-[#d8d6e3] bg-[#faf9fd] p-4">
                    {project.brand.logoDataUrl ? (
                      <img
                        src={project.brand.logoDataUrl}
                        alt="Logo principal"
                        className="max-h-24 max-w-full object-contain"
                      />
                    ) : (
                      <Upload className="text-[#6558db]" />
                    )}
                    <strong className="mt-3 text-xs">Logo principal</strong>
                    <span className="mt-1 text-[10px] text-[#85858f]">
                      PNG, JPG, WebP ou SVG · até 5 MB
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="sr-only"
                      onChange={(event) =>
                        void logoChanged(event.target.files?.[0])
                      }
                    />
                  </label>
                  <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-[#d8d6e3] bg-[#202026] p-4 text-white">
                    {project.brand.lightLogoDataUrl ? (
                      <img
                        src={project.brand.lightLogoDataUrl}
                        alt="Logo clara"
                        className="max-h-24 max-w-full object-contain"
                      />
                    ) : (
                      <>
                        <Upload className="text-[#aaa1fa]" />
                        <strong className="mt-3 text-xs">Versão clara</strong>
                        <span className="mt-1 text-[10px] text-white/45">
                          Opcional para fundos escuros
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () =>
                          update({
                            ...project,
                            brand: {
                              ...project.brand,
                              lightLogoDataUrl: String(reader.result),
                            },
                          });
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
                {analyzing && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#efedff] p-3 text-xs font-bold text-[#5c4fd1]">
                    <LoaderCircle size={16} className="animate-spin" />{" "}
                    Extraindo paleta e verificando contraste…
                  </div>
                )}
                {error && (
                  <div className="mt-4 rounded-xl bg-[#fff0f0] p-3 text-xs font-semibold text-[#a93d3d]">
                    {error}
                  </div>
                )}
                <div className="mt-7 rounded-[18px] border border-[#e3e2e9] p-5">
                  <h3 className="text-sm font-extrabold">Análise visual</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[#85858f]">Orientação</span>
                      <strong className="mt-1 block capitalize">
                        {project.brand.analysisMetadata?.orientation ||
                          "não analisada"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#85858f]">Luminância</span>
                      <strong className="mt-1 block capitalize">
                        {project.brand.analysisMetadata?.luminance || "—"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#85858f]">Cores relevantes</span>
                      <strong className="mt-1 block">
                        {project.brand.extractedColors.length}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#85858f]">Confiança</span>
                      <strong className="mt-1 block">
                        {Math.round(
                          (project.brand.analysisMetadata?.confidence || 0) *
                            100,
                        )}
                        %
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === "colors" && (
              <div>
                <div className="flex items-center gap-2">
                  <Palette size={18} className="text-[#6255d8]" />
                  <h2 className="font-extrabold">Paleta semântica</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#74747e]">
                  Cada cor tem uma função. Foregrounds são ajustados
                  automaticamente para manter leitura.
                </p>
                {project.brand.paletteVariations.length > 0 && (
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {project.brand.paletteVariations.map((variation) => (
                      <button
                        key={variation.name}
                        onClick={() =>
                          update({
                            ...project,
                            brand: {
                              ...project.brand,
                              activePalette: variation.palette,
                            },
                            designSystem: {
                              ...project.designSystem,
                              colors: variation.palette,
                            },
                            visualDirection: variation.name,
                          })
                        }
                        className={`rounded-[16px] border p-3 text-left ${project.visualDirection === variation.name ? "border-[#6d5ef5] bg-[#f0eeff]" : "border-[#e0dfe7]"}`}
                      >
                        <div className="flex gap-1">
                          {[
                            variation.palette.primary,
                            variation.palette.secondary,
                            variation.palette.accent,
                          ].map((color) => (
                            <span
                              key={color}
                              className="h-7 flex-1 rounded-lg"
                              style={{ background: color }}
                            />
                          ))}
                        </div>
                        <strong className="mt-2 block text-xs">
                          {variation.name}
                        </strong>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {colorLabels.map(([key, label]) => (
                    <label
                      key={key}
                      className="rounded-[15px] border border-[#e3e2e9] p-3"
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7e7e88]">
                        {label}
                      </span>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="color"
                          value={String(project.designSystem.colors[key])}
                          onChange={(event) =>
                            applyColor(key, event.target.value)
                          }
                          className="size-8 rounded-lg border-0 bg-transparent p-0"
                        />
                        <span className="text-[10px] font-semibold">
                          {String(project.designSystem.colors[key])}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const variation = project.brand.paletteVariations.find(
                      (item) => item.name === "Equilibrada",
                    );
                    if (variation)
                      update({
                        ...project,
                        brand: {
                          ...project.brand,
                          activePalette: variation.palette,
                        },
                        designSystem: {
                          ...project.designSystem,
                          colors: variation.palette,
                        },
                      });
                  }}
                  className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-[#6255d8]"
                >
                  <RefreshCw size={14} /> Restaurar sugestões automáticas
                </button>
              </div>
            )}
            {tab === "typography" && (
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-[#6255d8]" />
                  <h2 className="font-extrabold">Tipografia</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#74747e]">
                  Combinações curadas evitam peso desnecessário e mantêm
                  consistência.
                </p>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="heading-font">Fonte de títulos</Label>
                    <Select
                      id="heading-font"
                      value={project.designSystem.typography.headingFont}
                      onChange={(event) =>
                        update({
                          ...project,
                          designSystem: {
                            ...project.designSystem,
                            typography: {
                              ...project.designSystem.typography,
                              headingFont: event.target.value,
                            },
                          },
                        })
                      }
                    >
                      {[
                        "Inter",
                        "Manrope",
                        "Plus Jakarta Sans",
                        "Poppins",
                        "Sora",
                        "DM Sans",
                        "Outfit",
                      ].map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="body-font">Fonte de texto</Label>
                    <Select
                      id="body-font"
                      value={project.designSystem.typography.bodyFont}
                      onChange={(event) =>
                        update({
                          ...project,
                          designSystem: {
                            ...project.designSystem,
                            typography: {
                              ...project.designSystem.typography,
                              bodyFont: event.target.value,
                            },
                          },
                        })
                      }
                    >
                      {["Inter", "Manrope", "DM Sans", "Outfit"].map((font) => (
                        <option key={font}>{font}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="weight">Peso dos títulos</Label>
                    <Select
                      id="weight"
                      value={project.designSystem.typography.headingWeight}
                      onChange={(event) =>
                        update({
                          ...project,
                          designSystem: {
                            ...project.designSystem,
                            typography: {
                              ...project.designSystem.typography,
                              headingWeight: Number(event.target.value),
                            },
                          },
                        })
                      }
                    >
                      <option value="600">Semibold</option>
                      <option value="700">Bold</option>
                      <option value="800">Extra bold</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="scale">Escala</Label>
                    <Select
                      id="scale"
                      value={project.designSystem.typography.scale}
                      onChange={(event) =>
                        update({
                          ...project,
                          designSystem: {
                            ...project.designSystem,
                            typography: {
                              ...project.designSystem.typography,
                              scale: event.target
                                .value as Project["designSystem"]["typography"]["scale"],
                            },
                          },
                        })
                      }
                    >
                      <option value="compact">Compacta</option>
                      <option value="standard">Padrão</option>
                      <option value="expressive">Expressiva</option>
                    </Select>
                  </div>
                </div>
                <div className="mt-7 rounded-[20px] border border-[#e3e2e9] p-6">
                  <span className="text-xs font-bold text-[#6558db]">
                    Prévia tipográfica
                  </span>
                  <h3
                    className="mt-4 text-4xl leading-tight tracking-[-.045em]"
                    style={{
                      fontFamily: `"${project.designSystem.typography.headingFont}", Inter, ui-sans-serif, system-ui, sans-serif`,
                      fontWeight: project.designSystem.typography.headingWeight,
                    }}
                  >
                    Seu melhor próximo passo.
                  </h3>
                  <p
                    className="mt-3 text-sm leading-6 text-[#74747e]"
                    style={{
                      fontFamily: `"${project.designSystem.typography.bodyFont}", Inter, ui-sans-serif, system-ui, sans-serif`,
                    }}
                  >
                    Uma experiência clara, coerente e feita para a sua marca.
                  </p>
                </div>
              </div>
            )}
            {tab === "style" && (
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-[#6255d8]" />
                  <h2 className="font-extrabold">
                    Forma, profundidade e movimento
                  </h2>
                </div>
                <div className="mt-7 space-y-6">
                  <div>
                    <div className="flex justify-between">
                      <Label htmlFor="card-radius">Raio dos cards</Label>
                      <span className="text-xs text-[#85858f]">
                        {project.designSystem.shape.cardRadius}px
                      </span>
                    </div>
                    <input
                      id="card-radius"
                      type="range"
                      min="4"
                      max="38"
                      value={project.designSystem.shape.cardRadius}
                      onChange={(event) =>
                        update({
                          ...project,
                          designSystem: {
                            ...project.designSystem,
                            shape: {
                              ...project.designSystem.shape,
                              cardRadius: Number(event.target.value),
                            },
                          },
                        })
                      }
                      className="w-full accent-[#6d5ef5]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="card-style">Estilo dos cards</Label>
                    <Select
                      id="card-style"
                      value={project.designSystem.cards.style}
                      onChange={(event) =>
                        update({
                          ...project,
                          designSystem: {
                            ...project.designSystem,
                            cards: {
                              ...project.designSystem.cards,
                              style: event.target
                                .value as Project["designSystem"]["cards"]["style"],
                            },
                          },
                        })
                      }
                    >
                      <option value="flat">Plano</option>
                      <option value="outlined">Contornado</option>
                      <option value="elevated">Elevado</option>
                      <option value="glass">Glass</option>
                      <option value="gradient">Gradiente</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="button-style">Estilo dos botões</Label>
                    <Select
                      id="button-style"
                      value={project.designSystem.buttons.style}
                      onChange={(event) =>
                        update({
                          ...project,
                          designSystem: {
                            ...project.designSystem,
                            buttons: {
                              ...project.designSystem.buttons,
                              style: event.target
                                .value as Project["designSystem"]["buttons"]["style"],
                            },
                          },
                        })
                      }
                    >
                      <option value="solid">Sólido</option>
                      <option value="outline">Contorno</option>
                      <option value="soft">Suave</option>
                      <option value="glass">Glass</option>
                      <option value="gradient">Gradiente</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="motion">Transição</Label>
                    <Select
                      id="motion"
                      value={project.designSystem.motion.transition}
                      onChange={(event) =>
                        update({
                          ...project,
                          designSystem: {
                            ...project.designSystem,
                            motion: {
                              ...project.designSystem.motion,
                              transition: event.target
                                .value as Project["designSystem"]["motion"]["transition"],
                            },
                          },
                        })
                      }
                    >
                      <option value="none">Sem animação</option>
                      <option value="fade">Fade</option>
                      <option value="slide">Slide</option>
                      <option value="scale">Escala</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="density">Densidade</Label>
                    <Select
                      id="density"
                      value={project.designSystem.spacing.density}
                      onChange={(event) =>
                        update({
                          ...project,
                          designSystem: {
                            ...project.designSystem,
                            spacing: {
                              ...project.designSystem.spacing,
                              density: event.target
                                .value as Project["designSystem"]["spacing"]["density"],
                            },
                          },
                        })
                      }
                    >
                      <option value="compact">Compacta</option>
                      <option value="balanced">Equilibrada</option>
                      <option value="spacious">Espaçosa</option>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
        <aside className="flex min-h-[700px] items-center justify-center border-l border-[#e5e4eb] bg-[#efedf4] p-7">
          <div className="w-full max-w-[340px]">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-[#777781]">
              <span>Preview ao vivo</span>
              <span>{project.visualDirection}</span>
            </div>
            <div className="h-[640px] overflow-hidden rounded-[38px] border-[6px] border-[#222126] bg-white p-1.5 shadow-[0_30px_80px_rgba(29,25,55,.2)]">
              <div className="h-full overflow-hidden rounded-[28px]">
                <ExperienceCanvas
                  key={`${project.updatedAt}-${tab}`}
                  project={project}
                  preview
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
