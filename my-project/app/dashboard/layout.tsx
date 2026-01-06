'use client';

import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import { Home, Code, GraduationCap, LogOut, Menu, X, BarChart, Activity } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import { ModeToggle } from "@/components/mode-toggle";

interface DecodedToken {
  user: {
    role: string;
  };
}

let userRole: string | null = null;
const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
if (token) {
  try {
    const payload: DecodedToken = jwtDecode(token);
    userRole = payload.user.role;
  } catch (error) {
    console.error('Invalid token', error);
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  if (!userRole && typeof window !== 'undefined') {
    router.push('/');
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const allNavItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/dashboard/tasks', icon: Code, label: 'Tasks' },
    { href: '/dashboard/users', icon: GraduationCap, label: 'Users' },
    { href: '/dashboard/projects', icon: Code, label: 'Projects' },
  ];

  const navItems = userRole === 'USER'
    ? allNavItems.filter(item => item.label === 'Tasks')
    : allNavItems;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setIsSidebarOpen(false);
      }
    };

    if (isSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-950 font-mono">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 z-40 w-64 h-screen backdrop-blur-xl bg-white/5 border-r border-white/10 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            <Activity className="h-6 w-6 text-blue-400" />
            Vighnotech
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ${isActive
                  ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-white border border-white/10 shadow-lg shadow-blue-500/10'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? 'text-blue-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-4">
          <div className="flex items-center justify-between px-4 py-2 bg-white/5 rounded-xl border border-white/5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Appearance</span>
            <ModeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-300 border border-transparent hover:border-red-500/20"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <header className="md:hidden flex items-center justify-between p-4 backdrop-blur-xl bg-white/5 border-b border-white/10">
          <button onClick={() => setIsSidebarOpen(true)} className="text-slate-300">
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/dashboard" className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Vighnotech
          </Link>
          <div className="w-6" /> {/* Spacer */}
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}