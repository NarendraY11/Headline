// Vercel Edge Middleware: serve pre-built .md files when Accept: text/markdown
// is requested exactly. Every other Accept value falls through unchanged.
export default async function middleware(request: Request): Promise<Response | void> {
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
  try {
    const res = await fetch(`${origin}${pathBase}/index.md`);
    // If the .md file doesn't exist the SPA fallback serves index.html — skip it.
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return;
    return new Response(await res.text(), {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        vary: 'Accept',
      },
    });
  } catch {
    return;
  }
}
