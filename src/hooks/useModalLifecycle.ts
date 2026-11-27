import { useEffect, useEffectEvent } from 'react'
import { hasPendingSave } from './useSaveProtection'

const activeModals = new Map<symbol, () => void>()
let lockedDocument: Document | null = null
let originalOverflow = ''

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  event.preventDefault()
  event.stopImmediatePropagation()
  if (!hasPendingSave()) Array.from(activeModals.values()).at(-1)?.()
}

export function registerModal(onClose: () => void) {
  const token = Symbol('modal')
  if (activeModals.size === 0) {
    lockedDocument = document
    originalOverflow = lockedDocument.documentElement.style.overflow
    lockedDocument.documentElement.style.overflow = 'hidden'
    lockedDocument.addEventListener('keydown', handleEscape)
  }
  activeModals.set(token, onClose)

  return () => {
    if (!activeModals.delete(token)) return
    if (activeModals.size === 0 && lockedDocument) {
      lockedDocument.documentElement.style.overflow = originalOverflow
      lockedDocument.removeEventListener('keydown', handleEscape)
      lockedDocument = null
    }
  }
}

export function useModalLifecycle(open: boolean, onClose: () => void) {
  const closeOnEscape = useEffectEvent(onClose)

  useEffect(() => {
    if (!open) return
    return registerModal(() => closeOnEscape())
  }, [open])

  return () => {
    if (!hasPendingSave()) onClose()
  }
}
