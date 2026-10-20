import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Schutz vor Einbettung in fremde Seiten (Clickjacking). Per Meta-Tag lässt sich frame-ancestors nicht setzen.
if (window.top !== window.self) {
  document.documentElement.style.display = 'none'
  try { window.top!.location.href = window.self.location.href } catch { /* fremde Herkunft: Seite bleibt ausgeblendet */ }
}

// Verhindert, dass das Scrollen über einem fokussierten Zahlenfeld dessen Wert ändert
document.addEventListener(
  'wheel',
  () => {
    const active = document.activeElement
    if (active instanceof HTMLInputElement && active.type === 'number') {
      active.blur()
    }
  },
  { passive: true }
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
