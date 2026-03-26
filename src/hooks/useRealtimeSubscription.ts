/**
 * useRealtimeSubscription — Combines SWR with Supabase realtime for incremental updates.
 * Instead of full-table-reload on every INSERT/UPDATE, updates the SWR cache incrementally.
 */
'use client'
import { useEffect, useRef } from 'react'
import useSWR, { type KeyedMutator, type SWRConfiguration } from 'swr'
import { supabase } from '@/lib/supabase'

interface RealtimeConfig<T> {
  /** SWR cache key — null disables the hook */
  key: string | null
  /** Supabase table name to subscribe to */
  table: string
  /** Tenant ID for RLS filter */
  tenantId: string | null
  /** Function that fetches the initial data */
  queryFn: () => Promise<T[]>
  /** Optional SWR config */
  swrOptions?: SWRConfiguration
}

interface RealtimeResult<T> {
  data: T[]
  error: any
  isLoading: boolean
  mutate: KeyedMutator<T[]>
}

export function useRealtimeSubscription<T extends { id: string }>(
  config: RealtimeConfig<T>,
): RealtimeResult<T> {
  const { key, table, tenantId, queryFn, swrOptions } = config
  const channelRef = useRef<any>(null)

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async () => queryFn(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      ...swrOptions,
    },
  )

  useEffect(() => {
    if (!key || !tenantId) return

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const ch = supabase.channel(`rt-${table}-${tenantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table,
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        // Incremental insert — add to beginning of list
        mutate((prev) => {
          if (!prev) return [payload.new as T]
          // Avoid duplicates
          if (prev.some(item => item.id === (payload.new as T).id)) return prev
          return [payload.new as T, ...prev]
        }, { revalidate: false })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table,
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        // Incremental update — replace matching item
        mutate((prev) => {
          if (!prev) return prev
          return prev.map(item =>
            item.id === (payload.new as T).id ? (payload.new as T) : item
          )
        }, { revalidate: false })
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table,
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        // Incremental delete
        mutate((prev) => {
          if (!prev) return prev
          return prev.filter(item => item.id !== (payload.old as any).id)
        }, { revalidate: false })
      })
      .subscribe()

    channelRef.current = ch

    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [key, table, tenantId, mutate])

  return {
    data: data || [],
    error: error ?? null,
    isLoading,
    mutate,
  }
}
