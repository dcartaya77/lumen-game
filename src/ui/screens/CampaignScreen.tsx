import { useEffect, useRef, useState } from 'react';
import { BOSS_NIGHTS, bossBit, CAMPAIGN_NIGHTS, CAMPAIGN_TIERS, isBossNight, planNight, tierOf } from '@/data/campaign';
import { bossIdFor, bossNameKey } from '@/data/bosses';
import { MAP_BY_ID } from '@/data/maps';
import { RARITY_COLORS, RARITY_KEYS, type TalismanRarity } from '@/data/minibosses';
import { TALISMANS, talismanKey } from '@/data/talismans';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { bossTuning, resetBossTuning, setBossTuning } from '@/state/debug';
import { useApp } from '@/state/store';
import { addTalisman } from '@/state/talismanActions';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Mapa de la campaña: 25 noches en 5 tramos de 5, con las noches de jefe destacadas. */
export function CampaignScreen() {
  const go = useApp((s) => s.go);
  const beginNight = useApp((s) => s.beginNight);
  const profile = useApp((s) => s.profile);
  const campaign = useApp((s) => s.campaign);
  const debug = useApp((s) => s.debug);
  const debugSetNext = useApp((s) => s.debugSetNext);
  const [picked, setPicked] = useState<number | null>(null);
  const [dbgRarity, setDbgRarity] = useState<TalismanRarity>(0);
  const [, refresh] = useState(0);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    tg.backButton.show(() => go('menu'));
    return () => tg.backButton.hide();
  }, [go]);

  // Al abrir, la noche actual queda centrada en pantalla.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  if (!profile || !campaign) return null;

  const next = campaign.next;
  const selected = picked ?? Math.min(next, CAMPAIGN_NIGHTS);
  const replay = selected < next;
  const plan = planNight(selected, replay);
  const map = MAP_BY_ID[plan.tier.mapId];
  const tune = bossTuning();
  const bossId = bossIdFor(selected);
  const finished = (campaign.bosses & bossBit(CAMPAIGN_NIGHTS)) !== 0;
  const tweak = (t: Parameters<typeof setBossTuning>[0]) => {
    setBossTuning(t);
    refresh((n) => n + 1);
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('campaign')} sparks={profile.sparks} />
      {next > CAMPAIGN_NIGHTS && <p className="ready-note" style={{ marginBottom: 8 }}>{t('campaign_done')}</p>}
      {finished && (
        <button className="btn btn-block" style={{ marginBottom: 8 }} onClick={() => go('ending')}>
          {t('ending_see')}
        </button>
      )}
      <div className="stack scrollable" style={{ gap: 18 }}>
        {CAMPAIGN_TIERS.map((tier) => {
          const m = MAP_BY_ID[tier.mapId];
          const nights = Array.from({ length: tier.to - tier.from + 1 }, (_, i) => tier.from + i);
          return (
            <section key={tier.id} className="camp-tier" style={{ ['--c' as string]: hex(m?.glow ?? 0xffa640) }}>
              <header className="camp-tier-head">
                <strong>{m ? t(m.nameKey) : tier.id}</strong>
                <span className="hint">{t('night_range', { a: tier.from, b: tier.to })}</span>
              </header>
              <div className={tier.index % 2 === 1 ? 'camp-row rev' : 'camp-row'}>
                {nights.map((n) => {
                  const locked = n > next;
                  const stars = Number(campaign.stars[n - 1] ?? '0');
                  const cls = [
                    'camp-node',
                    isBossNight(n) ? 'boss' : '',
                    locked ? 'locked' : n === next ? 'current' : 'done',
                    n === selected ? 'sel' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <button
                      key={n}
                      ref={n === selected ? selectedRef : undefined}
                      className={cls}
                      disabled={locked}
                      aria-label={t('campaign_night', { n })}
                      onClick={() => {
                        tg.haptic.select();
                        setPicked(n);
                      }}
                    >
                      <span className="camp-num">{isBossNight(n) ? '👑' : locked ? '🔒' : n}</span>
                      {!locked && n < next && <span className="camp-stars-mini">{'★'.repeat(stars)}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {debug && (
          <div className="panel">
            <div className="panel-title">DEBUG · next = {next}</div>
            <div className="audio-row" style={{ marginTop: 0 }}>
              <button className="btn" onClick={() => debugSetNext(next - 1)}>
                −1
              </button>
              <button className="btn" onClick={() => debugSetNext(next + 1)}>
                +1
              </button>
              <button className="btn" onClick={() => debugSetNext(CAMPAIGN_NIGHTS + 1)}>
                All
              </button>
              <button className="btn" onClick={() => debugSetNext(1)}>
                Reset
              </button>
            </div>
            <p className="hint" style={{ margin: '8px 0 0' }}>
              {BOSS_NIGHTS.join(', ')} · hp ×{plan.mods.enemyHp.toFixed(2)} · speed ×{plan.mods.enemySpeed.toFixed(2)} · count ×
              {plan.mods.spawnRate.toFixed(2)} · sparks ×{plan.sparkMult.toFixed(2)} · {tierOf(selected).id}
            </p>
            <div className="audio-row" style={{ marginTop: 8 }}>
              {([0, 1, 2, 3] as const).map((r) => (
                <button
                  key={r}
                  className={dbgRarity === r ? 'btn' : 'btn off'}
                  style={dbgRarity === r ? { color: hex(RARITY_COLORS[r]!), boxShadow: `inset 0 0 0 2px ${hex(RARITY_COLORS[r]!)}` } : undefined}
                  onClick={() => setDbgRarity(r)}
                >
                  {t(RARITY_KEYS[r])}
                </button>
              ))}
            </div>
            <div className="audio-row" style={{ marginTop: 8 }}>
              {TALISMANS.map((d) => {
                const owned = campaign.tal[talismanKey(d.id, dbgRarity)] ?? 0;
                return (
                  <button
                    key={d.id}
                    className="btn"
                    style={{ boxShadow: `inset 0 0 0 1px ${hex(RARITY_COLORS[dbgRarity]!)}` }}
                    onClick={() => addTalisman(talismanKey(d.id, dbgRarity), 'debug')}
                  >
                    +{d.icon}
                    {owned > 0 && <small> ×{owned}</small>}
                  </button>
                );
              })}
            </div>
            <div className="panel-title" style={{ marginTop: 10 }}>
              Vida del jefe = k × DPS^exp
            </div>
            <div className="audio-row" style={{ marginTop: 4 }}>
              <button className="btn" onClick={() => tweak({ exp: tune.exp - 0.05 })}>
                exp −
              </button>
              <span className="pill">{tune.exp.toFixed(2)}</span>
              <button className="btn" onClick={() => tweak({ exp: tune.exp + 0.05 })}>
                exp +
              </button>
            </div>
            <div className="audio-row" style={{ marginTop: 4 }}>
              <button className="btn" onClick={() => tweak({ k: tune.k * 0.9 })}>
                k −10%
              </button>
              <span className="pill">{tune.k}</span>
              <button className="btn" onClick={() => tweak({ k: tune.k * 1.1 })}>
                k +10%
              </button>
              <button
                className="btn"
                onClick={() => {
                  resetBossTuning();
                  refresh((n) => n + 1);
                }}
              >
                JSON
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="panel camp-detail">
        <div className="camp-detail-head">
          <strong>{t('campaign_night', { n: selected })}</strong>
          {plan.boss && <span className="upgrade-tag">{bossId ? t(bossNameKey(bossId)) : t('night_boss')}</span>}
          <span className="hint">{map ? t(map.nameKey) : ''}</span>
        </div>
        <p className="hint" style={{ margin: '4px 0 10px' }}>
          {replay ? t('night_replay_hint') : t('night_stars_hint', { a: plan.starKills[0], b: plan.starKills[1] })}
        </p>
        <button className="btn btn-primary btn-block" onClick={() => beginNight(selected)}>
          {replay ? t('night_replay', { n: selected }) : t('night_play', { n: selected })}
        </button>
      </div>
    </div>
  );
}
