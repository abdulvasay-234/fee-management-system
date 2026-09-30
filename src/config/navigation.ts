import {
  Banknote,
  ClipboardPlus,
  BookKey,
  History,
  LayoutDashboard,
  Settings,
  Users,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react'

export interface NavigationItem {
  icon: LucideIcon
  label: string
  path: string
}

export const navigationItems: NavigationItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: UserRoundCheck, label: 'Walk-ins', path: '/walk-ins' },
  { icon: Users, label: 'Admissions', path: '/admissions' },
  { icon: History, label: 'Payments', path: '/payment-history' },
  { icon: ClipboardPlus, label: 'New Admission', path: '/new-admission' },
  { icon: Banknote, label: 'Fee Payment', path: '/fee-receipt' },
  { icon: BookKey, label: 'Course Codes', path: '/course-codes' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]