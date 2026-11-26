import { useEffect, useSyncExternalStore, type ComponentProps, type CSSProperties } from 'react'
import { Select } from '../../components/ui/Select'
import { getCachedCourseCodes, getCourseCodes, getCourseCodeServiceStatus, subscribeToCourseCodes } from './courseCodeService'
import { getCourseColor } from './courseColors'

type CourseStyle = CSSProperties & Record<'--course-foreground' | '--course-background' | '--course-border', string>

function useCourseStyle(name: string, code?: string): CourseStyle {
  const status = useSyncExternalStore(subscribeToCourseCodes, getCourseCodeServiceStatus)
  useEffect(() => { void getCourseCodes() }, [])
  const colors = getCourseColor(status.source === 'uninitialized' && !code ? '' : name, getCachedCourseCodes(), code)
  return {
    '--course-foreground': colors.foreground,
    '--course-background': colors.background,
    '--course-border': colors.border,
  }
}

export function CourseDot({ name, code }: { name: string; code?: string }) {
  const style = useCourseStyle(name, code)
  return <span className="course-dot" style={style} aria-hidden="true" />
}

export function CourseLabel({ name, code, variant = 'badge' }: { name: string; code?: string; variant?: 'badge' | 'inline' }) {
  const style = useCourseStyle(name, code)
  return (
    <span className={`course-label course-label--${variant}`} style={style}>
      <span className="course-dot" aria-hidden="true" />
      <span className="course-label__name">{name || 'Not provided'}</span>
    </span>
  )
}

export function CourseSelect(props: ComponentProps<typeof Select>) {
  const name = typeof props.value === 'string' ? props.value : ''
  return <Select {...props} leadingAdornment={name ? <CourseDot name={name} /> : undefined} />
}
