'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import Link from 'next/link';
import axios from '@/lib/axios';
import { Mail, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [debugUrl, setDebugUrl] = useState('');

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setDebugUrl('');
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post('/auth/forgot-password', { email });
      setSuccess(res.data.message || 'If an account with that email exists, a password reset link has been sent.');
      if (res.data.debug?.resetUrl) {
        setDebugUrl(res.data.debug.resetUrl);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">
            Forgot password
          </h1>
          <p className="text-sm text-muted-foreground">Enter your email to receive a reset link</p>
        </div>

        <div className="bg-card border border-border rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-input border-input"
                disabled={isLoading || !!success}
                required
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-sm text-red-400 text-center">{error}</p>
              </div>
            )}

            {success && (
              <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
                </div>
                {debugUrl && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Dev only - reset link:</p>
                    <a href={debugUrl} className="text-xs text-blue-500 break-all hover:underline block bg-white/50 dark:bg-black/20 p-2 rounded-lg border">
                      {debugUrl}
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">This is shown only in development when email is not configured.</p>
                  </div>
                )}
              </div>
            )}

            {!success ? (
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl px-6 py-6 text-base font-semibold shadow-lg shadow-blue-500/30"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Sending link...</span>
                  </div>
                ) : (
                  'Send reset link'
                )}
              </Button>
            ) : (
              <Link href="/" className="block">
                <Button type="button" variant="outline" className="w-full rounded-xl py-6">
                  Back to sign in
                </Button>
              </Link>
            )}

            {!success && (
              <div className="text-center">
                <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back to sign in
                </Link>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
