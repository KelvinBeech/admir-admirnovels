import { NextRequest, NextResponse } from "next/server";

import { getFastTrackItem, getLatestNarrativeFastTrackItem, type NarrativeRunRecord, updateFastTrackArtifacts, updateFastTrackProduction } from "@/lib/fast-track-repository";
import { generateNarrativeArtifacts } from "@/lib/narrative-artifacts";
import { callOllamaText } from "@/lib/ollama";

const BANNED_NARRATIVE_TERMS = ["Jade", "Giselle", "Ollama", "Mission Control", "Scout", "Narrative target:"];

function sanitizeNarrativeText(input: string) {
  let output = input;
  for (const term of BANNED_NARRATIVE_TERMS) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    output = output.replace(pattern, "");
  }
  return output
    .replace(/structured story state/gi, "story frame")
    .replace(/continuity state/gi, "story continuity")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasNarrativeLeakage(input: string) {
  return BANNED_NARRATIVE_TERMS.some((term) => input.toLowerCase().includes(term.toLowerCase()));
}

function createRunId() {
  return `novel-run-${Date.now()}`;
}

async function generateNovelTitle(seedPrompt: string, fallbackTitle: string) {
  try {
    const result = await callOllamaText(
      "You create strong, concise, reader-facing novel titles. Return only one title, with no explanation, no quotes unless essential, and no markdown.",
      [
        "Create one compelling novel title for this project.",
        "The title should feel like a real book title, not a working label.",
        "Prefer 2 to 6 words.",
        "Avoid generic placeholders like First, Novel, Story, Book, Draft, Jade, Mission, Project.",
        "",
        "Source prompt:",
        seedPrompt,
      ].join("\n"),
    );

    const cleaned = result
      .split("\n")[0]
      ?.replace(/^#\s+/, "")
      .replace(/^"|"$/g, "")
      .trim();

    if (!cleaned || cleaned.length < 3) return fallbackTitle;
    return cleaned;
  } catch {
    return fallbackTitle;
  }
}

function normaliseChapterHeadings(manuscript: string) {
  return manuscript
    .replace(/^##\s*Chapter\s*(\d+)\s*[:,\-]?\s*$/gim, "## Chapter $1")
    .replace(/^##\s*Chapter\s*(\d+)\s*[:,\-]?\s+(.+)$/gim, (_match, num, title) => {
      const cleanedTitle = String(title || "").trim();
      return cleanedTitle ? `## Chapter ${num}, ${cleanedTitle}` : `## Chapter ${num}`;
    });
}

function extractNovelTitle(manuscript: string, fallbackTitle: string) {
  const lines = manuscript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const firstHeading = lines.find((line) => /^#\s+/.test(line));
  if (firstHeading) {
    const headingTitle = firstHeading.replace(/^#\s+/, "").trim();
    if (headingTitle && !/^(first\s+jade\s+novel|untitled|novel)$/i.test(headingTitle)) {
      return headingTitle;
    }
  }

  const firstChapterIndex = lines.findIndex((line) => /^##\s+Chapter\s+1\b/i.test(line));
  if (firstChapterIndex > 0) {
    const candidate = lines[firstChapterIndex - 1];
    if (candidate && !candidate.startsWith("##") && !/^(first\s+jade\s+novel|untitled|novel)$/i.test(candidate)) {
      return candidate.replace(/^"|"$/g, "").trim();
    }
  }

  return fallbackTitle;
}

export async function POST(request: NextRequest) {
  const startedAt = new Date().toISOString();
  let selectedItemId = "";
  let seedPrompt = "";
  let previousRuns: NarrativeRunRecord[] = [];
  let runId = createRunId();

  try {
    const body = await request.json().catch(() => ({}));
    const itemId = String(body?.itemId || "").trim();
    const item = itemId ? await getFastTrackItem(itemId) : await getLatestNarrativeFastTrackItem();

    if (!item) {
      return NextResponse.json({ error: "No narrative-ready Fast Track item found." }, { status: 404 });
    }

    selectedItemId = item.itemId;
    seedPrompt = item.brief?.rawPrompt || `${item.title}\n\n${item.summary}\n\nWhy now: ${item.whyNow}`;
    previousRuns = item.production?.runs || [];
    const existingOutputs = item.production?.outputs || {};
    const storyBible = existingOutputs.storyBible || [
      `Story world: ${item.brief?.projectName || item.title}`,
      `Premise: ${item.brief?.interpretation || item.summary}`,
      `Core tension: ${item.whyNow || item.summary}`,
      "Tone: thoughtful, atmospheric, emotionally grounded narrative with forward momentum.",
      "Primary movement: a beginning that steadily reveals stakes, emotional direction, and the deeper shape of the journey.",
    ].join("\n");
    const storyContinuity = [
      "Current continuity state:",
      "- Fresh regeneration run starting from the approved Fast Track prompt",
      "- Previous manuscript output should not force stale continuation state",
      "- The story should feel complete in this run, not like a partial carry-over",
      "- Use prior learning, but generate a fresh novel draft",
    ].join("\n");
    const storyState = {
      characters: [
        "A central consciousness carrying the emotional thread of the novel",
        "Secondary figures or forces beginning to shape the direction of the story",
      ],
      setting: item.brief?.projectName || item.title,
      activeTensions: [
        "Something important is beginning before its consequences are fully understood",
        "The emotional cost of movement versus staying still",
      ],
      unresolvedThreads: [
        "What deeper truth is driving the story beneath the opening premise?",
        "Which relationship, force, or revelation will most reshape the journey?",
      ],
      currentNarrativeTarget: "Generate a complete fresh novel with real scenes, continuity, and an earned ending.",
    };

    const activeRun: NarrativeRunRecord = {
      runId,
      status: "active",
      startedAt,
      summary: "Novel generation started.",
    };

    await updateFastTrackProduction(selectedItemId, {
      mode: "narrative",
      status: "active",
      leadAgent: "Jade",
      supportAgents: ["Giselle", "Elita"],
      startedAt,
      currentRunId: runId,
      runs: [activeRun, ...previousRuns].slice(0, 10),
      summary: "Narrative production is active. Jade is generating a fresh novel draft.",
      seedPrompt,
      outputs: {
        ...existingOutputs,
        narrativeDraft: "",
        manuscriptDraft: "",
        manuscriptChapters: [],
        storyBible,
        storyContinuity,
        storyState,
      },
      artifacts: {},
    });

    const generatedTitle = await generateNovelTitle(seedPrompt, item.brief?.projectName || item.title);

    const ollamaPrompt = [
      `Project: ${item.brief?.projectName || item.title}`,
      "",
      "Write a complete short novel from scratch in one pass.",
      "Deliver approximately 5,000 to 8,000 words, which should read like a substantial short novel.",
      "Include a strong beginning, meaningful development, a turning point, a climax, and an ending that feels complete.",
      "Begin exactly with '## Chapter 1,'. Continue with as many chapters as needed to complete the novel in this single response.",
      "Do not output planning notes or chapter summaries. Write the actual full novel only.",
      "These must be real scenes, not summaries, not chapter notes, not commentary, and not analysis.",
      "Return only in-world manuscript prose with headings like '## Chapter X, Title'.",
      "Do not mention Jade, Giselle, Ollama, Mission Control, Scout, the model, the prompt, continuity state, structured story state, or the act of writing.",
      "Ground the prose in the actual setting, genre, and world implied by the user's prompt.",
      "Use concrete sensory details, dialogue, atmosphere, and emotional movement.",
      "",
      "Story bible:",
      storyBible,
      "",
      "Continuity state:",
      storyContinuity,
      "",
      "Structured story state:",
      JSON.stringify(storyState, null, 2),
      "",
      "User prompt:",
      seedPrompt,
      "",
      "Narrative target:",
      storyState.currentNarrativeTarget || item.summary,
    ].join("\n");

    let generatedManuscript = await callOllamaText(
      "You are a serious novelist. Write only manuscript prose in markdown. Follow the user's prompt and implied setting faithfully. Never mention assistant names, tools, prompts, models, agents, or process. Never output summaries, notes, or explanations. Write scenes with characters, setting, dialogue, sensory detail, and emotional specificity.",
      sanitizeNarrativeText(ollamaPrompt),
    );

    generatedManuscript = sanitizeNarrativeText(generatedManuscript);
    generatedManuscript = normaliseChapterHeadings(generatedManuscript);
    if (hasNarrativeLeakage(generatedManuscript)) {
      throw new Error("Generated manuscript contained internal narrative leakage.");
    }

    const manuscriptChapters = generatedManuscript
      .split(/\n(?=## Chapter\s+\d+)/g)
      .map((chunk) => chunk.trim())
      .filter((chunk) => Boolean(chunk) && /^## Chapter\s+\d+/i.test(chunk));

    const extractedTitle = extractNovelTitle(generatedManuscript, generatedTitle);

    const manuscriptDraft = [
      `# ${extractedTitle}`,
      "",
      ...manuscriptChapters,
    ].join("\n\n").trim();

    const updatedOutputs = {
      ...existingOutputs,
      narrativeDraft: manuscriptDraft,
      manuscriptDraft,
      manuscriptChapters,
      storyBible,
      storyContinuity: [
        "Current continuity state:",
        "- Full manuscript draft generated from the approved Fast Track prompt",
        "- Emotional and thematic movement now exists across the chapter stack",
        "- Future refinement should improve continuity rather than restart the novel",
        "- Repeated motifs, relationships, and consequences should intensify rather than reset",
      ].join("\n"),
      storyState: {
        ...storyState,
        currentNarrativeTarget: "Refine continuity, scene quality, and emotional progression across the finished draft.",
      },
    };

    await updateFastTrackProduction(selectedItemId, {
      mode: "narrative",
      status: "active",
      leadAgent: "Jade",
      supportAgents: ["Giselle", "Elita"],
      startedAt,
      currentRunId: runId,
      runs: [
        {
          runId,
          status: "active",
          startedAt,
          title: extractedTitle,
          summary: "Narrative draft generated. Building the novel PDF artifact now.",
          chapterCount: manuscriptChapters.length,
        },
        ...previousRuns,
      ].slice(0, 10),
      summary: "Narrative draft generated. Building the novel PDF artifact now.",
      seedPrompt,
      outputs: updatedOutputs,
      artifacts: {},
    });

    const narrativeArtifacts = await generateNarrativeArtifacts({
      itemId: selectedItemId,
      runId,
      title: extractedTitle,
      summary: item.brief?.interpretation || item.summary || "Narrative output",
      manuscript: manuscriptDraft,
    });

    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const completedRun: NarrativeRunRecord = {
      runId,
      status: "complete",
      startedAt,
      completedAt,
      durationMs,
      title: extractedTitle,
      summary: "Narrative production is complete. Jade generated the novel draft and PDF artifact.",
      pdfUrl: narrativeArtifacts.pdfUrl,
      chapterCount: manuscriptChapters.length,
    };

    const persistedArtifacts = {
      mode: "marketing",
      pdfUrl: narrativeArtifacts.pdfUrl,
    } as const;

    await updateFastTrackArtifacts(selectedItemId, persistedArtifacts);

    const production = await updateFastTrackProduction(selectedItemId, {
      mode: "narrative",
      status: "complete",
      leadAgent: "Jade",
      supportAgents: ["Giselle", "Elita"],
      startedAt,
      currentRunId: runId,
      runs: [completedRun, ...previousRuns].slice(0, 10),
      summary: "Narrative production is complete. Jade has generated the novel draft and PDF artifact.",
      seedPrompt,
      outputs: updatedOutputs,
      artifacts: persistedArtifacts,
    });

    return NextResponse.json({ item: production }, { status: 200 });
  } catch (err) {
    console.error("Error generating novel", err);
    const message = err instanceof Error ? err.message : "Failed to generate novel";

    if (selectedItemId) {
      const failedAt = new Date().toISOString();
      const durationMs = seedPrompt ? new Date(failedAt).getTime() - new Date(startedAt).getTime() : undefined;
      const failedRun: NarrativeRunRecord = {
        runId,
        status: "failed",
        startedAt,
        completedAt: failedAt,
        durationMs,
        summary: "Novel generation failed.",
        error: message,
      };

      await updateFastTrackProduction(selectedItemId, {
        mode: "narrative",
        status: "blocked",
        leadAgent: "Jade",
        supportAgents: ["Giselle", "Elita"],
        startedAt,
        currentRunId: runId,
        runs: [failedRun, ...previousRuns].slice(0, 10),
        summary: `Narrative production failed: ${message}`,
        seedPrompt,
      }).catch((updateErr) => console.error("Failed to persist failed run", updateErr));
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
