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
    <div className="flex h-screen bg-background text-foreground font-sans">
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 z-40 w-64 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="p-6 border-b border-sidebar-border flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center justify-center text-xl font-bold tracking-tight">
            Vighnotech
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-medium text-sidebar-foreground/70">Theme</span>
            <ModeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="md:hidden flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
          <button onClick={() => setIsSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/dashboard" className="text-lg font-bold">
            Vighnotech
          </Link>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}