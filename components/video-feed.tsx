'use client';

import { useState, useEffect } from 'react';
import { VideoOff, Wifi } from 'lucide-react';
import { getPythonApiUrl } from '@/lib/api-config';

import type { Detection } from '@/lib/detection-utils';

interface VideoFeedProps {
  url?: string;
  onStop?: () => void;
  detections?: Detection[];
}

export function VideoFeed({ url, onStop }: VideoFeedProps) {
  const [defaultUrl, setDefaultUrl] = useState(() => `${getPythonApiUrl()}/video_feed`);
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDefaultUrl(`${getPythonApiUrl()}/video_feed`);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Reset error state when url changes
  useEffect(() => {
    setHasError(false);
    setLoaded(false);
  }, [url, defaultUrl]);

  const streamUrl = url || defaultUrl;
  const isDataUrl = streamUrl.startsWith('data:');
  const isStaticResult = isDataUrl || url?.includes('/result/');

  return (
    <>
      <div className="flex flex-col h-full w-full gap-4">
        <div className="w-full h-full relative bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant shadow-sm flex flex-col min-h-[300px]">
          {/* Glassmorphic Header */}
          <div className="absolute top-0 left-0 right-0 bg-inverse-surface/70 backdrop-blur-md p-3 flex justify-between items-center z-10 border-b border-white/10 pointer-events-none">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasError ? 'bg-outline' : 'bg-severity-high'}`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${hasError ? 'bg-outline' : 'bg-severity-high'}`} />
              </span>
              <span className="font-mono text-xs font-bold text-[#00E5FF] tracking-widest drop-shadow-md">
                {isStaticResult ? 'DETECTION RESULT' : hasError ? 'STREAM OFFLINE' : ''}
              </span>
            </div>
            <div className="flex gap-2 text-white font-mono text-[10px] items-center drop-shadow-md pointer-events-auto">
              <span className="bg-black/40 px-2 py-1 rounded border border-white/20 hidden sm:block">YOLOv11</span>
            </div>
          </div>

          {/* Feed area */}
          <div className="flex-1 relative bg-black flex items-center justify-center cursor-pointer" onClick={() => isStaticResult && streamUrl && setIsModalOpen(true)}>
            {hasError && !isDataUrl ? (
              /* Graceful offline state — webcam not available */
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <VideoOff className="w-8 h-8 text-white/40" />
                </div>
                <div>
                  <p className="text-white/70 font-mono text-sm font-bold mb-1">CAMERA UNAVAILABLE</p>
                  <p className="text-white/40 text-xs font-mono leading-relaxed">
                    No camera source detected.<br />
                    On deployment, set <span className="text-[#00E5FF]">NEXT_PUBLIC_PYTHON_API_URL</span><br />
                    to your Python API server URL.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-white/30 text-[10px] font-mono">
                  <Wifi className="w-3 h-3" />
                  YOLO API: {getPythonApiUrl()}
                </div>
              </div>
            ) : (
              <>
                {/* Loading shimmer while stream connects */}
                {!loaded && !isDataUrl && (
                  <div className="absolute inset-0 bg-black flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-[#00E5FF]/30 border-t-[#00E5FF] rounded-full animate-spin" />
                      <p className="text-[#00E5FF]/60 font-mono text-xs tracking-widest">CONNECTING TO YOLO STREAM...</p>
                    </div>
                  </div>
                )}
                <img
                  src={streamUrl}
                  alt="Live Detection Stream"
                  className={`w-full h-full object-contain transition-opacity duration-300 ${loaded || isDataUrl ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setLoaded(true)}
                  onError={() => setHasError(true)}
                />
              </>
            )}
          </div>
        </div>

        {onStop && (
          <div className="flex justify-center">
            <button onClick={onStop} className="w-full bg-error hover:bg-error/90 text-white px-6 py-3 rounded-lg font-bold shadow-sm transition-colors cursor-pointer text-sm">
              Stop Feed
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center">
            <button
              className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2 font-mono text-sm bg-black/50 rounded-lg"
              onClick={() => setIsModalOpen(false)}
            >
              CLOSE (Esc)
            </button>
            <img
              src={streamUrl}
              alt="Full size detection"
              className="max-w-full max-h-[90vh] object-contain rounded border border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
