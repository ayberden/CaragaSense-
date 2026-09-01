'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/sidebar';
import { TopNav } from '@/components/top-nav';
import { BottomNav } from '@/components/bottom-nav';
import { DashboardView } from '@/components/dashboard-view';
import { TriageView } from '@/components/triage-view';
import { AlertsView } from '@/components/alerts-view';
import { AnalyticsView } from '@/components/analytics-view';
import { UserManagementView } from '@/components/user-management-view';
import { MapViewMobile } from '@/components/map-view-mobile';
import { FAB } from '@/components/fab';
import { CitizenView } from '@/components/citizen-view';
import { ReportDetailModal } from '@/components/report-detail-modal';
import { Loader2 } from 'lucide-react';
import type { Report } from '@/lib/database.types';

export type AppTab = 'dashboard' | 'triage' | 'alerts' | 'map' | 'analytics' | 'users';

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
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Redirect to login if not authenticated after loading
  useEffect(() => {
    if (hasMounted && !isLoading && !user) {
      router.replace('/login');
    }
  }, [hasMounted, isLoading, user, router]);

  // Show loading while mounting, auth resolving, or redirecting
  if (!hasMounted || isLoading || !user) {
    return <LoadingScreen />;
  }


  // ── CITIZEN VIEW ──────────────────────────────────────────
  // Citizens get their own mobile-optimized reporting interface
  if (profile?.role === 'citizen') {
    return (
      <>
        <CitizenView onViewReport={setSelectedReport} />
        {selectedReport && (
          <ReportDetailModal
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </>
    );
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
          {activeTab === 'triage' && <TriageView onViewReport={setSelectedReport} />}
          {activeTab === 'alerts' && <AlertsView onViewReport={setSelectedReport} />}
          {activeTab === 'map' && <MapViewMobile />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'users' && <UserManagementView />}
        </main>
      </div>

      <FAB show={activeTab === 'dashboard' || activeTab === 'map'} />
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Global Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
