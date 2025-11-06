'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function withAuth(Component: any) {
  return function AuthenticatedComponent(props: any) {
    const router = useRouter();

    useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/');
      }
    }, [router]);

    return <Component {...props} />;
  };
}
