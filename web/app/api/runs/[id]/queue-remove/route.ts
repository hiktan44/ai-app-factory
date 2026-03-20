import { NextResponse } from "next/server";
import { getPipelineManager } from "@/lib/pipeline-manager";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const manager = getPipelineManager();
    const removed = manager.removeFromQueue(id);

    if (removed) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { error: "Pipeline kuyrukta bulunamadı" },
      { status: 404 },
    );
  } catch (error) {
    console.error("Failed to remove from queue:", error);
    return NextResponse.json(
      { error: "Kuyruktan çıkarma başarısız" },
      { status: 500 },
    );
  }
}
