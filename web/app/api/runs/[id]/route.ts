import { NextResponse } from "next/server";
import { getRunDetail } from "@/lib/file-utils";
import { getPipelineManager } from "@/lib/pipeline-manager";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const manager = getPipelineManager();
    const run = getRunDetail(id, manager.activeRunIds);

    if (!run) {
      return NextResponse.json(
        { error: "Run bulunamad\u0131" },
        { status: 404 },
      );
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error("Failed to get run detail:", error);
    return NextResponse.json(
      { error: "Run detay\u0131 al\u0131namad\u0131" },
      { status: 500 },
    );
  }
}
