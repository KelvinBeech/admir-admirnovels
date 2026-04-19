"use client";

import { useEffect, useMemo, useState } from "react";

import { appConfig } from "@/lib/app-config";
import { jadeWritingRoutes } from "@/lib/jade-writing-routes";

type FastTrackItem = {
  itemId: string;
  title: string;
  summary: string;
  whyNow: string;
  originAgent: string;
  confidence: string;
  createdAt: string;
  brief?: {
    rawPrompt?: string;
    projectName?: string;
    interpretation?: string;
    decision?: "proceed" | "hold" | "park";
  };
  production?: {
    mode?: string;
    status?: string;
    leadAgent?: string;
    artifacts?: {
      pdfUrl?: string;
      generatedAt?: string;
    };
    outputs?: {
      manuscriptChapters?: string[];
    };
  };
};

const ambitionOptions = ["Clean and simple", "Rich and substantial", "As strong as possible"];
const pageTargets = ["60 pages", "120 pages", "220 pages"];
const chapterTargets = ["6 chapters", "12 chapters", "18 chapters"];

function getFallbackRecommendation(ambition: string, pageTarget: string, chapterTarget: string) {
  const ambitious = ambition === "As strong as possible";
  const substantial = ambition === "Rich and substantial";
  const longBook = pageTarget === "220 pages" || chapterTarget === "18 chapters";
  const mediumBook = pageTarget === "120 pages" || chapterTarget === "12 chapters";

  if (ambitious || longBook) {
    return {
      ...jadeWritingRoutes.Premium,
      reason: "This project looks ambitious enough that stronger writing quality and longer-form consistency are worth the extra time and cost.",
    };
  }

  if (substantial || mediumBook) {
    return {
      ...jadeWritingRoutes.Balanced,
      reason: "This looks like a meaningful novel project, but not necessarily one that needs the heaviest premium route.",
    };
  }

  return {
    ...jadeWritingRoutes.Fast,
    reason: "This looks light enough that speed and momentum are probably more valuable than premium-level polish on the first pass.",
  };
}

function getRecommendationFromItem(item: FastTrackItem | null) {
  if (!item) return null;

  const raw = `${item.title}\n${item.summary}\n${item.whyNow}\n${item.brief?.rawPrompt || ""}`.toLowerCase();
  const longSignals = ["novel", "long", "book", "chapter", "fiction", "manuscript"];
  const mediumSignals = ["story", "tale", "narrative", "character", "scene"];

  const longScore = longSignals.filter((signal) => raw.includes(signal)).length;
  const mediumScore = mediumSignals.filter((signal) => raw.includes(signal)).length;

  if (longScore >= 2) {
    return {
      ...jadeWritingRoutes.Premium,
      reason: "The latest Fast Track item reads like a substantial novel brief, so Jade recommends the strongest route for quality and long-form consistency.",
    };
  }

  if (mediumScore >= 1) {
    return {
      ...jadeWritingRoutes.Balanced,
      reason: "The latest Fast Track item looks narrative-heavy, but not necessarily premium-only, so Jade recommends a balanced route.",
    };
  }

  return {
    ...jadeWritingRoutes.Fast,
    reason: "The latest Fast Track item looks light enough that Jade can start quickly on a fast route.",
  };
}

export default function Home() {
  const [item, setItem] = useState<FastTrackItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ambition, setAmbition] = useState("As strong as possible");
  const [pageTarget, setPageTarget] = useState("120 pages");
  const [chapterTarget, setChapterTarget] = useState("12 chapters");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/fast-track/latest", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Fast Track API error: ${res.status}`);
        setItem(data.item || null);
      } catch (err) {
        console.error("Failed to load latest Fast Track item", err);
        setError(err instanceof Error ? err.message : "Failed to load latest Fast Track item.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fallbackRecommendation = useMemo(
    () => getFallbackRecommendation(ambition, pageTarget, chapterTarget),
    [ambition, pageTarget, chapterTarget],
  );
  const liveRecommendation = getRecommendationFromItem(item);
  const recommendation = liveRecommendation || fallbackRecommendation;
  const chapterCount = item?.production?.outputs?.manuscriptChapters?.length || 0;
  const hasPdf = Boolean(item?.production?.artifacts?.pdfUrl);
  const sourcePrompt = item?.brief?.rawPrompt || "No live Fast Track item loaded yet. Use the questions on the right to shape Jade’s recommendation until Firebase is connected.";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.22),_transparent_35%),linear-gradient(180deg,#140b22_0%,#09090f_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-fuchsia-200/80">AdmirNovels</div>
            <div className="mt-2 text-sm text-white/70">A dedicated studio for branching from Mission Control into long-form fiction.</div>
          </div>
          <div className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-100">
            Latest Fast Track branch
          </div>
        </header>

        <section className="grid flex-1 items-start gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <div className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
              Fallback first, live data when ready
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
              Turn a prompt into a novel workspace that actually fits the job.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75 sm:text-xl">
              AdmirNovels keeps the interactive recommendation flow you liked this morning, while layering in the latest Fast Track item whenever Firebase is available.
            </p>

            {loading ? (
              <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">Checking for the latest Fast Track narrative item…</div>
            ) : item ? (
              <div className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-sm text-emerald-50/90">
                Live Fast Track item loaded, {item.brief?.projectName || item.title}.
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-50/90">
                No live Fast Track novel loaded yet. The page is using the local recommendation builder for now.
              </div>
            )}

            {error ? (
              <div className="mt-4 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/75">Prompt source</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{item?.brief?.projectName || item?.title || "Awaiting Fast Track prompt"}</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  {item?.brief?.decision || "fallback mode"}
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Current prompt</div>
                <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-white/85">{sourcePrompt}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur-md">
            <div className="rounded-[28px] border border-fuchsia-400/20 bg-[#120d1d] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-200/75">Jade launch</div>
                  <div className="mt-2 text-2xl font-semibold text-white">Make the novel</div>
                  <p className="mt-3 text-sm leading-6 text-white/70">
                    Answer the project-shape questions first. Then Jade recommends the best route, and that recommendation can be overridden later if needed.
                  </p>
                </div>
                <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                  Standalone Firebase path
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <SelectionBlock label="Question 1, ambition" options={ambitionOptions} value={ambition} onChange={setAmbition} />
                <SelectionBlock label="Question 2, page target" options={pageTargets} value={pageTarget} onChange={setPageTarget} />
                <SelectionBlock label="Question 3, chapter target" options={chapterTargets} value={chapterTarget} onChange={setChapterTarget} />
              </div>

              <div className="mt-6 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-fuchsia-100/75">Jade’s recommendation</div>
                <div className="mt-2 text-xl font-semibold text-white">{recommendation.name} is the best fit for this novel.</div>
                <p className="mt-3 text-sm leading-6 text-white/75">{recommendation.reason}</p>
                <div className="mt-4 rounded-2xl border border-fuchsia-300/30 bg-[#1c1028] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-white">{recommendation.name}</div>
                    <div className="rounded-full border border-fuchsia-300/40 bg-fuchsia-400/10 px-3 py-1 text-xs text-fuchsia-100">
                      {recommendation.label}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/65">{recommendation.description}</p>
                  <div className="mt-2 text-sm font-medium text-white/80">{recommendation.tradeoff}</div>
                  {appConfig.developerMode ? <div className="mt-2 text-xs text-white/45">{recommendation.technicalNote}</div> : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <MetricCard label="Draft status" value={item?.production?.status || "Not started"} />
                <MetricCard label="Chapter count" value={String(chapterCount)} />
                <MetricCard label="Novel PDF" value={hasPdf ? "Ready" : "Not ready"} />
                <MetricCard label="Lead agent" value={item?.production?.leadAgent || "Jade"} />
              </div>

              <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm leading-6 text-sky-50/90">
                This page should never collapse into a dead shell again. If Firebase is unavailable, the recommendation builder still works and the user can keep moving.
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button className="rounded-full bg-fuchsia-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-400">
                  Make the novel
                </button>
                <button className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10">
                  View prompt source
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SelectionBlock({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition ${selected ? "border-fuchsia-400/30 bg-fuchsia-500/10 text-white" : "border-transparent bg-white/5 text-white/70 hover:bg-white/8"}`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-3 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
