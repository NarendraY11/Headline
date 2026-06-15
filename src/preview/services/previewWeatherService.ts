import { previewMockData } from "./previewMockData";
import type { PreviewWeatherBriefingData } from "./previewServiceTypes";

export const previewWeatherService = {
  getBriefing(): PreviewWeatherBriefingData {
    return previewMockData.weatherBriefing;
  },
};

