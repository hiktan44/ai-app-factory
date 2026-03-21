import { NextResponse } from "next/server";
import { getRunDir } from "@/lib/file-utils";
import { getPipelineManager } from "@/lib/pipeline-manager";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const manager = getPipelineManager();

    // Çalışan pipeline silinemez
    if (manager.activeRunIds.includes(id)) {
      return NextResponse.json(
        { error: "Çalışan pipeline silinemez. Önce durdurun." },
        { status: 400 },
      );
    }

    const runDir = getRunDir(id);

    if (!fs.existsSync(runDir)) {
      return NextResponse.json(
        { error: "Run bulunamadı" },
        { status: 404 },
      );
    }

    // Dizini recursive sil
    fs.rmSync(runDir, { recursive: true, force: true });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error("Failed to delete run:", error);
    return NextResponse.json(
      { error: "Silme başarısız" },
      { status: 500 },
    );
  }
}
