// ─── Скрытые достижения ───────────────────────────────────────────────────────
// Списка достижений в обычном интерфейсе нет: пользователь узнаёт о достижении
// только в момент открытия (тост + запись в уведомлениях). Полный список видят
// только создатели в панели разработчика. Прогресс хранится в ls "achUnlocked".

import { Play, Flame, Zap, Trophy, Sparkles, Heart, Music2, Mic2, Gift, Crown } from "./myraIcons";

export interface AchievementCounters {
  totalPlays: number;
  streak: number;
  likedCount: number;
  playlistCount: number;
  releaseCount: number;
  donationCount: number;
  level: number;
}

export const ACHIEVEMENTS = [
  { id: "firstPlay", icon: Play,     key: "ach.firstPlay", need: 1,   of: (c: AchievementCounters) => c.totalPlays },
  { id: "streak7",   icon: Flame,    key: "ach.streak7",   need: 7,   of: (c: AchievementCounters) => c.streak },
  { id: "streak30",  icon: Zap,      key: "ach.streak30",  need: 30,  of: (c: AchievementCounters) => c.streak },
  { id: "streak100", icon: Flame,    key: "ach.streak100", need: 100, of: (c: AchievementCounters) => c.streak },
  { id: "plays100",  icon: Trophy,   key: "ach.plays100",  need: 100, of: (c: AchievementCounters) => c.totalPlays },
  { id: "plays500",  icon: Sparkles, key: "ach.plays500",  need: 500, of: (c: AchievementCounters) => c.totalPlays },
  { id: "plays1000", icon: Trophy,   key: "ach.plays1000", need: 1000, of: (c: AchievementCounters) => c.totalPlays },
  { id: "plays5000", icon: Sparkles, key: "ach.plays5000", need: 5000, of: (c: AchievementCounters) => c.totalPlays },
  { id: "liked10",   icon: Heart,    key: "ach.liked10",   need: 10,  of: (c: AchievementCounters) => c.likedCount },
  { id: "liked50",   icon: Heart,    key: "ach.liked50",   need: 50,  of: (c: AchievementCounters) => c.likedCount },
  { id: "liked100",  icon: Heart,    key: "ach.liked100",  need: 100, of: (c: AchievementCounters) => c.likedCount },
  { id: "playlist1", icon: Music2,   key: "ach.playlist1", need: 1,   of: (c: AchievementCounters) => c.playlistCount },
  { id: "playlist5", icon: Music2,   key: "ach.playlist5", need: 5,   of: (c: AchievementCounters) => c.playlistCount },
  { id: "playlist25",icon: Music2,   key: "ach.playlist25",need: 25,  of: (c: AchievementCounters) => c.playlistCount },
  { id: "release1",  icon: Mic2,     key: "ach.release1",  need: 1,   of: (c: AchievementCounters) => c.releaseCount },
  { id: "release10", icon: Mic2,     key: "ach.release10", need: 10,  of: (c: AchievementCounters) => c.releaseCount },
  { id: "donate1",   icon: Gift,     key: "ach.donate1",   need: 1,   of: (c: AchievementCounters) => c.donationCount },
  { id: "donate10",  icon: Gift,     key: "ach.donate10",  need: 10,  of: (c: AchievementCounters) => c.donationCount },
  { id: "level5",    icon: Crown,    key: "ach.level5",    need: 5,   of: (c: AchievementCounters) => c.level },
  { id: "level10",   icon: Crown,    key: "ach.level10",   need: 10,  of: (c: AchievementCounters) => c.level },
  { id: "level25",   icon: Crown,    key: "ach.level25",   need: 25,  of: (c: AchievementCounters) => c.level },
  { id: "level50",   icon: Crown,    key: "ach.level50",   need: 50,  of: (c: AchievementCounters) => c.level },
  { id: "level100",  icon: Crown,    key: "ach.level100",  need: 100, of: (c: AchievementCounters) => c.level },
  { id: "level250",  icon: Crown,    key: "ach.level250",  need: 250, of: (c: AchievementCounters) => c.level },
  { id: "level500",  icon: Crown,    key: "ach.level500",  need: 500, of: (c: AchievementCounters) => c.level },
] as const;

export type Achievement = typeof ACHIEVEMENTS[number];

/** Список с прогрессом — для панели разработчика */
export function buildAchievements(c: AchievementCounters) {
  return ACHIEVEMENTS.map(a => {
    const have = a.of(c);
    return { ...a, have, done: have >= a.need, pct: Math.min(100, Math.round((have / a.need) * 100)) };
  });
}
