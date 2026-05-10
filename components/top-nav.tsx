import { CloudSun, User } from 'lucide-react';
import { NetworkStatus } from './network-status';

export function TopNav() {
  return (
    <header className="bg-surface flex justify-between items-center h-16 px-4 w-full sticky top-0 z-50 border-b border-outline-variant shadow-none shrink-0">
      <div className="flex items-center gap-4">
        <span className="font-headline text-2xl font-bold text-primary">CaragaSense AI</span>
      </div>
      <div className="flex items-center gap-4 hidden md:flex">
        <div className="flex items-center gap-2">
          <CloudSun className="text-primary w-5 h-5" />
        </div>
        <NetworkStatus />
        <div className="w-8 h-8 rounded-full bg-surface-dim overflow-hidden border border-outline-variant flex items-center justify-center">
          <User className="w-5 h-5 text-outline" />
        </div>
      </div>
      {/* Mobile Top Nav items */}
      <div className="flex items-center gap-4 md:hidden">
        <CloudSun className="text-primary w-5 h-5" />
        <NetworkStatus />
      </div>
    </header>
  );
}
