import type { EnquiryRecord } from '../../services/api'

function getLocalDateParts(date = new Date()) {
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  }
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

export function isToday(value: string, today = new Date()) {
  const date = parseDateOnly(value)
  const current = getLocalDateParts(today)
  return date.year === current.year
    && date.month === current.month
    && date.day === current.day
}

export function isYesterday(value: string, today = new Date()) {
  const dateObj = parseDateOnly(value)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const current = getLocalDateParts(yesterday)
  return dateObj.year === current.year
    && dateObj.month === current.month
    && dateObj.day === current.day
}

export function isThisWeek(value: string, today = new Date()) {
  const dateObj = new Date(`${value}T00:00:00`)
  
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  
  return dateObj >= weekStart && dateObj <= weekEnd
}

export function isThisMonth(value: string, today = new Date()) {
  const date = parseDateOnly(value)
  const current = getLocalDateParts(today)
  return date.year === current.year && date.month === current.month
}

export function getReadableDate(value: string, today = new Date()): string {
  if (isToday(value, today)) {
    return 'Today'
  }
  if (isYesterday(value, today)) {
    return 'Yesterday'
  }

  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateForDisplay(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export interface EnquiryGroup {
  date: string
  label: string
  count: number
  enquiries: EnquiryRecord[]
  isExpanded: boolean
}

export function groupEnquiriesByDate(enquiries: EnquiryRecord[], today = new Date()): EnquiryGroup[] {
  const groups: Map<string, EnquiryRecord[]> = new Map()

  enquiries.forEach((enquiry) => {
    const date = enquiry.enquiryDate
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(enquiry)
  })

  return Array.from(groups.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, records]) => ({
      date,
      label: formatDateForDisplay(date),
      count: records.length,
      enquiries: records,
      isExpanded: isToday(date, today),
    }))
}

export function getTodayString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getYesterdayString(): string {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const year = yesterday.getFullYear()
  const month = String(yesterday.getMonth() + 1).padStart(2, '0')
  const day = String(yesterday.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getWeekStartString(): string {
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const year = weekStart.getFullYear()
  const month = String(weekStart.getMonth() + 1).padStart(2, '0')
  const day = String(weekStart.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getMonthStartString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export function getMonthEndString(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, today.getMonth() + 1, 0).getDate()
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`
}
