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
    startedAt?: string;
    updatedAt?: string;
    currentRunId?: string;
    summary?: string;
    runs?: Array<{
      runId: string;
      status: "active" | "complete" | "failed";
      startedAt: string;
      completedAt?: string;
      durationMs?: number;
      title?: string;
      summary?: string;
      pdfUrl?: string;
      chapterCount?: number;
      error?: string;
    }>;
    artifacts?: {
      pdfUrl?: string;
      generatedAt?: string;
    };
    outputs?: {
      manuscriptChapters?: string[];
    };
  };
};

function formatTimestamp(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationMs(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return null;
  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatDuration(startedAt?: string, endedAt?: string) {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const totalSeconds = Math.round((end - start) / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

const ambitionOptions = ["Clean and simple", "Rich and substantial", "As strong as possible"];
const pageTargets = ["60 pages", "120 pages", "220 pages"];
const chapterTargets = ["6 chapters", "12 chapters", "18 chapters"];

function getPromptWeightFromItem(item: FastTrackItem | null) {
  if (!item) {
    return { premiumBoost: 0, balancedBoost: 0 };
  }

  const raw = `${item.title}\n${item.summary}\n${item.whyNow}\n${item.brief?.rawPrompt || ""}`.toLowerCase();
  const longSignals = ["novel", "long", "book", "chapter", "fiction", "manuscript"];
  const mediumSignals = ["story", "tale", "narrative", "character", "scene"];

  const longScore = longSignals.filter((signal) => raw.includes(signal)).length;
  const mediumScore = mediumSignals.filter((signal) => raw.includes(signal)).length;

  return {
    premiumBoost: longScore >= 2 ? 1 : 0,
    balancedBoost: mediumScore >= 1 ? 1 : 0,
  };
}

function getRecommendation(
  ambition: string,
  pageTarget: string,
  chapterTarget: string,
  item: FastTrackItem | null,
) {
  const ambitious = ambition === "As strong as possible";
  const substantial = ambition === "Rich and substantial";
  const longBook = pageTarget === "220 pages" || chapterTarget === "18 chapters";
  const mediumBook = pageTarget === "120 pages" || chapterTarget === "12 chapters";
  const promptWeight = getPromptWeightFromItem(item);

  const premiumScore =
    (ambitious ? 2 : 0) +
    (longBook ? 2 : 0) +
    (substantial ? 1 : 0) +
    promptWeight.premiumBoost;

  const balancedScore =
    (substantial ? 2 : 0) +
    (mediumBook ? 2 : 0) +
    promptWeight.balancedBoost;

  const fastEligible = !ambitious && !substantial && !longBook && !mediumBook && !item;
  const fastWithPromptEligible = !ambitious && !substantial && pageTarget === "60 pages" && chapterTarget === "6 chapters" && promptWeight.premiumBoost === 0;

  if (premiumScore >= balancedScore && premiumScore >= 2) {
    return {
      ...jadeWritingRoutes.Premium,
      reason: item
        ? "Based on this Fast Track brief and your selected project shape, Jade recommends the strongest route for quality and long-form consistency."
        : "This project looks ambitious enough that stronger writing quality and longer-form consistency are worth the extra time and cost.",
    };
  }

  if (fastEligible || fastWithPromptEligible) {
    return {
      ...jadeWritingRoutes.Fast,
      reason: item
        ? "Based on this Fast Track brief and your selected project shape, Jade can move quickly with a lighter, faster route."
        : "This looks light enough that speed and momentum are probably more valuable than premium-level polish on the first pass.",
    };
  }

  if (balancedScore >= 2) {
    return {
      ...jadeWritingRoutes.Balanced,
      reason: item
        ? "Based on this Fast Track brief and your selected project shape, Jade recommends a balanced route with solid quality without pushing as hard on time and cost."
        : "This looks like a meaningful novel project, but not necessarily one that needs the heaviest premium route.",
    };
  }

  return {
    ...jadeWritingRoutes.Fast,
    reason: item
      ? "Based on this Fast Track brief and your selected project shape, Jade can move quickly with a lighter, faster route."
      : "This looks light enough that speed and momentum are probably more valuable than premium-level polish on the first pass.",
  };
}

export default function Home() {
  const [item, setItem] = useState<FastTrackItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ambition, setAmbition] = useState("As strong as possible");
  const [pageTarget, setPageTarget] = useState("120 pages");
  const [chapterTarget, setChapterTarget] = useState("12 chapters");
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

  async function loadLatestItem() {
    try {
      setError(null);
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
  }

  useEffect(() => {
    void loadLatestItem();
  }, []);

  async function handleMakeNovel() {
    try {
      setGenerating(true);
      setGenerationMessage(item?.production?.artifacts?.pdfUrl ? "Starting a fresh regeneration run…" : "Generating the novel draft and PDF now…");
      setError(null);

      const res = await fetch("/api/novel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item?.itemId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Novel API error: ${res.status}`);

      setItem(data.item || null);
      setGenerationMessage("Novel run finished.");
      await loadLatestItem();
    } catch (err) {
      console.error("Failed to generate novel", err);
      setError(err instanceof Error ? err.message : "Failed to generate novel.");
      setGenerationMessage(null);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteRunPdf(runId: string) {
    try {
      setDeletingRunId(runId);
      setError(null);
      const res = await fetch("/api/novel/run", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item?.itemId, runId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Delete run API error: ${res.status}`);
      setItem(data.item || null);
      await loadLatestItem();
    } catch (err) {
      console.error("Failed to delete run PDF", err);
      setError(err instanceof Error ? err.message : "Failed to delete run PDF.");
    } finally {
      setDeletingRunId(null);
    }
  }

  const recommendation = useMemo(
    () => getRecommendation(ambition, pageTarget, chapterTarget, item),
    [ambition, pageTarget, chapterTarget, item],
  );
  const chapterCount = item?.production?.outputs?.manuscriptChapters?.length || 0;
  const hasPdf = Boolean(item?.production?.artifacts?.pdfUrl);
  const productionStatus = item?.production?.status || "idle";
  const latestRun = item?.production?.runs?.[0];
  const runDuration = latestRun?.durationMs
    ? formatDurationMs(latestRun.durationMs)
    : formatDuration(item?.production?.startedAt, item?.production?.artifacts?.generatedAt || item?.production?.updatedAt);
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

            <div data-prompt-source className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
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
                <MetricCard label="Draft status" value={productionStatus} />
                <MetricCard label="Chapter count" value={String(chapterCount)} />
                <MetricCard label="Novel PDF" value={hasPdf ? "Ready" : "Not ready"} />
                <MetricCard label="Lead agent" value={item?.production?.leadAgent || "Jade"} />
                <MetricCard label="Run time" value={runDuration || "Not available yet"} />
                <MetricCard label="Updated" value={formatTimestamp(item?.production?.artifacts?.generatedAt || item?.production?.updatedAt) || item?.production?.artifacts?.generatedAt || item?.production?.updatedAt || "Not available yet"} />
              </div>

              <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm leading-6 text-sky-50/90">
                This page should never collapse into a dead shell again. If Firebase is unavailable, the recommendation builder still works and the user can keep moving.
              </div>

              {(generationMessage || item?.production?.summary) ? (
                <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-50/90">
                  {generating ? generationMessage : item?.production?.summary || generationMessage}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleMakeNovel()}
                  disabled={generating || loading || productionStatus === "active"}
                  className="rounded-full bg-fuchsia-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating || productionStatus === "active"
                    ? "Making the novel…"
                    : hasPdf
                      ? "Regenerate novel"
                      : "Make the novel"}
                </button>
                <button
                  type="button"
                  onClick={() => void loadLatestItem()}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  Refresh status
                </button>
                <button
                  type="button"
                  onClick={() => document.querySelector('[data-prompt-source]')?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  View prompt source
                </button>
              </div>

              {item?.production?.runs?.filter((run) => run.pdfUrl).length ? (
                <div className="mt-6 rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Recent runs</div>
                  <div className="mt-4 space-y-3">
                    {item.production.runs.filter((run) => run.pdfUrl).map((run) => (
                      <div key={run.runId} className="rounded-2xl border border-white/8 bg-[#171222] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{run.title || item?.brief?.projectName || item?.title || "Novel run"}</div>
                            <div className="mt-1 text-xs text-white/50">
                              {run.status === "complete" ? "Complete" : run.status === "failed" ? "Failed" : "Active"}
                              {item?.brief?.projectName || item?.title ? ` • Source: ${item?.brief?.projectName || item?.title}` : ""}
                            </div>
                          </div>
                          <div className="text-xs text-white/45">{formatTimestamp(run.startedAt) || run.startedAt}</div>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-white/70">{run.summary || "No run summary available."}</div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/55">
                          <span>Started: {formatTimestamp(run.startedAt) || run.startedAt}</span>
                          <span>Finished: {formatTimestamp(run.completedAt) || "Not finished yet"}</span>
                          <span>Duration: {formatDurationMs(run.durationMs) || "Not available yet"}</span>
                          <span>Chapters: {typeof run.chapterCount === "number" ? String(run.chapterCount) : "-"}</span>
                        </div>
                        {run.pdfUrl ? (
                          <div className="mt-3 flex flex-wrap gap-3">
                            <a href={run.pdfUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-emerald-300 hover:text-emerald-200">
                              Open PDF from this run
                            </a>
                            <button
                              type="button"
                              onClick={() => void handleDeleteRunPdf(run.runId)}
                              disabled={deletingRunId === run.runId}
                              className="text-sm font-medium text-rose-300 hover:text-rose-200 disabled:opacity-50"
                            >
                              {deletingRunId === run.runId ? "Deleting PDF…" : "Delete PDF"}
                            </button>
                          </div>
                        ) : null}
                        {run.error ? <div className="mt-3 text-sm text-rose-200">{run.error}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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
