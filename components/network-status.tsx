'use client';
import { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 border-l border-outline-variant pl-4 ${isOnline ? 'text-status-online' : 'text-status-offline'}`}>
      {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      <span className="font-mono text-xs font-bold tracking-wider">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
    </div>
  );
}
