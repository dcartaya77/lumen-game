import { useEffect } from 'react';
import { BOSS_NIGHTS, bossBit, CAMPAIGN_NIGHTS } from '@/data/campaign';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { useApp } from '@/state/store';

/** Final de la campaña: el amanecer y una tarjeta de victoria con el resumen y un botón para compartirla. */
export function EndingScreen() {
  const go = useApp((s) => s.go);
  const campaign = useApp((s) => s.campaign);
  const stats = useApp((s) => s.stats);

  useEffect(() => {
    tg.backButton.show(() => go('campaign'));
    return () => tg.backButton.hide();
  }, [go]);

  if (!campaign || !stats) return null;

  const nights = Math.min(CAMPAIGN_NIGHTS, campaign.next - 1);
  const stars = [...campaign.stars].reduce((n, c) => n + Number(c), 0);
  const bosses = BOSS_NIGHTS.filter((n) => campaign.bosses & bossBit(n)).length;

  return (
    <div className="screen ending">
      <div className="ending-sun" aria-hidden />
      <h1 className="ending-title">{t('ending_title')}</h1>
      <div className="ending-text">
        <p>{t('ending_p1')}</p>
        <p>{t('ending_p2')}</p>
        <p className="ending-teaser">{t('ending_p3')}</p>
      </div>
      <div className="panel ending-card">
        <div className="panel-title">{t('ending_card')}</div>
        <div className="row">
          <span>{t('ending_nights')}</span>
          <strong>
            {nights}/{CAMPAIGN_NIGHTS}
          </strong>
        </div>
        <div className="row">
          <span>{t('ending_stars')}</span>
          <strong>
            ★ {stars}/{CAMPAIGN_NIGHTS * 3}
          </strong>
        </div>
        <div className="row">
          <span>{t('ending_bosses')}</span>
          <strong>
            {bosses}/{BOSS_NIGHTS.length}
          </strong>
        </div>
        <div className="row">
          <span>{t('ending_kills')}</span>
          <strong>{stats.kills.toLocaleString()}</strong>
        </div>
      </div>
      <div className="stack" style={{ marginTop: 'auto' }}>
        <button
          className="btn btn-primary btn-block"
          onClick={() => tg.share(tg.appLink(), t('ending_share_text', { n: nights, s: stars }))}
        >
          {t('ending_share')}
        </button>
        <button className="btn btn-block" onClick={() => go('campaign')}>
          {t('continue')}
        </button>
      </div>
    </div>
  );
}
