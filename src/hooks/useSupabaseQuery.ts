/**
 * useSupabaseQuery — SWR wrapper for Supabase queries.
 * Provides: automatic deduplication, stale-while-revalidate, mutate() for incremental updates.
 */
'use client'
import useSWR, { type SWRConfiguration, type KeyedMutator } from 'swr'

interface UseSupabaseQueryResult<T> {
  data: T | null
  error: any
  isLoading: boolean
  mutate: KeyedMutator<T>
}

export function useSupabaseQuery<T>(
  key: string | null,
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options?: SWRConfiguration,
): UseSupabaseQueryResult<T> {
  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => {
      const result = await queryFn()
      if (result.error) throw result.error
      return result.data
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      ...options,
    },
  )

  return {
    data: data ?? null,
    error: error ?? null,
    isLoading,
    mutate,
  }
}
