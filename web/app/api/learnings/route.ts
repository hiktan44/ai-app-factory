import { NextResponse } from "next/server";
import { readLearnings } from "@/lib/file-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const learnings = readLearnings();
    return NextResponse.json(learnings);
  } catch (error) {
    console.error("Failed to read learnings:", error);
    return NextResponse.json({});
  }
}
