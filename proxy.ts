import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

// Paths reachable without a session.
const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/set-password",
  "/api/auth",
  "/api/cron",
  "/eventid/apply", // public tokenized ID form
  "/api/eventid/public", // public token resolve + submit (service-role)
];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect helper — MUST carry over any auth cookies refreshed by getUser(),
  // otherwise a rotated token is dropped and every request re-refreshes => loop.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // If not logged in and not on a public path, redirect to login.
  // Public APIs (e.g. EventID public submit) self-validate their token regardless of proxy.
  const isPublic = PUBLIC_PREFIXES.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );
  if (!user && !isPublic) {
    return redirectTo("/login");
  }

  // If logged in and on login page, redirect to home
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    return redirectTo("/");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)",
  ],
};
