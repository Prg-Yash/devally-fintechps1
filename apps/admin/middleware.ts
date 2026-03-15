import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname === "/";
  const session = request.cookies.get("admin_session")?.value;

  // Unauthenticated user trying to access a protected route
  if (!session && !isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Authenticated user trying to access the login page
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/analytics", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
