// Vercel Edge Middleware: serve pre-built .md files when Accept: text/markdown
// is requested exactly. Every other Accept value falls through unchanged.
//
// Uses x-middleware-rewrite (an internal Vercel operation) instead of a
// same-origin fetch so the rewrite works regardless of SSO deployment
// protection on preview deployments — no outbound HTTP request is made.
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
