import { serve } from "inngest/express";
import { inngest } from "./inngestClient.js";
import { allFunctions } from "./inngestFunctions.js";

// Re-export so existing callers of `import { inngest } from "./inngest.js"` keep working.
export { inngest };

let _handler: ReturnType<typeof serve> | null = null;

export function getInngestHandler() {
  if (!_handler) {
    _handler = serve({ client: inngest, functions: allFunctions });
  }
  return _handler;
}
