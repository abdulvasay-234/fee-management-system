import type { CourseCode } from './courseCodeTypes'

function normalizeName(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized === 'other' ? 'other programs' : normalized
}

export function getCourseColor(name: string, courses: CourseCode[], code?: string) {
  const key = normalizeName(name)
  const courseCode = code ?? courses.find((course) => normalizeName(course.name) === key)?.code
  let seed = 0
  if (courseCode && /^\d{2}$/.test(courseCode)) {
    seed = Number(courseCode)
  } else {
    for (const character of key) seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0
  }
  const hue = key || courseCode ? Math.round((210 + seed * 137.508) % 360 * 100) / 100 : 0
  const saturation = key || courseCode ? 65 : 0
  return {
    foreground: `hsl(${hue}, ${saturation}%, 28%)`,
    background: `hsl(${hue}, ${saturation}%, 96%)`,
    border: `hsl(${hue}, ${saturation}%, 82%)`,
  }
}
