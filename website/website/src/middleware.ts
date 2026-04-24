import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  // API routes called by extensions — auth handled inside the route via auth()
  '/api/context(.*)',
  '/api/workspace(.*)',
  '/api/save(.*)',
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const origin = req.headers.get('origin') ?? '';
  const isExtension = origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://');

  // Handle CORS pre-flight for extension requests
  if (req.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    if (isExtension) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Access-Control-Allow-Credentials', 'true');
      res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    return res;
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const res = NextResponse.next();

  // Attach CORS headers for all extension API requests
  if (isExtension && req.nextUrl.pathname.startsWith('/api/')) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }

  return res;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
