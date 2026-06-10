import { NextResponse } from "next/server";
import { getRunDir } from "@/lib/file-utils";
import fs from "fs";
import path from "path";
import net from "net";
import { spawn, execSync } from "child_process";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface RunResult {
  success: boolean;
  url?: string;
  source?: "cached" | "fresh";
  message?: string;
  error?: string;
  details?: string;
}

/**
 * Dinamik olarak kullanılabilir boş bir port bulur
 */
async function findFreePort(startPort = 3001): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      server.once("close", () => resolve(startPort));
      server.close();
    });
    server.on("error", () => {
      resolve(findFreePort(startPort + 1));
    });
  });
}

/**
 * Belirtilen portun aktif olarak dinlenip dinlenmediğini kontrol eder
 */
async function isPortActive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * POST /api/runs/[id]/run
 * GET /api/runs/[id]/run
 *
 * Uygulamayı yerel makinede (localhost) çalıştırır ve dev server URL'ini döner.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return runApp(id);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return runApp(id);
}

async function runApp(id: string): Promise<NextResponse<RunResult>> {
  try {
    const runDir = getRunDir(id);
    const appDir = path.join(runDir, "app");

    if (!fs.existsSync(appDir)) {
      return NextResponse.json(
        { success: false, error: "App dizini bulunamadı — pipeline tamamlanmamış olabilir" },
        { status: 404 },
      );
    }

    const pidPath = path.join(appDir, "local-dev.pid");
    const portPath = path.join(appDir, "local-dev.port");

    // 1) Halihazırda çalışan bir dev server var mı?
    if (fs.existsSync(pidPath) && fs.existsSync(portPath)) {
      try {
        const pid = parseInt(fs.readFileSync(pidPath, "utf-8").trim(), 10);
        const port = parseInt(fs.readFileSync(portPath, "utf-8").trim(), 10);

        // Process'in yaşayıp yaşamadığını kontrol et (signal 0)
        let isRunning = false;
        try {
          process.kill(pid, 0);
          isRunning = true;
        } catch {
          isRunning = false;
        }

        // Port da aktifse direkt mevcut adresi dön
        if (isRunning && (await isPortActive(port))) {
          return NextResponse.json({
            success: true,
            url: `http://localhost:${port}`,
            source: "cached",
            message: "Uygulama zaten yerelde çalışıyor",
          });
        }
      } catch (e) {
        // ignore parse/kill errors, fall through to start
      }
    }

    // 2) Yeni dev server başlat
    const port = await findFreePort(3001);

    // Bağımlılıkların kurulu olduğundan emin ol
    const nodeModulesPath = path.join(appDir, "node_modules");
    if (!fs.existsSync(nodeModulesPath)) {
      console.log(`[Local Run] node_modules bulunamadı. Kuruluyor: ${appDir}`);
      try {
        execSync("pnpm install", { cwd: appDir, stdio: "ignore" });
      } catch (err) {
        console.warn("[Local Run] pnpm install başarısız oldu, npm ile deneniyor...", err);
        try {
          execSync("npm install", { cwd: appDir, stdio: "ignore" });
        } catch (npmErr) {
          return NextResponse.json(
            { success: false, error: "Bağımlılıklar kurulamadı (pnpm/npm install başarısız)" },
            { status: 500 },
          );
        }
      }
    }

    // Sunucuyu arka planda (detached) başlat
    console.log(`[Local Run] Dev server başlatılıyor. Port: ${port}`);
    const logFile = path.join(appDir, "local-dev.log");
    const logFd = fs.openSync(logFile, "a");

    // pnpm run dev komutunu çalıştır
    const child = spawn("pnpm", ["run", "dev", "--port", String(port)], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port) },
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });


    child.unref(); // Ebeveyn Next.js sürecinden bağımsızlaştır

    if (child.pid) {
      fs.writeFileSync(pidPath, String(child.pid));
      fs.writeFileSync(portPath, String(port));
    } else {
      return NextResponse.json(
        { success: false, error: "Dev server süreci başlatılamadı" },
        { status: 500 },
      );
    }

    // Sunucunun hazır olmasını bekle (max 15 saniye)
    let ready = false;
    for (let i = 0; i < 15; i++) {
      if (await isPortActive(port)) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (ready) {
      return NextResponse.json({
        success: true,
        url: `http://localhost:${port}`,
        source: "fresh",
        message: "Uygulama başarıyla yerelde başlatıldı",
      });
    }

    // Başlatılamadıysa log dosyasından hata detayını okumaya çalış
    let errorDetails = "";
    try {
      if (fs.existsSync(logFile)) {
        errorDetails = fs.readFileSync(logFile, "utf-8").slice(-500);
      }
    } catch { /* ignore */ }

    return NextResponse.json(
      {
        success: false,
        error: "Dev sunucusu 15 saniye içinde yanıt vermedi",
        details: errorDetails || "Detaylar için local-dev.log dosyasını kontrol edin.",
      },
      { status: 502 },
    );
  } catch (error) {
    console.error("Run app failed:", error);
    return NextResponse.json(
      { success: false, error: "Uygulama çalıştırılamadı", details: String(error) },
      { status: 500 },
    );
  }
}
