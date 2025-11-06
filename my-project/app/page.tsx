'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import axios from '@/lib/axios';

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    try {
      const response = await axios.post('/auth/login', {
        email,
        password,
        datetime: new Date().toISOString(),
      });
      localStorage.setItem('token', response.data.token);
      router.push('/dashboard');
    } catch (error) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-mono p-4 sm:p-6 md:p-8">
      <main className="flex flex-col items-center justify-center w-full max-w-sm sm:max-w-md p-6 sm:p-8 bg-card/50 backdrop-blur-lg rounded-xl border border-accent/20 shadow-lg">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text mb-6">
          Login
        </h1>
        <div className="w-full space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white" />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-4 rounded-lg bg-background/80 border-accent/20 text-white" />
          {error && <p className="text-red-500">{error}</p>}
          <Button className="w-full bg-primary text-white hover:bg-primary/90 rounded-full px-6 py-3 shadow-[0_0_15px_rgba(37,99,235,0.5)]" onClick={handleLogin}>Login</Button>
        </div>
      </main>
    </div>
  );
}
