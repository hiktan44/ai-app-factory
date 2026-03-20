import { NextResponse } from "next/server";
import { listArtifacts, getRunDir } from "@/lib/file-utils";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const filePath = url.searchParams.get("file");

  // Dosya içeriği okuma
  if (filePath) {
    try {
      const runDir = getRunDir(id);
      const fullPath = path.join(runDir, filePath);

      // Güvenlik: runDir dışına çıkmayı engelle
      if (!fullPath.startsWith(runDir)) {
        return NextResponse.json({ error: "Geçersiz dosya yolu" }, { status: 400 });
      }

      if (!fs.existsSync(fullPath)) {
        return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 });
      }

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return NextResponse.json({ error: "Dizin okunamaz" }, { status: 400 });
      }

      // Büyük dosyaları sınırla (1MB)
      if (stat.size > 1024 * 1024) {
        const content = fs.readFileSync(fullPath, "utf-8").slice(-50000);
        return NextResponse.json({ content, truncated: true, size: stat.size });
      }

      const content = fs.readFileSync(fullPath, "utf-8");
      return NextResponse.json({ content, truncated: false, size: stat.size });
    } catch (error) {
      console.error("Failed to read artifact:", error);
      return NextResponse.json({ error: "Dosya okunamadı" }, { status: 500 });
    }
  }

  // Normal listing
  try {
    const artifacts = listArtifacts(id);
    return NextResponse.json({ artifacts });
  } catch (error) {
    console.error("Failed to list artifacts:", error);
    return NextResponse.json({ artifacts: [] });
  }
}
