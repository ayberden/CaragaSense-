'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-config';
import type { Profile, UserRole } from '@/lib/database.types';

const supabase = createClient();

const MOCK_PROFILES: Profile[] = [
  { id: 'dev-local-admin-001', full_name: 'Local Admin', role: 'admin', avatar_url: null, phone: null, created_at: new Date(Date.now() - 864000000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'dev-user-002', full_name: 'Juan dela Cruz', role: 'engineer', avatar_url: null, phone: '+63-912-345-6789', created_at: new Date(Date.now() - 432000000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'dev-user-003', full_name: 'Maria Santos', role: 'citizen', avatar_url: null, phone: null, created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date().toISOString() },
  { id: 'dev-user-004', full_name: 'Pedro Reyes', role: 'citizen', avatar_url: null, phone: '+63-917-654-3210', created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date().toISOString() },
];

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (DEV_BYPASS) {
      setProfiles(MOCK_PROFILES);
      setIsLoading(false);
      return;
    }

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

    if (DEV_BYPASS) {
      await new Promise(r => setTimeout(r, 300));
      setIsUpdating(false);
      return true;
    }

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
    if (DEV_BYPASS) {
      // Mock: assign random report counts
      setCounts({ 'dev-user-003': 3, 'dev-user-004': 2 });
      return;
    }

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
