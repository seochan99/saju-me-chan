// Thin wrapper around the gtag.js snippet loaded in index.html.
// Every call is a no-op when the tag is blocked or has not loaded yet,
// so callers never need to guard.
function gtag(...args) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag(...args)
}

export function trackEvent(name, params = {}) {
  gtag('event', name, params)
}

export function setAnalyticsUser(userId) {
  gtag('set', { user_id: userId ?? null })
  gtag('set', 'user_properties', { login_status: userId ? 'signed_in' : 'guest' })
}
