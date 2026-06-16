import { Inngest } from "inngest";

// Standalone client — no other local imports so there is no circular dependency.
// Both inngest.ts (handler) and inngestFunctions.ts (function definitions) import
// from here, breaking the inngest.ts ↔ inngestFunctions.ts cycle that caused
// ReferenceError: Cannot access 'inngest' before initialization on every request.
export const inngest = new Inngest({
  id: "headline",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
});
