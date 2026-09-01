import { NextResponse, type NextRequest } from 'next/server';
import { DEV_BYPASS } from '@/lib/dev-config';

export async function middleware(request: NextRequest) {
  if (DEV_BYPASS) {
    // In dev bypass mode: allow ALL routes through — no redirects.
    // The auth state is managed by localStorage in the client (lib/auth-context.tsx).
    // page.tsx redirects to /login if not logged in.
    return NextResponse.next({ request });
  }

  // ── Production: use Supabase auth ────────────────────────────────────────
  const { updateSession } = await import('@/lib/supabase/middleware');
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets (sw.js, manifest.json, icons)
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
