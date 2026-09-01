'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-config';
import type { Report, ReportInsert, ReportStatus, SeverityLevel } from '@/lib/database.types';

const supabase = createClient();

// ── Mock data for local dev ───────────────────────────────────────────────────
const MOCK_REPORTS: Report[] = [
  {
    id: 'mock-001', reporter_id: null, damage_type: 'pothole', severity: 'critical',
    confidence: 0.94, description: 'Large pothole on main road, vehicle damage risk.',
    latitude: 8.9475, longitude: 125.5406, address: 'Montilla Blvd, Butuan City',
    image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400&q=80',
    status: 'reported', assigned_to: null, ai_detection_data: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'mock-002', reporter_id: null, damage_type: 'transverse_crack', severity: 'high',
    confidence: 0.87, description: 'Multiple transverse cracks detected across road surface.',
    latitude: 8.9501, longitude: 125.5430, address: 'J.C. Aquino Ave, Butuan City',
    image_url: 'https://images.unsplash.com/photo-1574870111867-089730e5a72b?w=400&q=80',
    status: 'verified', assigned_to: null, ai_detection_data: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'mock-003', reporter_id: null, damage_type: 'longitudinal_crack', severity: 'medium',
    confidence: 0.72, description: 'Longitudinal crack running along the road centerline.',
    latitude: 8.9455, longitude: 125.5450, address: 'Langihan Road, Butuan City',
    image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400&q=80',
    status: 'in_progress', assigned_to: null, ai_detection_data: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mock-004', reporter_id: null, damage_type: 'pothole', severity: 'high',
    confidence: 0.91, description: 'Deep pothole near intersection, urgent repair needed.',
    latitude: 8.9490, longitude: 125.5380, address: 'Rosario St, Butuan City',
    image_url: 'https://images.unsplash.com/photo-1574870111867-089730e5a72b?w=400&q=80',
    status: 'scheduled', assigned_to: null, ai_detection_data: null,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'mock-005', reporter_id: null, damage_type: 'other', severity: 'medium',
    confidence: 0.65, description: 'Open manhole cover detected, pedestrian hazard.',
    latitude: 8.9520, longitude: 125.5410, address: 'Villanueva St, Butuan City',
    image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400&q=80',
    status: 'reported', assigned_to: null, ai_detection_data: null,
    created_at: new Date(Date.now() - 43200000).toISOString(),
    updated_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'mock-006', reporter_id: null, damage_type: 'transverse_crack', severity: 'low',
    confidence: 0.58, description: 'Minor surface crack, monitor for deterioration.',
    latitude: 8.9460, longitude: 125.5420, address: 'P. Burgos St, Butuan City',
    image_url: 'https://images.unsplash.com/photo-1574870111867-089730e5a72b?w=400&q=80',
    status: 'fixed', assigned_to: null, ai_detection_data: null,
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

const MOCK_STATS = {
  total_reports: MOCK_REPORTS.length,
  critical_count: MOCK_REPORTS.filter(r => r.severity === 'critical').length,
  high_count: MOCK_REPORTS.filter(r => r.severity === 'high').length,
  medium_count: MOCK_REPORTS.filter(r => r.severity === 'medium').length,
  low_count: MOCK_REPORTS.filter(r => r.severity === 'low').length,
  reported_count: MOCK_REPORTS.filter(r => r.status === 'reported').length,
  verified_count: MOCK_REPORTS.filter(r => r.status === 'verified').length,
  scheduled_count: MOCK_REPORTS.filter(r => r.status === 'scheduled').length,
  in_progress_count: MOCK_REPORTS.filter(r => r.status === 'in_progress').length,
  fixed_count: MOCK_REPORTS.filter(r => r.status === 'fixed').length,
};
// ── End mock data ─────────────────────────────────────────────────────────────

/**
 * Hook to fetch reports with optional filters.
 */
export function useReports(filters?: {
  status?: ReportStatus | ReportStatus[];
  severity?: SeverityLevel | SeverityLevel[];
  limit?: number;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterString = JSON.stringify(filters);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (DEV_BYPASS) {
      // Return filtered mock data
      let r = [...MOCK_REPORTS];
      if (filters?.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        r = r.filter(x => statuses.includes(x.status));
      }
      if (filters?.severity) {
        const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
        r = r.filter(x => severities.includes(x.severity));
      }
      if (filters?.limit) r = r.slice(0, filters.limit);
      setReports(r);
      setIsLoading(false);
      return;
    }

    let query = supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters?.severity) {
      if (Array.isArray(filters.severity)) {
        query = query.in('severity', filters.severity);
      } else {
        query = query.eq('severity', filters.severity);
      }
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setReports(data || []);
    }
    setIsLoading(false);
  }, [filterString]);

  useEffect(() => {
    fetchReports();

    if (DEV_BYPASS) return; // No real-time in dev mode

    // Real-time subscription for live updates
    const channel = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => { fetchReports(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchReports]);

  return { reports, isLoading, error, refetch: fetchReports };
}

/**
 * Hook to create a new damage report.
 */
export function useCreateReport() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReport = async (report: ReportInsert) => {
    setIsSubmitting(true);
    setError(null);

    if (DEV_BYPASS) {
      // Simulate success
      await new Promise(r => setTimeout(r, 500));
      setIsSubmitting(false);
      return { ...report, id: `mock-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Report;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: insertError } = await (supabase
      .from('reports') as any)
      .insert([report])
      .select()
      .single();

    setIsSubmitting(false);

    if (insertError) {
      setError((insertError as { message: string }).message);
      return null;
    }

    return data as Report;
  };

  return { createReport, isSubmitting, error };
}

/**
 * Hook to update a report's status (admin/engineer action).
 */
export function useUpdateReportStatus() {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatus = async (reportId: string, newStatus: ReportStatus, assignedTo?: string) => {
    setIsUpdating(true);

    if (DEV_BYPASS) {
      await new Promise(r => setTimeout(r, 300));
      setIsUpdating(false);
      return true;
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (assignedTo !== undefined) {
      updateData.assigned_to = assignedTo;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase
      .from('reports') as any)
      .update(updateData)
      .eq('id', reportId);

    setIsUpdating(false);
    return !error;
  };

  return { updateStatus, isUpdating };
}

/**
 * Hook to upload a report image to Supabase Storage.
 */
export function useUploadImage() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);

    if (DEV_BYPASS) {
      // Return a fake URL in dev mode
      await new Promise(r => setTimeout(r, 500));
      setIsUploading(false);
      return URL.createObjectURL(file);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `reports/${fileName}`;

    const { error } = await supabase.storage
      .from('report-images')
      .upload(filePath, file);

    setIsUploading(false);

    if (error) {
      console.error('Upload error:', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('report-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  return { uploadImage, isUploading };
}

/**
 * Hook to fetch the status history timeline for a specific report.
 */
export function useReportTimeline(reportId: string | null) {
  const [history, setHistory] = useState<Array<{
    id: string;
    old_status: ReportStatus | null;
    new_status: ReportStatus;
    changed_by: string | null;
    note: string | null;
    created_at: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!reportId) return;

    if (DEV_BYPASS) {
      setHistory([
        { id: 'h1', old_status: null, new_status: 'reported', changed_by: null, note: 'Report submitted via AI Scanner', created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 'h2', old_status: 'reported', new_status: 'verified', changed_by: null, note: 'AI confidence confirmed, field team notified', created_at: new Date(Date.now() - 1800000).toISOString() },
      ]);
      return;
    }

    setIsLoading(true);
    supabase
      .from('report_status_history')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setHistory(data || []);
        setIsLoading(false);
      });
  }, [reportId]);

  return { history, isLoading };
}

/**
 * Hook to fetch dashboard statistics.
 */
export function useReportStats() {
  const [stats, setStats] = useState<{
    total_reports: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    reported_count: number;
    verified_count: number;
    scheduled_count: number;
    in_progress_count: number;
    fixed_count: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (DEV_BYPASS) {
      setStats(MOCK_STATS);
      setIsLoading(false);
      return;
    }

    supabase.from('reports').select('*').then(({ data, error }) => {
      if (data) {
        setStats({
          total_reports: data.length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          critical_count: data.filter((r: any) => r.severity === 'critical').length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          high_count: data.filter((r: any) => r.severity === 'high').length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          medium_count: data.filter((r: any) => r.severity === 'medium').length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          low_count: data.filter((r: any) => r.severity === 'low').length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          reported_count: data.filter((r: any) => r.status === 'reported').length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          verified_count: data.filter((r: any) => r.status === 'verified').length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          scheduled_count: data.filter((r: any) => r.status === 'scheduled').length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          in_progress_count: data.filter((r: any) => r.status === 'in_progress').length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fixed_count: data.filter((r: any) => r.status === 'fixed').length,
        });
      } else {
        console.error('Failed to load stats:', error);
      }
      setIsLoading(false);
    });
  }, []);

  return { stats, isLoading };
}
