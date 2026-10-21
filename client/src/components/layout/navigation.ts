import type { LucideIcon } from 'lucide-react'
import { ArrowLeftRight, ChartColumn, LayoutDashboard, Settings, Wallet } from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Shown in the mobile drawer and on the page header. */
  description: string
}

/** Primary application navigation, shared by the sidebar and the mobile drawer. */
export const navigation: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    description: 'Overview of your money',
  },
  {
    label: 'Transactions',
    to: '/transactions',
    icon: ArrowLeftRight,
    description: 'Every movement across your accounts',
  },
  {
    label: 'Budgets',
    to: '/budgets',
    icon: Wallet,
    description: 'Monthly limits and how far you have stretched them',
  },
  {
    label: 'Analytics',
    to: '/analytics',
    icon: ChartColumn,
    description: 'Trends, categories and merchant insights',
  },
  {
    label: 'Settings',
    to: '/settings',
    icon: Settings,
    description: 'Profile, preferences and data sources',
  },
]
