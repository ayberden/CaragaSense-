'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/lib/database.types';

const supabase = createClient();

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setProfiles(data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);
  return { profiles, isLoading, error, refetch: fetchProfiles };
}

export function useUpdateRole() {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateRole = async (userId: string, newRole: UserRole): Promise<boolean> => {
    setIsUpdating(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('profiles') as any)
      .update({ role: newRole })
      .eq('id', userId);
    setIsUpdating(false);
    return !error;
  };

  return { updateRole, isUpdating };
}

export function useUserReportCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from('reports').select('reporter_id').then(({ data }) => {
      if (data) {
        const map: Record<string, number> = {};
        data.forEach((r: { reporter_id: string | null }) => {
          if (r.reporter_id) map[r.reporter_id] = (map[r.reporter_id] || 0) + 1;
        });
        setCounts(map);
      }
    });
  }, []);

  return { counts };
}
