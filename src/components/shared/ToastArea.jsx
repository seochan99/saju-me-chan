export default function ToastArea({ toast }) {
  return (
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
  )
}
