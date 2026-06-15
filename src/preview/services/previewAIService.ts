import { previewMockData } from "./previewMockData";
import type { PreviewAIExplanation, PreviewAICoachingResponse } from "./previewServiceTypes";

export const previewAIService = {
  getCoachingResponse(): PreviewAICoachingResponse {
    return previewMockData.aiCoachingResponse;
  },
  getExplanation(): PreviewAIExplanation {
    return previewMockData.aiExplanation;
  },
};

