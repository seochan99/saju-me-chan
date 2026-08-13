// Kept in sync with the toast animation durations in styles/app.css
export const TOAST_VISIBLE_MS = 2600
export const TOAST_EXIT_MS = 240

// Rotated while waiting for the first streamed token
export const BAKE_MESSAGES = [
  '명식을 화로에 올렸다냥...',
  '오행이 노릇해지는 중이다냥',
  '쓴소리를 반죽하고 있다냥...',
  '단맛은 빼고 굽는다냥',
  '거의 다 익었다냥...',
]
export const BAKE_MESSAGE_MS = 2600

// Signed-out visitors read this many sections before the rest is locked.
// The prompt asks for six sections, so this hands over roughly half.
export const GUEST_PREVIEW_SECTIONS = 3

// Survives the OAuth redirect, so a visitor who signs in from the lock keeps
// what they typed and the reading they already paid attention to.
export const GUEST_DRAFT_KEY = 'saju:guest-draft'
