import { NextResponse } from "next/server";
import { getPipelineManager } from "@/lib/pipeline-manager";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const manager = getPipelineManager();
    const stopped = manager.stopRun(id);

    if (!stopped) {
      return NextResponse.json(
        { error: "Bu pipeline \u00e7al\u0131\u015fm\u0131yor veya bulunamad\u0131" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: "Pipeline durduruldu" });
  } catch (error) {
    console.error("Failed to stop run:", error);
    return NextResponse.json(
      { error: "Pipeline durdurulamad\u0131" },
      { status: 500 },
    );
  }
}
