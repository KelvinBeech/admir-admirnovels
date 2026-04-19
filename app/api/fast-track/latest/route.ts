import { NextResponse } from "next/server";

import { getLatestNarrativeFastTrackItem } from "@/lib/fast-track-repository";

export async function GET() {
  try {
    const item = await getLatestNarrativeFastTrackItem();
    return NextResponse.json({ item }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load latest Fast Track item";
    console.error("Error loading latest Fast Track item", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
