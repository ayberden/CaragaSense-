'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { useReports, useCreateReport, useUploadImage } from '@/hooks/use-reports';
import {
  Camera, MapPin, Clock, CheckCircle2, AlertTriangle,
  Plus, X, Loader2, Send, Image as ImageIcon, LogOut, UploadCloud, CameraOff, Radar
} from 'lucide-react';
import Image from 'next/image';
import { VideoFeed } from './video-feed';
import { CameraScanner } from './camera-scanner';
import { countDetections, generateDescription, getDominantType, inferSeverity, getMaxConfidence, getDamageLabel, mapClassToDamageType, type Detection } from '@/lib/detection-utils';
import { getPythonApiUrl } from '@/lib/api-config';
import type { Report, DamageType, SeverityLevel, ReportStatus } from '@/lib/database.types';

const LocationPickerMap = dynamic(() => import('./location-picker'), { ssr: false });

const STATUS_STEPS: { key: ReportStatus; label: string; icon: React.ElementType }[] = [
  { key: 'reported', label: 'Reported', icon: Send },
  { key: 'verified', label: 'Verified', icon: CheckCircle2 },
  { key: 'scheduled', label: 'Scheduled', icon: Clock },
  { key: 'in_progress', label: 'In Progress', icon: AlertTriangle },
  { key: 'fixed', label: 'Fixed', icon: CheckCircle2 },
];

const SEVERITY_STYLES: Record<SeverityLevel, { badge: string; dot: string }> = {
  critical: { badge: 'bg-error-container text-on-error-container', dot: 'bg-severity-high' },
  high: { badge: 'bg-error-container text-on-error-container', dot: 'bg-severity-high' },
  medium: { badge: 'bg-secondary-fixed text-on-secondary-fixed-variant', dot: 'bg-severity-medium' },
  low: { badge: 'bg-surface-container text-severity-low', dot: 'bg-severity-low' },
};

const DAMAGE_LABELS: Record<string, string> = {
  pothole: 'Pothole',
  open_manhole: 'Open Manhole',
  manhole: 'Manhole',
  alligator_crack: 'Alligator Crack',
  block_crack: 'Block Crack',
  edge_crack: 'Edge Crack',
  longitudinal_crack: 'Longitudinal Crack',
  transverse_crack: 'Transverse Crack',
  rutting: 'Rutting',
  other: 'Other Damages',
};

function StatusTimeline({ currentStatus }: { currentStatus: ReportStatus }) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
  if (currentStatus === 'dismissed') {
    return (<div className="flex items-center gap-2 text-xs font-mono"><X className="w-4 h-4 text-error" /><span className="text-error font-bold">DISMISSED</span></div>);
  }
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, i) => {
        const done = i <= currentIndex, cur = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${cur ? 'bg-primary text-on-primary ring-2 ring-primary/30' : done ? 'bg-severity-low text-white' : 'bg-surface-container-high text-on-surface-variant'}`} title={step.label}>
              <step.icon className="w-3 h-3" />
            </div>
            {i < STATUS_STEPS.length - 1 && <div className={`w-4 h-0.5 rounded ${done ? 'bg-severity-low' : 'bg-outline-variant'}`} />}
          </div>
        );
      })}
    </div>
  );
}

function ReportCard({ report, onClick }: { report: Report; onClick?: () => void }) {
  const styles = SEVERITY_STYLES[report.severity];
  const img = report.image_url || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=300&q=80';
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="h-36 w-full relative">
        <Image src={img} alt={report.damage_type} fill className="object-cover" unoptimized referrerPolicy="no-referrer" />
        <div className="absolute top-2 left-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full shadow text-[10px] font-mono font-bold ${styles.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />{report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
          </span>
        </div>
        {report.confidence !== null && (
          <div className="absolute top-2 right-2"><span className="bg-black/60 text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold backdrop-blur-sm">AI: {Math.round(report.confidence * 100)}%</span></div>
        )}
      </div>
      <div className="p-4">
        <h4 className="font-bold text-base text-on-surface mb-2">{DAMAGE_LABELS[report.damage_type] || report.damage_type}</h4>
        <div className="flex items-center gap-1.5 text-sm text-on-surface-variant mb-3">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{report.address || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`}</span>
        </div>
        {report.description && <p className="text-xs text-on-surface-variant mb-3 line-clamp-2">{report.description}</p>}
        <div className="pt-3 border-t border-outline-variant">
          <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-2">Status</p>
          <StatusTimeline currentStatus={report.status} />
        </div>
        <p className="text-[10px] font-mono text-outline mt-3">
          {new Date(report.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function NewReportModal({ onClose, prefill }: { onClose: () => void; prefill?: { damageType?: DamageType; severity?: SeverityLevel; description?: string; confidence?: number; detections?: Detection[]; imageSrc?: string } }) {
  const { user } = useAuth();
  const { createReport, isSubmitting } = useCreateReport();
  const { uploadImage, isUploading } = useUploadImage();
  const [damageType, setDamageType] = useState<DamageType>(prefill?.damageType || 'pothole');
  const [severity, setSeverity] = useState<SeverityLevel>(prefill?.severity || 'medium');
  const [description, setDescription] = useState(prefill?.description || '');
  const [address, setAddress] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(prefill?.imageSrc || null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If a prefill imageSrc is provided (base64 or URL), convert it to a File for upload
  useEffect(() => {
    if (!prefill?.imageSrc) return;
    const src = prefill.imageSrc;
    // If it's a base64 data URL, convert to File
    if (src.startsWith('data:')) {
      fetch(src)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], 'detection.jpg', { type: 'image/jpeg' });
          setImageFile(file);
        })
        .catch(() => { /* silent fail – preview still shows */ });
    }
    // If it's a remote URL, we store the URL directly (uploaded separately by API)
    // The image_url will be set via the url on submit
  }, [prefill?.imageSrc]);

  useEffect(() => {
    if (!coords) return;
    const fetchAddress = async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`);
        const data = await res.json();
        if (data && data.display_name) {
          const parts = [];
          if (data.address.road) parts.push(data.address.road);
          if (data.address.suburb || data.address.village || data.address.neighbourhood) parts.push(data.address.suburb || data.address.village || data.address.neighbourhood);
          if (data.address.city || data.address.town) parts.push(data.address.city || data.address.town);
          if (parts.length > 0) setAddress(parts.join(', '));
          else setAddress(data.display_name.split(',').slice(0, 3).join(', '));
        }
      } catch (err) { console.error('Geocoding failed:', err); }
    };
    const timer = setTimeout(fetchAddress, 800);
    return () => clearTimeout(timer);
  }, [coords]);

  const handleGetLocation = useCallback((auto = false) => {
    if (!navigator.geolocation) { setError('Geolocation not supported. Tap the map to pin the location.'); return; }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // On the automatic attempt, don't overwrite a pin the user already placed by hand
        setCoords((prev) => (auto && prev ? prev : gps));
        setError(null);
        setIsGettingLocation(false);
      },
      (err) => {
        setError(auto
          ? `Couldn't detect your location automatically (${err.message}). Tap "Use My GPS Location" or tap the map to pin it.`
          : `Location error: ${err.message}`);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  // Auto-locate as soon as the report form opens
  useEffect(() => {
    handleGetLocation(true);
  }, [handleGetLocation]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); const r = new FileReader(); r.onload = () => setImagePreview(r.result as string); r.readAsDataURL(file); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) { setError('Please tag your location first'); return; }
    setError(null);
    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
    } else if (prefill?.imageSrc && !prefill.imageSrc.startsWith('data:')) {
      // It's already a remote URL (from upload endpoint), use directly
      imageUrl = prefill.imageSrc;
    }
    const result = await createReport({ reporter_id: user?.id, damage_type: damageType, severity, description: description || null, latitude: coords.lat, longitude: coords.lng, address: address || null, image_url: imageUrl });
    if (result) onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-container-lowest w-full max-w-lg rounded-t-2xl md:rounded-2xl border border-outline-variant shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface-container-lowest border-b border-outline-variant px-5 py-4 flex justify-between items-center z-10">
          <h2 className="font-headline text-xl font-bold text-on-surface">Report Road Damage</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && <div className="bg-error-container/50 border border-error/20 text-on-error-container rounded-lg px-4 py-3 text-sm">{error}</div>}

          {/* Damage Type */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface font-headline">Damage Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(DAMAGE_LABELS) as [DamageType, string][]).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setDamageType(key)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all text-left ${damageType === key ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface font-headline">Severity</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'critical'] as SeverityLevel[]).map((level) => (
                <button key={level} type="button" onClick={() => setSeverity(level)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider border transition-all ${severity === level ? (level === 'low' ? 'border-severity-low bg-severity-low/10 text-severity-low' : level === 'medium' ? 'border-severity-medium bg-severity-medium/10 text-severity-medium' : 'border-severity-high bg-severity-high/10 text-severity-high') : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}>{level}</button>
              ))}
            </div>
          </div>

          {/* Photo */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface font-headline">
              Photo {prefill?.imageSrc ? <span className="text-primary font-mono text-xs ml-1">✦ Auto-filled from YOLO detection</span> : '(Optional)'}
            </label>
            {imagePreview ? (
              <div className="relative h-40 rounded-lg overflow-hidden border border-primary/40 ring-1 ring-primary/20">
                <Image src={imagePreview} alt="Preview" fill className="object-cover" unoptimized />
                {prefill?.imageSrc && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-3 py-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-mono text-primary font-bold tracking-widest">YOLO DETECTION IMAGE</span>
                  </div>
                )}
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-outline-variant rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors">
                <ImageIcon className="w-8 h-8 text-outline mb-1" /><span className="text-xs text-on-surface-variant font-mono">Tap to add photo</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            )}
          </div>

          {/* Location with Map */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface font-headline">Location</label>
            <button type="button" onClick={() => handleGetLocation(false)} disabled={isGettingLocation}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-medium transition-all ${coords ? 'border-severity-low bg-severity-low/10 text-severity-low' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}>
              {isGettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {isGettingLocation
                ? 'Detecting your location...'
                : coords ? `📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Use My GPS Location'}
            </button>
            <div className="h-48 rounded-lg overflow-hidden border border-outline-variant">
              <LocationPickerMap coords={coords} onCoordsChange={setCoords} />
            </div>
            <p className="text-[10px] text-on-surface-variant font-mono">Tap the map or drag the pin to adjust</p>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street / Landmark (optional)"
              className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface font-headline">Description (Optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="e.g., Deep pothole near the intersection..."
              className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          <button type="submit" disabled={isSubmitting || isUploading || !coords}
            className="w-full bg-primary text-on-primary font-headline font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all">
            {isSubmitting || isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" />Submit Report</>}
          </button>
        </form>
      </div>
    </div>
  );
}

type CitizenTab = 'reports' | 'scan';
type ScanMode = 'camera' | 'upload' | 'off';

export function CitizenView({ onViewReport }: { onViewReport?: (report: Report) => void }) {
  const { user, profile, signOut } = useAuth();
  const [showNewReport, setShowNewReport] = useState(false);
  const [activeTab, setActiveTab] = useState<CitizenTab>('reports');
  const [scanMode, setScanMode] = useState<ScanMode>('camera');
  const [streamUrl, setStreamUrl] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [allDetections, setAllDetections] = useState<Detection[]>([]);
  const [annotatedImageSrc, setAnnotatedImageSrc] = useState<string | null>(null);
  const [reportPrefill, setReportPrefill] = useState<{ damageType?: DamageType; severity?: SeverityLevel; description?: string; confidence?: number; detections?: Detection[]; imageSrc?: string } | undefined>();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { reports, isLoading } = useReports();
  const myReports = reports.filter((r) => r.reporter_id === user?.id);
  const pendingCount = myReports.filter((r) => !['fixed', 'dismissed'].includes(r.status)).length;
  const resolvedCount = myReports.filter((r) => r.status === 'fixed').length;

  const detCounts = countDetections(allDetections);
  const totalDetections = allDetections.length;

  const handleCameraDetections = useCallback((dets: Detection[]) => {
    if (dets.length > 0) setAllDetections((prev) => [...prev, ...dets].slice(-100));
  }, []);

  const handleAnnotatedImage = useCallback((src: string | null) => {
    setAnnotatedImageSrc(src);
  }, []);

  const handleStartCamera = () => {
    setScanMode('camera');
    setAllDetections([]);
    setAnnotatedImageSrc(null);
    setActiveTab('scan');
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setAllDetections([]);
    setAnnotatedImageSrc(null);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const apiUrl = `${getPythonApiUrl()}/upload`;
      const resp = await fetch(apiUrl, { method: 'POST', body: formData });
      const data = await resp.json();
      if (resp.ok && data.url) {
        setStreamUrl(data.url);
        setScanMode('upload');
        setActiveTab('scan');
        const dets: Detection[] = data.detections || [{ class: data.damage_type || 'pothole', confidence: data.confidence || 0.85 }];
        setAllDetections(dets);
        if (data.type === 'image') setAnnotatedImageSrc(data.url);
      } else {
        setUploadError('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err: unknown) {
      const targetUrl = `${getPythonApiUrl()}/upload`;
      const errDetail = err instanceof Error ? err.message : String(err);
      setUploadError(
        `The AI Detection API is not reachable at "${targetUrl}". Error: ${errDetail}. (Note: Render's free tier sleeps after inactivity and takes ~45s to wake up on the first request).`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleReportFromDetection = () => {
    const prefill = {
      damageType: getDominantType(allDetections),
      severity: inferSeverity(allDetections),
      description: generateDescription(allDetections),
      confidence: getMaxConfidence(allDetections),
      detections: allDetections,
      imageSrc: annotatedImageSrc ?? undefined,
    };
    setReportPrefill(prefill);
    setShowNewReport(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-surface sticky top-0 z-50 border-b border-outline-variant px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="CaragaSense Logo"
              width={38}
              height={38}
              className="w-9 h-9 object-contain drop-shadow-sm"
              priority
            />
            <div>
              <h1 className="font-headline text-xl font-bold text-primary tracking-tight">CaragaSense AI</h1>
              <p className="text-xs text-on-surface-variant font-mono tracking-wider">Hi, {profile?.full_name || user?.email?.split('@')[0] || 'Citizen'} 👋</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Reports</p>
              <p className="text-lg font-bold text-on-surface font-mono">{myReports.length}</p>
            </div>
            <button onClick={signOut} className="text-on-surface-variant hover:text-error p-2 rounded-full hover:bg-error-container/30 transition-colors" title="Sign Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="bg-surface border-b border-outline-variant px-4 shrink-0">
        <div className="max-w-2xl mx-auto flex">
          <button onClick={() => setActiveTab('reports')} className={`flex-1 py-3 text-sm font-bold font-headline text-center border-b-2 transition-colors ${activeTab === 'reports' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:bg-surface-container-high'}`}>My Reports</button>
          <button onClick={handleStartCamera} className={`flex-1 py-3 text-sm font-bold font-headline text-center border-b-2 transition-colors ${activeTab === 'scan' ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:bg-surface-container-high'}`}>AI Scanner</button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'reports' && (
          <>
            {/* Stats Strip */}
            <div className="bg-surface border-b border-outline-variant px-4 py-3">
              <div className="max-w-2xl mx-auto flex gap-3">
                <div className="flex-1 bg-severity-medium/10 rounded-lg px-3 py-2 text-center">
                  <p className="font-mono text-lg font-bold text-severity-medium">{pendingCount}</p>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Pending</p>
                </div>
                <div className="flex-1 bg-severity-low/10 rounded-lg px-3 py-2 text-center">
                  <p className="font-mono text-lg font-bold text-severity-low">{resolvedCount}</p>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Resolved</p>
                </div>
                <div className="flex-1 bg-primary/10 rounded-lg px-3 py-2 text-center">
                  <p className="font-mono text-lg font-bold text-primary">{myReports.length}</p>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Total</p>
                </div>
              </div>
            </div>

            <div className="px-4 py-6 max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-headline text-lg font-bold text-on-surface">My Reports</h2>
                <button onClick={() => setShowNewReport(true)} className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"><Plus className="w-4 h-4" /> New</button>
              </div>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-on-surface-variant mt-3 text-sm font-mono">Loading...</p></div>
              ) : myReports.length === 0 ? (
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center">
                  <Camera className="w-12 h-12 text-outline mx-auto mb-3" />
                  <h3 className="font-bold text-on-surface mb-1">No Reports Yet</h3>
                  <p className="text-sm text-on-surface-variant mb-4">Tap below to report road damage in your area.</p>
                  <button onClick={() => setShowNewReport(true)} className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-bold text-sm inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Report Damage</button>
                </div>
              ) : (
                <div className="grid gap-4">{myReports.map((r) => <ReportCard key={r.id} report={r} onClick={() => onViewReport?.(r)} />)}</div>
              )}
            </div>
          </>
        )}

        {activeTab === 'scan' && (
          <div className="px-4 py-6 max-w-2xl mx-auto flex flex-col gap-4">
            {/* Mode Selector */}
            <div className="bg-surface-container-lowest rounded-xl p-3 flex gap-2 border border-outline-variant shadow-sm">
              <button onClick={handleStartCamera} className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all ${scanMode === 'camera' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
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
                <div className="h-[50vh] min-h-[300px]">
                  <CameraScanner
                    isActive={activeTab === 'scan' && scanMode === 'camera'}
                    onDetections={handleCameraDetections}
                    onAnnotatedImage={handleAnnotatedImage}
                    onCameraReadyChange={setIsCameraReady}
                    onStop={() => {
                      setScanMode('off');
                      setIsCameraReady(false);
                    }}
                  />
                </div>
              ) : scanMode === 'off' ? (
                <div className="h-[50vh] min-h-[300px] bg-surface-container-lowest rounded-xl border border-outline-variant flex flex-col items-center justify-center p-6 text-center">
                  <CameraOff className="w-12 h-12 text-outline mb-3" />
                  <h4 className="font-bold text-on-surface mb-1">Camera Stopped</h4>
                  <p className="text-xs text-on-surface-variant mb-4 font-mono">Tap below to start live camera scanning</p>
                  <button onClick={handleStartCamera} className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2">
                    <Camera className="w-4 h-4" />Start Live Camera
                  </button>
                </div>
              ) : (
                <div className="h-[50vh] min-h-[300px]">
                  <VideoFeed url={streamUrl} onStop={handleStartCamera} detections={allDetections} />
                </div>
              )}
            </div>

            {/* API Error Banner */}
            {uploadError && (
              <div className="bg-error-container border border-error/30 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 text-error" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-error-container mb-0.5">AI Detection Unavailable</p>
                  <p className="text-xs text-on-error-container/80 leading-relaxed">{uploadError}</p>
                </div>
                <button onClick={() => setUploadError(null)} className="text-on-error-container/60 hover:text-on-error-container shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Detection Counter Panel */}
            {totalDetections > 0 && (
              <div className="bg-surface-container-lowest border border-primary/30 rounded-xl p-4 shadow-sm ring-1 ring-primary/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Radar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-on-surface">Detection Summary</h4>
                      <p className="text-[10px] font-mono text-on-surface-variant">{totalDetections} total detection{totalDetections !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => setAllDetections([])} className="text-[10px] font-mono text-outline hover:text-error transition-colors">Reset</button>
                </div>
                {/* Count chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(detCounts).map(([label, count]) => (
                    <div key={label} className="flex items-center gap-1.5 bg-surface-container rounded-full px-3 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs font-medium text-on-surface">{label}</span>
                      <span className="font-mono text-xs font-bold text-primary">{count}</span>
                    </div>
                  ))}
                </div>
                {/* AI Crack Type Analysis — shown when AI classifier returns a specific subtype */}
                {allDetections.some((d) => d.crack_type && d.crack_type !== 'unknown') && (
                  <div className="mb-3">
                    <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-2">🔍 Crack Type Analysis</p>
                    <div className="space-y-2">
                      {allDetections
                        .filter((d) => d.crack_type && d.crack_type !== 'unknown')
                        .slice(-5)
                        .map((d, i) => (
                          <div key={i} className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="text-xs font-bold text-primary">{d.crack_label}</span>
                                <span className="text-[10px] font-mono text-on-surface-variant shrink-0">{Math.round(d.confidence * 100)}% YOLO</span>
                              </div>
                              {d.crack_description && (
                                <p className="text-[10px] text-on-surface-variant leading-relaxed">{d.crack_description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {/* AI Description */}
                <div className="bg-surface-muted rounded-lg px-3 py-2 mb-3">
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-1">AI Generated Description</p>
                  <p className="text-xs text-on-surface leading-relaxed">{generateDescription(allDetections)}</p>
                </div>
                <button onClick={handleReportFromDetection} className="w-full bg-primary text-on-primary font-headline font-bold py-3 rounded-lg flex items-center justify-center gap-2 text-sm shadow-sm active:scale-[0.98] transition-transform">
                  <Send className="w-4 h-4" />Report This Detection
                </button>
              </div>
            )}

            <p className="text-xs text-on-surface-variant text-center font-mono">Use your camera or upload images/video to detect road damage detection using YOLOv11</p>
          </div>
        )}
      </main>

      {/* FAB */}
      <button onClick={() => setShowNewReport(true)} className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg shadow-primary/30 flex items-center justify-center z-50 hover:scale-105 active:scale-95 transition-transform">
        <Plus className="w-7 h-7" />
      </button>

      {showNewReport && <NewReportModal prefill={reportPrefill} onClose={() => { setShowNewReport(false); setReportPrefill(undefined); }} />}
    </div>
  );
}
