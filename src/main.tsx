import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// As cores das vidas como variáveis (o anel do "Contact me"); geradas de journey.ts no build (vite.config.ts).
import 'virtual:journey-accents.css'
import App from './App'

const root = document.getElementById('root')
if (!root) throw new Error('index.html sem #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
