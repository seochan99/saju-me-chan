export function formatBirthDate(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${year}.${month}.${day}`
}

export function formatReadingDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}.${month}.${day} ${hour}:${minute}`
}

export function genderLabel(value) {
  if (value === 'male') return '남자'
  if (value === 'female') return '여자'
  return ''
}

export function calendarLabel(value) {
  return value === 'lunar' ? '음력' : '양력'
}
