import {
    Award,
    Bell,
    BellOff,
    Calendar,
    Check,
    CheckCircle2,
    Clock,
    Trash2,
    Zap
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NotificationItem, useNotifications } from "../contexts/NotificationContext";

export default function NotificationCenter() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();
  
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "milestone":
        return <Award size={15} className="text-amber-500 shrink-0" />;
      case "countdown":
        return <Calendar size={15} className="text-rose-500 shrink-0" />;
      case "reminder":
        return <Clock size={15} className="text-sky-500 shrink-0" />;
      default:
        return <Zap size={15} className="text-emerald-500 shrink-0" />;
    }
  };

  const getTypeBadgeStyle = (type: NotificationItem["type"]) => {
    switch (type) {
      case "milestone":
        return "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400";
      case "countdown":
        return "bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400";
      case "reminder":
        return "bg-sky-50 border-sky-100 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/20 dark:text-sky-400";
      default:
        return "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400";
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.read) {
      markAsRead(item.id);
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      
      if (diffMs < 60000) return "Just now";
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 sm:p-2.5 text-muted hover:text-ink hover:bg-panel rounded-full border border-transparent hover:border-rule transition-colors focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none relative cursor-pointer"
        aria-label="Notification Center"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-signal text-[9px] font-mono font-bold text-bg rounded-full flex items-center justify-center border-2 border-bg shadow-sm animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Pane */}
      {isOpen && (
          <div
            className="anim-pop absolute right-0 mt-2.5 w-[calc(100vw-2rem)] sm:w-80 md:w-96 max-w-sm bg-paper border border-rule rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.1)] overflow-hidden z-50 origin-top-right text-left"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-bg border-b border-rule flex items-center justify-between">
              <div>
                <h3 className="font-serif text-sm font-semibold text-ink flex items-center gap-1.5">
                  <span>Flight Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-mono font-bold bg-signal/10 text-signal border border-signal/15 px-1.5 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </h3>
                <p className="font-mono text-[9px] text-muted-2 uppercase tracking-widest mt-0.5">Tactical telemetry stream</p>
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="font-sans text-[11px] font-medium text-sky hover:text-sky-dark hover:underline transition-all flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 size={11} /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-rule no-scrollbar">
              {notifications.length === 0 ? (
                <div className="py-12 px-4 text-center text-muted">
                  <div className="w-10 h-10 bg-panel border border-rule rounded-full flex items-center justify-center mx-auto mb-3">
                    <BellOff size={16} className="text-muted-2" />
                  </div>
                  <p className="font-sans text-xs font-semibold text-ink-2">Your cockpit is clear</p>
                  <p className="font-sans text-[11px] text-muted-2 mt-1">Milestones, logs, and countdown alerts appear here.</p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div role="button" tabIndex={0} onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-4 flex gap-3 relative transition-all group hover:bg-bg ${
                      !item.read ? "bg-panel/40" : ""
                    } cursor-pointer`}
                  >
                    {/* Unread Indicator Dot */}
                    {!item.read && (
                      <span className="absolute top-[21px] left-1.5 w-1.5 h-1.5 rounded-full bg-signal" />
                    )}

                    {/* Icon wrapper */}
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center mt-0.5 shadow-sm ${getTypeBadgeStyle(item.type)}`}>
                      {getIcon(item.type)}
                    </div>

                    {/* Notification body */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-sans text-xs font-semibold text-ink leading-tight truncate">
                          {item.title}
                        </span>
                        <span className="font-mono text-[9px] text-muted-2 shrink-0">
                          {getRelativeTime(item.created_at)}
                        </span>
                      </div>
                      <p className="font-sans text-[11.5px] text-muted-2 leading-relaxed mt-1">
                        {item.body}
                      </p>
                    </div>

                    {/* Quick actions hover overlay */}
                    <div className="absolute right-2 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!item.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(item.id);
                          }}
                          title="Mark as read"
                          className="p-1 text-muted hover:text-emerald-600 hover:bg-bg rounded transition-colors cursor-pointer"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        title="Dismiss"
                        className="p-1 text-muted hover:text-signal hover:bg-bg rounded transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-panel/30 border-t border-rule text-center">
              <span className="font-mono text-[8px] text-muted uppercase tracking-widest">Aviation Standards Compliant</span>
            </div>
          </div>
        )}
    </div>
  );
}
