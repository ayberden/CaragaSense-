'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff, Loader2, FlipHorizontal, Square } from 'lucide-react';

import type { Detection } from '@/lib/detection-utils';

interface CameraScannerProps {
  onDetections: (dets: Detection[]) => void;
  onAnnotatedImage?: (src: string | null) => void;
  isActive: boolean;
  onCameraReadyChange?: (ready: boolean) => void;
  onStop?: () => void;
}

export function CameraScanner({ onDetections, onAnnotatedImage, isActive, onCameraReadyChange, onStop }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [annotatedSrc, setAnnotatedSrc] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    onCameraReadyChange?.(cameraReady);
  }, [cameraReady, onCameraReadyChange]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access denied';
      setCameraError(msg);
      setCameraReady(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setAnnotatedSrc(null);
  }, []);

  // Start/stop camera based on isActive
  useEffect(() => {
    if (isActive) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [isActive, startCamera, stopCamera]);

  // Frame capture loop — send frames to /detect every 1.5s
  useEffect(() => {
    if (!cameraReady || !isActive) return;

    const captureAndDetect = async () => {
      if (isProcessing || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

      setIsProcessing(true);
      try {
        const apiUrl = `http://${window.location.hostname}:5000/detect`;
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.detections) onDetections(data.detections);
          if (data.annotated_image) {
            setAnnotatedSrc(data.annotated_image);
            onAnnotatedImage?.(data.annotated_image);
          }
        }
      } catch { /* API not reachable, silent fail */ }
      finally { setIsProcessing(false); }
    };

    intervalRef.current = setInterval(captureAndDetect, 1500);
    // Run one immediately
    captureAndDetect();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [cameraReady, isActive, isProcessing, onDetections]);

  const flipCamera = () => {
    stopCamera();
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="w-full h-full relative bg-black rounded-xl overflow-hidden border border-outline-variant shadow-sm min-h-[300px] flex items-center justify-center">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {cameraError ? (
        <div className="text-center p-6">
          <CameraOff className="w-12 h-12 text-outline mx-auto mb-3" />
          <p className="text-white/80 text-sm font-mono mb-2">Camera Access Failed</p>
          <p className="text-white/50 text-xs mb-4">{cameraError}</p>
          <button onClick={startCamera} className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Live video (hidden when we have annotated frames) */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${annotatedSrc ? 'hidden' : ''}`}
            playsInline
            muted
            autoPlay
          />
          {/* Annotated overlay from API */}
          {annotatedSrc && (
            <img src={annotatedSrc} alt="AI Detection" className="w-full h-full object-contain" />
          )}

          {/* Header overlay */}
          <div className="absolute top-0 left-0 right-0 bg-black/60 backdrop-blur-md p-3 flex justify-between items-center z-10">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cameraReady ? 'bg-severity-low' : 'bg-severity-medium'}`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${cameraReady ? 'bg-severity-low' : 'bg-severity-medium'}`} />
              </span>
              <span className="font-mono text-xs font-bold text-[#00E5FF] tracking-widest">
                {cameraReady ? 'LIVE CAMERA' : 'CONNECTING...'}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              {isProcessing && <Loader2 className="w-4 h-4 text-white animate-spin" />}
              {cameraReady && onStop && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStop(); }}
                  className="bg-error/90 hover:bg-error text-white px-2.5 py-1 rounded-lg border border-white/20 text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                  title="Stop Live Camera"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Stop Camera
                </button>
              )}
              <button onClick={flipCamera} className="bg-white/10 p-1.5 rounded-lg border border-white/20 text-white hover:bg-white/20 transition-colors">
                <FlipHorizontal className="w-4 h-4" />
              </button>
              <span className="bg-black/40 px-2 py-1 rounded text-white font-mono text-[10px] border border-white/20">YOLOv11</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
