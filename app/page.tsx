'use client';
import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { TopNav } from '@/components/top-nav';
import { BottomNav } from '@/components/bottom-nav';
import { DashboardView } from '@/components/dashboard-view';
import { TriageView } from '@/components/triage-view';
import { AlertsView } from '@/components/alerts-view';
import { MapViewMobile } from '@/components/map-view-mobile';
import { FAB } from '@/components/fab';

export type AppTab = 'dashboard' | 'triage' | 'alerts' | 'map' | 'analytics';

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');

  return (
    <div className="bg-background text-on-background font-sans h-screen flex flex-col overflow-hidden">
      <TopNav />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="flex-1 overflow-y-auto bg-surface pb-[64px] md:pb-0 relative flex flex-col">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'triage' && <TriageView />}
          {activeTab === 'alerts' && <AlertsView />}
          {activeTab === 'map' && <MapViewMobile />}
          {activeTab === 'analytics' && (
            <div className="p-8 max-w-7xl mx-auto w-full">
              <h1 className="font-headline text-3xl font-bold">Analytics Reports</h1>
              <p className="mt-2 text-on-surface-variant">Under Construction</p>
            </div>
          )}
        </main>
      </div>

      <FAB show={activeTab === 'dashboard' || activeTab === 'map'} />
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
