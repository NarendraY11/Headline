import React, { createContext, useCallback, useContext, useState } from 'react';

type ModalTab = 'signin' | 'signup' | 'forgot';

interface AuthModalCtx {
  authModalOpen: boolean;
  authModalTab: ModalTab;
  openAuthModal: (tab?: ModalTab) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalCtx | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<ModalTab>('signin');

  const openAuthModal = useCallback((tab: ModalTab = 'signin') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  return (
    <AuthModalContext.Provider value={{ authModalOpen, authModalTab, openAuthModal, closeAuthModal }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
}
