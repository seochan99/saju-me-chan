import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// CommonMark does not close **bold** when it touches Korean text, so patch it
import remarkCjkFriendly from 'remark-cjk-friendly'
import { analyzeSajuStream } from './gemini'
import './App.css'

// A half-written **bold** would show its asterisks until the closing pair
// arrives, so drop the dangling opener while streaming.
function hideUnclosedBold(text) {
  const marks = text.match(/\*\*/g)
  if (!marks || marks.length % 2 === 0) return text

  const last = text.lastIndexOf('**')
  return text.slice(0, last) + text.slice(last + 2)
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
  const [error, setError] = useState('')

  // When the user clicks the button, call Gemini
  async function handleAnalyze() {
    setIsLoading(true)
    setError('')
    setResult('')

    try {
      // Append each streamed piece so the text appears while it is written
      await analyzeSajuStream(
        { name, birthDate, birthTime, gender, calendarType },
        (delta) => setResult((prev) => prev + delta),
      )
    } catch (err) {
      console.error(err)
      setError(err?.message || '사주 해석 요청에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">사주 해석</h1>
        <p className="subtitle">태어난 정보를 입력하면 사주 명식을 해석해 드립니다.</p>
      </header>

      <div className="card">
        <div className="field">
          <label className="field-label" htmlFor="name">
            이름
          </label>
          <input
            className="input"
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="birthDate">
            생년월일
          </label>
          <input
            className="input"
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="birthTime">
            태어난 시간
          </label>
          <input
            className="input"
            id="birthTime"
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
          />
        </div>

        <div className="field">
          <span className="field-label">성별</span>
          <div className="segmented">
            <label className="segment">
              <input
                type="radio"
                name="gender"
                value="male"
                checked={gender === 'male'}
                onChange={(e) => setGender(e.target.value)}
              />
              남자
            </label>
            <label className="segment">
              <input
                type="radio"
                name="gender"
                value="female"
                checked={gender === 'female'}
                onChange={(e) => setGender(e.target.value)}
              />
              여자
            </label>
          </div>
        </div>

        <div className="field">
          <span className="field-label">양력 / 음력</span>
          <div className="segmented">
            <label className="segment">
              <input
                type="radio"
                name="calendarType"
                value="solar"
                checked={calendarType === 'solar'}
                onChange={(e) => setCalendarType(e.target.value)}
              />
              양력
            </label>
            <label className="segment">
              <input
                type="radio"
                name="calendarType"
                value="lunar"
                checked={calendarType === 'lunar'}
                onChange={(e) => setCalendarType(e.target.value)}
              />
              음력
            </label>
          </div>
        </div>

        <button className="submit" type="button" onClick={handleAnalyze} disabled={isLoading}>
          {isLoading ? '해석 중...' : '사주 해석하기'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Skeleton until the first piece of text arrives */}
      {isLoading && !result && (
        <section className="result" aria-busy="true">
          <h2 className="result-title">사주 해석 결과</h2>
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
        <section className="result" aria-live="polite">
          <h2 className="result-title">사주 해석 결과</h2>
          {/* Gemini returns markdown, so render it instead of raw text */}
          <div className={`result-body${isLoading ? ' is-streaming' : ''}`}>
            <Markdown remarkPlugins={[remarkGfm, remarkCjkFriendly]}>
              {isLoading ? hideUnclosedBold(result) : result}
            </Markdown>
          </div>
        </section>
      )}
    </div>
  )
}

export default App
