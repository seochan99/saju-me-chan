import { MASCOT_MAIN } from '../../constants/assets'
import ProfileFields from './ProfileFields'

export default function ProfileModal({
  mode,
  form,
  onChange,
  error,
  isSaving,
  canSave,
  nameInputRef,
  onClose,
  onSubmit,
}) {
  const isOnboarding = mode === 'onboarding'

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={isOnboarding ? undefined : onClose}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {isOnboarding && (
          <img className="mascot mascot--modal" src={MASCOT_MAIN} alt="사주 도사냥" />
        )}
        <h2 className="modal-title" id="profile-modal-title">
          {isOnboarding ? '프로필 설정' : '프로필 수정'}
        </h2>
        <p className="modal-subtitle">
          {isOnboarding
            ? '사주를 보려면 기본 정보가 필요하다냥. 나중에 프로필에서 수정할 수 있다냥.'
            : '저장된 정보는 다음 사주 해석에 바로 사용됩니다.'}
        </p>

        <form className="modal-form" onSubmit={onSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="profile-modal-name">
              이름 <span className="required">필수</span>
            </label>
            <input
              ref={nameInputRef}
              className="input"
              id="profile-modal-name"
              type="text"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="이름을 입력하세요"
              disabled={isSaving}
              autoComplete="name"
            />
          </div>

          <ProfileFields
            form={form}
            onChange={onChange}
            disabled={isSaving}
            idPrefix="profile-modal"
            radioName="profile-modal"
            showName={false}
          />

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-actions">
            {!isOnboarding && (
              <button
                type="button"
                className="secondary"
                onClick={onClose}
                disabled={isSaving}
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="submit"
              disabled={isSaving || !canSave}
            >
              {isSaving ? '저장 중...' : isOnboarding ? '시작하기' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
