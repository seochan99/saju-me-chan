// A half-written **bold** would show its asterisks until the closing pair
// arrives, so drop the dangling opener while streaming.
export function hideUnclosedBold(text) {
  const marks = text.match(/\*\*/g)
  if (!marks || marks.length % 2 === 0) return text

  const last = text.lastIndexOf('**')
  return text.slice(0, last) + text.slice(last + 2)
}
