import { createContext, useContext, useState } from 'react'
import en from '../locale/en'
import ptBR from '../locale/pt-BR'

const LOCALES = { en, 'pt-BR': ptBR }
const Ctx = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(
    () => localStorage.getItem('hf_lang') || 'en'
  )

  function changeLang(newLang) {
    localStorage.setItem('hf_lang', newLang)
    setLang(newLang)
  }

  function t(key, vars = {}) {
    const dict = LOCALES[lang] ?? LOCALES.en
    let str = dict[key] ?? LOCALES.en[key] ?? key
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v)
    }
    return str
  }

  return <Ctx.Provider value={{ lang, changeLang, t }}>{children}</Ctx.Provider>
}

export const useT = () => useContext(Ctx)
