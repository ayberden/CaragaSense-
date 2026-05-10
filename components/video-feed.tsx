'use client';

import { useState, useEffect } from 'react';

export function VideoFeed({ url }: { url?: string }) {
  // Use localhost as the default for SSR to match the server-rendered HTML
  const [defaultUrl, setDefaultUrl] = useState("http://localhost:5000/video_feed");

  useEffect(() => {
    // Update to the actual hostname on the client after mounting
    setDefaultUrl(`http://${window.location.hostname}:5000/video_feed`);
  }, []);

  const streamUrl = url || defaultUrl;

  return (
    <div className="flex-1 relative bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant shadow-sm flex flex-col min-h-[300px]">
      {/* Glassmorphic Header */}
      <div className="absolute top-0 left-0 right-0 bg-inverse-surface/70 backdrop-blur-md p-3 flex justify-between items-center z-10 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-severity-high opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-severity-high"></span>
          </span>
          <span className="font-mono text-xs font-bold text-white tracking-widest text-[#00E5FF]">
            {url?.includes('/result/') ? "DETECTION RESULT" : "LIVE: YOLO STREAM"}
          </span>
        </div>
        <div className="flex gap-2 text-white font-mono text-[10px] items-center">
          <span className="bg-black/40 px-2 py-1 rounded border border-white/20">
            {url?.includes('/result/') ? "STATIC" : "LIVE"}
          </span>
          <span className="bg-black/40 px-2 py-1 rounded border border-white/20 hidden sm:block">YOLOv11</span>
        </div>
      </div>

      {/* Actual Live Video Feed or Image from Python API */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {/* We add a unique key based on the URL to force re-render if it's an image, so it re-fetches */}
        <img 
            key={streamUrl}
            src={streamUrl} 
            alt="Live Detection Stream"
            className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
