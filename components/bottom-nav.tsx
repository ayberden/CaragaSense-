import { AppTab } from '@/app/page';
import { LayoutDashboard, Camera, MapIcon, AlertTriangle } from 'lucide-react';

interface BottomNavProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'triage', label: 'Triage', icon: Camera },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  ] as const;

  return (
    <nav className="md:hidden fixed bottom-0 w-full bg-surface border-t border-outline-variant flex justify-around items-center h-[64px] z-50">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AppTab)}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${isActive ? 'text-primary bg-primary-container/20 border-t-2 border-primary' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <tab.icon className={`w-6 h-6 ${isActive ? 'fill-primary/20' : ''}`} />
            <span className={`font-mono text-[10px] mt-1 ${isActive ? 'font-bold' : ''}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
