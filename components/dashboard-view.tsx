'use client';

import { useState } from 'react';
import { VideoFeed } from './video-feed';
import { CameraScanner } from './camera-scanner';
import { MapView } from './map-view';
import { Camera, Video, UploadCloud, Loader2, AlertTriangle, TrendingUp, CheckCircle2, Clock, CameraOff } from 'lucide-react';
import { useReportStats } from '@/hooks/use-reports';
import { getPythonApiUrl } from '@/lib/api-config';

export function DashboardView() {
  const [scanMode, setScanMode] = useState<'camera' | 'upload' | 'off'>('camera');
  const [streamUrl, setStreamUrl] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const { stats, isLoading: statsLoading } = useReportStats();

  const handleStartCamera = () => {
    setScanMode('camera');
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const apiUrl = `${getPythonApiUrl()}/upload`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.url) {
        setStreamUrl(data.url);
        setScanMode('upload');
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to connect to the Python API. Ensure the Python server is running on port 5000.");
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
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
    <div className="flex-1 flex flex-col gap-6 h-full p-4 md:p-8 overflow-y-auto">
      {/* Top Section: Stats, Video Feed & Controls */}
      <div className="w-full flex flex-col gap-4 shrink-0">
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

        {/* Mode Selector */}
        <div className="bg-surface-container-lowest rounded-xl p-3 flex gap-2 border border-outline-variant shadow-sm shrink-0">
          <button
            onClick={handleStartCamera}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all ${scanMode === 'camera' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <Camera className="w-4 h-4" />Camera
          </button>
          <label className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all cursor-pointer ${scanMode === 'upload' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'} ${isUploading ? 'opacity-50' : ''}`}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            Upload
            <input type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" disabled={isUploading} />
          </label>
        </div>

        {/* Scanner View */}
        <div className="flex flex-col gap-3">
          {scanMode === 'camera' ? (
            <div className="h-[400px] min-h-[300px]">
              <CameraScanner
                isActive={scanMode === 'camera'}
                onDetections={() => {}}
                onCameraReadyChange={setIsCameraReady}
                onStop={() => {
                  setScanMode('off');
                  setIsCameraReady(false);
                }}
              />
            </div>
          ) : scanMode === 'off' ? (
            <div className="h-[400px] min-h-[300px] bg-surface-container-lowest rounded-xl border border-outline-variant flex flex-col items-center justify-center p-6 text-center">
              <CameraOff className="w-12 h-12 text-outline mb-3" />
              <h4 className="font-bold text-on-surface mb-1">Camera Stopped</h4>
              <p className="text-xs text-on-surface-variant mb-4 font-mono">Tap below to start live camera scanning</p>
              <button onClick={handleStartCamera} className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2">
                <Camera className="w-4 h-4" />Start Live Camera
              </button>
            </div>
          ) : (
            <div className="h-[400px] min-h-[300px]">
              <VideoFeed url={streamUrl} onStop={handleStartCamera} />
            </div>
          )}
        </div>
      </div>
      {/* Bottom Section: GIS Map (Hidden on mobile inside standard Dashboard tab, rendered in its own tab) */}
      <div className="hidden md:flex w-full min-h-[600px] flex-col shrink-0">
        <MapView />
      </div>
    </div>
  );
}

