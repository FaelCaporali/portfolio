import { describe, expect, it } from 'vitest'
import { langFromPath, localePath, parseAcceptLanguage, preferredLang, savedLang, stripLang } from './i18n'

describe('regra de idioma', () => {
  it('Accept-Language em ordem de q, com empate na ordem do cabeçalho', () => {
    expect(parseAcceptLanguage('en;q=0.3, pt-BR;q=0.8, fr')).toEqual(['fr', 'pt-BR', 'en'])
    expect(parseAcceptLanguage('pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7')).toEqual(['pt-BR', 'pt', 'en-US', 'en'])
    expect(parseAcceptLanguage('*, de;q=0')).toEqual([])
    expect(parseAcceptLanguage(null)).toEqual([])
  })

  it('o primeiro idioma suportado decide; nenhum suportado = inglês', () => {
    expect(preferredLang(['pt-BR', 'en'], null)).toBe('pt')
    expect(preferredLang(['fr', 'pt'], null)).toBe('pt')
    expect(preferredLang(['en-GB', 'pt-BR'], null)).toBe('en')
    expect(preferredLang(['fr', 'de'], null)).toBe('en')
    expect(preferredLang([], null)).toBe('en')
    expect(preferredLang(['PT-pt'], null)).toBe('pt')
  })

  it('a escolha salva vale sobre o navegador', () => {
    expect(preferredLang(['pt-BR'], 'en')).toBe('en')
    expect(preferredLang(['en-US'], 'pt')).toBe('pt')
    expect(savedLang('a=1; lang=pt; b=2')).toBe('pt')
    expect(savedLang('lang=en')).toBe('en')
    expect(savedLang('xlang=pt')).toBeNull()
    expect(savedLang('lang=fr')).toBeNull()
  })

  it('localePath e o caminho de volta', () => {
    expect(localePath('en', '/')).toBe('/')
    expect(localePath('en', '/journey')).toBe('/journey')
    expect(localePath('pt', '/')).toBe('/pt')
    expect(localePath('pt', '/journey')).toBe('/pt/journey')
    expect(langFromPath('/pt')).toBe('pt')
    expect(langFromPath('/pt/journey')).toBe('pt')
    expect(langFromPath('/ptx')).toBe('en')
    expect(langFromPath('/journey')).toBe('en')
    expect(stripLang('/pt/journey')).toBe('/journey')
    expect(stripLang('/pt')).toBe('/')
    expect(stripLang('/journey')).toBe('/journey')
    expect(stripLang('/journey/')).toBe('/journey')
    expect(stripLang('/pt/journey/')).toBe('/journey')
    expect(stripLang('/pt/')).toBe('/')
  })
})
