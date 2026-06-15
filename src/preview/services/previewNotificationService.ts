import { previewMockData } from "./previewMockData";
import type {
  PreviewCalendarSyncSnapshot,
  PreviewNotificationPayload,
  PreviewPushNotificationExample,
  PreviewPushSubscriptionStatus,
} from "./previewServiceTypes";

export const previewNotificationService = {
  getNotifications(): PreviewNotificationPayload[] {
    return previewMockData.notifications;
  },
  getUnreadCount(): number {
    return previewMockData.notifications.filter((notification) => notification.unread).length;
  },
  getPushSubscriptionStatus(): PreviewPushSubscriptionStatus {
    return previewMockData.pushSubscriptionStatus;
  },
  getPushExamples(): PreviewPushNotificationExample[] {
    return previewMockData.pushExamples;
  },
  getCalendarSyncSnapshot(): PreviewCalendarSyncSnapshot {
    return previewMockData.calendarSyncSnapshot;
  },
};
