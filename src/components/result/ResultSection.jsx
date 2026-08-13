import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkCjkFriendly from 'remark-cjk-friendly'
import { BAKE_MESSAGES } from '../../constants/config'
import { MASCOT_LOADING, MASCOT_MAIN } from '../../constants/assets'
import { hideUnclosedBold } from '../../utils/markdownStream'
import GoogleMark from '../shared/GoogleMark'

function BakingPanel({ resultTitle, bakeStep }) {
  return (
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
        <p className="bake-caption" key={bakeStep}>
          {BAKE_MESSAGES[bakeStep]}
        </p>
      </div>
    </section>
  )
}

function LockGate({ lockedTitles, onSignIn, isSigningIn }) {
  return (
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

        {lockedTitles.length > 0 && (
          <ul className="lock-list">
            {lockedTitles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="google-signin"
          onClick={() => onSignIn('lock_gate')}
          disabled={isSigningIn}
        >
          <GoogleMark />
          {isSigningIn ? '이동 중...' : 'Google로 나머지 보기'}
        </button>
        <p className="lock-note">10초면 끝난다냥. 결제는 없다냥.</p>
      </div>
    </div>
  )
}

export default function ResultSection({
  isLoading,
  result,
  resultTitle,
  bakeStep,
  gate,
  canShare,
  isBusy,
  isSharing,
  onShare,
  onSignIn,
  isSigningIn,
}) {
  return (
    <>
      {isLoading && !result && <BakingPanel resultTitle={resultTitle} bakeStep={bakeStep} />}

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
                    onClick={() => onShare('result_header')}
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

          <div className={`result-body${isLoading && !gate.isLocked ? ' is-streaming' : ''}`}>
            <Markdown remarkPlugins={[remarkGfm, remarkCjkFriendly]}>
              {isLoading ? hideUnclosedBold(gate.preview) : gate.preview}
            </Markdown>
          </div>

          {gate.isLocked && (
            <LockGate
              lockedTitles={gate.lockedTitles}
              onSignIn={onSignIn}
              isSigningIn={isSigningIn}
            />
          )}
        </section>
      )}
    </>
  )
}
