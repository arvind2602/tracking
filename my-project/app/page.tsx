'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import { Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react";
import { jwtDecode } from 'jwt-decode';

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is already authenticated on component mount
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        // Decode the JWT token to check expiration
        const decoded = jwtDecode<{ exp?: number }>(token);
        const currentTime = Date.now() / 1000; // Convert to seconds

        // Check if token is expired
        if (decoded.exp && decoded.exp > currentTime) {
          // Token is valid and not expired, redirect to dashboard/tasks
          router.push('/dashboard/tasks');
        } else {
          // Token is expired, remove it
          localStorage.removeItem('token');
          setIsCheckingAuth(false);
        }
      } catch (error) {
        // Token is invalid, remove it
        console.error('Invalid token:', error);
        localStorage.removeItem('token');
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await axios.post('/auth/login', {
        email,
        password,
      });
      localStorage.setItem('token', response.data.token);
      router.push('/dashboard/tasks');
    } catch (error) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && password) {
      handleLogin();
    }
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-muted-foreground text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background font-mono p-4">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 dark:bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 dark:bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <main className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        {/* Logo/Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/50">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">
            Welcome Back
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to access your dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-3xl shadow-2xl p-8 transition-all duration-300 hover:shadow-lg">
          <div className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <div className="relative group">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full px-4 py-3 rounded-xl bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-ring transition-all duration-300"
                  disabled={isLoading}
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10 blur-xl"></div>
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <div className="relative group">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-input border-input text-foreground placeholder:text-muted-foreground focus:border-ring transition-all duration-300"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10 blur-xl"></div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-sm text-red-400 text-center">{error}</p>
              </div>
            )}

            {/* Login Button */}
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl px-6 py-6 text-base font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleLogin}
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Additional Links */}
            <div className="text-center pt-2">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                Forgot your password?
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Secure Project management system
        </p>
      </main>
    </div>
  );
}
