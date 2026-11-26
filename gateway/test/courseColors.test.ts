import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const modulePath = fileURLToPath(new URL('../../src/features/courseCodes/courseColors.ts', import.meta.url))
const { getCourseColor } = await import(modulePath)

const courses = [
  { code: '01', name: 'Data Science' },
  { code: '02', name: 'Cyber Security' },
  { code: '00', name: 'Other Programs' },
]

function luminance(hsl: string) {
  const [hue, saturation, lightness] = hsl.match(/[\d.]+/g)!.map(Number)
  const s = saturation / 100
  const l = lightness / 100
  const a = s * Math.min(l, 1 - l)
  const rgb = [0, 8, 4].map((offset) => {
    const k = (offset + hue / 30) % 12
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}

describe('Automatic course colours', () => {
  it('uses immutable codes across renamed, reordered and newly added courses', () => {
    const original = getCourseColor('Data Science', courses)
    expect(getCourseColor(' data   SCIENCE ', [...courses].reverse())).toEqual(original)
    expect(getCourseColor('New Name', [{ code: '01', name: 'New Name' }, ...courses.slice(1)])).toEqual(original)
    expect(getCourseColor('Data Science', [{ code: '03', name: 'New Course' }, ...courses])).toEqual(original)
    expect(getCourseColor('Data Science', [], '01')).toEqual(original)
    expect(getCourseColor('Other', courses)).toEqual(getCourseColor('Other Programs', courses))
  })

  it('gives every supported code a distinct colour with readable text', () => {
    const colors = Array.from({ length: 100 }, (_, code) => getCourseColor('Course', [], String(code).padStart(2, '0')))
    expect(new Set(colors.map((color) => color.foreground)).size).toBe(100)
    colors.forEach((color) => {
      expect((luminance(color.background) + 0.05) / (luminance(color.foreground) + 0.05)).toBeGreaterThanOrEqual(4.5)
      expect(1.05 / (luminance(color.foreground) + 0.05)).toBeGreaterThanOrEqual(4.5)
    })
  })

  it('handles historical names consistently without using arbitrary input as CSS', () => {
    expect(getCourseColor(' Legacy   Course ', [])).toEqual(getCourseColor('legacy course', []))
    expect(getCourseColor('Legacy Course', [])).not.toEqual(getCourseColor('Different Course', []))
    expect(getCourseColor('', []).foreground).toMatch(/, 0%,/)
    expect(getCourseColor('url(untrusted)', [], 'invalid').foreground).toMatch(/^hsl\([\d.]+, 65%, 28%\)$/)
  })
})
