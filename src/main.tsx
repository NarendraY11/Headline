import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { LoadingProvider } from './contexts/LoadingContext.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <LoadingProvider>
          <App />
        </LoadingProvider>
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);
