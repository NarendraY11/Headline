import {
    AlertCircle
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useFeature } from "../../hooks/useFeatureFlags";


export function FeatureGatingBlocks() {
  const maintenanceMode = useFeature("maintenanceMode");
  const announcementBanner = useFeature("announcementBanner");
  const announcementText = useFeature("announcementText");
  const { userData } = useAuth(); // don't block admins even if maintenance is on
  
  if (maintenanceMode && userData?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="p-8 max-w-md text-center bg-paper border border-rule-strong rounded-xl shadow-sm">
          <AlertCircle className="w-12 h-12 text-muted-2 mx-auto mb-4" />
          <h1 className="text-xl font-serif text-ink mb-2">Scheduled Maintenance</h1>
          <p className="text-muted text-sm">
            Our systems are currently undergoing required maintenance. We will be back online shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {announcementBanner && announcementText && (
        <div className="w-full bg-indigo-600 dark:bg-indigo-500/20 dark:border-b dark:border-indigo-500 text-white dark:text-sky text-[11px] font-sans font-medium text-center py-1.5 px-4 tracking-wide shadow-sm z-[100] relative">
          {announcementText}
        </div>
      )}
    </>
  );
}
