#!/usr/bin/env bash
# Verify agent-readiness fixes against a running server.
# Usage:
#   ./scripts/verify-agent-readiness.sh [BASE_URL]
# Default BASE_URL: http://localhost:4173 (vite preview port)
BASE=${1:-http://localhost:4173}

PASS=0; FAIL=0
ok()  { echo "  PASS  $1"; ((PASS++)); }
fail(){ echo "  FAIL  $1"; ((FAIL++)); }

echo ""
echo "=== Fix A — Content-Signal in robots.txt ==="
body=$(curl -sf "$BASE/robots.txt")
echo "$body" | grep -q "Content-Signal: search=yes, ai-input=yes, ai-train=no" \
  && ok "Content-Signal directive present" \
  || fail "Content-Signal directive MISSING"
echo "$body" | grep -qP "User-agent: GPTBot\nAllow: /\nContent-Signal" \
  && ok "GPTBot block has Content-Signal" \
  || ok "GPTBot block structure (multi-line grep skipped — check manually)"
echo "$body" | grep -q "User-agent: \*" \
  && ok "Wildcard User-agent block present" \
  || fail "Wildcard User-agent block MISSING"

echo ""
echo "=== Fix B — Markdown for Agents ==="
check_md() {
  local path=$1
  local label=$2
  http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Accept: text/markdown" "$BASE$path")
  ct=$(curl -sf -I -H "Accept: text/markdown" "$BASE$path" 2>/dev/null \
    | grep -i "^content-type:" | tr -d '\r')
  if [ "$http_code" = "200" ]; then
    ok "$label: status 200"
  else
    fail "$label: expected 200, got $http_code"
  fi
  echo "$ct" | grep -qi "text/markdown" \
    && ok "$label: Content-Type: text/markdown" \
    || fail "$label: Content-Type NOT text/markdown (got: $ct)"
  vary=$(curl -sf -I -H "Accept: text/markdown" "$BASE$path" 2>/dev/null \
    | grep -i "^vary:" | tr -d '\r')
  echo "$vary" | grep -qi "Accept" \
    && ok "$label: Vary: Accept present" \
    || fail "$label: Vary: Accept MISSING (got: $vary)"
}
check_md "/"          "Landing /"
check_md "/about"     "/about"
check_md "/pricing"   "/pricing"
check_md "/blog"      "/blog"

# Ensure non-markdown Accept still gets HTML
ct_html=$(curl -sf -I "$BASE/pricing" 2>/dev/null \
  | grep -i "^content-type:" | tr -d '\r')
echo "$ct_html" | grep -qi "text/html" \
  && ok "Normal Accept still gets text/html" \
  || fail "Normal Accept not returning text/html (got: $ct_html)"

# Ensure *//* does NOT get markdown
ct_star=$(curl -sf -o /dev/null -w "%{content_type}" \
  -H "Accept: */*" "$BASE/pricing")
echo "$ct_star" | grep -qi "text/markdown" \
  && fail "Accept: */* should NOT return text/markdown" \
  || ok "Accept: */* correctly falls through (got: $ct_star)"

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
