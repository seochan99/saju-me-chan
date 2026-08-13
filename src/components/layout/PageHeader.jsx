import { MASCOT_MAIN, MASCOT_SUB } from '../../constants/assets'

export default function PageHeader({ isGuest, readingCount }) {
  return (
    <header className="header">
      {isGuest ? (
        <img className="mascot mascot--hero" src={MASCOT_MAIN} alt="사주 도사냥" />
      ) : (
        <img className="mascot mascot--header" src={MASCOT_SUB} alt="" aria-hidden="true" />
      )}
      <h1 className="title">사주 해석</h1>
      <p className="subtitle">
        {isGuest
          ? '로그인 없이 바로 본다냥. 정보만 넣으면 도사냥이 명식을 읽어 준다냥.'
          : '저장된 내 정보로 도사냥이 바로 명식을 읽어 준다냥.'}
      </p>
      {isGuest && readingCount != null && readingCount > 0 && (
        <p className="trust-count">
          지금까지 총 <span>{readingCount.toLocaleString('ko-KR')}</span>
          개의 사주가 생성되었습니다
        </p>
      )}
    </header>
  )
}
