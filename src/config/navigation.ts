import {
  ClipboardPlus,
  BookKey,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavigationItem {
  icon: LucideIcon
  label: string
  path: string
}

export const navigationItems: NavigationItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: ClipboardPlus, label: 'New Admission', path: '/new-admission' },
  { icon: FileText, label: 'Fee Receipt', path: '/fee-receipt' },
  { icon: Users, label: 'Students', path: '/students' },
  { icon: History, label: 'Payments', path: '/payment-history' },
  { icon: BookKey, label: 'Course Codes', path: '/course-codes' },
  { icon: Settings, label: 'Settings', path: '/settings' },
]