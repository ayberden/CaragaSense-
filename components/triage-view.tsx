'use client';
import { useState, useMemo } from 'react';
import { Filter, Loader2, Eye, X, ArrowUpDown, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { useReports, useUpdateReportStatus } from '@/hooks/use-reports';
import type { Report, SeverityLevel, DamageType, ReportStatus } from '@/lib/database.types';

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

const SEVERITY_ORDER: Record<SeverityLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
type SortField = 'severity' | 'confidence' | 'date_newest' | 'date_oldest';

function formatConfidence(c: number | null): string {
  return c === null ? 'N/A' : `${Math.round(c * 100)}%`;
}

function getReportImage(r: Report): string {
  return r.image_url || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=200&q=80';
}

/* ── Filter Panel ───────────────────────────────── */
function FilterPanel({ filters, onChange, onClose }: {
  filters: { severity: SeverityLevel[]; damageType: DamageType[]; status: ReportStatus[]; sort: SortField };
  onChange: (f: typeof filters) => void;
  onClose: () => void;
}) {
  const toggleArr = <T extends string>(arr: T[], val: T) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  const Chip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} type="button"
      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-high'}`}>
      {label}
    </button>
  );

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg p-5 space-y-4 mb-4">
      <div className="flex justify-between items-center">
        <h3 className="font-headline text-base font-bold text-on-surface">Filter & Sort</h3>
        <button onClick={onClose} className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Severity */}
      <div>
        <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-2">Severity</p>
        <div className="flex flex-wrap gap-2">
          {(['critical', 'high', 'medium', 'low'] as SeverityLevel[]).map((s) => (
            <Chip key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={filters.severity.includes(s)}
              onClick={() => onChange({ ...filters, severity: toggleArr(filters.severity, s) })} />
          ))}
        </div>
      </div>

      {/* Damage Type */}
      <div>
        <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-2">Damage Type</p>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(DAMAGE_LABELS) as [DamageType, string][]).map(([key, label]) => (
            <Chip key={key} label={label} active={filters.damageType.includes(key)}
              onClick={() => onChange({ ...filters, damageType: toggleArr(filters.damageType, key) })} />
          ))}
        </div>
      </div>

      {/* Status */}
      <div>
        <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          {(['reported', 'verified', 'scheduled', 'in_progress'] as ReportStatus[]).map((s) => (
            <Chip key={s} label={s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} active={filters.status.includes(s)}
              onClick={() => onChange({ ...filters, status: toggleArr(filters.status, s) })} />
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mb-2">Sort By</p>
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'severity', label: 'Severity (Critical First)' },
            { id: 'confidence', label: 'AI Confidence' },
            { id: 'date_newest', label: 'Newest First' },
            { id: 'date_oldest', label: 'Oldest First' },
          ] as { id: SortField; label: string }[]).map((s) => (
            <Chip key={s.id} label={s.label} active={filters.sort === s.id}
              onClick={() => onChange({ ...filters, sort: s.id })} />
          ))}
        </div>
      </div>

      {/* Clear */}
      <button onClick={() => onChange({ severity: [], damageType: [], status: ['reported', 'verified', 'scheduled', 'in_progress'], sort: 'severity' })}
        className="text-xs text-primary font-bold hover:underline">
        Reset All Filters
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════ */
export function TriageView({ onViewReport }: { onViewReport?: (report: Report) => void }) {
  const { reports: rawReports, isLoading, error } = useReports({
    status: ['reported', 'verified', 'scheduled', 'in_progress'],
  });
  const { updateStatus, isUpdating } = useUpdateReportStatus();
  const [showFilter, setShowFilter] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    severity: [] as SeverityLevel[],
    damageType: [] as DamageType[],
    status: ['reported', 'verified', 'scheduled', 'in_progress'] as ReportStatus[],
    sort: 'severity' as SortField,
  });

  const activeFilterCount = filters.severity.length + filters.damageType.length + (filters.sort !== 'severity' ? 1 : 0);

  const reports = useMemo(() => {
    let r = [...rawReports];
    if (filters.severity.length > 0) r = r.filter((x) => filters.severity.includes(x.severity));
    if (filters.damageType.length > 0) r = r.filter((x) => filters.damageType.includes(x.damage_type));

    switch (filters.sort) {
      case 'severity':
        r.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'confidence':
        r.sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1));
        break;
      case 'date_newest':
        r.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'date_oldest':
        r.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
    }
    return r;
  }, [rawReports, filters]);

  const handleDispatch = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    await updateStatus(reportId, 'in_progress');
  };

  const handleDismiss = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to dismiss this report? This action cannot be undone.')) return;
    await updateStatus(reportId, 'dismissed');
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-on-surface-variant mt-3 font-mono text-sm">Loading triage queue...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex flex-col h-full max-w-7xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="font-headline text-3xl font-bold text-on-surface">Triage Queue</h1>
        <p className="font-sans text-lg text-on-surface-variant">Review and dispatch field operations based on AI detection confidence.</p>
      </header>

      {error && (
        <div className="bg-error-container/50 border border-error/20 text-on-error-container rounded-lg px-4 py-3 text-sm mb-4">
          Failed to load reports: {error}
        </div>
      )}

      {/* Filter Toggle */}
      {showFilter && <FilterPanel filters={filters} onChange={setFilters} onClose={() => setShowFilter(false)} />}

      {rawReports.length === 0 && !error ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-sm flex-1 flex flex-col items-center justify-center text-center">
          <h2 className="text-xl font-bold mb-2">No pending reports</h2>
          <p className="text-on-surface-variant">All road damage reports have been processed.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex-1">
            <div className="px-6 py-4 border-b border-outline-variant bg-surface-muted flex justify-between items-center">
              <h3 className="font-headline text-xl font-bold text-on-surface">
                Detection Queue
                <span className="ml-2 text-sm font-mono text-on-surface-variant font-normal">({reports.length}{reports.length !== rawReports.length ? ` of ${rawReports.length}` : ''})</span>
              </h3>
              <button onClick={() => setShowFilter(!showFilter)}
                className={`flex items-center gap-2 text-sm font-bold transition-colors ${showFilter ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}>
                <Filter className="w-4 h-4" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-mono flex items-center justify-center">{activeFilterCount}</span>
                )}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface font-mono text-xs uppercase tracking-widest text-on-surface-variant border-b border-outline-variant">
                    <th className="px-6 py-4 font-bold">Damage Type</th>
                    <th className="px-6 py-4 font-bold">Severity</th>
                    <th className="px-6 py-4 font-bold">Location</th>
                    <th className="px-6 py-4 font-bold">Confidence</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Action</th>
                    <th className="px-6 py-4 font-bold w-10"></th>
                  </tr>
                </thead>
                <tbody className="font-sans text-sm">
                  {reports.map((report) => {
                    const styles = SEVERITY_STYLES[report.severity];
                    return (
                      <tr key={report.id} className="border-b border-outline-variant hover:bg-surface-muted transition-colors cursor-pointer" onClick={() => onViewReport?.(report)}>
                        <td className="px-6 py-4 flex items-center gap-4">
                          <div className="w-12 h-12 rounded overflow-hidden relative border border-outline-variant shrink-0 cursor-pointer"
                               onClick={(e) => { e.stopPropagation(); setFullscreenImage(getReportImage(report)); }}>
                            <Image src={getReportImage(report)} alt={report.damage_type} fill className="object-cover" unoptimized referrerPolicy="no-referrer" />
                          </div>
                          <span className="font-bold text-base text-on-surface">{DAMAGE_LABELS[report.damage_type] || report.damage_type}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-bold ${styles.badge}`}>
                            <span className={`w-2 h-2 rounded-full ${styles.dot}`}></span> {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-base text-on-surface-variant max-w-[200px] truncate">{report.address || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`}</td>
                        <td className="px-6 py-4 text-base text-on-surface-variant font-mono">{formatConfidence(report.confidence)}</td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container px-2 py-1 rounded">{report.status.replace('_', ' ')}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => handleDismiss(e, report.id)} disabled={isUpdating}
                              className="text-on-surface-variant hover:text-error font-semibold transition-colors disabled:opacity-50">Dismiss</button>
                            <button onClick={(e) => handleDispatch(e, report.id)} disabled={isUpdating}
                              className="bg-primary text-on-primary px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">Dispatch</button>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <button onClick={(e) => { e.stopPropagation(); onViewReport?.(report); }}
                            className="p-2 rounded-lg hover:bg-surface-container-high text-outline hover:text-primary transition-colors" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col gap-4 pb-16">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-headline text-lg font-bold text-on-surface">
                Detection Queue <span className="ml-1 text-sm font-mono text-on-surface-variant font-normal">({reports.length})</span>
              </h3>
              <button onClick={() => setShowFilter(!showFilter)}
                className={`text-sm font-bold flex items-center gap-1 ${showFilter ? 'text-primary' : 'text-on-surface-variant'}`}>
                <Filter className="w-4 h-4" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[9px] font-mono flex items-center justify-center">{activeFilterCount}</span>
                )}
              </button>
            </div>
            {reports.map((report) => {
              const styles = SEVERITY_STYLES[report.severity];
              return (
                <div key={report.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col cursor-pointer" onClick={() => onViewReport?.(report)}>
                  <div className="h-32 w-full relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setFullscreenImage(getReportImage(report)); }}>
                    <Image src={getReportImage(report)} alt={report.damage_type} fill className="object-cover" unoptimized referrerPolicy="no-referrer" />
                    <div className="absolute top-2 left-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded shadow text-[10px] font-mono font-bold ${styles.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></span> {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)}
                      </span>
                    </div>
                    {report.confidence !== null && (
                      <div className="absolute top-2 right-2">
                        <span className="bg-black/50 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold">AI: {formatConfidence(report.confidence)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-lg text-on-surface">{DAMAGE_LABELS[report.damage_type] || report.damage_type}</h4>
                      <span className="text-[10px] font-mono font-bold text-on-surface-variant bg-surface-container px-2 py-1 rounded uppercase">{report.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant mb-4">{report.address || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`}</p>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => handleDismiss(e, report.id)} disabled={isUpdating}
                        className="flex-1 bg-surface-container-high text-on-surface py-2 rounded-lg font-semibold text-sm transition-colors active:bg-surface-variant disabled:opacity-50">Dismiss</button>
                      <button onClick={(e) => handleDispatch(e, report.id)} disabled={isUpdating}
                        className="flex-1 bg-primary text-on-primary py-2 rounded-lg font-semibold text-sm transition-colors active:scale-95 shadow-sm disabled:opacity-50">Dispatch</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {fullscreenImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setFullscreenImage(null)}>
          <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center">
            <button 
              className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2 font-mono text-sm bg-black/50 rounded-lg"
              onClick={() => setFullscreenImage(null)}
            >
              CLOSE (Esc)
            </button>
            <img 
              src={fullscreenImage} 
              alt="Full size detection" 
              className="max-w-full max-h-[90vh] object-contain rounded border border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
