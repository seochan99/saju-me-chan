import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkCjkFriendly from 'remark-cjk-friendly'
import { supabase } from './supabase'
import './App.css'

const MASCOT_MAIN = '/assets/images/main-cat.png'
const MASCOT_SUB = '/assets/images/sub-cat.png'

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

function ResultPage({ token }) {
  const [result, setResult] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [createdAt, setCreatedAt] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadSharedReading() {
      if (!token) {
        setError('공유 링크가 올바르지 않습니다.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError('')

      const { data, error: fetchError } = await supabase.rpc('get_shared_reading', {
        p_token: token,
      })

      if (cancelled) return

      if (fetchError) {
        console.error(fetchError)
        setError(fetchError.message || '공유된 사주를 불러오지 못했습니다.')
        setIsLoading(false)
        return
      }

      const reading = Array.isArray(data) ? data[0] : data

      if (!reading?.result) {
        setError('공유된 사주를 찾을 수 없습니다. 링크가 만료되었거나 잘못되었을 수 있어요.')
        setIsLoading(false)
        return
      }

      setResult(reading.result)
      setOwnerName(reading.owner_name ?? '')
      setCreatedAt(reading.created_at ?? '')
      setIsLoading(false)
    }

    loadSharedReading()

    return () => {
      cancelled = true
    }
  }, [token])

  const resultTitle = ownerName ? `${ownerName}님의 사주 해석` : '사주 해석 결과'

  if (isLoading) {
    return (
      <div className="share-screen">
        <p className="auth-status">공유된 사주를 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="share-screen">
        <div className="share-card">
          <img className="mascot mascot--hero" src={MASCOT_SUB} alt="" aria-hidden="true" />
          <h1 className="share-title">사주를 찾을 수 없다냥</h1>
          <p className="share-subtitle">{error}</p>
          <a className="submit share-home-link" href="/">
            내 사주 보러 가기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="share-screen share-screen--result">
      <div className="share-page">
        <header className="share-header">
          <img className="mascot mascot--header" src={MASCOT_SUB} alt="" aria-hidden="true" />
          <div>
            <p className="share-brand">사주 도사냥</p>
            <p className="share-brand-tag">친구가 공유한 사주 결과</p>
          </div>
        </header>

        <section className="result" id="saju-result" aria-live="polite">
          <div className="result-head">
            <img className="mascot mascot--avatar" src={MASCOT_MAIN} alt="" aria-hidden="true" />
            <div>
              <h1 className="result-title">{resultTitle}</h1>
              {createdAt && (
                <p className="result-status">해석 일시 {formatReadingDate(createdAt)}</p>
              )}
            </div>
          </div>
          <div className="result-body">
            <Markdown remarkPlugins={[remarkGfm, remarkCjkFriendly]}>{result}</Markdown>
          </div>
        </section>

        <p className="share-footer">
          나도 도사냥에게 사주를 물어보려면{' '}
          <a className="share-footer-link" href="/">
            여기로
          </a>
        </p>
      </div>
    </div>
  )
}

export default ResultPage
