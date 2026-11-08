'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import { Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 to-transparent rounded-full animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/5 to-transparent rounded-full animate-pulse"
          style={{ animationDuration: '6s' }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <div className="relative w-20 h-20 mb-3 drop-shadow-md">
          <Image
            src="/logo.png"
            alt="CaragaSense AI Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        <h1 className="font-headline text-2xl font-bold text-on-surface tracking-tight">
          Update Password
        </h1>
        <p className="text-on-surface-variant text-xs mt-1 font-mono tracking-wider uppercase">
          CaragaSense Account Security
        </p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xl overflow-hidden p-6 space-y-5">
        {success ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 bg-severity-low/10 text-severity-low rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold font-headline text-on-surface">Password Updated!</h2>
              <p className="text-xs text-on-surface-variant">
                Your password has been changed successfully. Redirecting you to the dashboard...
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 pb-2 border-b border-outline-variant">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold font-headline text-on-surface">Choose a New Password</h2>
                <p className="text-xs text-on-surface-variant">Enter your new secure password below.</p>
              </div>
            </div>

            {error && (
              <div className="bg-error-container/50 border border-error/20 text-on-error-container rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-bold text-on-surface font-headline">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-bold text-on-surface font-headline">
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white font-headline font-bold text-base py-3.5 rounded-lg flex items-center justify-center gap-2 shadow-sm shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Save New Password
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

