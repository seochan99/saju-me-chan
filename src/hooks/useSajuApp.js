import { useEffect, useRef, useState } from 'react'
import { BAKE_MESSAGE_MS, BAKE_MESSAGES } from '../constants/config'
import { setAnalyticsUser, trackEvent } from '../lib/analytics'
import { analyzeSajuStream } from '../lib/gemini'
import { supabase } from '../lib/supabase'
import { splitGatedResult } from '../utils/gatedResult'
import { clearGuestDraft, readGuestDraft, writeGuestDraft } from '../utils/guestDraft'
import {
  emptyProfileForm,
  isProfileFormComplete,
  profileToForm,
} from '../utils/profileForm'
import useToast from './useToast'

export default function useSajuApp() {
  const { toast, showToast } = useToast()

  const [user, setUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const [guestForm, setGuestForm] = useState(() => readGuestDraft()?.form ?? emptyProfileForm())

  const [profile, setProfile] = useState(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [profileModalMode, setProfileModalMode] = useState(null)
  const [profileForm, setProfileForm] = useState(emptyProfileForm())
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [result, setResult] = useState(() => readGuestDraft()?.result ?? '')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareToken, setShareToken] = useState(null)
  const [error, setError] = useState('')

  const [readings, setReadings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [isListLoading, setIsListLoading] = useState(false)

  const [bakeStep, setBakeStep] = useState(0)
  const [readingCount, setReadingCount] = useState(null)

  const profileNameRef = useRef(null)
  const shouldScrollToResultRef = useRef(false)
  const loggedUserIdRef = useRef(null)

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
      const sessionUser = data.session?.user ?? null
      setUser(sessionUser)
      setAnalyticsUser(sessionUser?.id ?? null)
      setIsAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null
      setUser(sessionUser)
      setAnalyticsUser(sessionUser?.id ?? null)
      setIsAuthLoading(false)

      // SIGNED_IN also replays on token refresh in some browsers, so only the
      // first arrival of a given user id counts as a login.
      if (event === 'SIGNED_IN' && sessionUser?.id && sessionUser.id !== loggedUserIdRef.current) {
        loggedUserIdRef.current = sessionUser.id
        trackEvent('login', { method: 'google' })
      }
      if (!sessionUser) {
        loggedUserIdRef.current = null
      }
    })

    supabase.rpc('get_saju_reading_count').then(({ data, error: countError }) => {
      if (!isMounted) return
      if (countError) {
        console.error(countError)
        return
      }
      const next = Number(data)
      if (Number.isFinite(next)) setReadingCount(next)
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

  useEffect(() => {
    if (user || isLoading) return
    writeGuestDraft({ form: guestForm, result })
  }, [user, isLoading, guestForm, result])

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

  useEffect(() => {
    if (!isLoading) return
    document.getElementById('saju-pending')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isLoading])

  // Titles keep arriving while the answer streams, so the impression waits for
  // the finished text to report a stable section count.
  const gateRef = useRef(gate)
  gateRef.current = gate

  useEffect(() => {
    if (!gate.isLocked || isLoading) return
    trackEvent('lock_gate_view', { locked_sections: gateRef.current.lockedTitles.length })
  }, [gate.isLocked, isLoading])

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

    trackEvent('guest_result_unlocked')
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

  async function handleGoogleSignIn(placement) {
    setIsSigningIn(true)
    setError('')

    trackEvent('sign_in_click', {
      placement: typeof placement === 'string' ? placement : 'unknown',
      has_guest_result: Boolean(isGuest && result),
    })

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
      trackEvent('sign_in_error', { message: signInError.message || 'unknown' })
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
    trackEvent('sign_out')
  }

  function openProfileEditor() {
    if (!profile || isBusy) return
    setError('')
    trackEvent('profile_edit_open')
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
      trackEvent('profile_save_error', {
        mode: isOnboarding ? 'onboarding' : 'edit',
        message: saveError.message || 'unknown',
      })
      return
    }

    setProfile(data)
    setProfileModalMode(null)
    trackEvent('profile_save', {
      mode: isOnboarding ? 'onboarding' : 'edit',
      has_birth_time: Boolean(profileForm.birthTime),
      calendar_type: profileForm.calendarType,
      gender: profileForm.gender,
    })
  }

  async function handleSelectReading(id) {
    if (isBusy || id === selectedId) return

    setError('')
    setSelectedId(id)
    shouldScrollToResultRef.current = true
    trackEvent('reading_open')

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

  async function handleShare(source) {
    if (!selectedId || !result || isBusy || isSharing) return

    setIsSharing(true)
    setError('')

    const placement = typeof source === 'string' ? source : 'unknown'
    trackEvent('share_click', { placement })

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
          trackEvent('share', { method: 'web_share', placement, content_type: 'saju_reading' })
          return
        } catch (shareError) {
          if (shareError?.name === 'AbortError') {
            trackEvent('share_cancel', { method: 'web_share', placement })
            return
          }
        }
      }

      await navigator.clipboard.writeText(shareUrl)
      showToast('공유 링크를 복사했어요', 'success')
      trackEvent('share', { method: 'copy_link', placement, content_type: 'saju_reading' })
    } catch (err) {
      console.error(err)
      setError(err?.message || '공유 링크 만들기에 실패했습니다.')
      trackEvent('share_error', { placement, message: err?.message || 'unknown' })
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

    if (!window.confirm('이 사주 기록을 삭제할까요?')) {
      trackEvent('reading_delete_cancel')
      return
    }

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

    trackEvent('reading_delete')
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

    const analyzeContext = {
      is_guest: isGuest,
      mode: editingId ? 'redo' : 'new',
      has_birth_time: Boolean(formData.birthTime),
      gender: formData.gender,
      calendar_type: formData.calendarType,
    }
    const startedAt = Date.now()
    trackEvent('analyze_start', analyzeContext)

    try {
      const fullText = await analyzeSajuStream(formData, (delta) =>
        setResult((prev) => prev + delta),
      )

      if (!fullText) {
        trackEvent('analyze_empty', analyzeContext)
        return
      }

      trackEvent('analyze_complete', {
        ...analyzeContext,
        duration_ms: Date.now() - startedAt,
        result_length: fullText.length,
      })

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
      trackEvent('analyze_error', {
        ...analyzeContext,
        duration_ms: Date.now() - startedAt,
        message: err?.message || 'unknown',
      })
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

    trackEvent('new_reading_click')

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

  return {
    toast,
    isAuthLoading,
    isGuest,
    isBusy,
    isSigningIn,
    isSharing,
    isLoading,
    isViewingSaved,
    isProfileLoading,
    isListLoading,
    canShare,
    canAnalyze,
    canSaveProfile,
    gate,
    guestForm,
    setGuestForm,
    profile,
    profileForm,
    setProfileForm,
    profileModalMode,
    profileNameRef,
    readings,
    selectedId,
    result,
    resultTitle,
    bakeStep,
    readingCount,
    error,
    submitLabel,
    userLabel,
    handleGoogleSignIn,
    handleSignOut,
    openProfileEditor,
    closeProfileModal,
    handleSaveProfile,
    handleSelectReading,
    handleShare,
    handleDeleteReading,
    handleAnalyze,
    handleNewReading,
    isSavingProfile,
  }
}
