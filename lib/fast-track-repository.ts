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

export interface NarrativeRunRecord {
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
  currentRunId?: string;
  runs?: NarrativeRunRecord[];
  artifacts?: {
    mode?: string;
    pdfUrl?: string;
    generatedAt?: string;
  };
  outputs?: {
    narrativeDraft?: string;
    manuscriptDraft?: string;
    manuscriptChapters?: string[];
    storyBible?: string;
    storyContinuity?: string;
    storyState?: {
      characters?: string[];
      setting?: string;
      activeTensions?: string[];
      unresolvedThreads?: string[];
      currentNarrativeTarget?: string;
    };
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

export async function getFastTrackItem(itemId: string): Promise<FastTrackItem | null> {
  const db = getFirestore();
  const snapshot = await db.collection(FAST_TRACK_COLLECTION).doc(itemId).get();
  if (!snapshot.exists) return null;
  return mapFastTrack(snapshot);
}

export async function updateFastTrackProduction(itemId: string, production: ProductionRun): Promise<FastTrackItem | null> {
  const db = getFirestore();
  const ref = db.collection(FAST_TRACK_COLLECTION).doc(itemId);
  await ref.set({ production: { ...production, updatedAt: new Date().toISOString() } }, { merge: true });
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  return mapFastTrack(snapshot);
}

export async function updateFastTrackArtifacts(itemId: string, artifacts: NonNullable<ProductionRun["artifacts"]>): Promise<FastTrackItem | null> {
  const db = getFirestore();
  const ref = db.collection(FAST_TRACK_COLLECTION).doc(itemId);
  await ref.set({ production: { artifacts: { ...artifacts, generatedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() } }, { merge: true });
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  return mapFastTrack(snapshot);
}
