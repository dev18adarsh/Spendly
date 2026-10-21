/**
 * Pagination helpers.
 *
 * The same `page` / `limit` contract is used by every list endpoint so the
 * client can treat them uniformly.
 */
export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20

export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  const totalPages = params.limit > 0 ? Math.ceil(total / params.limit) : 0

  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1 && total > 0,
  }
}

/**
 * Normalises raw query values into pagination parameters.
 * Invalid or out-of-range values fall back to the defaults rather than erroring.
 */
export function parsePagination(
  query: Record<string, unknown>,
  maxPageSize: number,
): PaginationParams {
  const rawPage = Number(query.page)
  const rawLimit = Number(query.limit)

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : DEFAULT_PAGE
  const requestedLimit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : DEFAULT_LIMIT
  const limit = Math.min(requestedLimit, maxPageSize)

  return { page, limit, skip: (page - 1) * limit }
}
