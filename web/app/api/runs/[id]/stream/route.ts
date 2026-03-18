import fs from "fs";
import path from "path";
import { getRunDir } from "@/lib/file-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const runDir = getRunDir(id);
  const logPath = path.join(runDir, "pipeline.log");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let position = 0;
      let isAborted = false;

      // Send existing content first
      if (fs.existsSync(logPath)) {
        try {
          const existing = fs.readFileSync(logPath, "utf-8");
          position = Buffer.byteLength(existing, "utf-8");
          const msg = JSON.stringify({ type: "initial", content: existing });
          controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
        } catch {
          // File might be temporarily locked
        }
      }

      // Poll for changes every 500ms
      const interval = setInterval(() => {
        if (isAborted) {
          clearInterval(interval);
          return;
        }

        try {
          if (!fs.existsSync(logPath)) return;

          const stat = fs.statSync(logPath);
          if (stat.size <= position) return;

          // Read only new bytes
          const fd = fs.openSync(logPath, "r");
          const bufferSize = stat.size - position;
          const buffer = Buffer.alloc(bufferSize);
          fs.readSync(fd, buffer, 0, bufferSize, position);
          fs.closeSync(fd);
          position = stat.size;

          const newContent = buffer.toString("utf-8");
          const msg = JSON.stringify({ type: "append", content: newContent });
          controller.enqueue(encoder.encode(`data: ${msg}\n\n`));

          // Check if pipeline completed
          if (
            newContent.includes("PIPELINE TAMAMLANDI") ||
            newContent.includes("=== AI APP FACTORY - TAMAMLANDI ===")
          ) {
            const completeMsg = JSON.stringify({ type: "complete" });
            controller.enqueue(encoder.encode(`data: ${completeMsg}\n\n`));
            clearInterval(interval);
            controller.close();
          }
        } catch {
          // File temporarily unavailable, retry next interval
        }
      }, 500);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        isAborted = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });

      // Safety timeout: close after 2 hours max
      setTimeout(() => {
        if (!isAborted) {
          isAborted = true;
          clearInterval(interval);
          try {
            const timeoutMsg = JSON.stringify({
              type: "complete",
              status: "timeout",
            });
            controller.enqueue(encoder.encode(`data: ${timeoutMsg}\n\n`));
            controller.close();
          } catch {
            // Already closed
          }
        }
      }, 2 * 60 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
