import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "nx_scraper_auth";
const PUBLIC_PATHS = ["/api/auth"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const auth = req.cookies.get(SESSION_COOKIE);
  if (!auth?.value) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon.png).*)"],
};
