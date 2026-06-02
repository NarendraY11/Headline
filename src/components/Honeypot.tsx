import { useState } from "react";

// Honeypot anti-bot trap. The field is visually hidden and removed from the tab
// order / a11y tree, so real users never see or fill it. Bots that blindly
// populate every input will set it, letting us silently reject the submission.
// Field name must match HONEYPOT_FIELD in api/_lib/utils.ts for the backend
// check to line up on endpoints that forward it.
export const HONEYPOT_FIELD = "website";

const hiddenStyle: React.CSSProperties = {
  position: "absolute",
  left: "-9999px",
  top: "auto",
  width: 1,
  height: 1,
  overflow: "hidden",
};

export function useHoneypot() {
  const [value, setValue] = useState("");

  const field = (
    <div aria-hidden="true" style={hiddenStyle}>
      <label>
        Leave this field empty
        <input
          type="text"
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
    </div>
  );

  return { value, field, isBot: value.trim() !== "" };
}
