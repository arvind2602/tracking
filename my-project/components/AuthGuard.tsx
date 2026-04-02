'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      // If no token, redirect to login unless already on login page
      if (pathname !== '/') {
        router.push('/');
      }
      return;
    }

    try {
      const payload = jwtDecode<{ user: { role: string } }>(token);
      const userRole = payload.user.role;

      if (userRole === 'USER') {
        // Allow access to essential dashboard routes
        const isAllowedPath =
          pathname === '/' ||
          pathname.startsWith('/dashboard/tasks') ||
          pathname.startsWith('/dashboard/profile') ||
          pathname.startsWith('/dashboard/attendance') ||
          pathname.startsWith('/dashboard/qr');

        if (!isAllowedPath) {
          router.push('/dashboard/tasks');
        }
      }
    } catch (error) {
      // If token is invalid, redirect to login
      console.error('Invalid token', error);
      router.push('/');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
