'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEV_BYPASS } from '@/lib/dev-config';
import { devLogin } from '@/lib/auth-context';
import Image from 'next/image';
import { Shield, Eye, EyeOff, ArrowRight, AlertCircle, Wrench, Users, ShieldCheck } from 'lucide-react';
import type { UserRole } from '@/lib/database.types';

// ── Dev Login Panel ───────────────────────────────────────────────────────────
function DevLoginPanel() {
  const roles: { role: UserRole; label: string; name: string; desc: string; icon: React.ElementType; color: string; bg: string; border: string }[] = [
    {
      role: 'admin',
      label: 'ADMIN',
      name: 'Local Admin',
      desc: 'Full access: triage, analytics, user management',
      icon: ShieldCheck,
      color: 'text-severity-high',
      bg: 'bg-severity-high/10',
      border: 'border-severity-high/30 hover:border-severity-high',
    },
    {
      role: 'engineer',
      label: 'ENGINEER',
      name: 'Juan dela Cruz',
      desc: 'Dashboard, triage queue & field dispatch',
      icon: Wrench,
      color: 'text-severity-medium',
      bg: 'bg-severity-medium/10',
      border: 'border-severity-medium/30 hover:border-severity-medium',
    },
    {
      role: 'citizen',
      label: 'CITIZEN',
      name: 'Maria Santos',
      desc: 'Report road damage, track submitted reports',
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/30 hover:border-primary',
    },
  ];

  return (
    <div className="p-6 space-y-3">
      <div className="text-center mb-5">
        <span className="inline-block bg-primary/10 text-primary text-[10px] font-mono font-bold px-3 py-1 rounded-full border border-primary/20 tracking-widest">
          LOCAL DEV MODE
        </span>
        <p className="text-on-surface-variant text-xs mt-2 font-mono">Select a role to sign in</p>
      </div>

      {roles.map(({ role, label, name, desc, icon: Icon, color, bg, border }) => (
        <button
          key={role}
          onClick={() => devLogin(role)}
          className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group ${border} bg-surface-container-lowest hover:bg-surface-container-high`}
        >
          <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-mono font-bold tracking-widest ${color}`}>{label}</span>
              <span className="text-xs text-on-surface font-bold">{name}</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-snug">{desc}</p>
          </div>
          <ArrowRight className={`w-4 h-4 ${color} opacity-0 group-hover:opacity-100 transition-opacity shrink-0`} />
        </button>
      ))}
    </div>
  );
}

// ── Production Login Form ─────────────────────────────────────────────────────
function ProductionLoginForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;
        if (data.session) { window.location.href = '/'; return; }
        setSuccessMessage('Account created! Check your email to confirm, then log in.');
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        window.location.href = '/';
        return;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Tab Switcher */}
      <div className="flex border-b border-outline-variant">
        <button
          onClick={() => { setIsSignUp(false); setError(null); setSuccessMessage(null); }}
          className={`flex-1 py-4 text-sm font-bold font-headline tracking-wide transition-colors ${
            !isSignUp ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => { setIsSignUp(true); setError(null); setSuccessMessage(null); }}
          className={`flex-1 py-4 text-sm font-bold font-headline tracking-wide transition-colors ${
            isSignUp ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {successMessage && (
          <div className="bg-severity-low/10 border border-severity-low/30 text-severity-low rounded-lg px-4 py-3 text-sm font-medium">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-error-container/50 border border-error/20 text-on-error-container rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {isSignUp && (
          <div className="space-y-2">
            <label htmlFor="fullName" className="text-sm font-bold text-on-surface font-headline">Full Name</label>
            <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz" required={isSignUp}
              className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
            />
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-bold text-on-surface font-headline">Email Address</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" required
            className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-bold text-on-surface font-headline">Password</label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
              className="w-full px-4 py-3 pr-12 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={isLoading}
          className="w-full bg-primary text-white font-headline font-bold text-base py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {isSignUp ? 'Create Account' : 'Sign In'}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </>
  );
}

// ── Main Login Page ───────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 to-transparent rounded-full animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/5 to-transparent rounded-full animate-pulse" style={{ animationDuration: '6s' }} />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(var(--color-primary) 1px, transparent 1px),
                              linear-gradient(to right, var(--color-primary) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Logo & Branding */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <div className="relative w-24 h-24 mb-3 drop-shadow-lg transition-transform hover:scale-105 duration-300">
          <Image
            src="/logo.png"
            alt="CaragaSense AI Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        <h1 className="font-headline text-3xl font-bold text-on-surface tracking-tight">
          CaragaSense<span className="text-primary">AI</span>
        </h1>
        <p className="text-on-surface-variant text-sm mt-1 font-mono tracking-wider uppercase">
          Road Damage Detection System
        </p>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl overflow-hidden">
          {DEV_BYPASS ? <DevLoginPanel /> : <ProductionLoginForm />}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-on-surface-variant mt-6 font-mono tracking-wide">
          SMART ECO BUTUAN 2040 · CARAGA REGION XIII
        </p>
      </div>
    </div>
  );
}
