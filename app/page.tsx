'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/sidebar';
import { TopNav } from '@/components/top-nav';
import { BottomNav } from '@/components/bottom-nav';
import { DashboardView } from '@/components/dashboard-view';
import { TriageView } from '@/components/triage-view';
import { AlertsView } from '@/components/alerts-view';
import { MapViewMobile } from '@/components/map-view-mobile';
import { FAB } from '@/components/fab';
import { CitizenView } from '@/components/citizen-view';
import { Loader2 } from 'lucide-react';

export type AppTab = 'dashboard' | 'triage' | 'alerts' | 'map' | 'analytics';

function LoadingScreen() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-surface gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-on-surface-variant font-mono text-sm tracking-wider">LOADING SYSTEM...</p>
    </div>
  );
}

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [hasMounted, setHasMounted] = useState(false);
  const { profile, isLoading } = useAuth();

  // Prevent hydration mismatch: server and first client render
  // both show the loading screen. After mount, show real content.
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Show loading on both server SSR and client until mounted + auth resolved
  if (!hasMounted || isLoading) {
    return <LoadingScreen />;
  }

  // ── CITIZEN VIEW ──────────────────────────────────────────
  // Citizens get their own mobile-optimized reporting interface
  if (profile?.role === 'citizen' || !profile?.role) {
    return <CitizenView />;
  }

  // ── ADMIN / ENGINEER VIEW ────────────────────────────────
  // Full command center dashboard with triage, map, analytics
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

