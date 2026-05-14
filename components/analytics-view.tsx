'use client';

import { useMemo } from 'react';
import { useReports, useReportStats } from '@/hooks/use-reports';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  RadialBarChart, RadialBar,
} from 'recharts';
import {
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Activity,
  Loader2, MapPin, Zap, Target, BarChart3,
} from 'lucide-react';
import type { Report } from '@/lib/database.types';

/* ── Color palette ──────────────────────────────── */
const SEVERITY_COLORS = {
  critical: '#DE350B',
  high: '#FF5630',
  medium: '#FFAB00',
  low: '#36B37E',
};

const STATUS_COLORS = {
  reported: '#6554C0',
  verified: '#0065FF',
  scheduled: '#00B8D9',
  in_progress: '#FFAB00',
  fixed: '#36B37E',
  dismissed: '#97A0AF',
};

const DAMAGE_COLORS = [
  '#003d9b', '#0052cc', '#2684FF', '#4C9AFF', '#B3D4FF', '#79E2F2',
];

/* ── Helpers ────────────────────────────────────── */
function groupByDay(reports: Report[]) {
  const map = new Map<string, number>();
  reports.forEach((r) => {
    const day = new Date(r.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    map.set(day, (map.get(day) || 0) + 1);
  });
  // Return last 14 entries max
  return Array.from(map.entries())
    .map(([date, count]) => ({ date, count }))
    .slice(-14);
}

function groupBySeverity(reports: Report[]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  reports.forEach((r) => { counts[r.severity]++; });
  return Object.entries(counts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS],
  }));
}

function groupByDamageType(reports: Report[]) {
  const LABELS: Record<string, string> = {
    pothole: 'Pothole',
    longitudinal_crack: 'Long. Crack',
    transverse_crack: 'Trans. Crack',
    rutting: 'Rutting',
    faded_markings: 'Faded Marks',
    other: 'Other',
  };
  const map = new Map<string, number>();
  reports.forEach((r) => {
    const label = LABELS[r.damage_type] || r.damage_type;
    map.set(label, (map.get(label) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function groupByStatus(reports: Report[]) {
  const LABELS: Record<string, string> = {
    reported: 'Reported', verified: 'Verified', scheduled: 'Scheduled',
    in_progress: 'In Progress', fixed: 'Fixed', dismissed: 'Dismissed',
  };
  const map = new Map<string, number>();
  reports.forEach((r) => {
    const label = LABELS[r.status] || r.status;
    map.set(r.status, (map.get(r.status) || 0) + 1);
  });
  return Object.entries(LABELS).map(([key, label]) => ({
    name: label,
    value: map.get(key) || 0,
    fill: STATUS_COLORS[key as keyof typeof STATUS_COLORS],
  }));
}

function getAvgConfidence(reports: Report[]): number {
  const withConf = reports.filter((r) => r.confidence !== null);
  if (withConf.length === 0) return 0;
  return withConf.reduce((sum, r) => sum + (r.confidence || 0), 0) / withConf.length;
}

function getTopLocations(reports: Report[]) {
  const map = new Map<string, number>();
  reports.forEach((r) => {
    const loc = r.address || `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`;
    map.set(loc, (map.get(loc) || 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([location, count]) => ({ location, count }));
}

/* ── Custom Tooltip ─────────────────────────────── */
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-inverse-surface text-white px-3 py-2 rounded-lg shadow-lg text-xs font-mono">
      <p className="font-bold">{label}</p>
      <p>{payload[0].value} reports</p>
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────── */
function KpiCard({ label, value, icon: Icon, color, bgColor, subtitle }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; bgColor: string; subtitle?: string;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-11 h-11 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-2xl font-bold text-on-surface leading-tight">{value}</p>
        <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider mt-0.5">{label}</p>
        {subtitle && <p className="text-[10px] text-outline font-mono mt-1 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ── Chart Card Wrapper ─────────────────────────── */
function ChartCard({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-outline-variant">
        <h3 className="font-headline text-base font-bold text-on-surface">{title}</h3>
        {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export function AnalyticsView() {
  const { reports, isLoading: reportsLoading } = useReports();
  const { stats, isLoading: statsLoading } = useReportStats();

  const isLoading = reportsLoading || statsLoading;

  const dailyData = useMemo(() => groupByDay(reports), [reports]);
  const severityData = useMemo(() => groupBySeverity(reports), [reports]);
  const damageData = useMemo(() => groupByDamageType(reports), [reports]);
  const statusData = useMemo(() => groupByStatus(reports), [reports]);
  const avgConfidence = useMemo(() => getAvgConfidence(reports), [reports]);
  const topLocations = useMemo(() => getTopLocations(reports), [reports]);

  const resolutionRate = stats
    ? stats.total_reports > 0
      ? Math.round((stats.fixed_count / stats.total_reports) * 100)
      : 0
    : 0;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-on-surface-variant font-mono text-sm tracking-wider">LOADING ANALYTICS...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Analytics Reports</h1>
          <p className="font-sans text-lg text-on-surface-variant">
            Comprehensive road damage intelligence for Caraga Region.
          </p>
        </header>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Reports"
            value={stats?.total_reports ?? 0}
            icon={TrendingUp}
            color="text-primary"
            bgColor="bg-primary/10"
          />
          <KpiCard
            label="Critical + High"
            value={(stats?.critical_count ?? 0) + (stats?.high_count ?? 0)}
            icon={AlertTriangle}
            color="text-severity-high"
            bgColor="bg-severity-high/10"
            subtitle="Requires immediate action"
          />
          <KpiCard
            label="Resolution Rate"
            value={`${resolutionRate}%`}
            icon={CheckCircle2}
            color="text-severity-low"
            bgColor="bg-severity-low/10"
            subtitle={`${stats?.fixed_count ?? 0} of ${stats?.total_reports ?? 0} resolved`}
          />
          <KpiCard
            label="AI Confidence"
            value={`${Math.round(avgConfidence * 100)}%`}
            icon={Target}
            color="text-primary"
            bgColor="bg-primary/10"
            subtitle="Average detection accuracy"
          />
        </div>

        {/* Charts Row 1: Trend + Severity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Reports Over Time — Area Chart */}
          <ChartCard
            title="Reports Over Time"
            subtitle="Daily report submissions"
            className="lg:col-span-2"
          >
            {dailyData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-on-surface-variant text-sm font-mono">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#003d9b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#003d9b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c3c6d6" strokeOpacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#44464f' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#44464f' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#003d9b"
                    strokeWidth={2}
                    fill="url(#colorReports)"
                    dot={{ r: 4, fill: '#003d9b', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#0052cc' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Severity Breakdown — Donut Chart */}
          <ChartCard title="Severity Distribution" subtitle="By damage severity level">
            {severityData.every((d) => d.value === 0) ? (
              <div className="h-[260px] flex items-center justify-center text-on-surface-variant text-sm font-mono">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} reports`, '']}
                    contentStyle={{
                      backgroundColor: '#2f3036', color: '#fff', border: 'none',
                      borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Charts Row 2: Damage Type + Status Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Damage Type — Bar Chart */}
          <ChartCard title="Damage Type Breakdown" subtitle="Number of reports per damage category">
            {damageData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-on-surface-variant text-sm font-mono">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={damageData} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#c3c6d6" strokeOpacity={0.4} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#44464f' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontFamily: 'Inter, sans-serif', fill: '#44464f' }} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={24}>
                    {damageData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={DAMAGE_COLORS[index % DAMAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Status Pipeline — Radial Bar */}
          <ChartCard title="Status Pipeline" subtitle="Reports by current lifecycle stage">
            {statusData.every((d) => d.value === 0) ? (
              <div className="h-[280px] flex items-center justify-center text-on-surface-variant text-sm font-mono">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="20%"
                  outerRadius="90%"
                  barSize={14}
                  data={statusData.filter((d) => d.value > 0)}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={8}
                    label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 'bold' }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', lineHeight: '22px' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} reports`, '']}
                    contentStyle={{
                      backgroundColor: '#2f3036', color: '#fff', border: 'none',
                      borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace',
                    }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Bottom Row: Hot Spots + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Hot Spots Table */}
          <ChartCard title="Top Damage Hotspots" subtitle="Locations with most reports" className="lg:col-span-2">
            {topLocations.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-on-surface-variant text-sm font-mono">
                No data yet
              </div>
            ) : (
              <div className="space-y-2">
                {topLocations.map((loc, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-mono font-bold text-primary">{i + 1}</span>
                    </div>
                    <MapPin className="w-4 h-4 text-on-surface-variant shrink-0" />
                    <span className="text-sm text-on-surface flex-1 truncate">{loc.location}</span>
                    <span className="font-mono text-sm font-bold text-on-surface">{loc.count}</span>
                    <div className="w-16 h-2 bg-outline-variant/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(loc.count / (topLocations[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          {/* Quick Stats Grid */}
          <div className="space-y-4">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-severity-medium/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-severity-medium" />
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">Pending Queue</p>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Awaiting Action</p>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Reported</span>
                  <span className="font-mono text-sm font-bold text-on-surface">{stats?.reported_count ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Verified</span>
                  <span className="font-mono text-sm font-bold text-on-surface">{stats?.verified_count ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Scheduled</span>
                  <span className="font-mono text-sm font-bold text-on-surface">{stats?.scheduled_count ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">In Progress</span>
                  <span className="font-mono text-sm font-bold text-on-surface">{stats?.in_progress_count ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">System Stats</p>
                  <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">Performance</p>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Total Detections</span>
                  <span className="font-mono text-sm font-bold text-on-surface">{reports.filter((r) => r.confidence !== null).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Avg. Confidence</span>
                  <span className="font-mono text-sm font-bold text-primary">{Math.round(avgConfidence * 100)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">With Images</span>
                  <span className="font-mono text-sm font-bold text-on-surface">{reports.filter((r) => r.image_url).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
