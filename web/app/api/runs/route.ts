import { NextResponse } from "next/server";
import { listRuns } from "@/lib/file-utils";
import { getPipelineManager } from "@/lib/pipeline-manager";
import { CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const manager = getPipelineManager();
    const runs = listRuns(manager.activeRunId);
    const queue = manager.getQueue();

    return NextResponse.json({ runs, queue });
  } catch (error) {
    console.error("Failed to list runs:", error);
    return NextResponse.json({ runs: [], queue: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category } = body;

    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { error: "Kategori belirtilmedi" },
        { status: 400 },
      );
    }

    // Validate category (allow custom categories too)
    const isKnown = CATEGORIES.some((c) => c.value === category);
    if (!isKnown && !/^[a-z0-9-]+$/.test(category)) {
      return NextResponse.json(
        { error: "Ge\u00e7ersiz kategori format\u0131. K\u00fc\u00e7\u00fck harf, say\u0131 ve tire kullan\u0131n." },
        { status: 400 },
      );
    }

    const manager = getPipelineManager();
    const result = await manager.startRun(category);

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error("Failed to start run:", error);
    return NextResponse.json(
      { error: "Pipeline ba\u015flat\u0131lamad\u0131" },
      { status: 500 },
    );
  }
}
