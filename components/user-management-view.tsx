'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useProfiles, useUpdateRole, useUserReportCounts } from '@/hooks/use-profiles';
import {
  Users, Shield, Wrench, User, ChevronDown, Loader2, Search,
  FileText, Calendar,
} from 'lucide-react';
import type { Profile, UserRole } from '@/lib/database.types';

const ROLE_CONFIG: Record<UserRole, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'text-severity-high', bg: 'bg-severity-high/10' },
  engineer: { label: 'Engineer', icon: Wrench, color: 'text-severity-medium', bg: 'bg-severity-medium/10' },
  citizen: { label: 'Citizen', icon: User, color: 'text-primary', bg: 'bg-primary/10' },
};

const ALL_ROLES: UserRole[] = ['citizen', 'engineer', 'admin'];

function RoleDropdown({ profile, onUpdate }: { profile: Profile; onUpdate: (role: UserRole) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const config = ROLE_CONFIG[profile.role];

  const handleSelect = async (role: UserRole) => {
    if (role === profile.role) { setOpen(false); return; }
    setLoading(true);
    await onUpdate(role);
    setLoading(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-outline-variant ${config.bg} ${config.color} transition-all hover:shadow-sm disabled:opacity-50`}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <config.icon className="w-3.5 h-3.5" />}
        {config.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-36 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg overflow-hidden z-20">
            {ALL_ROLES.map((r) => {
              const cfg = ROLE_CONFIG[r];
              const isCurrent = r === profile.role;
              return (
                <button key={r} onClick={() => handleSelect(r)}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${isCurrent ? 'bg-primary/5 font-bold text-primary' : 'text-on-surface hover:bg-surface-container-high'}`}>
                  <cfg.icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-primary' : cfg.color}`} />
                  {cfg.label}
                  {isCurrent && <span className="ml-auto text-[9px] font-mono text-primary">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function UserManagementView() {
  const { profile: myProfile } = useAuth();
  const { profiles, isLoading, error, refetch } = useProfiles();
  const { updateRole } = useUpdateRole();
  const { counts } = useUserReportCounts();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  const isAdmin = myProfile?.role === 'admin';

  const filtered = profiles.filter((p) => {
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.full_name?.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q));
    }
    return true;
  });

  const roleCounts = {
    all: profiles.length,
    admin: profiles.filter((p) => p.role === 'admin').length,
    engineer: profiles.filter((p) => p.role === 'engineer').length,
    citizen: profiles.filter((p) => p.role === 'citizen').length,
  };

  const handleRoleUpdate = async (userId: string, newRole: UserRole) => {
    const success = await updateRole(userId, newRole);
    if (success) refetch();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-on-surface-variant font-mono text-sm">LOADING USERS...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 flex flex-col h-full max-w-7xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="font-headline text-3xl font-bold text-on-surface">User Management</h1>
        <p className="font-sans text-lg text-on-surface-variant">Manage user roles and view activity.</p>
      </header>

      {error && (
        <div className="bg-error-container/50 border border-error/20 text-on-error-container rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { id: 'all' as const, label: 'All Users', icon: Users, color: 'text-primary' },
          { id: 'admin' as const, label: 'Admins', icon: Shield, color: 'text-severity-high' },
          { id: 'engineer' as const, label: 'Engineers', icon: Wrench, color: 'text-severity-medium' },
          { id: 'citizen' as const, label: 'Citizens', icon: User, color: 'text-primary' },
        ].map((f) => (
          <button key={f.id} onClick={() => setRoleFilter(f.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${roleFilter === f.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-high'}`}>
            <f.icon className={`w-5 h-5 shrink-0 ${roleFilter === f.id ? 'text-primary' : f.color}`} />
            <div>
              <p className="font-mono text-lg font-bold text-on-surface leading-tight">{roleCounts[f.id]}</p>
              <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">{f.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or ID..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {/* Users Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex-1">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface font-mono text-xs uppercase tracking-widest text-on-surface-variant border-b border-outline-variant">
                <th className="px-6 py-4 font-bold">User</th>
                <th className="px-6 py-4 font-bold">Role</th>
                <th className="px-6 py-4 font-bold">Reports</th>
                <th className="px-6 py-4 font-bold">Joined</th>
              </tr>
            </thead>
            <tbody className="font-sans text-sm">
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-outline-variant hover:bg-surface-muted transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-on-primary-container" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-on-surface truncate">{p.full_name || 'Unnamed'}</p>
                        <p className="text-[10px] font-mono text-outline truncate">{p.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isAdmin && p.id !== myProfile?.id ? (
                      <RoleDropdown profile={p} onUpdate={(role) => handleRoleUpdate(p.id, role)} />
                    ) : (() => {
                      const RoleIcon = ROLE_CONFIG[p.role].icon;
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${ROLE_CONFIG[p.role].bg} ${ROLE_CONFIG[p.role].color}`}>
                          <RoleIcon className="w-3.5 h-3.5" />
                          {ROLE_CONFIG[p.role].label}
                          {p.id === myProfile?.id && <span className="text-[9px] font-mono ml-1 opacity-70">(You)</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="font-mono font-bold">{counts[p.id] || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant font-mono text-xs">
                    {new Date(p.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-outline-variant">
          {filtered.map((p) => (
            <div key={p.id} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-on-primary-container" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-on-surface truncate">{p.full_name || 'Unnamed'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono text-outline">{counts[p.id] || 0} reports</span>
                  <span className="text-[10px] font-mono text-outline">·</span>
                  <span className="text-[10px] font-mono text-outline">
                    {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </span>
                </div>
              </div>
              {isAdmin && p.id !== myProfile?.id ? (
                <RoleDropdown profile={p} onUpdate={(role) => handleRoleUpdate(p.id, role)} />
              ) : (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${ROLE_CONFIG[p.role].bg} ${ROLE_CONFIG[p.role].color}`}>
                  {ROLE_CONFIG[p.role].label}
                </span>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-on-surface-variant font-mono text-sm">No users found</div>
        )}
      </div>
    </div>
  );
}
