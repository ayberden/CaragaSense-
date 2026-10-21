'use client';

import Image from 'next/image';
import { CloudSun, User, LogOut, ChevronDown } from 'lucide-react';
import { NetworkStatus } from './network-status';
import { useAuth } from '@/lib/auth-context';
import { useState, useRef, useEffect } from 'react';

export function TopNav() {
  const { user, profile, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const roleLabel = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : 'Citizen';

  return (
    <header className="bg-surface flex justify-between items-center h-16 px-4 w-full sticky top-0 z-50 border-b border-outline-variant shadow-none shrink-0">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="CaragaSense AI"
          width={36}
          height={36}
          className="w-9 h-9 object-contain drop-shadow-sm"
          priority
        />
        <span className="font-headline text-2xl font-bold text-primary tracking-tight">CaragaSense AI</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2">
          <CloudSun className="text-primary w-5 h-5" />
        </div>
        <NetworkStatus />

        {/* User Profile Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 md:pl-4 md:border-l border-outline-variant hover:bg-surface-container-high rounded-lg md:px-2 py-1.5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-container overflow-hidden border border-outline-variant flex items-center justify-center">
              <User className="w-5 h-5 text-on-primary-container" />
            </div>
            <div className="text-left hidden lg:block">
              <p className="text-xs font-bold text-on-surface leading-tight">{displayName}</p>
              <p className="text-[10px] font-mono text-on-surface-variant leading-tight uppercase tracking-wider">{roleLabel}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-outline hidden md:block transition-transform ${showMenu ? 'rotate-180' : ''}`} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg overflow-hidden z-50">
              <div className="p-4 border-b border-outline-variant bg-surface-container-low">
                <p className="text-sm font-bold text-on-surface">{displayName}</p>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">{user?.email}</p>
                <span className="inline-block mt-2 px-2 py-0.5 bg-primary-container/30 text-primary text-[10px] font-mono font-bold rounded-full uppercase tracking-wider">
                  {roleLabel}
                </span>
              </div>
              <button
                onClick={() => { signOut(); setShowMenu(false); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-sm text-error hover:bg-error-container/30 transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
