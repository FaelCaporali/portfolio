/**
 * Os textos de interface em inglês, o idioma dos endereços sem prefixo. O tipo deste objeto é o contrato do português
 * (pt.ts): chave que falta lá é erro de tipo. Os textos da trajetória (marcos) vêm de journey.json, já nos dois
 * idiomas; as vidas em inglês, de journey.ts (a mesma fonte do herói desde o começo).
 */
import type { ContactErrorCode } from '../../../shared/contact/contract'
import { stages, type StageId } from '../../content/journey'

const FALLBACK = "Couldn't send right now. Please reach me directly below."

export const en = {
  /** Metas de cada página (src/i18n/meta.ts). */
  meta: {
    home: {
      title: 'Fael Caporali',
      description: 'Rafael Caporali — senior full-stack developer, Belo Horizonte.',
    },
    journey: {
      title: 'The full journey · Fael Caporali',
      description: "Fael Caporali's career, from running his own ventures to QA, tech lead and AI product engineering.",
    },
    mcp: {
      title: 'Ask your AI assistant · Fael Caporali',
      description:
        "Connect Claude, ChatGPT or any Model Context Protocol (MCP) client to Fael Caporali's portfolio: profile, filterable journey, delivered work and a direct message.",
    },
  },
  /** O controle que leva a ESTE idioma (aparece na página do outro). */
  lang: { short: 'EN', switchTo: 'Read in English' },
  errors: {
    notFoundTitle: 'Page not found · Fael Caporali',
    notFound: 'Page not found',
    notFoundText: 'There is nothing at this address.',
    failedTitle: 'Something went wrong · Fael Caporali',
    failed: 'Something went wrong',
    failedText: 'The page could not be shown. Please try again.',
    home: 'Back to the home page',
  },
  hero: {
    section: 'Introduction',
    /** "Today I am a(n)" / "Yesterday I was a(n)", antes da vida. */
    opening: (past: boolean, slot: string) =>
      `${past ? 'Yesterday I was' : 'Today I am'} a${/^[aeiou]/i.test(slot) ? 'n' : ''}`,
    /** "Today I am loading" até a cena 3D chegar. */
    loadingOpening: 'Today I am',
    loading: 'loading',
    slots: Object.fromEntries(stages.map((s) => [s.id, s.slot])) as Record<StageId, string>,
    titlesLabel: 'Titles',
    titles: ['FullStack Dev', 'QA Analyst', 'TechLead'],
    linksLabel: 'Links',
    journeyLink: 'See the full journey',
    /**
     * Fim do rótulo (depois de um espaço) que sai no celular deitado estreito, onde o par não cabe (HeroCopy); em
     * inglês, cabe inteiro.
     */
    journeyLinkTail: '',
    resume: 'Résumé',
    timeline: 'Timeline',
    source: 'View source on GitHub',
    sourceTitle: 'View source',
  },
  contact: {
    open: 'Contact me',
    title: 'Send me a message',
    name: 'Name',
    contact: 'E-mail or WhatsApp, so I can reply',
    message: 'Message',
    about: 'About',
    send: 'Send',
    sending: 'Sending…',
    verifying: 'Verifying…',
    sent: "Thanks! Message received. I'll get back to you soon.",
    another: 'Send another message',
    direct: 'Or reach me directly',
    hints: {
      name: 'Tell me your name.',
      contact: 'Enter an e-mail or a phone number.',
      message: (min: number) => `Write at least ${min} characters.`,
    },
    /** Falha sem código (rede, resposta ilegível) ou verificação humana que não carregou. */
    fallback: FALLBACK,
    stillVerifying: 'Still checking you are human. One moment and try again.',
    /** Um texto por recusa do Worker: quem escreveu sabe o que aconteceu e o que fazer. */
    errors: {
      method: 'The form could not be sent from here. Please reach me directly below.',
      forbidden: 'This page is not allowed to send the form. Please reach me directly below.',
      unsupported: 'Your browser sent the form in a format I cannot read. Please reach me directly below.',
      rate_limited: 'Too many attempts. Please try again in a minute.',
      too_large: 'The message is too long. Please shorten it and try again.',
      invalid: 'Something in the form could not be read. Please check it and try again.',
      verification_failed: 'Human verification failed. Please try again.',
      busy: 'Too many messages today. Please reach me directly below.',
      unavailable: FALLBACK,
    } satisfies Record<ContactErrorCode, string>,
    copy: {
      list: 'Contact',
      email: { title: 'Copy e-mail', copied: 'E-mail copied' },
      phone: { title: 'Copy phone number', copied: 'Phone copied' },
      failed: 'Copy failed. Select the text instead.',
    },
  },
  journey: {
    /** O título da página: antes, a palavra no espectro das vidas, depois. */
    title: { before: 'The full ', word: 'journey', after: '' },
    parts: { prologue: 'Prologue', story: 'The story' },
    /** Fim da parte que chega até hoje. */
    today: 'today',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    present: 'present',
    lives: 'Lives',
    map: 'Journey map',
    filter: 'Filter the map',
    years: 'Years',
    from: 'From',
    to: 'To',
    groups: { tools: 'Tools', concepts: 'Concepts', skills: 'Skills' },
    search: (group: string) => `Search ${group.toLowerCase()}`,
    removeFilter: (tag: string) => `Remove filter: ${tag}`,
    clear: 'Clear',
    empty: 'Nothing on the map matches these filters.',
    clearAll: 'Clear filters',
    readStory: 'Read the story',
    closeStory: 'Close the story',
  },
}

export type Messages = typeof en
