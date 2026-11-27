import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { registerModal } = await import(
  fileURLToPath(new URL('../../src/hooks/useModalLifecycle.ts', import.meta.url)),
)
const { registerPendingSave, finishPendingSave } = await import(
  fileURLToPath(new URL('../../src/hooks/useSaveProtection.ts', import.meta.url)),
)

const cleanups: Array<() => void> = []
const saves: symbol[] = []

function fixture(overflow = '') {
  const target = new EventTarget()
  const style = { overflow }
  const addEventListener = vi.fn(target.addEventListener.bind(target))
  const removeEventListener = vi.fn(target.removeEventListener.bind(target))
  vi.stubGlobal('document', { documentElement: { style }, addEventListener, removeEventListener })
  return { target, style, addEventListener, removeEventListener }
}

function openModal(onClose = () => {}) {
  const release = registerModal(onClose)
  cleanups.push(release)
  return release
}

function escape(target: EventTarget, handled = false) {
  const event = new Event('keydown', { cancelable: true })
  Object.defineProperty(event, 'key', { value: 'Escape' })
  if (handled) event.preventDefault()
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  cleanups.splice(0).reverse().forEach((cleanup) => cleanup())
  saves.splice(0).forEach(finishPendingSave)
  vi.unstubAllGlobals()
})

describe('shared modal lifecycle', () => {
  it.each(['parent-first', 'child-first'])('restores original scrolling only after both dialogs close: %s', (order) => {
    const { style, addEventListener, removeEventListener } = fixture('auto')
    const parent = openModal()
    const child = openModal()
    expect(style.overflow).toBe('hidden')
    expect(addEventListener).toHaveBeenCalledTimes(1)
    const [first, last] = order === 'parent-first' ? [parent, child] : [child, parent]
    first()
    expect(style.overflow).toBe('hidden')
    expect(removeEventListener).not.toHaveBeenCalled()
    last()
    expect(style.overflow).toBe('auto')
    expect(removeEventListener).toHaveBeenCalledTimes(1)
  })

  it('does not retain scroll locks or listeners across repeated open/close and duplicate cleanup cycles', () => {
    const { style, addEventListener, removeEventListener } = fixture()
    for (let index = 0; index < 60; index += 1) {
      const parent = openModal()
      const child = openModal()
      parent()
      parent()
      expect(style.overflow).toBe('hidden')
      child()
      expect(style.overflow).toBe('')
    }
    expect(addEventListener).toHaveBeenCalledTimes(60)
    expect(removeEventListener).toHaveBeenCalledTimes(60)
  })

  it('dismisses only the topmost dialog even when its callback immediately releases the lock', () => {
    const { target, style } = fixture()
    const parentClose = vi.fn()
    const parent = openModal(parentClose)
    let child: () => void = () => {}
    const childClose = vi.fn(() => child())
    child = openModal(childClose)
    expect(escape(target).defaultPrevented).toBe(true)
    expect(childClose).toHaveBeenCalledTimes(1)
    expect(parentClose).not.toHaveBeenCalled()
    expect(style.overflow).toBe('hidden')
    escape(target)
    expect(parentClose).toHaveBeenCalledTimes(1)
    parent()
    expect(style.overflow).toBe('')
  })

  it('does not dismiss dialogs while a save is pending and resumes normal Escape afterward', () => {
    const { target, style } = fixture()
    const parentClose = vi.fn()
    const childClose = vi.fn()
    openModal(parentClose)
    openModal(childClose)
    const token = Symbol('saving form')
    saves.push(token)
    registerPendingSave(token)
    escape(target)
    expect(parentClose).not.toHaveBeenCalled()
    expect(childClose).not.toHaveBeenCalled()
    expect(style.overflow).toBe('hidden')
    finishPendingSave(token)
    escape(target)
    expect(childClose).toHaveBeenCalledTimes(1)
    expect(parentClose).not.toHaveBeenCalled()
  })

  it('respects Escape already handled by a dropdown', () => {
    const { target } = fixture()
    const close = vi.fn()
    openModal(close)
    escape(target, true)
    expect(close).not.toHaveBeenCalled()
    escape(target)
    expect(close).toHaveBeenCalledTimes(1)
  })
})
