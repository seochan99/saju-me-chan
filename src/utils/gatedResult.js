import { GUEST_PREVIEW_SECTIONS } from '../constants/config'

function headingText(line) {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/^\d+[).]\s*/, '')
    .trim()
}

// Splits a reading into the part a signed-out visitor may read and the titles
// of what stays locked. Cutting on headings keeps the boundary stable while
// the answer is still streaming in.
export function splitGatedResult(text, isComplete) {
  const unlocked = { preview: text, isLocked: false, lockedTitles: [] }
  if (!text) return unlocked

  const lines = text.split('\n')
  const headings = []
  lines.forEach((line, index) => {
    if (/^#{1,6}\s+\S/.test(line)) headings.push(index)
  })

  if (headings.length > GUEST_PREVIEW_SECTIONS) {
    const cut = headings[GUEST_PREVIEW_SECTIONS]
    return {
      preview: lines.slice(0, cut).join('\n').trimEnd(),
      isLocked: true,
      lockedTitles: headings.slice(GUEST_PREVIEW_SECTIONS).map((index) => headingText(lines[index])),
    }
  }

  // Without headings there is no stable cut, so wait for the full text before
  // splitting on a paragraph break past the midpoint.
  if (!isComplete) return unlocked

  const boundary = text.indexOf('\n\n', Math.floor(text.length * 0.45))
  if (boundary === -1) return unlocked

  return { preview: text.slice(0, boundary).trimEnd(), isLocked: true, lockedTitles: [] }
}
