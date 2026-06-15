import { useContext } from "react";
import {
  PreviewDraftFlagsContext,
  PreviewModeContext,
  PreviewPanelStateContext,
  PreviewSelectionContext,
} from "./PreviewModeProvider";

export function usePreviewMode() {
  const context = useContext(PreviewModeContext);
  if (!context) {
    throw new Error("usePreviewMode must be used within PreviewModeProvider.");
  }
  return context;
}

export function usePreviewSelection() {
  const context = useContext(PreviewSelectionContext);
  if (!context) {
    throw new Error("usePreviewSelection must be used within PreviewModeProvider.");
  }
  return context;
}

export function usePreviewPanelState() {
  const context = useContext(PreviewPanelStateContext);
  if (!context) {
    throw new Error("usePreviewPanelState must be used within PreviewModeProvider.");
  }
  return context;
}

export function usePreviewDraftFlags() {
  const context = useContext(PreviewDraftFlagsContext);
  if (!context) {
    throw new Error("usePreviewDraftFlags must be used within PreviewModeProvider.");
  }
  return context;
}
