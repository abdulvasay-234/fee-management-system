import { useRef, useState, useSyncExternalStore } from 'react'

const pendingSaves = new Set<symbol>()
const listeners = new Set<() => void>()

export function hasPendingSave() {
  return pendingSaves.size > 0
}

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasPendingSave()) return
  event.preventDefault()
  event.returnValue = ''
}

export function registerPendingSave(token: symbol) {
  if (pendingSaves.has(token)) return
  if (!hasPendingSave() && typeof window !== 'undefined') {
    window.addEventListener('beforeunload', warnBeforeUnload)
  }
  pendingSaves.add(token)
  listeners.forEach((listener) => listener())
}

export function finishPendingSave(token: symbol) {
  if (!pendingSaves.delete(token)) return
  if (!hasPendingSave() && typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', warnBeforeUnload)
  }
  listeners.forEach((listener) => listener())
}

export function subscribeToPendingSaves(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useIsSaving() {
  return useSyncExternalStore(subscribeToPendingSaves, hasPendingSave, () => false)
}

export function useSaveProtection() {
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)
  const token = useRef(Symbol('save'))

  function startSaving() {
    if (savingRef.current || hasPendingSave()) return false
    savingRef.current = true
    registerPendingSave(token.current)
    setIsSaving(true)
    return true
  }

  function finishSaving() {
    savingRef.current = false
    finishPendingSave(token.current)
    setIsSaving(false)
  }

  return { isSaving, savingRef, startSaving, finishSaving }
}
