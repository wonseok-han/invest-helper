'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { experimental_createQueryPersister } from '@tanstack/query-persist-client-core';
import { useState } from 'react';

/**
 * localStorage 스토리지 어댑터
 */
const localStorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return Promise.resolve();
    localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (typeof window === 'undefined') return Promise.resolve();
    localStorage.removeItem(key);
    return Promise.resolve();
  },
};

/**
 * React Query Provider
 */
export function QueryProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    // Persister 생성 (클라이언트에서만)
    const persister =
      typeof window !== 'undefined'
        ? experimental_createQueryPersister({
            storage: localStorageAdapter,
            maxAge: 5 * 60 * 1000, // 5분간 유지
            serialize: JSON.stringify,
            deserialize: JSON.parse,
          })
        : null;

    return new QueryClient({
      defaultOptions: {
        queries: {
          // 캐시 시간: 5분
          staleTime: 5 * 60 * 1000,
          // 캐시 유지 시간: 10분
          gcTime: 10 * 60 * 1000,
          // 자동 리페칭 비활성화 (수동으로만)
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          retry: 1,
          // Persister 설정
          ...(persister && { persister: persister.persisterFn }),
        },
      },
    });
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
