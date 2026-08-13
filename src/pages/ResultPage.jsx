import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkCjkFriendly from 'remark-cjk-friendly'
import { MASCOT_MAIN, MASCOT_SUB } from '../constants/assets'
import { trackEvent } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import { formatReadingDate } from '../utils/format'
import '../styles/app.css'

export default function ResultPage({ token }) {
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
        trackEvent('shared_result_error', { reason: 'missing_token' })
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
        trackEvent('shared_result_error', { reason: 'fetch_failed' })
        return
      }

      const reading = Array.isArray(data) ? data[0] : data

      if (!reading?.result) {
        setError('공유된 사주를 찾을 수 없습니다. 링크가 만료되었거나 잘못되었을 수 있어요.')
        setIsLoading(false)
        trackEvent('shared_result_error', { reason: 'not_found' })
        return
      }

      setResult(reading.result)
      setOwnerName(reading.owner_name ?? '')
      setCreatedAt(reading.created_at ?? '')
      setIsLoading(false)
      trackEvent('shared_result_view', { result_length: reading.result.length })
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
          <a
            className="submit share-home-link"
            href="/"
            onClick={() => trackEvent('shared_cta_click', { placement: 'error_card' })}
          >
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
          <a
            className="share-footer-link"
            href="/"
            onClick={() => trackEvent('shared_cta_click', { placement: 'footer' })}
          >
            여기로
          </a>
        </p>
      </div>
    </div>
  )
}
