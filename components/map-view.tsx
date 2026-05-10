'use client';
import dynamic from 'next/dynamic';
import { Filter } from 'lucide-react';

const MapClient = dynamic(() => import('./map-content'), { ssr: false });

export function MapView() {
  return (
    <div className="bg-surface-container-lowest rounded-xl flex-1 border border-outline-variant shadow-sm overflow-hidden relative flex flex-col h-full">
      <div className="p-4 border-b border-outline-variant bg-surface flex justify-between items-center z-10 shrink-0">
        <h2 className="font-headline text-xl font-bold text-on-surface">Asset Map</h2>
        <button className="text-on-surface-variant p-2 hover:bg-surface-variant rounded-full transition-colors">
          <Filter className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 bg-surface-dim relative z-0">
        <MapClient />
      </div>
    </div>
  );
}
