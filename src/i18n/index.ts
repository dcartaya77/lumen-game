import { en } from './en';
import { es, type TranslationKey } from './es';

export type Lang = 'es' | 'en';
export type { TranslationKey };

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { es, en };

let currentLang: Lang = 'es';

export function setLang(lang: Lang): void {
  currentLang = lang;
  document.documentElement.lang = lang;
}

export function getLang(): Lang {
  return currentLang;
}

/** Traducción con interpolación simple: t('key', { n: 3 }) sustituye {n}. */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  let str = dictionaries[currentLang][key] ?? dictionaries.es[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
  return str;
}

/** Idioma inicial a partir del language_code de Telegram (o del navegador). */
export function detectLang(code: string): Lang {
  return code.toLowerCase().startsWith('es') ? 'es' : 'en';
}
