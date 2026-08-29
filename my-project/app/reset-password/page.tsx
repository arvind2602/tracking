'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from '@/lib/axios';
import { Lock, Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Optional: verify token on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setError('Missing reset token. Please use the link from your email.');
      return;
    }
    const verify = async () => {
      try {
        await axios.post('/auth/verify-reset-token', { token });
        setTokenValid(true);
      } catch (err: any) {
        setTokenValid(false);
        const msg = err?.response?.data?.error?.message || 'Invalid or expired reset link.';
        setError(msg);
      }
    };
    verify();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Missing reset token');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post('/auth/reset-password', {
        token,
        password,
        confirmPassword,
      });
      setSuccess(res.data.message || 'Password has been reset successfully.');
      setTimeout(() => router.push('/'), 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to reset password.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-card border border-border rounded-3xl shadow-2xl p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-semibold">Invalid reset link</h2>
        <p className="text-sm text-muted-foreground">The link is missing a token. Please request a new password reset email.</p>
        <Link href="/forgot-password">
          <Button className="w-full rounded-xl mt-2">Request new link</Button>
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to sign in</Link>
      </div>
    );
  }

  if (tokenValid === false && error) {
    return (
      <div className="bg-card border border-border rounded-3xl shadow-2xl p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-lg font-semibold">Link expired or invalid</h2>
        <p className="text-sm text-red-500">{error}</p>
        <Link href="/forgot-password" className="block">
          <Button className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white">Request new link</Button>
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground inline-block mt-2">Back to sign in</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-card border border-border rounded-3xl shadow-2xl p-8 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
        <h2 className="text-lg font-semibold">Password reset successful</h2>
        <p className="text-sm text-muted-foreground">{success}</p>
        <p className="text-xs text-muted-foreground">Redirecting to sign in...</p>
        <Link href="/" className="block">
          <Button className="w-full rounded-xl">Go to sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-3xl shadow-2xl p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Lock className="w-4 h-4" /> New Password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12 px-4 py-3 rounded-xl"
              disabled={isLoading}
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Lock className="w-4 h-4" /> Confirm Password
          </label>
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="px-4 py-3 rounded-xl"
            disabled={isLoading}
            required
          />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-500 text-center">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl py-6 font-semibold shadow-lg shadow-blue-500/30"
          disabled={isLoading || !password || !confirmPassword}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Resetting...
            </span>
          ) : (
            'Reset password'
          )}
        </Button>

        <div className="text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">Back to sign in</Link>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background font-mono p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <main className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/50">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">Reset password</h1>
          <p className="text-sm text-muted-foreground">Choose a new password for your account</p>
        </div>

        <Suspense fallback={<div className="bg-card border rounded-3xl p-8 text-center">Loading...</div>}>
          <ResetPasswordContent />
        </Suspense>
      </main>
    </div>
  );
}
