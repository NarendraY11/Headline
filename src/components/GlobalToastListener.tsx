import { useEffect } from 'react';
import { useToast } from './ui/Toast';

export function GlobalToastListener() {
  const { showToast } = useToast();

  useEffect(() => {
    const handleForceLogout = (e: Event) => {
      const customEvent = e as CustomEvent;
      showToast({
        title: "Session Expired",
        message: customEvent.detail?.message || "You have been logged out.",
        type: "error"
      });
    };

    window.addEventListener('force-logout-toast', handleForceLogout);
    return () => {
      window.removeEventListener('force-logout-toast', handleForceLogout);
    };
  }, [showToast]);

  return null;
}
