export default function AuthScreen({ message = '로그인 상태 확인 중...' }) {
  return (
    <div className="auth-screen">
      <p className="auth-status">{message}</p>
    </div>
  )
}
