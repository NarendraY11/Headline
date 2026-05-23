import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

interface LoadingContextType {
  setLoading: (loading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextType>({
  setLoading: () => {},
});

export const useGlobalLoading = () => useContext(LoadingContext);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loadingCount, setLoadingCount] = useState(0);

  const setLoading = useCallback((loading: boolean) => {
    setLoadingCount(prev => Math.max(0, prev + (loading ? 1 : -1)));
  }, []);

  const value = useMemo(() => ({ setLoading }), [setLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {loadingCount > 0 && (
        <div className="fixed top-0 left-0 w-full h-[3px] z-[9999] overflow-hidden bg-bg">
          <div className="h-full bg-signal shadow-[0_0_8px_var(--signal)] w-1/3 animate-[global-loading-bar_1.5s_ease-in-out_infinite]" />
        </div>
      )}
      {children}
    </LoadingContext.Provider>
  );
};
