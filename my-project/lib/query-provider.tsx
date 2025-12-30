'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 60 seconds
            staleTime: 60000, // 1 minute
            // Keep unused data in cache for 5 minutes
            gcTime: 300000, // 5 minutes (formerly cacheTime)
            // Disable automatic refetching on window focus
            refetchOnWindowFocus: false,
            // Disable refetch on reconnect
            refetchOnReconnect: false,
            // Retry failed requests only once
            retry: 1,
            // Show cached data while fetching fresh data
            refetchOnMount: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
