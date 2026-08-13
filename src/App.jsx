import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// CommonMark does not close **bold** when it touches Korean text, so patch it
import remarkCjkFriendly from 'remark-cjk-friendly'
import { analyzeSajuStream } from './gemini'
import { supabase } from './supabase'
import './App.css'

// Kept in sync with the toast animation durations in App.css
const TOAST_VISIBLE_MS = 2600
const TOAST_EXIT_MS = 240

const MASCOT_MAIN = '/assets/images/main-cat.png'
const MASCOT_SUB = '/assets/images/sub-cat.png'
const MASCOT_LOADING = '/assets/images/loading-cat.png'

// Rotated while waiting for the first streamed token
const BAKE_MESSAGES = [
  '명식을 화로에 올렸다냥...',
  '오행이 노릇해지는 중이다냥',
  '쓴소리를 반죽하고 있다냥...',
  '단맛은 빼고 굽는다냥',
  '거의 다 익었다냥...',
]
const BAKE_MESSAGE_MS = 2600

// Signed-out visitors read this many sections before the rest is locked.
// The prompt asks for six sections, so this hands over roughly half.
const GUEST_PREVIEW_SECTIONS = 3

// Survives the OAuth redirect, so a visitor who signs in from the lock keeps
// what they typed and the reading they already paid attention to.
const GUEST_DRAFT_KEY = 'saju:guest-draft'

// A half-written **bold** would show its asterisks until the closing pair
// arrives, so drop the dangling opener while streaming.
function hideUnclosedBold(text) {
  const marks = text.match(/\*\*/g)
  if (!marks || marks.length % 2 === 0) return text

  const last = text.lastIndexOf('**')
  return text.slice(0, last) + text.slice(last + 2)
}

function formatBirthDate(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${year}.${month}.${day}`
}

function formatReadingDate(value) {
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

// birth_time from Postgres may include seconds; trim for <input type="time">
function normalizeTime(value) {
  if (!value) return ''
  return value.slice(0, 5)
}

function genderLabel(value) {
  if (value === 'male') return '남자'
  if (value === 'female') return '여자'
  return ''
}

function calendarLabel(value) {
  return value === 'lunar' ? '음력' : '양력'
}

function emptyProfileForm(defaults = {}) {
  return {
    name: defaults.name ?? '',
    birthDate: defaults.birthDate ?? '',
    birthTime: defaults.birthTime ?? '',
    gender: defaults.gender ?? '',
    calendarType: defaults.calendarType ?? 'solar',
  }
}

function profileToForm(profile) {
  if (!profile) return emptyProfileForm()
  return emptyProfileForm({
    name: profile.name ?? '',
    birthDate: profile.birth_date ?? '',
    birthTime: normalizeTime(profile.birth_time),
    gender: profile.gender ?? '',
    calendarType: profile.calendar_type ?? 'solar',
  })
}

function isProfileFormComplete(form) {
  return Boolean(form.name.trim() && form.birthDate && form.gender)
}

function readGuestDraft() {
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

function writeGuestDraft(draft) {
  try {
    window.localStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Private browsing can reject writes; the draft is a convenience only.
  }
}

function clearGuestDraft() {
  try {
    window.localStorage.removeItem(GUEST_DRAFT_KEY)
  } catch {
    // Ignore for the same reason as writeGuestDraft.
  }
}

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
function splitGatedResult(text, isComplete) {
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

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function ProfileFields({ form, onChange, disabled, idPrefix, radioName, showName = true }) {
  function update(field, value) {
    onChange({ ...form, [field]: value })
  }

  return (
    <>
      {showName && (
        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-name`}>
            이름 <span className="required">필수</span>
          </label>
          <input
            className="input"
            id={`${idPrefix}-name`}
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="이름을 입력하세요"
            disabled={disabled}
            autoComplete="name"
          />
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-birthDate`}>
          생년월일 <span className="required">필수</span>
        </label>
        <input
          className="input"
          id={`${idPrefix}-birthDate`}
          type="date"
          value={form.birthDate}
          onChange={(e) => update('birthDate', e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-birthTime`}>
          태어난 시간 <span className="optional">선택</span>
        </label>
        <input
          className="input"
          id={`${idPrefix}-birthTime`}
          type="time"
          value={form.birthTime}
          onChange={(e) => update('birthTime', e.target.value)}
          disabled={disabled}
        />
        <p className="field-hint">모르면 비워 두어도 됩니다.</p>
      </div>

      <div className="field">
        <span className="field-label">
          성별 <span className="required">필수</span>
        </span>
        <div className="segmented">
          <label className={`segment${disabled ? ' is-disabled' : ''}`}>
            <input
              type="radio"
              name={`${radioName}-gender`}
              value="male"
              checked={form.gender === 'male'}
              onChange={(e) => update('gender', e.target.value)}
              disabled={disabled}
            />
            남자
          </label>
          <label className={`segment${disabled ? ' is-disabled' : ''}`}>
            <input
              type="radio"
              name={`${radioName}-gender`}
              value="female"
              checked={form.gender === 'female'}
              onChange={(e) => update('gender', e.target.value)}
              disabled={disabled}
            />
            여자
          </label>
        </div>
      </div>

      <div className="field">
        <span className="field-label">양력 / 음력</span>
        <div className="segmented">
          <label className={`segment${disabled ? ' is-disabled' : ''}`}>
            <input
              type="radio"
              name={`${radioName}-calendar`}
              value="solar"
              checked={form.calendarType === 'solar'}
              onChange={(e) => update('calendarType', e.target.value)}
              disabled={disabled}
            />
            양력
          </label>
          <label className={`segment${disabled ? ' is-disabled' : ''}`}>
            <input
              type="radio"
              name={`${radioName}-calendar`}
              value="lunar"
              checked={form.calendarType === 'lunar'}
              onChange={(e) => update('calendarType', e.target.value)}
              disabled={disabled}
            />
            음력
          </label>
        </div>
      </div>
    </>
  )
}

function App() {
  // Auth
  const [user, setUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isSigningIn, setIsSigningIn] = useState(false)

  // Signed-out visitors fill this in instead of a stored profile
  const [guestForm, setGuestForm] = useState(() => readGuestDraft()?.form ?? emptyProfileForm())

  // Profile (public.users)
  const [profile, setProfile] = useState(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [profileModalMode, setProfileModalMode] = useState(null)
  const [profileForm, setProfileForm] = useState(emptyProfileForm())
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // API result states
  const [result, setResult] = useState(() => readGuestDraft()?.result ?? '')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareToken, setShareToken] = useState(null)
  const [error, setError] = useState('')

  // Saved readings for the sidebar
  const [readings, setReadings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [isListLoading, setIsListLoading] = useState(false)

  // Transient feedback for actions that would otherwise look like no-ops
  const [toast, setToast] = useState(null)

  // Caption shown under the baking mascot while waiting
  const [bakeStep, setBakeStep] = useState(0)

  const profileNameRef = useRef(null)
  const shouldScrollToResultRef = useRef(false)
  const toastTimersRef = useRef([])

  const isGuest = !user
  const isBusy = isLoading || isSaving || isSavingProfile || isSharing
  const isViewingSaved = Boolean(selectedId && result && !isLoading)
  const canShare = Boolean(selectedId && result && !isLoading)
  const activeForm = isGuest ? guestForm : profile ? profileToForm(profile) : null
  const canAnalyze = Boolean(activeForm && isProfileFormComplete(activeForm))
  const canSaveProfile = isProfileFormComplete(profileForm)
  const isOnboarding = profileModalMode === 'onboarding'

  const gate = isGuest
    ? splitGatedResult(result, !isLoading)
    : { preview: result, isLocked: false, lockedTitles: [] }

  useEffect(() => {
    let isMounted = true

    const oauthError =
      new URLSearchParams(window.location.search).get('error_description') ||
      new URLSearchParams(window.location.search).get('error')

    if (oauthError) {
      setError(oauthError)
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setUser(data.session?.user ?? null)
      setIsAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsAuthLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setReadings([])
      setSelectedId(null)
      setShareToken(null)
      setProfileModalMode(null)
      setProfileForm(emptyProfileForm())
      setIsListLoading(false)
      setIsProfileLoading(false)
      return
    }

    loadProfileAndReadings(user)
  }, [user])

  // Skipped while streaming so a write does not run on every token
  useEffect(() => {
    if (user || isLoading) return
    writeGuestDraft({ form: guestForm, result })
  }, [user, isLoading, guestForm, result])

  // Scroll to the markdown result after a saved reading is opened
  useEffect(() => {
    if (!shouldScrollToResultRef.current || !selectedId || !result || isLoading) return
    shouldScrollToResultRef.current = false
    document.getElementById('saju-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedId, result, isLoading])

  useEffect(() => {
    if (!profileModalMode) return
    requestAnimationFrame(() => {
      profileNameRef.current?.focus()
    })
  }, [profileModalMode])

  // The form is tall enough to push a fresh answer out of view on phones
  useEffect(() => {
    if (!isLoading) return
    document.getElementById('saju-pending')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isLoading])

  useEffect(() => {
    if (!isLoading) {
      setBakeStep(0)
      return
    }

    const timer = setInterval(() => {
      setBakeStep((step) => (step + 1) % BAKE_MESSAGES.length)
    }, BAKE_MESSAGE_MS)

    return () => clearInterval(timer)
  }, [isLoading])

  useEffect(() => clearToastTimers, [])

  function clearToastTimers() {
    toastTimersRef.current.forEach(clearTimeout)
    toastTimersRef.current = []
  }

  function showToast(message, tone = 'info') {
    clearToastTimers()
    // key restarts the entrance animation when the same message repeats
    setToast({ message, tone, key: Date.now(), isLeaving: false })

    toastTimersRef.current = [
      // Mark as leaving first so the exit animation can play before unmount
      setTimeout(
        () => setToast((prev) => (prev ? { ...prev, isLeaving: true } : prev)),
        TOAST_VISIBLE_MS,
      ),
      setTimeout(() => setToast(null), TOAST_VISIBLE_MS + TOAST_EXIT_MS),
    ]
  }

  async function upsertProfile(userId, form) {
    const payload = {
      id: userId,
      name: form.name.trim(),
      birth_date: form.birthDate,
      birth_time: form.birthTime || null,
      gender: form.gender,
      calendar_type: form.calendarType,
      updated_at: new Date().toISOString(),
    }

    return supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select('id, name, birth_date, birth_time, gender, calendar_type, updated_at')
      .single()
  }

  async function loadProfileAndReadings(authUser) {
    // Read and clear before the first await so a repeated call (StrictMode
    // remounts in dev) cannot save the same reading twice.
    const draft = readGuestDraft()
    clearGuestDraft()
    const draftForm = draft?.form && isProfileFormComplete(draft.form) ? draft.form : null
    const draftResult = draft?.result?.trim() ? draft.result : ''

    setIsProfileLoading(true)
    setIsListLoading(true)
    setError('')

    const [{ data: profileData, error: profileError }, { data: readingsData, error: readingsError }] =
      await Promise.all([
        supabase
          .from('users')
          .select('id, name, birth_date, birth_time, gender, calendar_type, updated_at')
          .eq('id', authUser.id)
          .maybeSingle(),
        supabase
          .from('saju_readings')
          .select('id, created_at')
          .order('created_at', { ascending: false }),
      ])

    setIsProfileLoading(false)
    setIsListLoading(false)

    if (profileError) {
      console.error(profileError)
      setError(profileError.message || '프로필을 불러오지 못했습니다.')
      return
    }

    if (readingsError) {
      console.error(readingsError)
      setError(readingsError.message || '저장된 사주를 불러오지 못했습니다.')
    } else {
      setReadings(readingsData ?? [])
    }

    // What a visitor already typed is enough to skip the onboarding modal
    let activeProfile = profileData
    if (!activeProfile && draftForm) {
      const { data: createdProfile, error: createError } = await upsertProfile(
        authUser.id,
        draftForm,
      )

      if (createError) {
        console.error(createError)
      } else {
        activeProfile = createdProfile
      }
    }

    if (activeProfile) {
      setProfile(activeProfile)
      setProfileModalMode(null)
    } else {
      setProfile(null)
      const suggestedName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        ''
      setProfileForm(emptyProfileForm({ name: suggestedName }))
      setProfileModalMode('onboarding')
    }

    if (!draftResult) return

    setResult(draftResult)

    const newId = await createReading(draftResult, authUser.id)
    if (newId) {
      setSelectedId(newId)
      setShareToken(null)
      await loadReadings()
    }

    showToast('잠겨 있던 나머지 해석이 열렸어요', 'success')
  }

  async function loadReadings() {
    setIsListLoading(true)

    const { data, error: fetchError } = await supabase
      .from('saju_readings')
      .select('id, created_at')
      .order('created_at', { ascending: false })

    setIsListLoading(false)

    if (fetchError) {
      console.error(fetchError)
      setError(fetchError.message || '저장된 사주를 불러오지 못했습니다.')
      return
    }

    setReadings(data ?? [])
  }

  async function handleGoogleSignIn() {
    setIsSigningIn(true)
    setError('')

    // The redirect unloads the page, so hand the guest work to storage first
    if (isGuest) {
      writeGuestDraft({ form: guestForm, result })
    }

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'online',
          prompt: 'select_account',
        },
      },
    })

    if (signInError) {
      console.error(signInError)
      setError(signInError.message || 'Google 로그인에 실패했습니다.')
      setIsSigningIn(false)
    }
  }

  async function handleSignOut() {
    if (isBusy) return

    setError('')
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      console.error(signOutError)
      setError(signOutError.message || '로그아웃에 실패했습니다.')
      return
    }

    setResult('')
    setGuestForm(emptyProfileForm())
    clearGuestDraft()
  }

  function openProfileEditor() {
    if (!profile || isBusy) return
    setError('')
    setProfileForm(profileToForm(profile))
    setProfileModalMode('edit')
  }

  function closeProfileModal() {
    if (isOnboarding || isSavingProfile) return
    setProfileModalMode(null)
    setProfileForm(profileToForm(profile))
  }

  async function handleSaveProfile(event) {
    event.preventDefault()
    if (!user?.id || !canSaveProfile || isSavingProfile) return

    setIsSavingProfile(true)
    setError('')

    const { data, error: saveError } = await upsertProfile(user.id, profileForm)

    setIsSavingProfile(false)

    if (saveError) {
      console.error(saveError)
      setError(saveError.message || '프로필 저장에 실패했습니다.')
      return
    }

    setProfile(data)
    setProfileModalMode(null)
  }

  async function handleSelectReading(id) {
    if (isBusy || id === selectedId) return

    setError('')
    setSelectedId(id)
    shouldScrollToResultRef.current = true

    const { data, error: fetchError } = await supabase
      .from('saju_readings')
      .select('id, result, created_at, share_token')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error(fetchError)
      setError(fetchError.message || '저장된 사주를 불러오지 못했습니다.')
      return
    }

    setResult(data.result ?? '')
    setShareToken(data.share_token ?? null)
  }

  async function ensureShareToken() {
    if (!selectedId) return null
    if (shareToken) return shareToken

    const token = crypto.randomUUID().replace(/-/g, '')
    const { data, error: updateError } = await supabase
      .from('saju_readings')
      .update({ share_token: token })
      .eq('id', selectedId)
      .select('share_token')
      .single()

    if (updateError) {
      throw updateError
    }

    const nextToken = data?.share_token ?? token
    setShareToken(nextToken)
    return nextToken
  }

  async function handleShare() {
    if (!selectedId || !result || isBusy || isSharing) return

    setIsSharing(true)
    setError('')

    try {
      const token = await ensureShareToken()
      if (!token) {
        setError('공유 링크를 만들지 못했습니다.')
        return
      }

      const shareUrl = `${window.location.origin}/result/${token}`
      const shareTitle = profile?.name
        ? `${profile.name}님의 사주 해석`
        : '사주 해석 결과'

      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: shareTitle,
            text: '도사냥이 봐 준 사주 결과를 공유해요',
            url: shareUrl,
          })
          showToast('공유했어요', 'success')
          return
        } catch (shareError) {
          if (shareError?.name === 'AbortError') return
        }
      }

      await navigator.clipboard.writeText(shareUrl)
      showToast('공유 링크를 복사했어요', 'success')
    } catch (err) {
      console.error(err)
      setError(err?.message || '공유 링크 만들기에 실패했습니다.')
    } finally {
      setIsSharing(false)
    }
  }

  async function createReading(resultText, userId = user?.id) {
    if (!userId) {
      setError('로그인이 필요합니다.')
      return null
    }

    const { data, error: insertError } = await supabase
      .from('saju_readings')
      .insert({ user_id: userId, result: resultText })
      .select('id')
      .single()

    if (insertError) {
      console.error(insertError)
      setError(insertError.message || '사주 결과 저장에 실패했습니다.')
      return null
    }

    return data?.id ?? null
  }

  async function updateReading(id, resultText) {
    if (!user?.id) {
      setError('로그인이 필요합니다.')
      return false
    }

    const { error: updateError } = await supabase
      .from('saju_readings')
      .update({ result: resultText })
      .eq('id', id)

    if (updateError) {
      console.error(updateError)
      setError(updateError.message || '사주 결과 수정에 실패했습니다.')
      return false
    }

    return true
  }

  async function handleDeleteReading(id, event) {
    event.stopPropagation()
    if (isBusy) return

    if (!window.confirm('이 사주 기록을 삭제할까요?')) return

    setIsSaving(true)
    setError('')

    const { error: deleteError } = await supabase.from('saju_readings').delete().eq('id', id)

    setIsSaving(false)

    if (deleteError) {
      console.error(deleteError)
      setError(deleteError.message || '사주 삭제에 실패했습니다.')
      return
    }

    if (selectedId === id) {
      resetToNewReading()
    }

    showToast('사주 기록을 삭제했어요', 'success')
    await loadReadings()
  }

  async function handleAnalyze() {
    if (!canAnalyze || isBusy || !activeForm) return

    const editingId = selectedId
    setIsLoading(true)
    setError('')
    setResult('')
    shouldScrollToResultRef.current = false

    const formData = {
      name: activeForm.name.trim(),
      birthDate: activeForm.birthDate,
      birthTime: activeForm.birthTime,
      gender: activeForm.gender,
      calendarType: activeForm.calendarType,
    }

    try {
      const fullText = await analyzeSajuStream(formData, (delta) =>
        setResult((prev) => prev + delta),
      )

      if (!fullText) return

      // Guests keep the reading in the draft until they sign in
      if (isGuest) return

      if (editingId) {
        const ok = await updateReading(editingId, fullText)
        if (ok) {
          setSelectedId(editingId)
          await loadReadings()
        }
      } else {
        const newId = await createReading(fullText)
        if (newId) {
          setSelectedId(newId)
          setShareToken(null)
          await loadReadings()
        }
      }
    } catch (err) {
      console.error(err)
      setError(err?.message || '사주 해석 요청에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  function scrollToForm() {
    requestAnimationFrame(() => {
      document.getElementById('saju-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function resetToNewReading() {
    setResult('')
    setError('')
    setSelectedId(null)
    setShareToken(null)
    shouldScrollToResultRef.current = false
    scrollToForm()
  }

  function handleNewReading() {
    if (isBusy) return

    if (!selectedId && !result) {
      showToast('이미 새 사주 해석 화면이에요')
      scrollToForm()
      return
    }

    resetToNewReading()
    showToast('새 사주 해석을 시작할 수 있어요', 'success')
  }

  const readerName = (isGuest ? guestForm.name.trim() : profile?.name) || ''
  const resultTitle = readerName ? `${readerName}님의 사주 해석` : '사주 해석 결과'

  const submitLabel = isLoading
    ? '해석 중...'
    : selectedId || (isGuest && result)
      ? '다시 해석하기'
      : isGuest
        ? '무료로 사주 보기'
        : '사주 해석하기'

  const userLabel =
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    '로그인됨'

  if (isAuthLoading) {
    return (
      <div className="auth-screen">
        <p className="auth-status">로그인 상태 확인 중...</p>
      </div>
    )
  }

  return (
    <div className={`app-shell${isGuest ? ' app-shell--guest' : ''}`}>
      {isGuest ? (
        <header className="guest-bar">
          <div className="guest-bar-brand">
            <img className="mascot mascot--brand" src={MASCOT_MAIN} alt="" aria-hidden="true" />
            <div>
              <p className="guest-bar-name">사주 도사냥</p>
              <p className="guest-bar-tag">saju me</p>
            </div>
          </div>
          <button
            type="button"
            className="guest-bar-signin"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
          >
            <GoogleMark />
            {isSigningIn ? '이동 중...' : '로그인'}
          </button>
        </header>
      ) : (
        <aside className="sidebar" aria-label="저장된 사주 목록">
          <div className="sidebar-brand">
            <img className="mascot mascot--brand" src={MASCOT_MAIN} alt="" aria-hidden="true" />
            <div>
              <p className="sidebar-brand-name">사주 도사냥</p>
              <p className="sidebar-brand-tag">saju me</p>
            </div>
          </div>

          <div className="sidebar-user">
            <p className="sidebar-user-label">내 프로필</p>
            <p className="sidebar-user-name">{userLabel}</p>
            <div className="sidebar-user-actions">
              <button
                type="button"
                className="sidebar-signout"
                onClick={openProfileEditor}
                disabled={isBusy || !profile}
              >
                프로필
              </button>
              <button
                type="button"
                className="sidebar-signout"
                onClick={handleSignOut}
                disabled={isBusy}
              >
                로그아웃
              </button>
            </div>
          </div>
          <h2 className="sidebar-title">저장된 사주</h2>
          <button
            type="button"
            className="sidebar-new"
            onClick={handleNewReading}
            disabled={isBusy || !profile}
          >
            <span aria-hidden="true">+</span> 새 사주 해석
          </button>
          {isListLoading || isProfileLoading ? (
            <p className="sidebar-empty">불러오는 중...</p>
          ) : readings.length === 0 ? (
            <div className="sidebar-empty-state">
              <img className="mascot mascot--sleepy" src={MASCOT_SUB} alt="" aria-hidden="true" />
              <p className="sidebar-empty">아직 저장된 사주가 없다냥.</p>
            </div>
          ) : (
            <ul className="sidebar-list">
              {readings.map((reading) => (
                <li key={reading.id} className="sidebar-row">
                  <button
                    type="button"
                    className={`sidebar-item${selectedId === reading.id ? ' is-active' : ''}`}
                    onClick={() => handleSelectReading(reading.id)}
                    disabled={isBusy}
                  >
                    <span className="sidebar-item-name">사주 해석</span>
                    <span className="sidebar-item-meta">
                      {formatReadingDate(reading.created_at)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="sidebar-delete"
                    onClick={(event) => handleDeleteReading(reading.id, event)}
                    disabled={isBusy}
                    aria-label={`${formatReadingDate(reading.created_at)} 사주 삭제`}
                    title="삭제"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      <div className="page">
        <header className="header">
          {isGuest ? (
            <img className="mascot mascot--hero" src={MASCOT_MAIN} alt="사주 도사냥" />
          ) : (
            <img className="mascot mascot--header" src={MASCOT_SUB} alt="" aria-hidden="true" />
          )}
          <h1 className="title">사주 해석</h1>
          <p className="subtitle">
            {isGuest
              ? '로그인 없이 바로 본다냥. 정보만 넣으면 도사냥이 명식을 읽어 준다냥.'
              : '저장된 내 정보로 도사냥이 바로 명식을 읽어 준다냥.'}
          </p>
        </header>

        <div className="card" id="saju-form">
          {isViewingSaved && (
            <div className="mode-banner">
              <p className="mode-banner-text">저장된 사주를 보고 있습니다</p>
              <div className="mode-banner-actions">
                <button
                  type="button"
                  className="mode-banner-action"
                  onClick={handleShare}
                  disabled={isBusy || !canShare}
                >
                  {isSharing ? '공유 준비 중...' : '공유하기'}
                </button>
                <button
                  type="button"
                  className="mode-banner-action"
                  onClick={handleNewReading}
                  disabled={isBusy}
                >
                  새로 해석하기
                </button>
                <button
                  type="button"
                  className="mode-banner-action mode-banner-action--danger"
                  onClick={(event) => handleDeleteReading(selectedId, event)}
                  disabled={isBusy}
                >
                  삭제
                </button>
              </div>
            </div>
          )}

          {isGuest ? (
            <>
              <div className="guest-intro">
                <h2 className="profile-summary-title">내 정보</h2>
                <p className="guest-intro-note">가입 없이 바로 볼 수 있다냥.</p>
              </div>

              <div className="guest-fields">
                <ProfileFields
                  form={guestForm}
                  onChange={setGuestForm}
                  disabled={isBusy}
                  idPrefix="guest"
                  radioName="guest"
                />
              </div>

              <div className="action-row">
                <button
                  className="submit"
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isBusy || !canAnalyze}
                >
                  {submitLabel}
                </button>
              </div>

              <p className="form-hint">
                입력한 정보는 해석에만 쓰인다냥. 저장은 로그인한 뒤에만 한다냥.
              </p>
            </>
          ) : isProfileLoading ? (
            <p className="form-hint">프로필을 불러오는 중...</p>
          ) : profile ? (
            <>
              <div className="profile-summary">
                <div className="profile-summary-top">
                  <h2 className="profile-summary-title">내 정보</h2>
                  <button
                    type="button"
                    className="profile-summary-edit"
                    onClick={openProfileEditor}
                    disabled={isBusy}
                  >
                    수정
                  </button>
                </div>
                <dl className="profile-summary-list">
                  <div className="profile-summary-row">
                    <dt>이름</dt>
                    <dd>{profile.name}</dd>
                  </div>
                  <div className="profile-summary-row">
                    <dt>생년월일</dt>
                    <dd>
                      {formatBirthDate(profile.birth_date)} ({calendarLabel(profile.calendar_type)})
                    </dd>
                  </div>
                  <div className="profile-summary-row">
                    <dt>태어난 시간</dt>
                    <dd>{normalizeTime(profile.birth_time) || '미입력'}</dd>
                  </div>
                  <div className="profile-summary-row">
                    <dt>성별</dt>
                    <dd>{genderLabel(profile.gender)}</dd>
                  </div>
                </dl>
              </div>

              <div className="action-row">
                <button
                  className="submit"
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isBusy || !canAnalyze}
                >
                  {submitLabel}
                </button>
              </div>

              {selectedId && !isBusy && (
                <p className="form-hint">다시 해석하기는 현재 프로필 정보로 결과를 새로 만듭니다.</p>
              )}
            </>
          ) : (
            <p className="form-hint">사주 해석을 위해 프로필 정보를 먼저 입력해 주세요.</p>
          )}
        </div>

        {error && !profileModalMode && <p className="error">{error}</p>}

        {/* Baking mascot until the first piece of text arrives */}
        {isLoading && !result && (
          <section className="result" id="saju-pending" aria-busy="true">
            <div className="result-head">
              <img className="mascot mascot--reading" src={MASCOT_MAIN} alt="" aria-hidden="true" />
              <div>
                <h2 className="result-title">{resultTitle}</h2>
                <p className="result-status">도사냥이 명식을 들여다보는 중이다냥...</p>
              </div>
            </div>
            <div className="bake">
              <div className="bake-scene" aria-hidden="true">
                <img className="bake-cat" src={MASCOT_LOADING} alt="" />
                <span className="bake-glow" />
                <span className="bake-steam">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              {/* Keyed so each message replays the fade-in */}
              <p className="bake-caption" key={bakeStep}>
                {BAKE_MESSAGES[bakeStep]}
              </p>
            </div>
          </section>
        )}

        {result && (
          <section className="result" id="saju-result" aria-live="polite">
            <div className="result-head">
              <img className="mascot mascot--avatar" src={MASCOT_MAIN} alt="" aria-hidden="true" />
              <div className="result-head-copy">
                <div className="result-head-row">
                  <h2 className="result-title">{resultTitle}</h2>
                  {canShare && (
                    <button
                      type="button"
                      className="result-share"
                      onClick={handleShare}
                      disabled={isBusy}
                    >
                      {isSharing ? '공유 중...' : '공유'}
                    </button>
                  )}
                </div>
                {isLoading && !gate.isLocked && (
                  <p className="result-status">도사냥이 받아쓰는 중이다냥...</p>
                )}
              </div>
            </div>
            {/* Gemini returns markdown, so render it instead of raw text */}
            <div className={`result-body${isLoading && !gate.isLocked ? ' is-streaming' : ''}`}>
              <Markdown remarkPlugins={[remarkGfm, remarkCjkFriendly]}>
                {isLoading ? hideUnclosedBold(gate.preview) : gate.preview}
              </Markdown>
            </div>

            {gate.isLocked && (
              <div className="lock">
                <div className="lock-veil" aria-hidden="true">
                  <span className="lock-line" />
                  <span className="lock-line" />
                  <span className="lock-line" />
                  <span className="lock-line" />
                </div>

                <div className="lock-card">
                  <p className="lock-badge">여기부터 잠겨 있다냥</p>
                  <h3 className="lock-title">쓴소리는 아직 시작도 안 했다냥</h3>
                  <p className="lock-desc">
                    로그인하면 남은 해석이 바로 열리고, 지금 본 내용도 그대로 저장된다냥.
                  </p>

                  {gate.lockedTitles.length > 0 && (
                    <ul className="lock-list">
                      {gate.lockedTitles.map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    className="google-signin"
                    onClick={handleGoogleSignIn}
                    disabled={isSigningIn}
                  >
                    <GoogleMark />
                    {isSigningIn ? '이동 중...' : 'Google로 나머지 보기'}
                  </button>
                  <p className="lock-note">10초면 끝난다냥. 결제는 없다냥.</p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {profileModalMode && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={isOnboarding ? undefined : closeProfileModal}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            {isOnboarding && (
              <img className="mascot mascot--modal" src={MASCOT_MAIN} alt="사주 도사냥" />
            )}
            <h2 className="modal-title" id="profile-modal-title">
              {isOnboarding ? '프로필 설정' : '프로필 수정'}
            </h2>
            <p className="modal-subtitle">
              {isOnboarding
                ? '사주를 보려면 기본 정보가 필요하다냥. 나중에 프로필에서 수정할 수 있다냥.'
                : '저장된 정보는 다음 사주 해석에 바로 사용됩니다.'}
            </p>

            <form className="modal-form" onSubmit={handleSaveProfile}>
              <div className="field">
                <label className="field-label" htmlFor="profile-modal-name">
                  이름 <span className="required">필수</span>
                </label>
                <input
                  ref={profileNameRef}
                  className="input"
                  id="profile-modal-name"
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="이름을 입력하세요"
                  disabled={isSavingProfile}
                  autoComplete="name"
                />
              </div>

              <ProfileFields
                form={profileForm}
                onChange={setProfileForm}
                disabled={isSavingProfile}
                idPrefix="profile-modal"
                radioName="profile-modal"
                showName={false}
              />

              {error && profileModalMode && <p className="modal-error">{error}</p>}

              <div className="modal-actions">
                {!isOnboarding && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={closeProfileModal}
                    disabled={isSavingProfile}
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  className="submit"
                  disabled={isSavingProfile || !canSaveProfile}
                >
                  {isSavingProfile ? '저장 중...' : isOnboarding ? '시작하기' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="toast-area" role="status" aria-live="polite">
        {toast && (
          <p
            key={toast.key}
            className={`toast toast--${toast.tone}${toast.isLeaving ? ' is-leaving' : ''}`}
          >
            {toast.message}
          </p>
        )}
      </div>
    </div>
  )
}

export default App
