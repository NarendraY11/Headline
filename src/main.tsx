import '@fontsource/geist-sans/300.css';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { LoadingProvider } from './contexts/LoadingContext.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import { FeatureFlagsProvider } from './hooks/useFeatureFlags';
import { SpeedInsights } from "@vercel/speed-insights/react";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeatureFlagsProvider>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <LoadingProvider>
              <App />
              <SpeedInsights />
            </LoadingProvider>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </FeatureFlagsProvider>
  </StrictMode>,
);
