import { NextResponse } from "next/server";
import { listArtifacts } from "@/lib/file-utils";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const artifacts = listArtifacts(id);
    return NextResponse.json({ artifacts });
  } catch (error) {
    console.error("Failed to list artifacts:", error);
    return NextResponse.json({ artifacts: [] });
  }
}
