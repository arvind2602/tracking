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
      const payload: any = jwtDecode(token);
      console.log('Decoded payload:', payload.user.role);
      const userRole = payload.user.role;

      if (userRole === 'USER') {
        // Allow access to login and tasks routes
        if (pathname !== '/' && !pathname.startsWith('/dashboard/tasks')) {
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
