import { MASCOT_MAIN } from '../../constants/assets'
import GoogleMark from '../shared/GoogleMark'

export default function GuestBar({ onSignIn, isSigningIn }) {
  return (
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
        onClick={() => onSignIn('guest_bar')}
        disabled={isSigningIn}
      >
        <GoogleMark />
        {isSigningIn ? '이동 중...' : '로그인'}
      </button>
    </header>
  )
}
