import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ResultPage from './ResultPage.jsx'

function getSharedResultToken() {
  const match = window.location.pathname.match(/^\/result\/([^/]+)\/?$/)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

const sharedToken = getSharedResultToken()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {sharedToken ? <ResultPage token={sharedToken} /> : <App />}
  </StrictMode>,
)
