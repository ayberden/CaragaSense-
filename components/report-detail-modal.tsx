'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useReportTimeline, useUpdateReportStatus } from '@/hooks/use-reports';
import {
  X, MapPin, Clock, CheckCircle2, AlertTriangle, Send, Loader2,
  ChevronDown, User, Calendar, Zap, Shield, FileText, ArrowRight,
} from 'lucide-react';
import Image from 'next/image';
import type { Report, ReportStatus, SeverityLevel } from '@/lib/database.types';

/* ── Constants ──────────────────────────────────── */
const SEVERITY_STYLES: Record<SeverityLevel, { badge: string; dot: string; bg: string }> = {
  critical: {
    badge: 'bg-error-container text-on-error-container',
    dot: 'bg-severity-high',
    bg: 'bg-severity-high/5',
  },
  high: {
    badge: 'bg-error-container text-on-error-container',
    dot: 'bg-severity-high',
    bg: 'bg-severity-high/5',
  },
  medium: {
    badge: 'bg-secondary-fixed text-on-secondary-fixed-variant',
    dot: 'bg-severity-medium',
    bg: 'bg-severity-medium/5',
  },
  low: {
    badge: 'bg-surface-container text-severity-low',
    dot: 'bg-severity-low',
    bg: 'bg-severity-low/5',
  },
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; icon: React.ElementType; bgColor: string }> = {
  reported: { label: 'Reported', color: 'text-[#6554C0]', icon: Send, bgColor: 'bg-[#6554C0]/10' },
  verified: { label: 'Verified', color: 'text-[#0065FF]', icon: CheckCircle2, bgColor: 'bg-[#0065FF]/10' },
  scheduled: { label: 'Scheduled', color: 'text-[#00B8D9]', icon: Calendar, bgColor: 'bg-[#00B8D9]/10' },
  in_progress: { label: 'In Progress', color: 'text-severity-medium', icon: Loader2, bgColor: 'bg-severity-medium/10' },
  fixed: { label: 'Fixed', color: 'text-severity-low', icon: CheckCircle2, bgColor: 'bg-severity-low/10' },
  dismissed: { label: 'Dismissed', color: 'text-outline', icon: X, bgColor: 'bg-outline/10' },
};

const DAMAGE_LABELS: Record<string, string> = {
  pothole: 'Pothole',
  open_manhole: 'Open Manhole',
  alligator_crack: 'Alligator Crack',
  block_crack: 'Block Crack',
  longitudinal_crack: 'Longitudinal Crack',
  transverse_crack: 'Transverse Crack',
  rutting: 'Rutting',
  other: 'Other Damages',
};

const ALL_STATUSES: ReportStatus[] = ['reported', 'verified', 'scheduled', 'in_progress', 'fixed', 'dismissed'];

/* ── Timeline Item ──────────────────────────────── */
function TimelineItem({ entry, isLast }: {
  entry: { old_status: ReportStatus | null; new_status: ReportStatus; created_at: string; changed_by: string | null; note: string | null };
  isLast: boolean;
}) {
  const config = STATUS_CONFIG[entry.new_status];
  const Icon = config.icon;

  return (
    <div className="flex gap-3">
      {/* Line + Dot */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center shrink-0 ring-2 ring-surface-container-lowest`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-outline-variant my-1" />}
      </div>

      {/* Content */}
      <div className="pb-5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
          {entry.old_status && (
            <span className="text-[10px] font-mono text-outline">
              from {STATUS_CONFIG[entry.old_status]?.label || entry.old_status}
            </span>
          )}
        </div>
        <p className="text-[10px] font-mono text-outline mt-0.5">
          {new Date(entry.created_at).toLocaleDateString('en-PH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
        {entry.note && (
          <p className="text-xs text-on-surface-variant mt-1 bg-surface-container rounded-lg px-3 py-2">
            {entry.note}
          </p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export function ReportDetailModal({ report, onClose }: { report: Report; onClose: () => void }) {
  const { profile } = useAuth();
  const { history, isLoading: timelineLoading } = useReportTimeline(report.id);
  const { updateStatus, isUpdating } = useUpdateReportStatus();
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(report.status);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'engineer';
  const styles = SEVERITY_STYLES[report.severity];
  const statusConfig = STATUS_CONFIG[currentStatus];
  const img = report.image_url || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&q=80';

  // Combine the initial "reported" event with actual history
  const fullTimeline = useMemo(() => {
    const initial = {
      old_status: null as ReportStatus | null,
      new_status: 'reported' as ReportStatus,
      created_at: report.created_at,
      changed_by: report.reporter_id,
      note: null,
    };
    if (history.length === 0) return [initial];
    // If first history item is also "reported", skip the synthetic one
    if (history[0].new_status === 'reported') return history;
    return [initial, ...history];
  }, [history, report.created_at, report.reporter_id]);

  const handleStatusChange = async (newStatus: ReportStatus) => {
    setShowStatusDropdown(false);
    const success = await updateStatus(report.id, newStatus);
    if (success) {
      setCurrentStatus(newStatus);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface-container-lowest w-full max-w-2xl rounded-t-2xl md:rounded-2xl border border-outline-variant shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header with Image */}
        <div className="relative h-48 md:h-56 shrink-0">
          <Image src={img} alt={report.damage_type} fill className="object-cover" unoptimized referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/60 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Badges overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow text-xs font-mono font-bold ${styles.badge}`}>
              <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
              {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
            </span>
            {report.confidence !== null && (
              <span className="bg-black/50 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-mono font-bold">
                AI: {Math.round(report.confidence * 100)}%
              </span>
            )}
          </div>

          {/* Title overlay */}
          <div className="absolute bottom-3 left-4 right-4">
            <h2 className="font-headline text-2xl font-bold text-white drop-shadow-lg">
              {DAMAGE_LABELS[report.damage_type] || report.damage_type}
            </h2>
            <div className="flex items-center gap-1.5 text-white/80 text-sm mt-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {report.address || `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Status Bar */}
          <div className={`px-5 py-3 border-b border-outline-variant flex items-center justify-between ${styles.bg}`}>
            <div className="flex items-center gap-2">
              <statusConfig.icon className={`w-4 h-4 ${statusConfig.color}`} />
              <span className={`font-mono text-sm font-bold ${statusConfig.color}`}>
                {statusConfig.label.toUpperCase()}
              </span>
            </div>

            {/* Admin: Status Change Dropdown */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Change Status
                      <ChevronDown className={`w-4 h-4 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>
                {showStatusDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg overflow-hidden z-20">
                    {ALL_STATUSES.map((s) => {
                      const cfg = STATUS_CONFIG[s];
                      const isCurrent = s === currentStatus;
                      return (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          disabled={isCurrent}
                          className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                            isCurrent
                              ? 'bg-primary/5 text-primary font-bold cursor-default'
                              : 'text-on-surface hover:bg-surface-container-high'
                          }`}
                        >
                          <cfg.icon className={`w-4 h-4 ${isCurrent ? 'text-primary' : cfg.color}`} />
                          {cfg.label}
                          {isCurrent && <span className="ml-auto text-[10px] font-mono text-primary">CURRENT</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="p-5 space-y-5">
            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-container rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Damage Type</span>
                </div>
                <p className="text-sm font-bold text-on-surface">{DAMAGE_LABELS[report.damage_type] || report.damage_type}</p>
              </div>
              <div className="bg-surface-container rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Severity</span>
                </div>
                <p className="text-sm font-bold text-on-surface">
                  {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
                </p>
              </div>
              <div className="bg-surface-container rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Reported</span>
                </div>
                <p className="text-sm font-bold text-on-surface">
                  {new Date(report.created_at).toLocaleDateString('en-PH', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </p>
              </div>
              <div className="bg-surface-container rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Coordinates</span>
                </div>
                <p className="text-xs font-mono text-on-surface">
                  {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                </p>
              </div>
            </div>

            {/* Description */}
            {report.description && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-on-surface-variant" />
                  <h3 className="text-sm font-bold text-on-surface font-headline">Description</h3>
                </div>
                <p className="text-sm text-on-surface-variant bg-surface-container rounded-lg px-4 py-3 leading-relaxed">
                  {report.description}
                </p>
              </div>
            )}

            {/* AI Detection Data */}
            {report.ai_detection_data && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-on-surface font-headline">AI Detection Data</h3>
                </div>
                <pre className="text-[10px] font-mono text-on-surface-variant bg-inverse-surface text-white rounded-lg px-4 py-3 overflow-x-auto">
                  {JSON.stringify(report.ai_detection_data, null, 2)}
                </pre>
              </div>
            )}

            {/* Status Timeline */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-on-surface-variant" />
                <h3 className="text-sm font-bold text-on-surface font-headline">Status History</h3>
              </div>

              {timelineLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : (
                <div className="ml-1">
                  {fullTimeline.map((entry, i) => (
                    <TimelineItem
                      key={i}
                      entry={entry}
                      isLast={i === fullTimeline.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions (Admin only) */}
        {isAdmin && (
          <div className="px-5 py-3 border-t border-outline-variant bg-surface-muted flex gap-3 shrink-0">
            {currentStatus === 'reported' && (
              <button
                onClick={() => handleStatusChange('verified')}
                disabled={isUpdating}
                className="flex-1 bg-primary text-on-primary font-headline font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Verify & Dispatch
              </button>
            )}
            {currentStatus === 'verified' && (
              <button
                onClick={() => handleStatusChange('scheduled')}
                disabled={isUpdating}
                className="flex-1 bg-primary text-on-primary font-headline font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                <Calendar className="w-4 h-4" />
                Schedule Repair
              </button>
            )}
            {currentStatus === 'scheduled' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={isUpdating}
                className="flex-1 bg-severity-medium text-white font-headline font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                <ArrowRight className="w-4 h-4" />
                Start Work
              </button>
            )}
            {currentStatus === 'in_progress' && (
              <button
                onClick={() => handleStatusChange('fixed')}
                disabled={isUpdating}
                className="flex-1 bg-severity-low text-white font-headline font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Fixed
              </button>
            )}
            {!['fixed', 'dismissed'].includes(currentStatus) && (
              <button
                onClick={() => handleStatusChange('dismissed')}
                disabled={isUpdating}
                className="px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant font-medium text-sm hover:bg-error-container/20 hover:text-error hover:border-error/20 transition-colors disabled:opacity-50"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
