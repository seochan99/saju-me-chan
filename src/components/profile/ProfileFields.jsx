export default function ProfileFields({
  form,
  onChange,
  disabled,
  idPrefix,
  radioName,
  showName = true,
}) {
  function update(field, value) {
    onChange({ ...form, [field]: value })
  }

  return (
    <>
      {showName && (
        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-name`}>
            이름 <span className="required">필수</span>
          </label>
          <input
            className="input"
            id={`${idPrefix}-name`}
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="이름을 입력하세요"
            disabled={disabled}
            autoComplete="name"
          />
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-birthDate`}>
          생년월일 <span className="required">필수</span>
        </label>
        <input
          className="input"
          id={`${idPrefix}-birthDate`}
          type="date"
          value={form.birthDate}
          onChange={(e) => update('birthDate', e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${idPrefix}-birthTime`}>
          태어난 시간 <span className="optional">선택</span>
        </label>
        <input
          className="input"
          id={`${idPrefix}-birthTime`}
          type="time"
          value={form.birthTime}
          onChange={(e) => update('birthTime', e.target.value)}
          disabled={disabled}
        />
        <p className="field-hint">모르면 비워 두어도 됩니다.</p>
      </div>

      <div className="field">
        <span className="field-label">
          성별 <span className="required">필수</span>
        </span>
        <div className="segmented">
          <label className={`segment${disabled ? ' is-disabled' : ''}`}>
            <input
              type="radio"
              name={`${radioName}-gender`}
              value="male"
              checked={form.gender === 'male'}
              onChange={(e) => update('gender', e.target.value)}
              disabled={disabled}
            />
            남자
          </label>
          <label className={`segment${disabled ? ' is-disabled' : ''}`}>
            <input
              type="radio"
              name={`${radioName}-gender`}
              value="female"
              checked={form.gender === 'female'}
              onChange={(e) => update('gender', e.target.value)}
              disabled={disabled}
            />
            여자
          </label>
        </div>
      </div>

      <div className="field">
        <span className="field-label">양력 / 음력</span>
        <div className="segmented">
          <label className={`segment${disabled ? ' is-disabled' : ''}`}>
            <input
              type="radio"
              name={`${radioName}-calendar`}
              value="solar"
              checked={form.calendarType === 'solar'}
              onChange={(e) => update('calendarType', e.target.value)}
              disabled={disabled}
            />
            양력
          </label>
          <label className={`segment${disabled ? ' is-disabled' : ''}`}>
            <input
              type="radio"
              name={`${radioName}-calendar`}
              value="lunar"
              checked={form.calendarType === 'lunar'}
              onChange={(e) => update('calendarType', e.target.value)}
              disabled={disabled}
            />
            음력
          </label>
        </div>
      </div>
    </>
  )
}
