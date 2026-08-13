# 사주 도사냥

생년월일·시간·성별·양력/음력을 입력하면, 냉정한 고양이 도사 **도사냥**이 Google Gemini로 사주 명식을 해석해 주는 웹앱입니다.  
해석은 생성되는 대로 실시간 스트리밍되며, Google 로그인 사용자는 기록 저장·공유까지 할 수 있습니다.

**라이브:** [https://saju-me-chan.vercel.app/](https://saju-me-chan.vercel.app/)

## 주요 기능

- **사주 입력** — 이름, 생년월일, 태어난 시간, 성별, 양력/음력
- **도사냥 캐릭터 해석** — Gemini `gemini-3.6-flash` Interactions API, 고양이 말투 + 직설적 판단
- **고정 섹션 출력** — 한 줄 요약 · 타고난 기질 · 무기 · 약점 · 특이점 · 지금 당장 할 것
- **실시간 스트리밍** — 첫 토큰 전 베이킹 메시지, 이후 마크다운이 흘러나오며 렌더링
- **게스트 체험** — 로그인 없이 해석 가능, 일부 섹션만 미리보기 후 Google 로그인으로 전체 해금
- **Google 로그인 + 프로필** — Supabase Auth(PKCE), 생년월일 등 프로필 저장 후 반복 분석
- **해석 히스토리** — 사이드바에서 과거 결과 조회·삭제·새 분석
- **공유 링크** — `/result/:token` 공개 결과 페이지로 해석 공유
- **GA4 이벤트** — 로그인·분석·공유 등 주요 행동 추적

## 기술 스택

- React 19 + Vite 8
- [`@google/genai`](https://www.npmjs.com/package/@google/genai) (Gemini Interactions API)
- [`@supabase/supabase-js`](https://www.npmjs.com/package/@supabase/supabase-js) (Auth · DB · RPC)
- `react-markdown` + `remark-gfm` + `remark-cjk-friendly`
- Google Analytics 4
- 배포: Vercel

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 복사해 `.env`를 만듭니다.

```bash
cp .env.example .env
```

```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
```

| 변수 | 설명 |
| --- | --- |
| `VITE_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey)에서 발급 |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (anon) 키 |

`.env`는 `.gitignore`에 포함되어 커밋되지 않습니다.  
Supabase에는 Google OAuth와 해석 저장·공유용 테이블/RPC(`get_shared_reading`, `get_saju_reading_count` 등)가 설정되어 있어야 합니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

기본 주소는 http://localhost:5173 입니다.

## 스크립트

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | ESLint 검사 |

## 프로젝트 구조

```
src/
├── App.jsx                 # 게스트/로그인 셸 조합
├── main.jsx                # 진입점 (/result/:token → ResultPage)
├── pages/
│   └── ResultPage.jsx      # 공유 결과 공개 페이지
├── components/
│   ├── analyze/            # 분석 카드·제출 UI
│   ├── layout/             # 사이드바, 게스트 바, 헤더, 인증 로딩
│   ├── profile/            # 프로필 모달·필드
│   ├── result/             # 스트리밍·게이트 결과 영역
│   └── shared/             # 토스트, Google 마크 등
├── hooks/
│   ├── useSajuApp.js       # 인증·프로필·분석·공유 상태
│   └── useToast.js
├── lib/
│   ├── gemini.js           # Gemini 스트리밍 호출
│   ├── supabase.js         # Supabase 클라이언트
│   └── analytics.js        # GA4 헬퍼
├── constants/              # 에셋 경로, 토스트·게스트 게이트 설정
├── utils/                  # 게이트 분할, 게스트 드래프트, 포맷 등
├── prompts/
│   └── sajuBasic.js        # 도사냥 시스템 프롬프트 + 샘플 명식
└── styles/app.css          # 앱 스타일
```

## 참고

현재 사주 명식은 `src/prompts/sajuBasic.js`의 샘플 데이터를 컨텍스트로 사용합니다.  
추후 생년월일 기반으로 실제 명식을 계산해 이 부분을 대체할 수 있습니다.
