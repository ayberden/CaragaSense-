'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-config';
import {
  AlertTriangle, CheckCircle2, Info, X, Bell,
} from 'lucide-react';
import type { Report } from '@/lib/database.types';

/* ── Types ──────────────────────────────────────── */
type ToastType = 'info' | 'success' | 'warning' | 'critical';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  timestamp: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export const useToast = () => useContext(ToastContext);

/* ── Toast Styles ───────────────────────────────── */
const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: React.ElementType; iconColor: string }> = {
  info: { bg: 'bg-surface-container-lowest', border: 'border-primary/30', icon: Info, iconColor: 'text-primary' },
  success: { bg: 'bg-surface-container-lowest', border: 'border-severity-low/30', icon: CheckCircle2, iconColor: 'text-severity-low' },
  warning: { bg: 'bg-surface-container-lowest', border: 'border-severity-medium/30', icon: AlertTriangle, iconColor: 'text-severity-medium' },
  critical: { bg: 'bg-error-container/20', border: 'border-severity-high/40', icon: AlertTriangle, iconColor: 'text-severity-high' },
};

/* ── Single Toast Component ─────────────────────── */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const style = TOAST_STYLES[toast.type];
  const Icon = style.icon;

  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`${style.bg} border ${style.border} rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 max-w-sm w-full animate-slide-in backdrop-blur-sm`}
      role="alert"
    >
      <div className={`w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${style.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-surface leading-tight">{toast.title}</p>
        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{toast.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-outline hover:text-on-surface p-0.5 rounded transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── Provider ───────────────────────────────────── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const knownReportIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  const addToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, type, title, message, timestamp: Date.now() }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Real-time listener for new reports — fires toast notifications
  useEffect(() => {
    // Skip all Supabase calls in dev mode
    if (DEV_BYPASS) return;

    const supabase = createClient();

    // First load existing report IDs so we don't toast for old ones
    supabase
      .from('reports')
      .select('id')
      .then(({ data }) => {
        if (data) {
          data.forEach((r: { id: string }) => knownReportIds.current.add(r.id));
        }
        // Mark initial load complete after a short delay
        setTimeout(() => {
          isInitialLoad.current = false;
        }, 2000);
      });

    const channel = supabase
      .channel('toast-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          if (isInitialLoad.current) return;
          const newReport = payload.new as Report;

          // Skip if we've already seen this report
          if (knownReportIds.current.has(newReport.id)) return;
          knownReportIds.current.add(newReport.id);

          const DAMAGE_LABELS: Record<string, string> = {
            pothole: 'Pothole', open_manhole: 'Open Manhole', manhole: 'Manhole',
            alligator_crack: 'Alligator Crack', block_crack: 'Block Crack', edge_crack: 'Edge Crack',
            longitudinal_crack: 'Long. Crack', transverse_crack: 'Trans. Crack',
            rutting: 'Rutting', other: 'Other Damages',
          };

          const isCritical = newReport.severity === 'critical' || newReport.severity === 'high';
          const label = DAMAGE_LABELS[newReport.damage_type] || newReport.damage_type;
          const loc = newReport.address || `${newReport.latitude.toFixed(4)}, ${newReport.longitude.toFixed(4)}`;

          addToast(
            isCritical ? 'critical' : 'info',
            `New Report: ${label}`,
            `${newReport.severity.charAt(0).toUpperCase() + newReport.severity.slice(1)} severity at ${loc}`
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reports' },
        (payload) => {
          if (isInitialLoad.current) return;
          const updated = payload.new as Report;
          const old = payload.old as Partial<Report>;

          // Only toast on status changes
          if (old.status && old.status !== updated.status) {
            const STATUS_LABELS: Record<string, string> = {
              reported: 'Reported', verified: 'Verified', scheduled: 'Scheduled',
              in_progress: 'In Progress', fixed: 'Fixed', dismissed: 'Dismissed',
            };
            addToast(
              updated.status === 'fixed' ? 'success' : 'info',
              `Status Updated`,
              `Report moved to "${STATUS_LABELS[updated.status] || updated.status}"`
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed top-20 right-4 z-[200] flex flex-col gap-2">
          {toasts.slice(-5).map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={() => removeToast(toast.id)}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
