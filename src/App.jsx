import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// CommonMark does not close **bold** when it touches Korean text, so patch it
import remarkCjkFriendly from 'remark-cjk-friendly'
import { analyzeSajuStream } from './gemini'
import { supabase } from './supabase'
import './App.css'

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

function buildReadingPayload(formData, resultText) {
  const payload = {
    name: formData.name || '미입력',
    birth_date: formData.birthDate || null,
    birth_time: formData.birthTime || null,
    gender: formData.gender || null,
    calendar_type: formData.calendarType,
  }

  if (resultText !== undefined) {
    payload.result = resultText
  }

  return payload
}

function App() {
  // Form states
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [gender, setGender] = useState('')
  // 'solar' = 양력, 'lunar' = 음력
  const [calendarType, setCalendarType] = useState('solar')

  // API result states
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Saved readings for the sidebar
  const [readings, setReadings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [isListLoading, setIsListLoading] = useState(true)

  const nameInputRef = useRef(null)
  const shouldScrollToResultRef = useRef(false)

  const canAnalyze = Boolean(name.trim() && birthDate && gender)
  const isBusy = isLoading || isSaving
  const isViewingSaved = Boolean(selectedId && result && !isLoading)

  useEffect(() => {
    loadReadings()
  }, [])

  // Scroll to the markdown result after a saved reading is opened
  useEffect(() => {
    if (!shouldScrollToResultRef.current || !selectedId || !result || isLoading) return
    shouldScrollToResultRef.current = false
    document.getElementById('saju-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedId, result, isLoading])

  async function loadReadings() {
    setIsListLoading(true)

    const { data, error: fetchError } = await supabase
      .from('saju_readings')
      .select('id, name, birth_date, created_at')
      .order('created_at', { ascending: false })

    setIsListLoading(false)

    if (fetchError) {
      console.error(fetchError)
      return
    }

    setReadings(data ?? [])
  }

  // birth_time from Postgres may include seconds; trim for <input type="time">
  function normalizeTime(value) {
    if (!value) return ''
    return value.slice(0, 5)
  }

  async function handleSelectReading(id) {
    if (isBusy || id === selectedId) return

    setError('')
    setSelectedId(id)
    shouldScrollToResultRef.current = true

    const { data, error: fetchError } = await supabase
      .from('saju_readings')
      .select('id, name, birth_date, birth_time, gender, calendar_type, result')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error(fetchError)
      setError(fetchError.message || '저장된 사주를 불러오지 못했습니다.')
      return
    }

    setName(data.name ?? '')
    setBirthDate(data.birth_date ?? '')
    setBirthTime(normalizeTime(data.birth_time))
    setGender(data.gender ?? '')
    setCalendarType(data.calendar_type ?? 'solar')
    setResult(data.result ?? '')
  }

  // Create a new reading after analysis
  async function createReading(formData, resultText) {
    const { data, error: insertError } = await supabase
      .from('saju_readings')
      .insert(buildReadingPayload(formData, resultText))
      .select('id')
      .single()

    if (insertError) {
      console.error(insertError)
      setError(insertError.message || '사주 결과 저장에 실패했습니다.')
      return null
    }

    return data?.id ?? null
  }

  // Update an existing reading (form + optional result rewrite)
  async function updateReading(id, formData, resultText) {
    const { error: updateError } = await supabase
      .from('saju_readings')
      .update(buildReadingPayload(formData, resultText))
      .eq('id', id)

    if (updateError) {
      console.error(updateError)
      setError(updateError.message || '사주 결과 수정에 실패했습니다.')
      return false
    }

    return true
  }

  // Persist form fields on the selected reading without re-running Gemini
  async function handleSaveInfo() {
    if (!selectedId || !canAnalyze || isBusy) return

    setIsSaving(true)
    setError('')

    const formData = { name: name.trim(), birthDate, birthTime, gender, calendarType }
    const ok = await updateReading(selectedId, formData)

    setIsSaving(false)
    if (!ok) return

    await loadReadings()
  }

  async function handleDeleteReading(id, event) {
    event.stopPropagation()
    if (isBusy) return

    const target = readings.find((reading) => reading.id === id)
    const label = target?.name ? `"${target.name}"` : '이 사주'
    if (!window.confirm(`${label} 기록을 삭제할까요?`)) return

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
      handleNewReading()
    }

    await loadReadings()
  }

  // Analyze with Gemini, then create or update depending on selection
  async function handleAnalyze() {
    if (!canAnalyze || isBusy) return

    const editingId = selectedId
    setIsLoading(true)
    setError('')
    setResult('')
    shouldScrollToResultRef.current = false

    const formData = { name: name.trim(), birthDate, birthTime, gender, calendarType }

    try {
      const fullText = await analyzeSajuStream(formData, (delta) =>
        setResult((prev) => prev + delta),
      )

      if (!fullText) return

      if (editingId) {
        const ok = await updateReading(editingId, formData, fullText)
        if (ok) {
          setSelectedId(editingId)
          await loadReadings()
        }
      } else {
        const newId = await createReading(formData, fullText)
        if (newId) {
          setSelectedId(newId)
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

  function handleNewReading() {
    if (isBusy) return

    setName('')
    setBirthDate('')
    setBirthTime('')
    setGender('')
    setCalendarType('solar')
    setResult('')
    setError('')
    setSelectedId(null)
    shouldScrollToResultRef.current = false

    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
      document.getElementById('saju-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const resultTitle = name.trim()
    ? `${name.trim()}님의 사주 해석`
    : '사주 해석 결과'

  const submitLabel = isLoading
    ? '해석 중...'
    : selectedId
      ? '다시 해석하기'
      : '사주 해석하기'

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="저장된 사주 목록">
        <h2 className="sidebar-title">저장된 사주</h2>
        <button
          type="button"
          className="sidebar-new"
          onClick={handleNewReading}
          disabled={isBusy}
        >
          <span aria-hidden="true">+</span> 새 사주 만들기
        </button>
        {isListLoading ? (
          <p className="sidebar-empty">불러오는 중...</p>
        ) : readings.length === 0 ? (
          <p className="sidebar-empty">아직 저장된 사주가 없습니다.</p>
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
                  <span className="sidebar-item-name">{reading.name}</span>
                  {reading.birth_date && (
                    <span className="sidebar-item-meta">{formatBirthDate(reading.birth_date)}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="sidebar-delete"
                  onClick={(event) => handleDeleteReading(reading.id, event)}
                  disabled={isBusy}
                  aria-label={`${reading.name} 삭제`}
                  title="삭제"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="page">
        <header className="header">
          <h1 className="title">사주 해석</h1>
          <p className="subtitle">태어난 정보를 입력하면 사주 명식을 해석해 드립니다.</p>
        </header>

        <div className="card" id="saju-form">
          {isViewingSaved && (
            <div className="mode-banner">
              <p className="mode-banner-text">저장된 사주를 보고 있습니다</p>
              <div className="mode-banner-actions">
                <button
                  type="button"
                  className="mode-banner-action"
                  onClick={handleNewReading}
                  disabled={isBusy}
                >
                  새로 입력하기
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

          <div className="field">
            <label className="field-label" htmlFor="name">
              이름 <span className="required">필수</span>
            </label>
            <input
              ref={nameInputRef}
              className="input"
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              disabled={isBusy}
              autoComplete="name"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="birthDate">
              생년월일 <span className="required">필수</span>
            </label>
            <input
              className="input"
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              disabled={isBusy}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="birthTime">
              태어난 시간 <span className="optional">선택</span>
            </label>
            <input
              className="input"
              id="birthTime"
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              disabled={isBusy}
            />
            <p className="field-hint">모르면 비워 두어도 됩니다.</p>
          </div>

          <div className="field">
            <span className="field-label">
              성별 <span className="required">필수</span>
            </span>
            <div className="segmented">
              <label className={`segment${isBusy ? ' is-disabled' : ''}`}>
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === 'male'}
                  onChange={(e) => setGender(e.target.value)}
                  disabled={isBusy}
                />
                남자
              </label>
              <label className={`segment${isBusy ? ' is-disabled' : ''}`}>
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={(e) => setGender(e.target.value)}
                  disabled={isBusy}
                />
                여자
              </label>
            </div>
          </div>

          <div className="field">
            <span className="field-label">양력 / 음력</span>
            <div className="segmented">
              <label className={`segment${isBusy ? ' is-disabled' : ''}`}>
                <input
                  type="radio"
                  name="calendarType"
                  value="solar"
                  checked={calendarType === 'solar'}
                  onChange={(e) => setCalendarType(e.target.value)}
                  disabled={isBusy}
                />
                양력
              </label>
              <label className={`segment${isBusy ? ' is-disabled' : ''}`}>
                <input
                  type="radio"
                  name="calendarType"
                  value="lunar"
                  checked={calendarType === 'lunar'}
                  onChange={(e) => setCalendarType(e.target.value)}
                  disabled={isBusy}
                />
                음력
              </label>
            </div>
          </div>

          <div className="action-row">
            {selectedId && (
              <button
                className="secondary"
                type="button"
                onClick={handleSaveInfo}
                disabled={isBusy || !canAnalyze}
              >
                {isSaving ? '저장 중...' : '정보 저장'}
              </button>
            )}
            <button
              className="submit"
              type="button"
              onClick={handleAnalyze}
              disabled={isBusy || !canAnalyze}
            >
              {submitLabel}
            </button>
          </div>

          {!canAnalyze && !isBusy && (
            <p className="form-hint">이름, 생년월일, 성별을 입력하면 해석할 수 있습니다.</p>
          )}
          {selectedId && canAnalyze && !isBusy && (
            <p className="form-hint">정보 저장은 입력값만 수정하고, 다시 해석하기는 결과를 새로 만듭니다.</p>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        {/* Skeleton until the first piece of text arrives */}
        {isLoading && !result && (
          <section className="result" aria-busy="true">
            <h2 className="result-title">{resultTitle}</h2>
            <p className="result-status">해석을 작성하는 중입니다...</p>
            <div className="skeleton">
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-line--short" />
              <span className="skeleton-line" />
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-line--short" />
            </div>
          </section>
        )}

        {result && (
          <section className="result" id="saju-result" aria-live="polite">
            <h2 className="result-title">{resultTitle}</h2>
            {isLoading && <p className="result-status">해석을 작성하는 중입니다...</p>}
            {/* Gemini returns markdown, so render it instead of raw text */}
            <div className={`result-body${isLoading ? ' is-streaming' : ''}`}>
              <Markdown remarkPlugins={[remarkGfm, remarkCjkFriendly]}>
                {isLoading ? hideUnclosedBold(result) : result}
              </Markdown>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default App
