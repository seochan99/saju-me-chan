import { GUEST_DRAFT_KEY } from '../constants/config'
import { emptyProfileForm } from './profileForm'

export function readGuestDraft() {
  try {
    const raw = window.localStorage.getItem(GUEST_DRAFT_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    return {
      form: emptyProfileForm(parsed?.form ?? {}),
      result: typeof parsed?.result === 'string' ? parsed.result : '',
    }
  } catch {
    return null
  }
}

export function writeGuestDraft(draft) {
  try {
    window.localStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Private browsing can reject writes; the draft is a convenience only.
  }
}

export function clearGuestDraft() {
  try {
    window.localStorage.removeItem(GUEST_DRAFT_KEY)
  } catch {
    // Ignore for the same reason as writeGuestDraft.
  }
}
