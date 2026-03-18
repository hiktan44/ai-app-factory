import { NextResponse } from "next/server";
import { generateIdea } from "@/lib/gemini";
import { CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category } = body;

    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { error: "Kategori belirtilmedi" },
        { status: 400 },
      );
    }

    // Validate category
    const isKnown = CATEGORIES.some((c) => c.value === category);
    if (!isKnown && !/^[a-z0-9-]+$/.test(category)) {
      return NextResponse.json(
        { error: "Geçersiz kategori formatı" },
        { status: 400 },
      );
    }

    const idea = await generateIdea(category);

    return NextResponse.json({
      idea,
      category,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Idea generation failed:", error);
    const message = error instanceof Error ? error.message : "Fikir üretilemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
