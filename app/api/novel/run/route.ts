import { unlink } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { getFastTrackItem, updateFastTrackProduction } from "@/lib/fast-track-repository";

function resolvePublicPath(pdfUrl: string) {
  const relative = pdfUrl.replace(/^\//, "");
  return path.join(process.cwd(), "public", relative);
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const itemId = String(body?.itemId || "").trim();
    const runId = String(body?.runId || "").trim();

    if (!itemId || !runId) {
      return NextResponse.json({ error: "itemId and runId are required." }, { status: 400 });
    }

    const item = await getFastTrackItem(itemId);
    if (!item) {
      return NextResponse.json({ error: "Fast Track item not found." }, { status: 404 });
    }

    const runs = item.production?.runs || [];
    const targetRun = runs.find((run) => run.runId === runId);
    if (!targetRun) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    if (targetRun.pdfUrl) {
      const pdfPath = resolvePublicPath(targetRun.pdfUrl);
      await unlink(pdfPath).catch(() => {});
    }

    const updatedRuns = runs.filter((run) => run.runId !== runId);

    const latestPdfRun = updatedRuns.find((run) => run.pdfUrl);

    const updated = await updateFastTrackProduction(itemId, {
      ...(item.production || {}),
      runs: updatedRuns,
      artifacts: latestPdfRun?.pdfUrl
        ? {
            ...(item.production?.artifacts || {}),
            pdfUrl: latestPdfRun.pdfUrl,
          }
        : {},
      summary: latestPdfRun?.pdfUrl
        ? item.production?.summary || "Narrative production state updated."
        : "Novel PDF removed from this run.",
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (err) {
    console.error("Error deleting novel run PDF", err);
    const message = err instanceof Error ? err.message : "Failed to delete novel run PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
