import { GoogleGenAI } from '@google/genai/web'
import { SAJU_SYSTEM_INSTRUCTION, SAMPLE_SAJU_CHART } from './prompts/sajuBasic'

// Create Gemini client with the Vite env key
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
})

// Calculate Korean age (만 나이) from YYYY-MM-DD
function getKoreanAge(birthDate) {
  if (!birthDate) return null

  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  const dayDiff = today.getDate() - birth.getDate()

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1
  }

  return age
}

// Build the user message from form values + sample chart
function buildSajuInput({ name, birthDate, birthTime, gender, calendarType }) {
  const age = getKoreanAge(birthDate)
  const genderLabel = gender === 'female' ? 'female' : gender === 'male' ? 'male' : 'unknown'
  const calendarLabel = calendarType === 'lunar' ? '음력' : '양력'

  return `아래 사용자 정보와 사주 명식을 바탕으로 해석해 주세요.

이름: ${name || '미입력'}
성별: ${genderLabel}
나이: ${age !== null ? `만 ${age}세` : '미입력'}
생년월일: ${birthDate || '미입력'} (${calendarLabel})
태어난 시간: ${birthTime || '미입력'}

사주 명식:
${SAMPLE_SAJU_CHART}`
}

// Stream the interpretation so text can be shown while it is generated.
// onDelta is called with each new piece of text.
export async function analyzeSajuStream(formData, onDelta) {
  const stream = await ai.interactions.create({
    model: 'gemini-3.6-flash',
    system_instruction: SAJU_SYSTEM_INSTRUCTION,
    input: buildSajuInput(formData),
    stream: true,
  })

  let text = ''

  for await (const event of stream) {
    // Other deltas (thoughts, signatures) are not part of the answer
    if (event.event_type === 'step.delta' && event.delta?.type === 'text') {
      text += event.delta.text
      onDelta(event.delta.text)
    }
  }

  return text
}
