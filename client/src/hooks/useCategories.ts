import { useMemo } from 'react'

import { api } from '@/services'
import type { Category } from '@/types'
import { useAsyncData } from './useAsyncData'

export interface UseCategoriesResult {
  categories: Category[]
  /** Lookup by category id. */
  byId: Map<string, Category>
  isLoading: boolean
  isError: boolean
  error: Error | undefined
  refetch: () => void
}

/**
 * Category taxonomy, loaded through the same data source as everything else
 * so the lookup keeps working when the API takes over.
 */
export function useCategories(): UseCategoriesResult {
  const { data, error, status, refetch } = useAsyncData<Category[]>(
    (signal) => api.getCategories(signal),
    [],
  )

  const categories = data ?? []

  const byId = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  return {
    categories,
    byId,
    isLoading: status === 'loading',
    isError: status === 'error',
    error,
    refetch: () => refetch(),
  }
}
