import { useEffect, useRef, useState } from 'react'
import { TOAST_EXIT_MS, TOAST_VISIBLE_MS } from '../constants/config'

export default function useToast() {
  const [toast, setToast] = useState(null)
  const toastTimersRef = useRef([])

  function clearToastTimers() {
    toastTimersRef.current.forEach(clearTimeout)
    toastTimersRef.current = []
  }

  function showToast(message, tone = 'info') {
    clearToastTimers()
    // key restarts the entrance animation when the same message repeats
    setToast({ message, tone, key: Date.now(), isLeaving: false })

    toastTimersRef.current = [
      setTimeout(
        () => setToast((prev) => (prev ? { ...prev, isLeaving: true } : prev)),
        TOAST_VISIBLE_MS,
      ),
      setTimeout(() => setToast(null), TOAST_VISIBLE_MS + TOAST_EXIT_MS),
    ]
  }

  useEffect(() => clearToastTimers, [])

  return { toast, showToast }
}
