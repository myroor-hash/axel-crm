import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type GenericSchema = {
  Tables: Record<string, GenericTable>;
  Views: Record<string, never>;
  Functions: Record<string, never>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
};

type GenericDatabase = {
  public: GenericSchema;
};

export async function middleware(request: NextRequest) {
  const authBypassEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.CRM_DEV_BYPASS_AUTH === "true";

  if (authBypassEnabled) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient<GenericDatabase>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isLoginRoute = request.nextUrl.pathname === "/login";
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/callback");
  const isMfaRoute = request.nextUrl.pathname.startsWith("/auth/mfa");
  const isEmailApiRoute = request.nextUrl.pathname.startsWith("/api/email/");
  const isProtectedRoute =
    !isLoginRoute && !isAuthCallback && !isEmailApiRoute && !isMfaRoute;

  const accessToken = session?.access_token;
  let currentLevel: string | null = null;

  if (accessToken) {
    const { data } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);
    currentLevel = data?.currentLevel ?? null;
  }

  if (!user && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && currentLevel !== "aal2" && isProtectedRoute) {
    return NextResponse.redirect(new URL("/auth/mfa", request.url));
  }

  if (user && isLoginRoute) {
    return NextResponse.redirect(
      new URL(currentLevel === "aal2" ? "/" : "/auth/mfa", request.url)
    );
  }

  if (user && isMfaRoute && currentLevel === "aal2") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
