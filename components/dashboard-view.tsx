'use client';

import { useState, useRef } from 'react';
import { VideoFeed } from './video-feed';
import { MapView } from './map-view';
import { Radar, UploadCloud, Loader2, AlertTriangle, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { useReportStats } from '@/hooks/use-reports';

export function DashboardView() {
  const [streamUrl, setStreamUrl] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { stats, isLoading: statsLoading } = useReportStats();

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiUrl = `http://${window.location.hostname}:5000/upload`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (response.ok && data.url) {
        setStreamUrl(data.url);
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to connect to the Python API. Ensure the Python server is running on port 5000.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLiveScanClick = () => {
    setStreamUrl(`http://${window.location.hostname}:5000/video_feed`);
  };

  const statCards = [
    {
      label: 'Total Reports',
      value: stats?.total_reports ?? '—',
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Critical / High',
      value: stats ? `${(stats.critical_count || 0) + (stats.high_count || 0)}` : '—',
      icon: AlertTriangle,
      color: 'text-severity-high',
      bgColor: 'bg-severity-high/10',
    },
    {
      label: 'In Progress',
      value: stats?.in_progress_count ?? '—',
      icon: Clock,
      color: 'text-severity-medium',
      bgColor: 'bg-severity-medium/10',
    },
    {
      label: 'Resolved',
      value: stats?.fixed_count ?? '—',
      icon: CheckCircle2,
      color: 'text-severity-low',
      bgColor: 'bg-severity-low/10',
    },
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 h-full p-4 md:p-8">
      {/* Left Column: Stats, Video Feed & Controls */}
      <div className="w-full md:w-[60%] flex flex-col gap-4 h-[calc(100vh-140px)] md:h-[calc(100vh-120px)]">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="bg-surface-container-lowest rounded-xl p-3 border border-outline-variant shadow-sm flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="font-mono text-xl font-bold text-on-surface leading-tight">
                  {statsLoading ? <span className="inline-block w-6 h-5 bg-surface-container animate-pulse rounded" /> : card.value}
                </p>
                <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider leading-tight">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        <VideoFeed url={streamUrl} />
        
        {/* Hidden file input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*,video/mp4,video/x-m4v,video/*" 
          className="hidden" 
        />

        {/* Toggle Controls */}
        <div className="bg-surface-container-lowest rounded-xl p-4 flex gap-4 shrink-0 border border-outline-variant shadow-sm">
          <button 
            onClick={handleLiveScanClick}
            className="flex-1 bg-primary text-on-primary font-headline text-lg font-bold py-4 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.98]"
          >
            <Radar className="w-6 h-6" />
            Live Auto-Scan
          </button>
          <button 
            onClick={handleUploadClick}
            disabled={isUploading}
            className="flex-1 bg-surface-muted text-on-surface hover:bg-surface-variant font-headline text-lg py-4 rounded-lg flex items-center justify-center gap-2 border border-outline-variant transition-colors disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
            <span className="hidden sm:inline">{isUploading ? "Uploading..." : "Manual Upload"}</span>
            <span className="sm:hidden">{isUploading ? "..." : "Upload"}</span>
          </button>
        </div>
      </div>
      {/* Right Column: GIS Map (Hidden on mobile inside standard Dashboard tab, rendered in its own tab) */}
      <div className="hidden md:flex md:w-[40%] h-[calc(100vh-120px)] flex-col">
        <MapView />
      </div>
    </div>
  );
}
