import { NextResponse } from "next/server";
import { generateProductSpec } from "@/lib/gemini";
import { getPipelineManager } from "@/lib/pipeline-manager";
import type { IdeaProposal } from "@/lib/types";
import fs from "fs";
import path from "path";
import { getRunsDir } from "@/lib/file-utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idea, category } = body as { idea: IdeaProposal; category: string };

    if (!idea || !category) {
      return NextResponse.json(
        { error: "Fikir veya kategori eksik" },
        { status: 400 },
      );
    }

    // Generate detailed product spec from the approved idea
    const productSpec = await generateProductSpec(idea, category);

    // Start pipeline with pre-approved spec
    const manager = getPipelineManager();
    const result = await manager.startRunWithSpec(category, productSpec, idea.appName);

    return NextResponse.json({
      ...result,
      appName: idea.appName,
      message: "Pipeline onaylanan fikirle başlatıldı",
    }, { status: 202 });
  } catch (error) {
    console.error("Idea approval failed:", error);
    const message = error instanceof Error ? error.message : "Fikir onaylanamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
