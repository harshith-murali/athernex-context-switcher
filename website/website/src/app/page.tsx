'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DashboardView from '@/components/views/DashboardView';
import SessionsView from '@/components/views/SessionsView';
import PrimingPromptView from '@/components/views/PrimingPromptView';
import SettingsView from '@/components/views/SettingsView';

export type ViewType = 'dashboard' | 'sessions' | 'priming' | 'settings';

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <DashboardView />;
      case 'sessions': return <SessionsView />;
      case 'priming': return <PrimingPromptView />;
      case 'settings': return <SettingsView />;
    }
  };

  return (
    <div className="app-shell">
      <div className="main-area">
        <Header
          activeView={activeView}
          setActiveView={setActiveView}
        />
        {/* key forces remount on view change → re-triggers the entrance animation */}
        <main
          className="main-content"
          key={activeView}
          style={{ animation: 'slideUpFade 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}
        >
          {renderView()}
        </main>
      </div>
    </div>
  );
}
