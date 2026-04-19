import { getFirestore } from "@/lib/firestore";

export interface FastTrackBrief {
  rawPrompt?: string;
  projectName?: string;
  interpretation?: string;
  targetUser?: string;
  assumptions?: string;
  proposedSolution?: string;
  firstBuild?: string;
  suggestedTeam?: string;
  risksAndUnknowns?: string;
  followUpLater?: string;
  decision?: "proceed" | "hold" | "park";
  updatedAt?: string;
}

export interface ProductionRun {
  mode?: "narrative" | "build" | "media" | "general";
  status?: "idle" | "starting" | "active" | "blocked" | "complete";
  leadAgent?: string;
  supportAgents?: string[];
  startedAt?: string;
  updatedAt?: string;
  summary?: string;
  seedPrompt?: string;
  artifacts?: {
    mode?: string;
    pdfUrl?: string;
    generatedAt?: string;
  };
  outputs?: {
    manuscriptDraft?: string;
    manuscriptChapters?: string[];
  };
}

export interface FastTrackItem {
  itemId: string;
  title: string;
  summary: string;
  whyNow: string;
  originAgent: string;
  confidence: string;
  createdAt: string;
  brief?: FastTrackBrief;
  production?: ProductionRun;
}

const FAST_TRACK_COLLECTION = "fast_track_items";

function mapFastTrack(doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>): FastTrackItem {
  const data = doc.data() || {};
  return {
    itemId: (data.itemId as string) || doc.id,
    title: (data.title as string) || "Untitled fast track item",
    summary: (data.summary as string) || "",
    whyNow: (data.whyNow as string) || "",
    originAgent: (data.originAgent as string) || "Yogi",
    confidence: (data.confidence as string) || "MED",
    createdAt: (data.createdAt as string) || new Date(0).toISOString(),
    brief: (data.brief as FastTrackBrief | undefined) || undefined,
    production: (data.production as ProductionRun | undefined) || undefined,
  };
}

export async function listFastTrackItems(): Promise<FastTrackItem[]> {
  const db = getFirestore();
  const snapshot = await db.collection(FAST_TRACK_COLLECTION).orderBy("createdAt", "desc").limit(20).get();
  return snapshot.docs.map(mapFastTrack);
}

export async function getLatestNarrativeFastTrackItem(): Promise<FastTrackItem | null> {
  const items = await listFastTrackItems();
  const relevant = items.find((item) => {
    const raw = `${item.title}\n${item.summary}\n${item.whyNow}\n${item.brief?.rawPrompt || ""}`.toLowerCase();
    return item.brief?.decision === "proceed" && (
      item.production?.mode === "narrative" ||
      raw.includes("novel") ||
      raw.includes("story") ||
      raw.includes("fiction") ||
      raw.includes("manuscript")
    );
  });
  return relevant || null;
}
