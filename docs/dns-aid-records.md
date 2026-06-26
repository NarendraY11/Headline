# DNS-AID Records — heading380.in

_Date: 2026-06-26 · Phase 6_

DNS-AID (Agent Interface Discovery) lets AI agents find an organisation's **callable
agent endpoints** by looking up special DNS records, instead of guessing URLs. See
[draft-mozleywilliams-dnsop-dnsaid](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/)
and the SVCB record format in [RFC 9460](https://www.rfc-editor.org/rfc/rfc9460).

---

## TL;DR — do not publish anything yet

**There is nothing to advertise today.** A DNS-AID record points at a *live agent
endpoint* (a remote MCP or A2A server an agent can connect to). Heading has none:

- The **remote MCP server is deferred** (Phase 5 decision) — it doesn't exist.
- **WebMCP is browser-session-only.** Its tools live in `navigator.modelContext`,
  registered inside the user's own tab. There is no public URL, port, or hostname an
  outside agent could connect to — so there is nothing for a DNS record to target.
- `llms.txt` is **static metadata**, already advertised via the Phase 3 `Link`
  header. DNS-AID is for *interfaces you can call*, not documents you can read, so
  `llms.txt` is not what DNS-AID is for.

Publishing a DNS-AID record now would mean pointing it at a hostname that serves no
agent — a broken signal. **Revisit this doc only when a real remote MCP/A2A endpoint
goes live.** Everything below is a ready-to-paste template for that day, not a task
for today.

---

## The record you *would* publish (template — hold until an endpoint exists)

Once a remote MCP server is live at, say, `mcp.heading380.in`, the organisation index
record looks like this (SVCB, per the spec):

```
_index._agents.heading380.in.  3600  IN  SVCB  1 mcp.heading380.in. alpn=mcp,h2 port=443
```

Field-by-field:

| Field | Value | Meaning |
|-------|-------|---------|
| **Name / host** | `_index._agents.heading380.in` | The DNS-AID "index" label for the whole domain. `_index._agents` is fixed by the spec; only the domain at the end is ours. |
| **Type** | `SVCB` | The record type DNS-AID uses. (`HTTPS` is a sibling type; DNS-AID specifically uses `SVCB`.) |
| **TTL** | `3600` | Seconds the answer may be cached (1 hour). Fine to leave at the dashboard default. |
| **Priority** | `1` | "ServiceMode" — this record carries real connection params. Use `1`, not `0`. |
| **Target** | `mcp.heading380.in.` | The hostname of the live agent endpoint. **Replace with the real host when it exists.** Note the trailing dot in zone-file form; dashboards usually don't need it. |
| **Params** | `alpn=mcp,h2 port=443` | How to connect: `alpn=mcp,h2` = speaks the MCP agent protocol over HTTP/2; `port=443` = standard HTTPS port. Adjust `alpn` to `a2a` (or add it) if an A2A endpoint is published instead. |

> Each agent protocol is a **separate record**. If both an MCP and an A2A endpoint
> ever exist, publish two records (one `alpn=mcp,...`, one `alpn=a2a,...`), not one
> record listing both.

Optional spec params you can add later if useful: `well-known=agent-card.json` (path
to a capability card), `cap` + `cap-sha256` (a signed capability descriptor),
`ipv4hint`/`ipv6hint` (target IPs to save a lookup). None are needed for a minimal
first record.

---

## How to paste this into a DNS dashboard (zero networking background)

DNS records are managed either at **Vercel** (Dashboard → your project → Domains, if
nameservers point at Vercel) or at the **domain registrar** where `heading380.in` was
bought (the `.in` registrar). First confirm which one controls DNS — check the Vercel
Domains tab; if it shows the records, use Vercel, otherwise use the registrar.

Then, in whichever dashboard controls DNS, find **"DNS Records"** → **"Add Record"**
and fill the form:

1. **Type:** choose `SVCB` from the dropdown.
2. **Name / Host:** type `_index._agents`
   - Most dashboards automatically add `.heading380.in` for you — so you enter only
     the part *before* the domain. If the form instead wants the full name, type
     `_index._agents.heading380.in`.
3. **Value / Data / Target:** paste the part after the type, i.e.
   `1 mcp.heading380.in. alpn=mcp,h2 port=443`
   - Some dashboards split this into separate boxes — **Priority** = `1`,
     **Target** = `mcp.heading380.in`, and a **Params** box = `alpn=mcp,h2 port=443`.
4. **TTL:** leave the default (often "Auto" or 3600).
5. Save. Changes can take a few minutes to a few hours to spread across the internet.

To check it worked later, anyone can run `dig SVCB _index._agents.heading380.in` (or
use an online "DNS lookup" tool for type SVCB) and see the record come back.

### If the dashboard has no SVCB / HTTPS option

Some registrars haven't added the SVCB record type to their UI yet. Options, in order
of preference:

1. **Move DNS to a provider that supports SVCB** — Vercel DNS and Cloudflare both do.
   Pointing the domain's nameservers at one of them gives you the `SVCB` type. This is
   the clean fix.
2. **Ask the registrar's support** to add an SVCB record for you, or to enable it.
3. **Wait** — there is no harm in not publishing, because (per the TL;DR) there is
   nothing to point at yet anyway. Do not substitute a `TXT` record as a workaround;
   the DNS-AID spec treats TXT only as a non-preferred fallback and agents may not
   read it.

---

## DNSSEC — what it is and what to check

**DNSSEC** (DNS Security Extensions) cryptographically *signs* your DNS records so a
resolver can verify the answer it got is genuine and wasn't tampered with in transit.
Plain DNS has no such signature — an attacker positioned in the network could forge a
reply and point agents at a hostname you don't control. For an *agent discovery*
record, that matters more than usual: the whole point is that agents trust the record
to find your real endpoint.

The DNS-AID draft says discovery records **SHOULD be DNSSEC-signed** (and that *if*
TLSA records are ever added, those MUST be signed). It is a strong recommendation, not
a hard blocker — but when a real endpoint is published, signing is the right call.

**What you need to do (separately, when the time comes):** open your DNS provider's
dashboard and look for a **"DNSSEC"** toggle or section (Vercel, Cloudflare, and most
registrars expose one). It may already be on or off — **this doc does not assume
either way; check the dashboard.** Enabling it is usually a one-click switch at the
provider; if DNS is at the registrar but signing is done elsewhere you may also need to
paste a "DS record" back into the registrar. Confirm the dashboard shows DNSSEC as
**active** before relying on it.

---

## Summary

- **Action today:** none. No agent endpoint exists to advertise.
- **When a remote MCP/A2A server ships:** publish the SVCB record above with the real
  target host, then enable DNSSEC.
- **Blocker to revisit:** Phase 5's deferred MCP-server decision. DNS-AID is downstream
  of that — it cannot be meaningfully published first.
