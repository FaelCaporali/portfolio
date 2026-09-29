// As cores das vidas (geradas de journey.ts, vite.config.ts). O resto do CSS vem por <link> no journey.html, no <head>,
// para o HTML nunca aparecer sem estilo (J54); no build, as duas partes entram no <head>.
import 'virtual:journey-accents.css'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { JourneyPage } from './JourneyPage'

/**
 * A trajetória chega em HTML pronto (o build renderiza JourneyPage, render.tsx); aqui o React assume a mesma árvore:
 * filtros, menu do mapa, contato e o movimento da rolagem.
 */
const root = document.getElementById('journey')
if (!root) throw new Error('journey.html sem #journey')

hydrateRoot(
  root,
  <StrictMode>
    <JourneyPage />
  </StrictMode>,
)
