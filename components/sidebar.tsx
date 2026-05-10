import { AppTab } from '@/app/page';
import { LayoutDashboard, CheckSquare, AlertTriangle, BarChart3, Settings, HelpCircle } from 'lucide-react';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'triage', label: 'Triage', icon: CheckSquare },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ] as const;

  return (
    <nav className="bg-surface-container-low w-[280px] h-full sticky left-0 border-r border-outline-variant shadow-none flex-col py-4 hidden md:flex z-40 shrink-0">
      <div className="px-4 mb-6">
        <h2 className="font-headline text-xl font-bold text-surface-tint">Operations</h2>
        <p className="font-sans text-sm text-on-surface-variant">Municipal Engineering</p>
      </div>
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`mx-2 my-1 rounded-lg px-4 py-3 flex items-center gap-3 transition-all duration-200 ease-in-out text-left ${isActive ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'fill-primary/20' : ''}`} />
              <span className="font-sans text-sm">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto border-t border-outline-variant pt-4 flex flex-col gap-1">
        <button className="text-on-surface-variant hover:bg-surface-container-high mx-2 my-1 rounded-lg px-4 py-3 flex items-center gap-3 transition-colors text-left">
          <Settings className="w-5 h-5" />
          <span className="font-sans text-sm">Settings</span>
        </button>
        <button className="text-on-surface-variant hover:bg-surface-container-high mx-2 my-1 rounded-lg px-4 py-3 flex items-center gap-3 transition-colors text-left">
          <HelpCircle className="w-5 h-5" />
          <span className="font-sans text-sm">Help</span>
        </button>
      </div>
    </nav>
  );
}
