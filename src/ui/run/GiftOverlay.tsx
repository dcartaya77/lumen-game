import { BOSS } from '@/data/bosses';
import { t } from '@/i18n';
import { gameBus, useRun, type GiftOption } from '@/state/run';
import { AdButton } from '@/ui/components/AdButton';

const ICON = { heal: '💚', weapon: '⚔', shield: '🛡' } as const;
const COLOR = { heal: '#7dffa0', weapon: '#ffd24a', shield: '#8ff0ff' } as const;

function describe(g: GiftOption): string {
  if (g.id === 'heal') return t('gift_heal_desc');
  if (g.id === 'shield') return t('gift_shield_desc', { s: g.secs });
  if (!g.weaponKey) return t('gift_weapon_none');
  return t(g.evolve ? 'gift_weapon_evo' : 'gift_weapon_desc', { name: t(g.weaponKey) });
}

/** Antesala del jefe: el jugador elige 1 de 3 regalos antes del duelo. */
export function GiftOverlay() {
  const gifts = useRun((s) => s.gifts);
  const giftAd = useRun((s) => s.giftAd);
  const secs = BOSS.gifts.adShieldSecs;
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2 className="overlay-title">{t('gift_title')}</h2>
        <p className="hint" style={{ textAlign: 'center', margin: '0 0 14px' }}>
          {t('gift_sub')}
        </p>
        <div className="stack">
          {gifts.map((g) => (
            <button
              key={g.id}
              className="upgrade"
              style={{ ['--c' as string]: COLOR[g.id] }}
              disabled={g.id === 'weapon' && !g.weaponKey}
              onClick={() => gameBus.emit('gift', { id: g.id })}
            >
              <span className="gift-ico">{ICON[g.id]}</span>
              <span className="upgrade-body">
                <span className="upgrade-name">{t(`gift_${g.id}`)}</span>
                <span className="upgrade-desc">{describe(g)}</span>
              </span>
            </button>
          ))}
          {giftAd ? (
            <p className="hint ad-note">✓ {t('gift_ad_done', { s: secs })}</p>
          ) : (
            <AdButton placement="boss_shield" label={t('gift_ad', { s: secs })} onReward={() => gameBus.emit('giftAd', undefined)} />
          )}
        </div>
      </div>
    </div>
  );
}
