import { previewMockData } from "./previewMockData";
import type { PreviewStudyScheduleDay } from "./previewServiceTypes";

export const previewSchedulerService = {
  getSchedule(): PreviewStudyScheduleDay[] {
    return previewMockData.studySchedule;
  },
};

