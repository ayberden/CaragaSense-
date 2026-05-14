'use client';

import { useMemo, useState } from 'react';
import { useReports } from '@/hooks/use-reports';
import {
  AlertTriangle, Bell, Clock, Flame, MapPin, ChevronRight,
  Filter, Loader2, CheckCircle2, Info,
} from 'lucide-react';
import Image from 'next/image';
import type { Report, SeverityLevel } from '@/lib/database.types';

/* ── Constants ──────────────────────────────────── */
const SEVERITY_STYLES: Record<SeverityLevel, { badge: string; dot: string; ring: string }> = {
  critical: {
    badge: 'bg-error-container text-on-error-container',
    dot: 'bg-severity-high',
    ring: 'ring-severity-high/20',
  },
  high: {
    badge: 'bg-error-container text-on-error-container',
    dot: 'bg-severity-high',
    ring: 'ring-severity-high/20',
  },
  medium: {
    badge: 'bg-secondary-fixed text-on-secondary-fixed-variant',
    dot: 'bg-severity-medium',
    ring: 'ring-severity-medium/20',
  },
  low: {
    badge: 'bg-surface-container text-severity-low',
    dot: 'bg-severity-low',
    ring: 'ring-severity-low/20',
  },
};

const DAMAGE_LABELS: Record<string, string> = {
  pothole: 'Pothole',
  longitudinal_crack: 'Longitudinal Crack',
  transverse_crack: 'Transverse Crack',
  rutting: 'Rutting',
  faded_markings: 'Faded Markings',
  other: 'Other Damage',
};

type AlertFilter = 'all' | 'critical' | 'new' | 'stale';

/* ── Helpers ────────────────────────────────────── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isStale(dateStr: string): boolean {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff > 48 * 60 * 60 * 1000; // 48 hours
}

/* ── Alert Item Component ───────────────────────── */
function AlertItem({ report, onViewDetails }: { report: Report; onViewDetails: (r: Report) => void }) {
  const styles = SEVERITY_STYLES[report.severity];
  const stale = isStale(report.created_at);
  const isCritical = report.severity === 'critical' || report.severity === 'high';
  const img = report.image_url || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=200&q=80';

  return (
    <div
      className={`bg-surface-container-lowest border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group ${
        isCritical ? `border-severity-high/30 ring-1 ${styles.ring}` : 'border-outline-variant'
      }`}
      onClick={() => onViewDetails(report)}
    >
      <div className="flex">
        {/* Thumbnail */}
        <div className="w-20 md:w-28 relative shrink-0">
          <Image
            src={img}
            alt={report.damage_type}
            fill
            className="object-cover"
            unoptimized
            referrerPolicy="no-referrer"
          />
          {/* Severity strip */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 ${styles.dot}`} />
        </div>

        {/* Content */}
        <div className="flex-1 p-3 md:p-4 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {isCritical && (
                  <Flame className="w-3.5 h-3.5 text-severity-high shrink-0 animate-pulse" />
                )}
                <h4 className="text-sm font-bold text-on-surface truncate">
                  {DAMAGE_LABELS[report.damage_type] || report.damage_type}
                </h4>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mb-2">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {report.address || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${styles.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
              </span>
              <span className="text-[10px] font-mono text-outline">{timeAgo(report.created_at)}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 mt-1">
            {stale && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-severity-medium bg-severity-medium/10 px-1.5 py-0.5 rounded">
                <Clock className="w-3 h-3" />
                STALE
              </span>
            )}
            {report.confidence !== null && (
              <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                AI: {Math.round(report.confidence * 100)}%
              </span>
            )}
            <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded uppercase">
              {report.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center pr-3 shrink-0">
          <ChevronRight className="w-4 h-4 text-outline group-hover:text-primary transition-colors" />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export function AlertsView({ onViewReport }: { onViewReport?: (report: Report) => void }) {
  const { reports, isLoading, error } = useReports();
  const [filter, setFilter] = useState<AlertFilter>('all');

  // Compute alerts: only non-resolved reports, sorted by priority
  const alerts = useMemo(() => {
    const active = reports.filter((r) => !['fixed', 'dismissed'].includes(r.status));

    // Sort: critical first, then high, then by newest
    const severityOrder: Record<SeverityLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    active.sort((a, b) => {
      const diff = severityOrder[a.severity] - severityOrder[b.severity];
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return active;
  }, [reports]);

  const filteredAlerts = useMemo(() => {
    switch (filter) {
      case 'critical':
        return alerts.filter((r) => r.severity === 'critical' || r.severity === 'high');
      case 'new':
        return alerts.filter((r) => r.status === 'reported');
      case 'stale':
        return alerts.filter((r) => isStale(r.created_at));
      default:
        return alerts;
    }
  }, [alerts, filter]);

  const criticalCount = alerts.filter((r) => r.severity === 'critical' || r.severity === 'high').length;
  const newCount = alerts.filter((r) => r.status === 'reported').length;
  const staleCount = alerts.filter((r) => isStale(r.created_at)).length;

  const handleViewDetails = (report: Report) => {
    onViewReport?.(report);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-on-surface-variant font-mono text-sm tracking-wider">LOADING ALERTS...</p>
      </div>
    );
  }

  const filters: { id: AlertFilter; label: string; count: number; icon: React.ElementType; color: string }[] = [
    { id: 'all', label: 'All Active', count: alerts.length, icon: Bell, color: 'text-primary' },
    { id: 'critical', label: 'Critical', count: criticalCount, icon: AlertTriangle, color: 'text-severity-high' },
    { id: 'new', label: 'New', count: newCount, icon: Info, color: 'text-primary' },
    { id: 'stale', label: 'Stale (48h+)', count: staleCount, icon: Clock, color: 'text-severity-medium' },
  ];

  return (
    <div className="p-4 md:p-8 flex flex-col h-full max-w-7xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="font-headline text-3xl font-bold text-on-surface">Alerts & Notifications</h1>
        <p className="font-sans text-lg text-on-surface-variant">
          Review critical road damage reports and system updates.
        </p>
      </header>

      {error && (
        <div className="bg-error-container/50 border border-error/20 text-on-error-container rounded-lg px-4 py-3 text-sm mb-4">
          Failed to load alerts: {error}
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
              filter === f.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-high'
            }`}
          >
            <f.icon className={`w-5 h-5 shrink-0 ${filter === f.id ? 'text-primary' : f.color}`} />
            <div>
              <p className="font-mono text-lg font-bold text-on-surface leading-tight">{f.count}</p>
              <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">{f.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Alert List */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-sm flex-1 flex flex-col items-center justify-center text-center">
          <CheckCircle2 className="w-12 h-12 text-severity-low mb-3" />
          <h2 className="text-xl font-bold mb-2">
            {filter === 'all' ? 'No active alerts' : `No ${filter} alerts`}
          </h2>
          <p className="text-on-surface-variant">
            {filter === 'all'
              ? 'All road damage reports have been processed. System is running optimally.'
              : 'Try switching to a different filter to see alerts.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pb-16 md:pb-0">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-mono text-on-surface-variant">
              Showing <span className="font-bold text-on-surface">{filteredAlerts.length}</span> alerts
            </p>
          </div>
          {filteredAlerts.map((report) => (
            <AlertItem key={report.id} report={report} onViewDetails={handleViewDetails} />
          ))}
        </div>
      )}
    </div>
  );
}
