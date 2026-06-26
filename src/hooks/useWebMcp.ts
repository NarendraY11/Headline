import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { registerWebMcpTools } from "../lib/webmcp";

// Routes where the WebMCP tool surface is exposed. Per
// docs/agent-readiness-triage.md these are the authenticated app-shell page
// types (11–23) PLUS the public /exams/:examId pages (so the start-test tool
// works from there). It is deliberately NOT loaded on landing, marketing,
// pricing, legal, blog, QOTD, the A320 systems reference, or any /admin route.
const IN_SCOPE_PREFIXES = [
  "/exams/", // public exam landing — tool #1 entry point
  "/today",
  "/modules",
  "/topic",
  "/mock-exams",
  "/analytics",
  "/bookmarks",
  "/profile",
  "/referral",
  "/schedule",
  "/study-plan",
  "/mission",
  "/missions",
  "/exam-centre",
  "/interview-prep",
  "/quiz",
];

function inScope(pathname: string): boolean {
  return IN_SCOPE_PREFIXES.some((p) =>
    p.endsWith("/")
      ? pathname.startsWith(p)
      : pathname === p || pathname.startsWith(p + "/")
  );
}

/**
 * Registers the WebMCP tools while on an in-scope route and unregisters them on
 * navigation away / unmount. Must be rendered inside the Router.
 */
export function useWebMcp(): void {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!inScope(pathname)) return;
    return registerWebMcpTools(navigate);
  }, [pathname, navigate]);
}
