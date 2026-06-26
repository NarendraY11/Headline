declare const __APP_VERSION__: string;
declare const __SENTRY_RELEASE__: string;

// WebMCP (navigator.modelContext). The API is still in flux: the early-preview
// builds expose `provideContext({ tools })`, the W3C draft uses
// `registerTool(tool, { signal })`. We type both as optional and feature-detect
// at the call site (see src/lib/webmcp.ts).
interface ModelContextTool {
  name: string;
  description: string;
  inputSchema?: object;
  execute: (input: any) => Promise<any>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
}

interface Navigator {
  modelContext?: {
    provideContext?: (context: { tools: ModelContextTool[] }) => void;
    registerTool?: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => unknown;
  };
}
