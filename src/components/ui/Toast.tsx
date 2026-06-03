import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle className="text-mint shrink-0" size={20} />,
    error: <AlertCircle className="text-signal shrink-0" size={20} />,
    info: <Info className="text-sky shrink-0" size={20} />,
  };

  const borders = {
    success: 'border-l-mint',
    error: 'border-l-signal',
    info: 'border-l-sky',
  };

  return (
    <div
      className={`anim-toast pointer-events-auto flex items-start gap-3 bg-paper border border-rule shadow-lg rounded-lg p-4 min-w-[300px] max-w-sm border-l-4 ${borders[toast.type]}`}
    >
      {icons[toast.type]}
      <div className="flex-1">
        <h4 className="font-sans font-medium text-ink text-sm leading-tight mb-1">{toast.title}</h4>
        <p className="font-sans font-light text-ink-2 text-xs leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-muted hover:text-ink transition-colors p-1 -mt-1 -mr-1 rounded shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
