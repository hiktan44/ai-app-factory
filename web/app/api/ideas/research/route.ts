import { NextResponse } from "next/server";
import { researchIdea } from "@/lib/idea-researcher";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { idea: string; category: string };
    const { idea, category } = body;

    if (!idea || !category) {
      return NextResponse.json({ error: "idea ve category gerekli" }, { status: 400 });
    }

    const research = await researchIdea(idea, category);
    return NextResponse.json(research);
  } catch (error) {
    console.error("Research error:", error);
    return NextResponse.json({ error: "Araştırma başarısız" }, { status: 500 });
  }
}
