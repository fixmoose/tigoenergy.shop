import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000, // 5 minutes
                gcTime: 10 * 60 * 1000, // 10 minutes
                retry: (failureCount: number, error: any) => {
                    // Don't retry on 401/403 errors
                    if (error?.status >= 400 && error?.status < 500) {
                        return false
                    }
                    return failureCount < 3
                },
                refetchOnWindowFocus: false,
                refetchOnReconnect: true,
            },
            mutations: {
                retry: 1,
            },
        },
    })
}

export const queryClient = createQueryClient()
