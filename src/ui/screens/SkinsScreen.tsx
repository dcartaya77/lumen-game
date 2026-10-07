import { useEffect, useState } from 'react';
import { equippedSkin, isSkinOwned, isTrialable, SKIN_BY_ID, SKINS, skinSlot, type SkinDef, type SkinTarget } from '@/data/skins';
import type { PassiveStat } from '@/data/types';
import { WEAPON_BY_ID } from '@/data/weapons';
import { t, type TranslationKey } from '@/i18n';
import { tg } from '@/platform/telegram';
import { addSkinAd, armTrial, buySkin, equipSkin } from '@/state/skinActions';
import { useApp } from '@/state/store';
import { AdButton } from '@/ui/components/AdButton';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { SkinPreview } from '@/ui/components/SkinPreview';

const TABS: { target: SkinTarget; key: TranslationKey }[] = [
  { target: 'flame', key: 'st_flame' },
  { target: 'weapon', key: 'st_weapon' },
  { target: 'death', key: 'st_death' },
  { target: 'levelup', key: 'st_levelup' },
  { target: 'frame', key: 'st_frame' },
];

const RARITY_KEY: Record<SkinDef['rarity'], TranslationKey> = {
  common: 'rarity_common',
  rare: 'rarity_rare',
  epic: 'rarity_epic',
  legendary: 'rarity_legendary',
};

const STAT_KEY: Record<PassiveStat, TranslationKey> = {
  maxHp: 'stat_maxHp',
  speed: 'stat_speed',
  damage: 'stat_damage',
  magnet: 'stat_magnet',
  cooldown: 'stat_cooldown',
  armor: 'stat_armor',
  regen: 'stat_regen',
};

const hex = (c: number) => `#${(c || 0xffffff).toString(16).padStart(6, '0')}`;

export function SkinsScreen() {
  const go = useApp((s) => s.go);
  const profile = useApp((s) => s.profile);
  const ads = useApp((s) => s.ads);
  const [tab, setTab] = useState<SkinTarget>('flame');
  const [selId, setSelId] = useState<string | null>(null);

  useEffect(() => {
    tg.backButton.show(() => go('menu'));
    return () => tg.backButton.hide();
  }, [go]);

  if (!profile || !ads) return null;

  const list = SKINS.filter((s) => s.target === tab);
  const equippedId = tab === 'weapon' ? null : equippedSkin(profile, tab)?.id;
  const selected = list.find((s) => s.id === selId) ?? list.find((s) => s.id === equippedId) ?? list[0]!;

  return (
    <div className="screen">
      <ScreenHeader title={t('skins')} sparks={profile.sparks} />
      <div className="tabs">
        {TABS.map((x) => (
          <button
            key={x.target}
            className={tab === x.target ? 'tab active' : 'tab'}
            onClick={() => {
              setTab(x.target);
              setSelId(null);
            }}
          >
            {t(x.key)}
          </button>
        ))}
      </div>
      <div className="stack scrollable">
        <SkinDetail skin={selected} />
        <p className="hint" style={{ margin: 0 }}>
          ◆ {profile.frags} {t('frags')}
        </p>
        <div className="skin-grid">
          {list.map((s) => {
            const owned = isSkinOwned(profile, s);
            const on = equippedSkin(profile, skinSlot(s))?.id === s.id;
            return (
              <button
                key={s.id}
                className={`skin-cell rarity-${s.rarity}${s.id === selected.id ? ' sel' : ''}${owned ? '' : ' locked'}`}
                onClick={() => setSelId(s.id)}
              >
                <span className="skin-dot" style={{ background: hex(s.visual.color), color: hex(s.visual.glow) }} />
                <span className="skin-name">{t(s.nameKey)}</span>
                <span className="skin-state">{on ? '✓' : owned ? '' : '🔒'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function bonusText(skin: SkinDef): string {
  if (!skin.bonus) return t('skin_no_bonus');
  const { stat, value } = skin.bonus;
  const v = stat === 'armor' || stat === 'regen' ? String(value) : `${Math.round(value * 100)}%`;
  return t('skin_bonus', { v, stat: t(STAT_KEY[stat]) });
}

function SkinDetail({ skin }: { skin: SkinDef }) {
  const profile = useApp((s) => s.profile)!;
  const ads = useApp((s) => s.ads)!;
  const owned = isSkinOwned(profile, skin);
  const equipped = equippedSkin(profile, skinSlot(skin))?.id === skin.id;
  const u = skin.unlock;
  const weapon = skin.weaponId ? WEAPON_BY_ID[skin.weaponId] : undefined;
  const progress = ads.skinProgress[skin.id] ?? 0;

  return (
    <div className={`panel skin-detail rarity-${skin.rarity}`}>
      <div className="skin-preview-wrap">
        <SkinPreview skin={skin} size={150} />
      </div>
      <div className="skin-info">
        <div className="skin-title">
          <strong>{t(skin.nameKey)}</strong>
          <span className="rarity-tag">{t(RARITY_KEY[skin.rarity])}</span>
        </div>
        {weapon && <span className="hint">{t(weapon.nameKey)}</span>}
        <span className="hint">{bonusText(skin)}</span>
      </div>

      {owned ? (
        <button className="btn btn-block" disabled={equipped} onClick={() => equipSkin(skin.id)}>
          {equipped ? `✓ ${t('skin_equipped')}` : t('skin_equip')}
        </button>
      ) : u.type === 'sparks' ? (
        <button className="btn btn-primary btn-block" disabled={profile.sparks < u.cost} onClick={() => buySkin(skin.id)}>
          <span className="spark-icon" /> {u.cost}
        </button>
      ) : u.type === 'frags' ? (
        <button className="btn btn-primary btn-block" disabled={profile.frags < u.cost} onClick={() => buySkin(skin.id)}>
          ◆ {u.cost}
        </button>
      ) : u.type === 'ads' ? (
        <div className="stack" style={{ gap: 8 }}>
          <div className="skin-progress">
            <span className="mission-bar">
              <i style={{ width: `${Math.min(100, (progress / u.count) * 100)}%` }} />
            </span>
            <span className="hint">{t('skin_progress', { n: progress, max: u.count })}</span>
          </div>
          <AdButton placement="skin_unlock" label={t('skin_watch')} onReward={() => addSkinAd(skin.id)} />
          {isTrialable(skin) &&
            (ads.trial === skin.id ? (
              <p className="hint" style={{ margin: 0, textAlign: 'center' }}>{t('skin_trial_ready')}</p>
            ) : ads.trial ? (
              <p className="hint" style={{ margin: 0, textAlign: 'center' }}>
                {t('skin_trial_active', { name: t(SKIN_BY_ID[ads.trial]?.nameKey ?? skin.nameKey) })}
              </p>
            ) : ads.trialed.includes(skin.id) ? (
              <p className="hint" style={{ margin: 0, textAlign: 'center' }}>{t('skin_trial_used')}</p>
            ) : (
              <AdButton placement="skin_trial" label={t('skin_trial')} onReward={() => armTrial(skin.id)} />
            ))}
        </div>
      ) : u.type === 'boss' ? (
        <p className="hint" style={{ margin: 0, textAlign: 'center' }}>
          {t('skin_boss_locked', { n: u.night })}
        </p>
      ) : (
        <span className="hint">{t('skin_free')}</span>
      )}
    </div>
  );
}
