'use client';

import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import { Home, Code, GraduationCap, LogOut, Menu, X, BarChart, Activity, ChevronLeft, ChevronRight, User, Settings, Users } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from '@/lib/axios';
import { ModeToggle } from "@/components/mode-toggle";
import { BirthdayBanner } from "@/components/BirthdayBanner";
import { Button } from "@/components/ui/button";

interface DecodedToken {
  user: {
    role: string;
    is_hr: boolean;
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isHRUser, setIsHRUser] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload: DecodedToken = jwtDecode(token);
        setUserRole(payload.user.role);
        setIsHRUser(payload.user.is_hr || false);
      } catch (error) {
        console.error('Invalid token', error);
        router.push('/');
      }
    } else {
      router.push('/');
    }
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    const fetchOrgSettings = async () => {
      try {
        const response = await axios.get('/organization/settings');
        setOrgSettings(response.data);
      } catch (err) {
        console.error('Failed to fetch org settings', err);
      }
    };
    fetchOrgSettings();
  }, []);

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const allNavItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/dashboard/tasks', icon: Code, label: 'Tasks' },
    { href: '/dashboard/users', icon: GraduationCap, label: 'Users' },
    { href: '/dashboard/projects', icon: Code, label: 'Projects' },
    { href: '/dashboard/profile', icon: User, label: 'Profile' },
    { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  const navItems = userRole === 'USER'
    ? allNavItems.filter(item => item.label === 'Tasks' || item.label === 'Profile')
    : allNavItems;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-background font-mono">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 dark:bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 z-40 h-screen bg-sidebar border-r border-sidebar-border text-sidebar-foreground flex flex-col transition-all duration-300 ease-in-out md:relative 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        <div className={`p-4 border-b border-sidebar-border flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 truncate">
              {orgSettings?.logo ? (
                <img src={orgSettings.logo} alt="Logo" className="h-8 w-8 object-contain rounded-lg shrink-0" />
              ) : (
                <Activity className="h-6 w-6 text-blue-500 dark:text-blue-400 shrink-0" />
              )}
              <span>{orgSettings?.name || 'Vighnotech'}</span>
            </Link>
          )}
          {isCollapsed && (
            <Link href="/dashboard">
              {orgSettings?.logo ? (
                <img src={orgSettings.logo} alt="Logo" className="h-8 w-8 object-contain rounded-lg" />
              ) : (
                <Activity className="h-6 w-6 text-blue-500 dark:text-blue-400" />
              )}
            </Link>
          )}

          {/* Desktop Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex h-6 w-6 items-center justify-center rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* Mobile Close */}
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 
                  ${isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-lg'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.label : ''}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-4">
          <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'} px-3 py-2 bg-sidebar-accent rounded-xl border border-sidebar-border`}>
            {!isCollapsed && <span className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">Appearance</span>}
            <ModeToggle />
          </div>
          <button
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-400 dark:text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-300 border border-transparent hover:border-red-500/20
               ${isCollapsed ? 'justify-center' : ''}
            `}
            title={isCollapsed ? 'Logout' : ''}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden relative z-10 transition-all duration-300">
        <BirthdayBanner />
        <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border">
          <button onClick={() => setIsSidebarOpen(true)} className="text-foreground">
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            {orgSettings?.logo ? (
              <img src={orgSettings.logo} alt="Logo" className="h-6 w-6 object-contain rounded" />
            ) : (
              <Activity className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            )}
            <span>{orgSettings?.name || 'Dashboard'}</span>
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