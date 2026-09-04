import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
