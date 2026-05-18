'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Report, ReportInsert, ReportStatus, SeverityLevel } from '@/lib/database.types';

const supabase = createClient();

/**
 * Hook to fetch reports with optional filters.
 * Supports real-time subscription for live updates.
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

    // Real-time subscription for live updates
    const channel = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          // Refetch on any change
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    supabase.from('reports').select('*').then(({ data, error }) => {
      if (data) {
        setStats({
          total_reports: data.length,
          critical_count: data.filter((r: any) => r.severity === 'critical').length,
          high_count: data.filter((r: any) => r.severity === 'high').length,
          medium_count: data.filter((r: any) => r.severity === 'medium').length,
          low_count: data.filter((r: any) => r.severity === 'low').length,
          reported_count: data.filter((r: any) => r.status === 'reported').length,
          verified_count: data.filter((r: any) => r.status === 'verified').length,
          scheduled_count: data.filter((r: any) => r.status === 'scheduled').length,
          in_progress_count: data.filter((r: any) => r.status === 'in_progress').length,
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
