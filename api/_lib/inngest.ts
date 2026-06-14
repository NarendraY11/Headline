import { Inngest } from "inngest";
import { serve } from "inngest/express";
import { allFunctions } from "./inngestFunctions.js";

export const inngest = new Inngest({
  id: "headline",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
});

let _handler: ReturnType<typeof serve> | null = null;

export function getInngestHandler() {
  if (!_handler) {
    _handler = serve({ client: inngest, functions: allFunctions });
  }
  return _handler;
}
