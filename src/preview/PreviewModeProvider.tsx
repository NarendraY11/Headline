import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { FeatureDefinition } from "../views/admin/featureRegistry";
import type { FlagKeys, Flags } from "../hooks/useFeatureFlags";
import { usePreviewRenderDiagnostics } from "./previewDiagnostics";

export type PreviewPanelStatus = "idle" | "loading" | "error" | "unavailable" | "selected";
type ResolvedPreviewPanelStatus = Extract<PreviewPanelStatus, "selected" | "unavailable">;

export interface PreviewModeContextValue {
  isPreviewMode: boolean;
  draftFlags: Flags;
  selectedFeature: FeatureDefinition | null;
  status: PreviewPanelStatus;
  error: string | null;
  setDraftFlag: (key: FlagKeys, value: Flags[FlagKeys]) => void;
  setDraftFlags: (flags: Flags) => void;
  selectFeature: (feature: FeatureDefinition | null) => void;
  setSelectedFeature: (feature: FeatureDefinition | null) => void;
  setStatus: (status: PreviewPanelStatus) => void;
  setError: (error: string | null) => void;
  clearPreview: () => void;
}

export const PreviewModeContext = createContext<PreviewModeContextValue | null>(null);
export const PreviewSelectionContext = createContext<Pick<
  PreviewModeContextValue,
  "selectedFeature" | "selectFeature" | "setSelectedFeature" | "clearPreview"
> | null>(null);
export const PreviewPanelStateContext = createContext<Pick<
  PreviewModeContextValue,
  "status" | "error" | "setStatus" | "setError"
> | null>(null);
export const PreviewDraftFlagsContext = createContext<Pick<
  PreviewModeContextValue,
  "isPreviewMode" | "draftFlags" | "setDraftFlag" | "setDraftFlags"
> | null>(null);

interface PreviewModeProviderProps {
  children: ReactNode;
  draftFlags: Flags;
  isPreviewMode?: boolean;
  onDraftFlagsChange?: (flags: SetStateAction<Flags>) => void;
  resolvePreviewStatus?: (feature: FeatureDefinition) => ResolvedPreviewPanelStatus;
  selectionDelayMs?: number;
}

export function PreviewModeProvider({
  children,
  draftFlags,
  isPreviewMode = true,
  onDraftFlagsChange,
  resolvePreviewStatus,
  selectionDelayMs = 140,
}: PreviewModeProviderProps) {
  usePreviewRenderDiagnostics("PreviewModeProvider");
  const previewTimerRef = useRef<number | null>(null);
  const [selectedFeature, setSelectedFeatureState] = useState<FeatureDefinition | null>(null);
  const [status, setStatus] = useState<PreviewPanelStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const clearPendingSelection = useCallback(() => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPendingSelection();
    };
  }, [clearPendingSelection]);

  const setDraftFlags = useCallback(
    (nextFlags: SetStateAction<Flags>) => {
      onDraftFlagsChange?.(nextFlags);
    },
    [onDraftFlagsChange]
  );

  const setDraftFlag = useCallback(
    (key: FlagKeys, flagValue: Flags[FlagKeys]) => {
      if (!onDraftFlagsChange) {
        return;
      }
      onDraftFlagsChange((prev) => ({ ...prev, [key]: flagValue }));
    },
    [onDraftFlagsChange]
  );

  const selectFeature = useCallback(
    (feature: FeatureDefinition | null) => {
      clearPendingSelection();
      setSelectedFeatureState(feature);
      setError(null);

      if (!feature) {
        setStatus("idle");
        return;
      }

      setStatus("loading");
      previewTimerRef.current = window.setTimeout(() => {
        try {
          const nextStatus = resolvePreviewStatus?.(feature) ?? "selected";
          setStatus(nextStatus);
        } catch (selectionError) {
          setError(
            selectionError instanceof Error
              ? selectionError.message
              : "The preview panel could not prepare this feature."
          );
          setStatus("error");
        } finally {
          previewTimerRef.current = null;
        }
      }, selectionDelayMs);
    },
    [clearPendingSelection, resolvePreviewStatus, selectionDelayMs]
  );

  const clearPreview = useCallback(() => {
    clearPendingSelection();
    setSelectedFeatureState(null);
    setError(null);
    setStatus("idle");
  }, [clearPendingSelection]);

  const selectionValue = useMemo(
    () => ({
      selectedFeature,
      selectFeature,
      setSelectedFeature: setSelectedFeatureState,
      clearPreview,
    }),
    [clearPreview, selectFeature, selectedFeature]
  );

  const panelStateValue = useMemo(
    () => ({
      status,
      error,
      setStatus,
      setError,
    }),
    [error, status]
  );

  const draftFlagsValue = useMemo(
    () => ({
      isPreviewMode,
      draftFlags,
      setDraftFlag,
      setDraftFlags,
    }),
    [draftFlags, isPreviewMode, setDraftFlag, setDraftFlags]
  );

  const value = useMemo<PreviewModeContextValue>(() => ({
    ...draftFlagsValue,
    ...selectionValue,
    ...panelStateValue,
  }), [
    draftFlagsValue,
    panelStateValue,
    selectionValue,
  ]);

  return (
    <PreviewDraftFlagsContext.Provider value={draftFlagsValue}>
      <PreviewSelectionContext.Provider value={selectionValue}>
        <PreviewPanelStateContext.Provider value={panelStateValue}>
          <PreviewModeContext.Provider value={value}>
            {children}
          </PreviewModeContext.Provider>
        </PreviewPanelStateContext.Provider>
      </PreviewSelectionContext.Provider>
    </PreviewDraftFlagsContext.Provider>
  );
}
