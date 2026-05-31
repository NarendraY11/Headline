import { useEffect } from 'react';
import { useToast } from './ui/Toast';

export function GlobalToastListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleForceLogout = (e: Event) => {
      const customEvent = e as CustomEvent;
      toast({
        title: "Session Expired",
        description: customEvent.detail?.message || "You have been logged out.",
        variant: "destructive"
      });
    };

    window.addEventListener('force-logout-toast', handleForceLogout);
    return () => {
      window.removeEventListener('force-logout-toast', handleForceLogout);
    };
  }, [toast]);

  return null;
}
