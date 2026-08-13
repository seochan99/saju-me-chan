// birth_time from Postgres may include seconds; trim for <input type="time">
export function normalizeTime(value) {
  if (!value) return ''
  return value.slice(0, 5)
}

export function emptyProfileForm(defaults = {}) {
  return {
    name: defaults.name ?? '',
    birthDate: defaults.birthDate ?? '',
    birthTime: defaults.birthTime ?? '',
    gender: defaults.gender ?? '',
    calendarType: defaults.calendarType ?? 'solar',
  }
}

export function profileToForm(profile) {
  if (!profile) return emptyProfileForm()
  return emptyProfileForm({
    name: profile.name ?? '',
    birthDate: profile.birth_date ?? '',
    birthTime: normalizeTime(profile.birth_time),
    gender: profile.gender ?? '',
    calendarType: profile.calendar_type ?? 'solar',
  })
}

export function isProfileFormComplete(form) {
  return Boolean(form.name.trim() && form.birthDate && form.gender)
}
