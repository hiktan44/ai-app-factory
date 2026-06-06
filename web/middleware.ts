import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // If ADMIN_PASSWORD is not set, allow access (local dev mode)
  if (!adminPassword) {
    return NextResponse.next();
  }

  // Check auth cookie or Authorization header
  const authCookie = request.cookies.get("factory_auth")?.value;
  const authHeader = request.headers.get("Authorization");

  const authenticated =
    authCookie === adminPassword ||
    authHeader === `Bearer ${adminPassword}`;

  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api");
  const isLoginPath = pathname === "/login";

  if (authenticated || isLoginPath) {
    if (authenticated && isLoginPath) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Exclude health check from protection
  if (isApi) {
    if (pathname === "/api/health") {
      return NextResponse.next();
    }
    return new NextResponse(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
