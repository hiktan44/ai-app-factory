import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ai-app-factory-web",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
}
