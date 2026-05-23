import React from 'react';
import { Outlet } from 'react-router-dom';
import { Wordmark } from './branding/Wordmark';

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink font-sans">
      <header className="h-[64px] border-b border-rule flex items-center justify-between px-6 bg-paper shrink-0">
        <Wordmark />
      </header>
      <main className="flex-grow overflow-y-auto w-full relative">
        <div id="main-content-area" className="w-full h-full p-6 relative z-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppShell;
