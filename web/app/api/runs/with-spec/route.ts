import { NextResponse } from "next/server";
import { getPipelineManager } from "@/lib/pipeline-manager";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      category: string;
      productSpec: string;
      appName: string;
    };

    const { category, productSpec, appName } = body;

    if (!category || !productSpec || !appName) {
      return NextResponse.json({ error: "category, productSpec ve appName gerekli" }, { status: 400 });
    }

    const manager = getPipelineManager();
    const result = await manager.startRunWithSpec(category, productSpec, appName);

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error("Failed to start run with spec:", error);
    return NextResponse.json({ error: "Pipeline başlatılamadı" }, { status: 500 });
  }
}
