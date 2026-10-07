import type { CSSProperties } from 'react';
import { RARITY_KEYS } from '@/data/minibosses';
import { parseTalismanKey, talismanColor } from '@/data/talismans';
import { t } from '@/i18n';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Icono de un talismán con el borde del color de su rareza. */
export function TalismanIcon({ talKey, dim = false }: { talKey: string; dim?: boolean }) {
  const p = parseTalismanKey(talKey);
  if (!p) return null;
  const style = { '--rc': hex(talismanColor(p.rarity)) } as CSSProperties;
  return (
    <span className={dim ? 'tal-ico dim' : 'tal-ico'} style={style} title={`${t(p.def.nameKey)} · ${t(RARITY_KEYS[p.rarity])}`}>
      {p.def.icon}
    </span>
  );
}
