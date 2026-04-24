import { useSyncExternalStore } from 'react'

const IDLE_TIMEOUT_MS = 60 * 60 * 1000
const STORAGE_KEY = 'handoff.vault.unlocked.v1'

interface UnlockedVault {
  userId: string
  publicKey: Uint8Array
  privateKey: Uint8Array
  unlockedAt: number
  expiresAt: number
}

let unlocked: UnlockedVault | null = null
let hydrated = false
let idleTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function clearTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

function scheduleLock(at: number) {
  clearTimer()
  const ms = Math.max(0, at - Date.now())
  idleTimer = setTimeout(() => {
    lockVault()
  }, ms)
}

function zeroBytes(bytes: Uint8Array) {
  for (let i = 0; i < bytes.length; i++) bytes[i] = 0
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function fromBase64(s: string): Uint8Array {
  const binary = atob(s)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function persist() {
  if (typeof window === 'undefined') return
  try {
    if (!unlocked) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        userId: unlocked.userId,
        publicKey: toBase64(unlocked.publicKey),
        privateKey: toBase64(unlocked.privateKey),
        unlockedAt: unlocked.unlockedAt,
        expiresAt: unlocked.expiresAt,
      }),
    )
  } catch {
    // sessionStorage may be disabled (private mode); unlock stays in memory only.
  }
}

function hydrate() {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as {
      userId?: string
      publicKey: string
      privateKey: string
      unlockedAt: number
      expiresAt: number
    }
    if (Date.now() >= parsed.expiresAt || typeof parsed.userId !== 'string') {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    unlocked = {
      userId: parsed.userId,
      publicKey: fromBase64(parsed.publicKey),
      privateKey: fromBase64(parsed.privateKey),
      unlockedAt: parsed.unlockedAt,
      expiresAt: parsed.expiresAt,
    }
    scheduleLock(unlocked.expiresAt)
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY)
  }
}

export function unlockVault(
  userId: string,
  publicKey: Uint8Array,
  privateKey: Uint8Array,
) {
  hydrate()
  if (unlocked) zeroBytes(unlocked.privateKey)
  const now = Date.now()
  unlocked = {
    userId,
    publicKey,
    privateKey,
    unlockedAt: now,
    expiresAt: now + IDLE_TIMEOUT_MS,
  }
  scheduleLock(unlocked.expiresAt)
  persist()
  notify()
}

export function lockVault() {
  if (unlocked) zeroBytes(unlocked.privateKey)
  unlocked = null
  clearTimer()
  persist()
  notify()
}

export function touchVault() {
  hydrate()
  if (!unlocked) return
  unlocked.expiresAt = Date.now() + IDLE_TIMEOUT_MS
  scheduleLock(unlocked.expiresAt)
  persist()
}

export function getUnlocked(): UnlockedVault | null {
  hydrate()
  return unlocked
}

function subscribe(listener: () => void): () => void {
  hydrate()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useVault(): UnlockedVault | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      hydrate()
      return unlocked
    },
    () => null,
  )
}
