'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-config';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@/lib/database.types';

// ── Dev mock profiles (one per role) ─────────────────────────────────────────
const DEV_MOCK_PROFILES: Record<UserRole, Profile> = {
  admin: {
    id: 'dev-admin-001', full_name: 'Local Admin', role: 'admin',
    avatar_url: null, phone: null,
    created_at: new Date(Date.now() - 864000000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  engineer: {
    id: 'dev-engineer-001', full_name: 'Juan dela Cruz', role: 'engineer',
    avatar_url: null, phone: '+63-912-345-6789',
    created_at: new Date(Date.now() - 432000000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  citizen: {
    id: 'dev-citizen-001', full_name: 'Maria Santos', role: 'citizen',
    avatar_url: null, phone: null,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date().toISOString(),
  },
};

function makeDevUser(profile: Profile): User {
  return {
    id: profile.id,
    email: `${profile.role}@caragasense.local`,
    app_metadata: {},
    user_metadata: { full_name: profile.full_name },
    aud: 'authenticated',
    created_at: profile.created_at,
  } as unknown as User;
}

const DEV_ROLE_KEY = 'caragasense_dev_role';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // ── DEV BYPASS: read role from localStorage ───────────────────────────────
  useEffect(() => {
    if (!DEV_BYPASS) return;

    const savedRole = localStorage.getItem(DEV_ROLE_KEY) as UserRole | null;
    if (savedRole && DEV_MOCK_PROFILES[savedRole]) {
      const mockProfile = DEV_MOCK_PROFILES[savedRole];
      setProfile(mockProfile);
      setUser(makeDevUser(mockProfile));
    } else {
      // Not logged in
      setProfile(null);
      setUser(null);
    }
    setIsLoading(false);
  }, []);
  // ── END DEV BYPASS ────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (DEV_BYPASS) return; // No-op in dev mode
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ── Production: Supabase auth ─────────────────────────────────────────────
  useEffect(() => {
    if (DEV_BYPASS) return;

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) fetchProfile(s.user.id);
      })
      .catch((err) => console.error('Supabase session error:', err))
      .finally(() => setIsLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) await fetchProfile(s.user.id);
      else setProfile(null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);
  // ── END PRODUCTION ────────────────────────────────────────────────────────

  const signOut = async () => {
    if (DEV_BYPASS) {
      localStorage.removeItem(DEV_ROLE_KEY);
    } else {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setSession(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, isLoading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/**
 * Dev-only: log in as a specific role (called from the login page).
 * Saves the role to localStorage so AuthProvider picks it up.
 */
export function devLogin(role: UserRole) {
  localStorage.setItem(DEV_ROLE_KEY, role);
  window.location.href = '/';
}
