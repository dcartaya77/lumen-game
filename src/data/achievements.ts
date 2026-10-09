import type { TranslationKey } from '@/i18n';
import type { RunResult } from '@/state/run';
import type { SaveData } from '@/state/save-schema';
import { rewardOf } from './economy';

export interface AchievementDef {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  reward: number;
  /** true si se cumple tras esta partida. */
  check(result: RunResult, save: SaveData): boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'a_first', nameKey: 'ac_first', descKey: 'ac_first_desc', reward: rewardOf('achievements', 'a_first'), check: () => true },
  { id: 'a_win', nameKey: 'ac_win', descKey: 'ac_win_desc', reward: rewardOf('achievements', 'a_win'), check: (r) => r.won },
  { id: 'a_boss', nameKey: 'ac_boss', descKey: 'ac_boss_desc', reward: rewardOf('achievements', 'a_boss'), check: (r) => r.bossKilled },
  { id: 'a_lv15', nameKey: 'ac_lv15', descKey: 'ac_lv15_desc', reward: rewardOf('achievements', 'a_lv15'), check: (r) => r.level >= 15 },
  { id: 'a_k500', nameKey: 'ac_k500', descKey: 'ac_k500_desc', reward: rewardOf('achievements', 'a_k500'), check: (_r, s) => s.stats.kills >= 500 },
  { id: 'a_k2000', nameKey: 'ac_k2000', descKey: 'ac_k2000_desc', reward: rewardOf('achievements', 'a_k2000'), check: (_r, s) => s.stats.kills >= 2000 },
  { id: 'a_e10', nameKey: 'ac_e10', descKey: 'ac_e10_desc', reward: rewardOf('achievements', 'a_e10'), check: (r) => r.elitesKilled >= 4 },
  { id: 'a_evo', nameKey: 'ac_evo', descKey: 'ac_evo_desc', reward: rewardOf('achievements', 'a_evo'), check: (r) => r.evolved },
  { id: 'a_rich', nameKey: 'ac_rich', descKey: 'ac_rich_desc', reward: rewardOf('achievements', 'a_rich'), check: (r) => r.sparks >= 400 },
  { id: 'a_streak3', nameKey: 'ac_streak3', descKey: 'ac_streak3_desc', reward: rewardOf('achievements', 'a_streak3'), check: (_r, s) => s.daily.streak.n >= 3 },
  { id: 'a_streak7', nameKey: 'ac_streak7', descKey: 'ac_streak7_desc', reward: rewardOf('achievements', 'a_streak7'), check: (_r, s) => s.daily.streak.n >= 7 },
  { id: 'a_collector', nameKey: 'ac_collector', descKey: 'ac_collector_desc', reward: rewardOf('achievements', 'a_collector'), check: (_r, s) => s.stats.seen.w.length >= 6 && s.stats.seen.ev.length >= 1 },
];
