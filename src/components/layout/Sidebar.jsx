import { MASCOT_MAIN, MASCOT_SUB } from '../../constants/assets'
import { formatReadingDate } from '../../utils/format'

export default function Sidebar({
  userLabel,
  readings,
  selectedId,
  isBusy,
  hasProfile,
  isListLoading,
  isProfileLoading,
  onOpenProfile,
  onSignOut,
  onNewReading,
  onSelectReading,
  onDeleteReading,
}) {
  return (
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
            onClick={onOpenProfile}
            disabled={isBusy || !hasProfile}
          >
            프로필
          </button>
          <button
            type="button"
            className="sidebar-signout"
            onClick={onSignOut}
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
        onClick={onNewReading}
        disabled={isBusy || !hasProfile}
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
                onClick={() => onSelectReading(reading.id)}
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
                onClick={(event) => onDeleteReading(reading.id, event)}
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
  )
}
