'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axios';
import { Mail, ArrowLeft, Sparkles, CheckCircle2, KeyRound, Lock, Eye, EyeOff } from 'lucide-react';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [finalSuccess, setFinalSuccess] = useState('');

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(''); setSuccess('');
    if (!email) { setError('Please enter your email'); return; }
    setIsLoading(true);
    try {
      const res = await axios.post('/auth/forgot-password', { email });
      setSuccess(res.data.message || 'If an account exists, an OTP has been sent. Check inbox and spam.');
      setStep('otp');
      setResendCountdown(60);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to send OTP';
      setError(msg);
    } finally { setIsLoading(false); }
  };

  const handleResend = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await axios.post('/auth/forgot-password', { email });
      setSuccess('OTP resent. Check inbox and spam.');
      setResendCountdown(60);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Failed to resend';
      setError(msg);
    } finally { setIsLoading(false); }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return; }
    setIsLoading(true);
    try {
      const res = await axios.post('/auth/verify-otp', { email, otp });
      setOtpToken(res.data.otpToken);
      setSuccess('OTP verified. Set new password.');
      setStep('password');
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Invalid OTP');
    } finally { setIsLoading(false); }
  };

  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (!otpToken) { setError('OTP verification missing. Please verify OTP again.'); setStep('otp'); return; }
    setIsLoading(true);
    try {
      await axios.post('/auth/reset-password', { otpToken, password, confirmPassword });
      setFinalSuccess('Password reset successful. Redirecting to login...');
      setTimeout(() => router.push('/'), 1800);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Failed to reset password');
    } finally { setIsLoading(false); }
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
            {step === 'email' ? 'Forgot password' : step === 'otp' ? 'Verify OTP' : 'Set new password'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 'email' ? 'Enter your email to receive a 6-digit code' : step === 'otp' ? `Code sent to ${email}` : 'Choose a new password'}
          </p>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {(['email','otp','password'] as Step[]).map((s,i)=>(
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step===s ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : ['email','otp','password'].indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>{i+1}</div>
                {i<2 && <div className={`w-8 h-0.5 ${['email','otp','password'].indexOf(step) > i ? 'bg-green-500' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-3xl shadow-2xl p-8">
          {finalSuccess ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-green-600 dark:text-green-400 font-medium">{finalSuccess}</p>
              <Link href="/"><Button variant="outline" className="w-full rounded-xl">Go to login</Button></Link>
            </div>
          ) : step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Mail className="w-4 h-4"/>Email Address</label>
                <Input type="email" placeholder="Enter your email" value={email} onChange={(e)=>setEmail(e.target.value)} className="px-4 py-3 rounded-xl" disabled={isLoading} required />
              </div>
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"><p className="text-sm text-red-500 text-center">{error}</p></div>}
              {success && <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20"><p className="text-sm text-green-600 dark:text-green-400 text-center">{success}</p></div>}
              <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl py-6 font-semibold" disabled={isLoading || !email}>
                {isLoading ? <span className="flex items-center gap-2 justify-center"><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/><span>Sending OTP...</span></span> : 'Send OTP'}
              </Button>
              <div className="text-center"><Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4"/>Back to sign in</Link></div>
            </form>
          ) : step === 'otp' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><KeyRound className="w-4 h-4"/>6-digit Code</label>
                <Input placeholder="Enter 6-digit OTP" value={otp} onChange={(e)=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} className="px-4 py-3 rounded-xl text-center tracking-[0.4em] text-lg font-mono" maxLength={6} disabled={isLoading} required />
                <p className="text-xs text-muted-foreground text-center">Expires in 10 minutes. Check spam folder.</p>
              </div>
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"><p className="text-sm text-red-500 text-center">{error}</p></div>}
              {success && !error && <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20"><p className="text-sm text-green-600 text-center">{success}</p></div>}
              <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl py-6 font-semibold" disabled={isLoading || otp.length!==6}>
                {isLoading ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Verifying...</span> : 'Verify OTP'}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={()=>{setStep('email'); setOtp(''); setError('');}} className="text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4"/>Back</button>
                <button type="button" onClick={handleResend} disabled={resendCountdown>0 || isLoading} className="text-blue-600 hover:text-blue-500 disabled:text-muted-foreground disabled:cursor-not-allowed">
                  {resendCountdown>0 ? `Resend in ${resendCountdown}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Lock className="w-4 h-4"/>New Password</label>
                <div className="relative">
                  <Input type={showPassword?'text':'password'} placeholder="Min 6 characters" value={password} onChange={(e)=>setPassword(e.target.value)} className="pr-12 px-4 py-3 rounded-xl" disabled={isLoading} required />
                  <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><span>{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</span></button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Lock className="w-4 h-4"/>Confirm Password</label>
                <Input type={showPassword?'text':'password'} placeholder="Confirm password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} className="px-4 py-3 rounded-xl" disabled={isLoading} required />
              </div>
              {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"><p className="text-sm text-red-500 text-center">{error}</p></div>}
              <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl py-6 font-semibold" disabled={isLoading || !password || !confirmPassword}>
                {isLoading ? <span className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Resetting...</span> : 'Reset password'}
              </Button>
              <div className="text-center"><button type="button" onClick={()=>{setStep('otp'); setError('');}} className="text-sm text-muted-foreground hover:text-foreground">Back to OTP</button></div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
