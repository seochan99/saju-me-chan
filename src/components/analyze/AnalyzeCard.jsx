import { calendarLabel, formatBirthDate, genderLabel } from '../../utils/format'
import { normalizeTime } from '../../utils/profileForm'
import ProfileFields from '../profile/ProfileFields'

export default function AnalyzeCard({
  isGuest,
  isBusy,
  isViewingSaved,
  isSharing,
  canShare,
  canAnalyze,
  submitLabel,
  guestForm,
  onGuestFormChange,
  isProfileLoading,
  profile,
  selectedId,
  onShare,
  onNewReading,
  onDeleteSelected,
  onOpenProfile,
  onAnalyze,
}) {
  return (
    <div className="card" id="saju-form">
      {isViewingSaved && (
        <div className="mode-banner">
          <p className="mode-banner-text">저장된 사주를 보고 있습니다</p>
          <div className="mode-banner-actions">
            <button
              type="button"
              className="mode-banner-action"
              onClick={() => onShare('saved_banner')}
              disabled={isBusy || !canShare}
            >
              {isSharing ? '공유 준비 중...' : '공유하기'}
            </button>
            <button
              type="button"
              className="mode-banner-action"
              onClick={onNewReading}
              disabled={isBusy}
            >
              새로 해석하기
            </button>
            <button
              type="button"
              className="mode-banner-action mode-banner-action--danger"
              onClick={onDeleteSelected}
              disabled={isBusy}
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {isGuest ? (
        <>
          <div className="guest-intro">
            <h2 className="profile-summary-title">내 정보</h2>
            <p className="guest-intro-note">가입 없이 바로 볼 수 있다냥.</p>
          </div>

          <div className="guest-fields">
            <ProfileFields
              form={guestForm}
              onChange={onGuestFormChange}
              disabled={isBusy}
              idPrefix="guest"
              radioName="guest"
            />
          </div>

          <div className="action-row">
            <button
              className="submit"
              type="button"
              onClick={onAnalyze}
              disabled={isBusy || !canAnalyze}
            >
              {submitLabel}
            </button>
          </div>

          <p className="form-hint">
            입력한 정보는 해석에만 쓰인다냥. 저장은 로그인한 뒤에만 한다냥.
          </p>
        </>
      ) : isProfileLoading ? (
        <p className="form-hint">프로필을 불러오는 중...</p>
      ) : profile ? (
        <>
          <div className="profile-summary">
            <div className="profile-summary-top">
              <h2 className="profile-summary-title">내 정보</h2>
              <button
                type="button"
                className="profile-summary-edit"
                onClick={onOpenProfile}
                disabled={isBusy}
              >
                수정
              </button>
            </div>
            <dl className="profile-summary-list">
              <div className="profile-summary-row">
                <dt>이름</dt>
                <dd>{profile.name}</dd>
              </div>
              <div className="profile-summary-row">
                <dt>생년월일</dt>
                <dd>
                  {formatBirthDate(profile.birth_date)} ({calendarLabel(profile.calendar_type)})
                </dd>
              </div>
              <div className="profile-summary-row">
                <dt>태어난 시간</dt>
                <dd>{normalizeTime(profile.birth_time) || '미입력'}</dd>
              </div>
              <div className="profile-summary-row">
                <dt>성별</dt>
                <dd>{genderLabel(profile.gender)}</dd>
              </div>
            </dl>
          </div>

          <div className="action-row">
            <button
              className="submit"
              type="button"
              onClick={onAnalyze}
              disabled={isBusy || !canAnalyze}
            >
              {submitLabel}
            </button>
          </div>

          {selectedId && !isBusy && (
            <p className="form-hint">다시 해석하기는 현재 프로필 정보로 결과를 새로 만듭니다.</p>
          )}
        </>
      ) : (
        <p className="form-hint">사주 해석을 위해 프로필 정보를 먼저 입력해 주세요.</p>
      )}
    </div>
  )
}
