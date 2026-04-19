export type JadeWritingRoute = {
  name: string;
  label: string;
  description: string;
  tradeoff: string;
  technicalNote: string;
  qualityRank: number;
  speedRank: number;
  costRank: number;
};

export const jadeWritingRoutes: Record<"Premium" | "Balanced" | "Fast", JadeWritingRoute> = {
  Premium: {
    name: "Premium",
    label: "Recommended",
    description: "Best fit for long-form, high-quality novels where polish, consistency, and richness matter most.",
    tradeoff: "Best quality, slower turnaround, higher cost.",
    technicalNote: "Model: openai-codex/gpt-5.4",
    qualityRank: 3,
    speedRank: 1,
    costRank: 3,
  },
  Balanced: {
    name: "Balanced",
    label: "Recommended",
    description: "A sensible middle route if you want strong quality without pushing cost and runtime as far.",
    tradeoff: "Good quality, moderate speed, lower cost than Premium.",
    technicalNote: "Model: ollama/gemma4:e4b",
    qualityRank: 2,
    speedRank: 2,
    costRank: 2,
  },
  Fast: {
    name: "Fast",
    label: "Recommended",
    description: "Best when you want to get moving quickly and keep the first draft lightweight.",
    tradeoff: "Quickest turnaround, lighter output, lowest cost.",
    technicalNote: "Model: ollama/llama3.1:8b",
    qualityRank: 1,
    speedRank: 3,
    costRank: 1,
  },
};
