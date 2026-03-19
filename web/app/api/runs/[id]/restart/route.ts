import { NextResponse } from "next/server";
import { getPipelineManager } from "@/lib/pipeline-manager";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const manager = getPipelineManager();
    const result = await manager.restartRun(id);

    if (!result) {
      return NextResponse.json(
        { error: "Run ID geçersiz veya kategori belirlenemiyor" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      newRunId: result.newRunId,
      queued: result.queued,
      message: result.queued
        ? "Pipeline kuyruğa alındı"
        : "Pipeline yeniden başlatıldı",
    });
  } catch (error) {
    console.error("Failed to restart run:", error);
    return NextResponse.json(
      { error: "Pipeline yeniden başlatılamadı" },
      { status: 500 },
    );
  }
}
