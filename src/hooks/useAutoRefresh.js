import { useEffect, useRef } from 'react'

// A tab that just regained focus fires both visibilitychange and focus; only
// the first one should trigger a refresh.
const MIN_GAP_MS = 1000

// Calls `callback` every `ms` while the tab is visible, and right away when the
// user comes back to the tab. It does not run on mount (the caller does its own
// first load). `ms` null or 0 turns it off.
export const useAutoRefresh = (callback, ms) => {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  }, [callback])

  useEffect(() => {
    if (!ms) return undefined

    let lastRun = 0
    const run = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRun < MIN_GAP_MS) return
      lastRun = now
      latest.current()
    }

    const id = setInterval(run, ms)
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
    }
  }, [ms])
}
