// Vercel Edge Middleware: serve pre-built .md files when Accept: text/markdown
// is requested exactly. Every other Accept value falls through unchanged.
//
// Uses x-middleware-rewrite (an internal Vercel operation) instead of a
// same-origin fetch so the rewrite works regardless of SSO deployment
// protection on preview deployments — no outbound HTTP request is made.

// Matcher restricts middleware to HTML routes only — excludes API, Vercel internals,
// and all static assets (fonts, images, JS, CSS) to reduce edge request consumption.
export const config = {
  matcher: [
    '/((?!api|_vercel|assets|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};

export default function middleware(request: Request): Response | void {
  const { pathname, origin } = new URL(request.url);

  // Skip API routes, Vercel internals, and paths that already have a file extension.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_vercel') ||
    /\.\w+$/.test(pathname)
  ) {
    return;
  }

  // Only intercept when the client explicitly wants text/markdown (not */*, not text/*).
  const accept = request.headers.get('accept') ?? '';
  const wantsMarkdown = accept
    .split(',')
    .some(part => part.trim().split(';')[0].trim() === 'text/markdown');
  if (!wantsMarkdown) return;

  // Prerender writes dist/<route>/index.md (dist/index.md for root).
  const pathBase = pathname === '/' ? '' : pathname.replace(/\/$/, '');
  return new Response(null, {
    headers: {
      'x-middleware-rewrite': new URL(`${pathBase}/index.md`, origin).href,
      'content-type': 'text/markdown; charset=utf-8',
      vary: 'Accept',
    },
  });
}
