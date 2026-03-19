import { NextResponse } from "next/server";
import { getRunDir } from "@/lib/file-utils";
import fs from "fs";
import path from "path";
import { marked } from "marked";

export const dynamic = "force-dynamic";

// Security: only these files can be downloaded
const allowedFiles = ["product-spec.md", "review-report.md"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "md";
  const file = url.searchParams.get("file") || "product-spec.md";

  // Validate file name (prevent path traversal)
  const baseName = path.basename(file);
  if (!allowedFiles.includes(baseName)) {
    return NextResponse.json(
      { error: "Bu dosya indirilemez" },
      { status: 403 },
    );
  }

  const runDir = getRunDir(id);
  const filePath = path.join(runDir, baseName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Dosya bulunamadı" },
      { status: 404 },
    );
  }

  const content = fs.readFileSync(filePath, "utf-8");

  // --- Format: Raw Markdown ---
  if (format === "md") {
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}"`,
      },
    });
  }

  // --- Format: Print-ready HTML (for Save as PDF) ---
  if (format === "pdf") {
    const htmlBody = await marked.parse(content);
    const title = baseName.replace(".md", "");

    const fullHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.7;
      color: #1a1a2e;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 32px;
      background: #fff;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #0f0f23;
      border-bottom: 3px solid #6366f1;
      padding-bottom: 12px;
    }

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin-top: 32px;
      margin-bottom: 12px;
      color: #1e1b4b;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
    }

    h3 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 8px;
      color: #312e81;
    }

    p {
      margin-bottom: 12px;
      font-size: 14px;
    }

    ul, ol {
      margin-bottom: 12px;
      padding-left: 24px;
    }

    li {
      margin-bottom: 6px;
      font-size: 14px;
    }

    strong {
      font-weight: 600;
      color: #1e1b4b;
    }

    code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }

    pre {
      background: #1e1b4b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 16px;
    }

    pre code {
      background: none;
      padding: 0;
      color: inherit;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 13px;
    }

    th, td {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: #f8fafc;
      font-weight: 600;
      color: #1e1b4b;
    }

    blockquote {
      border-left: 4px solid #6366f1;
      padding: 8px 16px;
      margin: 12px 0;
      background: #f8fafc;
      color: #475569;
    }

    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }

    /* Print styles */
    @media print {
      body {
        padding: 20px;
        font-size: 12px;
      }
      h1 { font-size: 22px; }
      h2 { font-size: 16px; break-after: avoid; }
      h3 { font-size: 14px; break-after: avoid; }
      p, li { font-size: 12px; }
      pre { font-size: 11px; }
      table { font-size: 11px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#6366f1;color:#fff;padding:12px 20px;border-radius:8px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:14px;">PDF olarak kaydetmek için <strong>Ctrl+P</strong> (Mac: <strong>⌘P</strong>) → <em>"PDF olarak kaydet"</em> seçin</span>
    <button onclick="window.print()" style="background:#fff;color:#6366f1;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;">PDF İndir</button>
  </div>
  ${htmlBody}
  <script>
    // Auto-trigger print dialog after a short delay
    setTimeout(() => window.print(), 800);
  </script>
</body>
</html>`;

    return new NextResponse(fullHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  return NextResponse.json(
    { error: "Geçersiz format. 'md' veya 'pdf' kullanın." },
    { status: 400 },
  );
}
