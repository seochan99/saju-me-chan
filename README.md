# saju-me

생년월일·시간·성별·양력/음력을 입력하면 Google Gemini가 사주 명식을 해석해 주는 웹앱입니다. 해석 결과는 생성되는 대로 실시간으로 화면에 흘러나옵니다.

## 주요 기능

- **사주 입력 폼** — 이름, 생년월일, 태어난 시간, 성별, 양력/음력
- **Gemini 기반 해석** — Gemini `gemini-3.6-flash` Interactions API 사용
- **실시간 스트리밍 출력** — 첫 응답 전에는 스켈레톤 UI, 이후 텍스트가 생성되는 대로 표시
- **마크다운 렌더링** — 제목·강조·목록을 예쁘게 렌더링 (한글 강조 `**...**` 대응)

## 기술 스택

- React 19 + Vite
- [`@google/genai`](https://www.npmjs.com/package/@google/genai) (Gemini Interactions API)
- `react-markdown` + `remark-gfm` + `remark-cjk-friendly`

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 복사해 `.env`를 만들고 Gemini API 키를 넣습니다.

```bash
cp .env.example .env
```

```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

API 키는 [Google AI Studio](https://aistudio.google.com/apikey)에서 발급받을 수 있습니다. `.env`는 `.gitignore`에 포함되어 커밋되지 않습니다.

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
├── App.jsx              # 입력 폼 + 결과 화면(스켈레톤/스트리밍/마크다운)
├── gemini.js            # Gemini 클라이언트 및 스트리밍 호출
├── prompts/
│   └── sajuBasic.js     # 사주 해석 시스템 프롬프트 + 명식 컨텍스트
├── App.css / index.css  # 스타일
└── main.jsx             # 앱 진입점
```

## 참고

현재 사주 명식은 `src/prompts/sajuBasic.js`의 샘플 데이터를 컨텍스트로 사용합니다. 추후 생년월일 기반으로 실제 명식을 계산해 이 부분을 대체할 수 있습니다.
