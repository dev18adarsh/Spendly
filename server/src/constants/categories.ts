/**
 * Canonical category taxonomy.
 *
 * This is reference data, not sample transactions: it describes which
 * categories exist and how they are presented. The same slugs are mirrored by
 * the web client so both data sources speak the same language.
 */
export interface CategoryDefinition {
  slug: string
  name: string
  color: string
  icon: string
  order: number
}

export const CATEGORY_DEFINITIONS = [
  { slug: 'housing', name: 'Housing', color: '#60a5fa', icon: 'Home', order: 1 },
  { slug: 'food', name: 'Food & Dining', color: '#f2b544', icon: 'UtensilsCrossed', order: 2 },
  { slug: 'transport', name: 'Transport', color: '#a78bfa', icon: 'Car', order: 3 },
  { slug: 'shopping', name: 'Shopping', color: '#fb7185', icon: 'ShoppingBag', order: 4 },
  { slug: 'utilities', name: 'Utilities', color: '#2dd4bf', icon: 'Zap', order: 5 },
  { slug: 'health', name: 'Health', color: '#f472b6', icon: 'HeartPulse', order: 6 },
  {
    slug: 'entertainment',
    name: 'Entertainment',
    color: '#c084fc',
    icon: 'Clapperboard',
    order: 7,
  },
  { slug: 'subscriptions', name: 'Subscriptions', color: '#38bdf8', icon: 'Repeat', order: 8 },
  { slug: 'income', name: 'Income', color: '#35d6a4', icon: 'Landmark', order: 9 },
] as const

export type CategorySlug = (typeof CATEGORY_DEFINITIONS)[number]['slug']

export const CATEGORY_SLUGS: readonly CategorySlug[] = CATEGORY_DEFINITIONS.map(
  (category) => category.slug,
)

const CATEGORY_SLUG_SET: ReadonlySet<string> = new Set(CATEGORY_SLUGS)

export function isValidCategory(slug: string): boolean {
  return CATEGORY_SLUG_SET.has(slug)
}

export function findCategoryDefinition(slug: string): CategoryDefinition | undefined {
  return CATEGORY_DEFINITIONS.find((category) => category.slug === slug)
}
