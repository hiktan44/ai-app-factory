import { NextResponse } from "next/server";
import { generateIdea } from "@/lib/gemini";
import { CATEGORIES } from "@/lib/constants";
import { researchTrends } from "@/lib/trend-researcher";

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

    const isKnown = CATEGORIES.some((c) => c.value === category);
    if (!isKnown && !/^[a-z0-9-]+$/.test(category)) {
      return NextResponse.json(
        { error: "Geçersiz kategori formatı" },
        { status: 400 },
      );
    }

    let trendContext: string | undefined;
    try {
      const trends = await researchTrends(category);
      trendContext = buildTrendSummary(trends);
    } catch (e) {
      console.warn("Trend research failed, proceeding without trends:", e);
    }

    const idea = await generateIdea(category, trendContext);

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

function buildTrendSummary(trends: Awaited<ReturnType<typeof researchTrends>>): string {
  const lines: string[] = [];

  if (trends.productHuntDaily.length > 0) {
    lines.push("## ProductHunt Günlük Top 5:");
    for (const p of trends.productHuntDaily.slice(0, 5)) {
      lines.push(`- ${p.name} (${p.votesCount} oy): ${p.tagline}${p.isSaas ? " [SaaS]" : ""}`);
    }
  }

  if (trends.productHuntWeekly.length > 0) {
    lines.push("\n## ProductHunt Haftalık Top 10:");
    for (const p of trends.productHuntWeekly.slice(0, 10)) {
      lines.push(`- ${p.name} (${p.votesCount} oy): ${p.tagline}${p.isSaas ? " [SaaS]" : ""}`);
    }
  }

  if (trends.productHuntMonthly.length > 0) {
    lines.push("\n## ProductHunt Aylık Top 15:");
    for (const p of trends.productHuntMonthly.slice(0, 15)) {
      lines.push(`- ${p.name} (${p.votesCount} oy): ${p.tagline}${p.isSaas ? " [SaaS]" : ""}`);
    }
  }

  if (trends.github15DayRising.length > 0) {
    lines.push("\n## GitHub Son 15 Günde En Çok Yıldız Kazanan:");
    for (const r of trends.github15DayRising.slice(0, 15)) {
      lines.push(`- ${r.name} (${r.stars.toLocaleString()}⭐ ${r.language}): ${r.description} | ${r.url}`);
    }
  }

  if (trends.githubMonthlyTop.length > 0) {
    lines.push("\n## GitHub Aylık Top 10:");
    for (const r of trends.githubMonthlyTop.slice(0, 10)) {
      lines.push(`- ${r.name} (${r.stars.toLocaleString()}⭐ ${r.language}): ${r.description} | ${r.url}`);
    }
  }

  if (trends.githubTrendingWeekly.length > 0) {
    lines.push("\n## GitHub Bu Hafta Trend:");
    for (const r of trends.githubTrendingWeekly.slice(0, 10)) {
      lines.push(`- ${r.name} (${r.stars.toLocaleString()}⭐): ${r.description} | ${r.url}`);
    }
  }

  if (trends.saasOpportunities.length > 0) {
    lines.push("\n## SaaS Fırsatları:");
    for (const o of trends.saasOpportunities) {
      lines.push(`- ${o}`);
    }
  }

  return lines.join("\n");
}
