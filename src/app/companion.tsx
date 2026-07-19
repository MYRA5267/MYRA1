import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { BadgeCheck, Check, ChevronRight, Gift, Heart, Lock, Music2, Send, Sparkles, X } from "./myraIcons";
import { ls, type Track } from "./data";
import { F, Sheet } from "./lib";
import { useLang, type Lang } from "./i18n";

export type CompanionId = "luma" | "spark" | "echo";
export type ResonanceId = "first-wave" | "discovery-drop" | "genre-prism" | "night-star" | "pulse-heart" | "aurora-crown";

export interface CompanionDailyState {
  date: string;
  trackIds: number[];
  genres: string[];
  liked: boolean;
  claimed: boolean;
}

export interface CompanionState {
  selectedId: CompanionId | null;
  xp: number;
  playedTrackIds: number[];
  discoveredGenres: string[];
  unlockedGiftIds: ResonanceId[];
  showcasedGiftId: ResonanceId | null;
  lastTrackId: number | null;
  lastRewardAt: number;
  lastBondAt: number;
  daily: CompanionDailyState;
}

export interface CompanionDefinition {
  id: CompanionId;
  name: string;
  image: string;
  accent: string;
  accent2: string;
  copy: Record<Lang, { character: string; ability: string }>;
}

export interface ResonanceDefinition {
  id: ResonanceId;
  name: Record<Lang, string>;
  hint: Record<Lang, string>;
  accent: string;
  kind: "wave" | "drop" | "prism" | "star" | "heart" | "crown";
  needXp?: number;
  needGenres?: number;
}

export const COMPANIONS: CompanionDefinition[] = [
  {
    id: "luma",
    name: "Люма",
    image: "/companions/luma.webp",
    accent: "#f4a77f",
    accent2: "#c98cff",
    copy: {
      ru: { character: "Тёплая и любопытная", ability: "Находит музыку между знакомыми настроениями" },
      en: { character: "Warm and curious", ability: "Finds music between familiar moods" },
    },
  },
  {
    id: "spark",
    name: "Искра",
    image: "/companions/spark.webp",
    accent: "#ff8b5d",
    accent2: "#ff4f91",
    copy: {
      ru: { character: "Смелая и быстрая", ability: "Чувствует сильный ритм и заряжает Течение" },
      en: { character: "Bold and fast", ability: "Feels strong rhythm and energizes your Current" },
    },
  },
  {
    id: "echo",
    name: "Эхо",
    image: "/companions/echo.webp",
    accent: "#9a8cff",
    accent2: "#68b8ff",
    copy: {
      ru: { character: "Спокойный и глубокий", ability: "Собирает ночные и атмосферные открытия" },
      en: { character: "Calm and deep", ability: "Collects nocturnal and atmospheric discoveries" },
    },
  },
];

export const RESONANCES: ResonanceDefinition[] = [
  {
    id: "first-wave",
    name: { ru: "Первая волна", en: "First wave" },
    hint: { ru: "Подарок за встречу со спутником", en: "A gift for meeting your companion" },
    accent: "#f4a77f",
    kind: "wave",
    needXp: 0,
  },
  {
    id: "discovery-drop",
    name: { ru: "Капля открытия", en: "Discovery drop" },
    hint: { ru: "Откроется на 48 энергии", en: "Unlocks at 48 energy" },
    accent: "#67d7ff",
    kind: "drop",
    needXp: 48,
  },
  {
    id: "genre-prism",
    name: { ru: "Призма жанров", en: "Genre prism" },
    hint: { ru: "Открой 3 разных жанра", en: "Discover 3 different genres" },
    accent: "#b59cff",
    kind: "prism",
    needGenres: 3,
  },
  {
    id: "night-star",
    name: { ru: "Ночная звезда", en: "Night star" },
    hint: { ru: "Откроется на 120 энергии", en: "Unlocks at 120 energy" },
    accent: "#8e85ff",
    kind: "star",
    needXp: 120,
  },
  {
    id: "pulse-heart",
    name: { ru: "Живой пульс", en: "Living pulse" },
    hint: { ru: "Откроется на 220 энергии", en: "Unlocks at 220 energy" },
    accent: "#ff789e",
    kind: "heart",
    needXp: 220,
  },
  {
    id: "aurora-crown",
    name: { ru: "Корона сияния", en: "Aurora crown" },
    hint: { ru: "Откроется на 400 энергии", en: "Unlocks at 400 energy" },
    accent: "#ffd28a",
    kind: "crown",
    needXp: 400,
  },
];

export const EMPTY_COMPANION_STATE: CompanionState = {
  selectedId: null,
  xp: 0,
  playedTrackIds: [],
  discoveredGenres: [],
  unlockedGiftIds: [],
  showcasedGiftId: null,
  lastTrackId: null,
  lastRewardAt: 0,
  lastBondAt: 0,
  daily: { date: "", trackIds: [], genres: [], liked: false, claimed: false },
};

const LEVELS = [0, 60, 150, 300, 520];
const REPEAT_REWARD_COOLDOWN = 15 * 60 * 1000;
const BOND_COOLDOWN = 20 * 60 * 60 * 1000;
const DAILY_RITUAL_REWARD = 30;

function dateKey(now: number) {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function normalizeDaily(value: unknown): CompanionDailyState {
  if (!value || typeof value !== "object") return { ...EMPTY_COMPANION_STATE.daily };
  const raw = value as Partial<CompanionDailyState>;
  return {
    date: typeof raw.date === "string" ? raw.date : "",
    trackIds: Array.isArray(raw.trackIds) ? raw.trackIds.filter(Number.isFinite).slice(-12) : [],
    genres: Array.isArray(raw.genres) ? raw.genres.filter((genre): genre is string => typeof genre === "string").slice(-8) : [],
    liked: raw.liked === true,
    claimed: raw.claimed === true,
  };
}

function rollDaily(state: CompanionState, now: number): CompanionState {
  const today = dateKey(now);
  if (state.daily.date === today) return state;
  return { ...state, daily: { date: today, trackIds: [], genres: [], liked: false, claimed: false } };
}

function isCompanionId(value: unknown): value is CompanionId {
  return value === "luma" || value === "spark" || value === "echo";
}

function isResonanceId(value: unknown): value is ResonanceId {
  return RESONANCES.some(gift => gift.id === value);
}

export function normalizeCompanionState(value: unknown): CompanionState {
  if (!value || typeof value !== "object") return EMPTY_COMPANION_STATE;
  const raw = value as Partial<CompanionState>;
  return {
    selectedId: isCompanionId(raw.selectedId) ? raw.selectedId : null,
    xp: Math.max(0, Number.isFinite(raw.xp) ? Number(raw.xp) : 0),
    playedTrackIds: Array.isArray(raw.playedTrackIds) ? raw.playedTrackIds.filter(Number.isFinite).slice(-160) : [],
    discoveredGenres: Array.isArray(raw.discoveredGenres) ? raw.discoveredGenres.filter((genre): genre is string => typeof genre === "string").slice(-40) : [],
    unlockedGiftIds: Array.isArray(raw.unlockedGiftIds) ? raw.unlockedGiftIds.filter(isResonanceId) : [],
    showcasedGiftId: isResonanceId(raw.showcasedGiftId) ? raw.showcasedGiftId : null,
    lastTrackId: Number.isFinite(raw.lastTrackId) ? Number(raw.lastTrackId) : null,
    lastRewardAt: Number.isFinite(raw.lastRewardAt) ? Number(raw.lastRewardAt) : 0,
    lastBondAt: Number.isFinite(raw.lastBondAt) ? Number(raw.lastBondAt) : 0,
    daily: normalizeDaily(raw.daily),
  };
}

function eligibleGifts(state: CompanionState): ResonanceId[] {
  if (!state.selectedId) return [];
  return RESONANCES.filter(gift => {
    const xpReady = gift.needXp === undefined || state.xp >= gift.needXp;
    const genresReady = gift.needGenres === undefined || state.discoveredGenres.length >= gift.needGenres;
    return xpReady && genresReady;
  }).map(gift => gift.id);
}

function withEligibleGifts(state: CompanionState): CompanionState {
  const unlocked = new Set(state.unlockedGiftIds);
  eligibleGifts(state).forEach(id => unlocked.add(id));
  return { ...state, unlockedGiftIds: [...unlocked] };
}

export function selectCompanionState(state: CompanionState, id: CompanionId): CompanionState {
  if (state.selectedId) return state;
  return withEligibleGifts({
    ...state,
    selectedId: id,
    unlockedGiftIds: state.unlockedGiftIds.includes("first-wave") ? state.unlockedGiftIds : [...state.unlockedGiftIds, "first-wave"],
    showcasedGiftId: state.showcasedGiftId ?? "first-wave",
  });
}

export function rewardCompanionForPlay(state: CompanionState, track: Pick<Track, "id" | "genre">, now = Date.now()): CompanionState {
  if (!state.selectedId) return state;
  const rolled = rollDaily(state, now);
  const firstTrackPlay = !rolled.playedTrackIds.includes(track.id);
  const genre = track.genre.trim();
  const firstGenre = !!genre && !rolled.discoveredGenres.some(item => item.toLocaleLowerCase() === genre.toLocaleLowerCase());
  const repeatRewardReady = now - rolled.lastRewardAt >= REPEAT_REWARD_COOLDOWN;
  const gained = (firstTrackPlay ? 12 : repeatRewardReady ? 2 : 0) + (firstGenre ? 16 : 0);
  const dailyTrackIds = rolled.daily.trackIds.includes(track.id) ? rolled.daily.trackIds : [...rolled.daily.trackIds, track.id].slice(-12);
  const dailyGenres = !genre || rolled.daily.genres.some(item => item.toLocaleLowerCase() === genre.toLocaleLowerCase())
    ? rolled.daily.genres
    : [...rolled.daily.genres, genre].slice(-8);

  return withEligibleGifts({
    ...rolled,
    xp: rolled.xp + gained,
    playedTrackIds: firstTrackPlay ? [...rolled.playedTrackIds, track.id].slice(-160) : rolled.playedTrackIds,
    discoveredGenres: firstGenre ? [...rolled.discoveredGenres, genre].slice(-40) : rolled.discoveredGenres,
    lastTrackId: track.id,
    lastRewardAt: gained > 0 ? now : rolled.lastRewardAt,
    daily: { ...rolled.daily, trackIds: dailyTrackIds, genres: dailyGenres },
  });
}

export function recordCompanionLike(state: CompanionState, now = Date.now()): CompanionState {
  if (!state.selectedId) return state;
  const rolled = rollDaily(state, now);
  if (rolled.daily.liked) return rolled;
  return { ...rolled, daily: { ...rolled.daily, liked: true } };
}

export function dailyRitualProgress(state: CompanionState, now = Date.now()) {
  const daily = state.daily.date === dateKey(now) ? state.daily : EMPTY_COMPANION_STATE.daily;
  const tasks = [daily.trackIds.length >= 3, daily.genres.length >= 2, daily.liked];
  return {
    tasks,
    completed: tasks.filter(Boolean).length,
    ready: tasks.every(Boolean),
    claimed: daily.claimed,
    trackCount: daily.trackIds.length,
    genreCount: daily.genres.length,
  };
}

export function claimCompanionRitual(state: CompanionState, now = Date.now()): CompanionState {
  if (!state.selectedId) return state;
  const rolled = rollDaily(state, now);
  const ritual = dailyRitualProgress(rolled, now);
  if (!ritual.ready || ritual.claimed) return rolled;
  return withEligibleGifts({
    ...rolled,
    xp: rolled.xp + DAILY_RITUAL_REWARD,
    daily: { ...rolled.daily, claimed: true },
  });
}

export function bondCompanionState(state: CompanionState, now = Date.now()): CompanionState {
  if (!state.selectedId || now - state.lastBondAt < BOND_COOLDOWN) return state;
  return withEligibleGifts({ ...state, xp: state.xp + 6, lastBondAt: now });
}

export function companionLevel(xp: number) {
  let index = 0;
  while (index < LEVELS.length - 1 && xp >= LEVELS[index + 1]) index += 1;
  const start = LEVELS[index];
  const next = LEVELS[index + 1] ?? LEVELS[index] + 300;
  return {
    level: index + 1,
    start,
    next,
    progress: Math.max(0, Math.min(1, (xp - start) / Math.max(1, next - start))),
  };
}

function loadCompanionState() {
  return normalizeCompanionState(ls.get<unknown>("companion", EMPTY_COMPANION_STATE));
}

export function useCompanion() {
  const { lang } = useLang();
  const [state, setState] = useState<CompanionState>(loadCompanionState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const commit = useCallback((next: CompanionState) => {
    stateRef.current = next;
    setState(next);
    ls.set("companion", next);
  }, []);

  const select = useCallback((id: CompanionId) => {
    const previous = stateRef.current;
    if (previous.selectedId) {
      toast(lang === "ru" ? "Спутник уже связан с твоим профилем" : "A companion is already bonded to your profile");
      return false;
    }
    const next = selectCompanionState(previous, id);
    commit(next);
    const companion = COMPANIONS.find(item => item.id === id)!;
    toast.success(lang === "ru" ? `${companion.name} теперь рядом` : `${companion.name} is now with you`);
    return true;
  }, [commit, lang]);

  const recordPlay = useCallback((track: Pick<Track, "id" | "genre">) => {
    const previous = stateRef.current;
    const next = rewardCompanionForPlay(previous, track);
    if (next === previous) return;
    commit(next);
    const unlocked = next.unlockedGiftIds.find(id => !previous.unlockedGiftIds.includes(id));
    if (unlocked) {
      const gift = RESONANCES.find(item => item.id === unlocked)!;
      toast.success(lang === "ru" ? `Новый артефакт: ${gift.name.ru}` : `New artifact: ${gift.name.en}`);
    }
  }, [commit, lang]);

  const recordLike = useCallback(() => {
    const previous = stateRef.current;
    const next = recordCompanionLike(previous);
    if (next === previous) return;
    commit(next);
  }, [commit]);

  const bond = useCallback(() => {
    const previous = stateRef.current;
    const next = bondCompanionState(previous);
    if (next.lastBondAt === previous.lastBondAt) {
      toast(lang === "ru" ? "Волна уже откликнулась сегодня" : "The wave has already answered today");
      return false;
    }
    commit(next);
    toast.success(lang === "ru" ? "+6 энергии связи" : "+6 bond energy");
    return true;
  }, [commit, lang]);

  const showcase = useCallback((id: ResonanceId) => {
    const previous = stateRef.current;
    if (!previous.unlockedGiftIds.includes(id)) return;
    commit({ ...previous, showcasedGiftId: id });
  }, [commit]);

  const claimRitual = useCallback(() => {
    const previous = stateRef.current;
    const next = claimCompanionRitual(previous);
    if (next === previous || next.daily.claimed === previous.daily.claimed) return false;
    commit(next);
    toast.success(lang === "ru" ? `Ритуал завершён · +${DAILY_RITUAL_REWARD} энергии` : `Ritual complete · +${DAILY_RITUAL_REWARD} energy`);
    return true;
  }, [commit, lang]);

  const companion = useMemo(
    () => COMPANIONS.find(item => item.id === state.selectedId) ?? null,
    [state.selectedId],
  );
  const ritual = useMemo(() => dailyRitualProgress(state), [state]);

  return useMemo(
    () => ({ state, companion, ritual, select, recordPlay, recordLike, bond, showcase, claimRitual }),
    [state, companion, ritual, select, recordPlay, recordLike, bond, showcase, claimRitual],
  );
}

export type CompanionController = ReturnType<typeof useCompanion>;

const UI = {
  ru: {
    eyebrow: "ЖИВОЙ СПУТНИК",
    chooseTitle: "Кто услышит музыку вместе с тобой?",
    chooseSub: "Спутник растёт из твоего вкуса, реагирует на треки и собирает редкие артефакты.",
    choose: "Выбрать",
    choiceWarning: "Выбор закрепится за профилем. Спутника нельзя будет заменить — зато его характер и форма будут развиваться вместе с тобой.",
    confirmChoice: "Связать навсегда",
    cancelChoice: "Ещё подумать",
    permanent: "Единственный спутник профиля",
    companion: "Спутник MYRA",
    meet: "Познакомиться",
    level: "уровень",
    energy: "энергии",
    collection: "Артефакты",
    collectionSub: "Редкие знаки музыкальных открытий",
    touch: "Позвать в полёт",
    flow: "Слушать вместе",
    listening: "чувствует этот трек",
    resting: "ждёт новую музыку",
    showcase: "На витрине",
    putShowcase: "На витрину",
    locked: "Ещё не найден",
    close: "Закрыть",
    bond: "Связь",
    ritual: "Ритуал дня",
    ritualSub: "Небольшой путь без серий и наказаний",
    ritualTracks: "Послушать 3 разных трека",
    ritualGenres: "Услышать 2 разных жанра",
    ritualLike: "Сохранить один трек",
    ritualClaim: "Принять 30 энергии",
    ritualClaimed: "Ритуал завершён",
    ritualLocked: "Заверши все три шага",
    memory: "Память спутника",
    tracks: "треков",
    genres: "жанров",
    gifts: "артефактов",
  },
  en: {
    eyebrow: "LIVING COMPANION",
    chooseTitle: "Who will hear the music with you?",
    chooseSub: "Your companion grows from your taste, reacts to tracks and gathers rare resonances.",
    choose: "Choose",
    choiceWarning: "This choice is bound to your profile. Your companion cannot be replaced — its character and form will evolve with you instead.",
    confirmChoice: "Bond forever",
    cancelChoice: "Think again",
    permanent: "Your profile's one companion",
    companion: "MYRA companion",
    meet: "Meet yours",
    level: "level",
    energy: "energy",
    collection: "Artifacts",
    collectionSub: "Rare marks of musical discovery",
    touch: "Call to flight",
    flow: "Listen together",
    listening: "feels this track",
    resting: "awaits new music",
    showcase: "Showcased",
    putShowcase: "Showcase",
    locked: "Not found yet",
    close: "Close",
    bond: "Bond",
    ritual: "Daily ritual",
    ritualSub: "A small path without streaks or punishment",
    ritualTracks: "Hear 3 different tracks",
    ritualGenres: "Hear 2 different genres",
    ritualLike: "Save one track",
    ritualClaim: "Receive 30 energy",
    ritualClaimed: "Ritual complete",
    ritualLocked: "Complete all three steps",
    memory: "Companion memory",
    tracks: "tracks",
    genres: "genres",
    gifts: "artifacts",
  },
} as const;

function companionMood(id: CompanionId, genre: string, playing: boolean, lang: Lang) {
  if (!playing) {
    const night = new Date().getHours() >= 23 || new Date().getHours() < 6;
    if (lang === "ru") return night ? "дремлет в ночном свете" : "бережёт энергию до следующего трека";
    return night ? "dozes in the night light" : "saves energy for the next track";
  }
  const value = genre.toLocaleLowerCase();
  const energetic = /hip|rock|dance|electro|house|drum|pop/.test(value);
  const calm = /ambient|lo-fi|jazz|class|soul|chill/.test(value);
  const ru = id === "spark"
    ? energetic ? "разгоняет ритм и оставляет огненный след" : "учится слышать тишину между ударами"
    : id === "echo"
      ? calm ? "раскрывает вокруг трека глубокие круги" : "превращает ритм в световые волны"
      : calm ? "собирает мягкие оттенки этой мелодии" : "летит следом за пульсом трека";
  const en = id === "spark"
    ? energetic ? "accelerates the beat and leaves a trail of fire" : "learns the silence between each beat"
    : id === "echo"
      ? calm ? "opens deep circles around the track" : "turns the rhythm into waves of light"
      : calm ? "gathers the soft colors of this melody" : "flies along the track's pulse";
  return lang === "ru" ? ru : en;
}

function CompanionPortrait({ companion, playing, size = "medium", gift, reactionKey, arriving = false }: {
  companion: CompanionDefinition;
  playing: boolean;
  size?: "small" | "medium" | "large";
  gift?: ResonanceId | null;
  reactionKey?: number;
  arriving?: boolean;
}) {
  const giftDef = RESONANCES.find(item => item.id === gift);
  const previousReaction = useRef(reactionKey);
  const [reacting, setReacting] = useState(false);
  useEffect(() => {
    if (reactionKey === undefined || previousReaction.current === reactionKey) return;
    previousReaction.current = reactionKey;
    setReacting(true);
    const timer = window.setTimeout(() => setReacting(false), 1050);
    return () => window.clearTimeout(timer);
  }, [reactionKey]);
  return (
    <div
      className={`myra-companion-portrait myra-companion-portrait--${size}${playing ? " is-playing" : ""}${reacting ? " is-track-reacting" : ""}${arriving ? " is-arriving" : ""}`}
      style={{ "--companion-accent": companion.accent, "--companion-accent-2": companion.accent2 } as React.CSSProperties}
    >
      <span className="myra-companion-orbit" aria-hidden="true" />
      <img src={companion.image} alt={companion.name} loading={size === "large" ? "eager" : "lazy"} decoding="async" />
      {giftDef && <span className={`myra-companion-showcase myra-gift--${giftDef.kind}`} style={{ "--gift-accent": giftDef.accent } as React.CSSProperties}><i /></span>}
      <span className="myra-companion-pulse" aria-hidden="true" />
    </div>
  );
}

export function CompanionHomeCard({ controller, playing, genre, trackId, onOpen }: {
  controller: CompanionController;
  playing: boolean;
  genre: string;
  trackId: number;
  onOpen: () => void;
}) {
  const { lang } = useLang();
  const copy = UI[lang];
  const { companion, state } = controller;
  const level = companionLevel(state.xp);

  if (!companion) {
    return (
      <motion.button whileTap={{ scale: 0.985 }} onClick={onOpen} className="myra-companion-invite" aria-label={copy.meet}>
        <div className="myra-companion-invite-copy">
          <span>{copy.eyebrow}</span>
          <strong>{copy.companion}</strong>
          <p>{copy.chooseSub}</p>
          <i>{copy.meet}<ChevronRight size={14} /></i>
        </div>
        <CompanionPortrait companion={COMPANIONS[0]} playing={false} size="medium" />
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onOpen}
      className="myra-companion-home-card"
      style={{ "--companion-accent": companion.accent, "--companion-accent-2": companion.accent2 } as React.CSSProperties}
    >
      <CompanionPortrait companion={companion} playing={playing} size="medium" gift={state.showcasedGiftId} reactionKey={trackId} />
      <div className="myra-companion-home-copy">
        <span>{copy.eyebrow}</span>
        <strong>{companion.name}</strong>
        <p>{companionMood(companion.id, genre, playing, lang)}</p>
        <div className="myra-companion-mini-progress"><i style={{ transform: `scaleX(${level.progress})` }} /></div>
        <small>{copy.bond} · {copy.level} {level.level} · {copy.ritual} {controller.ritual.completed}/3</small>
      </div>
      <ChevronRight size={17} className="myra-companion-chevron" />
    </motion.button>
  );
}

export function CompanionProfileCard({ controller, playing, trackId, onOpen }: {
  controller: CompanionController;
  playing: boolean;
  trackId: number;
  onOpen: () => void;
}) {
  const { lang } = useLang();
  const copy = UI[lang];
  const { companion, state } = controller;
  const chosen = companion ?? COMPANIONS[0];
  const level = companionLevel(state.xp);
  return (
    <motion.button whileTap={{ scale: 0.985 }} onClick={onOpen} className="myra-companion-profile-card" style={{ "--companion-accent": chosen.accent } as React.CSSProperties}>
      <CompanionPortrait companion={chosen} playing={playing && !!companion} size="small" gift={state.showcasedGiftId} reactionKey={trackId} />
      <div>
        <span>{copy.companion}</span>
        <strong>{companion ? companion.name : copy.meet}</strong>
        <p>{companion ? `${copy.level} ${level.level} · ${state.unlockedGiftIds.length}/${RESONANCES.length} ${copy.collection.toLocaleLowerCase()}` : copy.chooseSub}</p>
      </div>
      <ChevronRight size={17} />
    </motion.button>
  );
}

export function GiftVisual({ gift, unlocked }: { gift: ResonanceDefinition; unlocked: boolean }) {
  return (
    <div className={`myra-resonance-visual myra-gift--${gift.kind}${unlocked ? " is-unlocked" : ""}`} style={{ "--gift-accent": gift.accent } as React.CSSProperties}>
      <i />
      {!unlocked && <Lock size={13} />}
    </div>
  );
}

export function CompanionSheet({ open, onClose, controller, playing, genre, trackId, onStartFlow }: {
  open: boolean;
  onClose: () => void;
  controller: CompanionController;
  playing: boolean;
  genre: string;
  trackId: number;
  onStartFlow: () => void;
}) {
  const { lang } = useLang();
  const copy = UI[lang];
  const { state, companion, ritual, select, bond, claimRitual } = controller;
  const [choosing, setChoosing] = useState(!companion);
  const [pendingChoice, setPendingChoice] = useState<CompanionId | null>(null);
  const [justSelected, setJustSelected] = useState(false);
  const [touched, setTouched] = useState(false);
  const level = companionLevel(state.xp);

  useEffect(() => {
    if (!open) {
      setChoosing(false);
      setPendingChoice(null);
      setJustSelected(false);
      setTouched(false);
    } else if (!companion) {
      setChoosing(true);
    }
  }, [open, companion]);

  const confirmChoice = () => {
    if (!pendingChoice || !select(pendingChoice)) return;
    setJustSelected(true);
    setPendingChoice(null);
    setChoosing(false);
    window.setTimeout(() => setJustSelected(false), 1300);
  };

  const touch = () => {
    setTouched(true);
    bond();
    window.setTimeout(() => setTouched(false), 1150);
  };

  return (
    <Sheet open={open} onClose={onClose} z={75} wide>
      <div className="myra-companion-sheet">
        <div className="myra-companion-sheet-head">
          <div>
            <span>{copy.eyebrow}</span>
            <strong>{choosing || !companion ? copy.chooseTitle : companion.name}</strong>
            {companion && !choosing && <small>{copy.permanent}</small>}
          </div>
          <button onClick={onClose} aria-label={copy.close}><X size={18} /></button>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {choosing || !companion ? (
            <motion.div key="choose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="myra-companion-chooser">
              <p className="myra-companion-chooser-intro">{copy.chooseSub}</p>
              <div className="myra-companion-choice-grid">
                {COMPANIONS.map(item => (
                  <button key={item.id} onClick={() => setPendingChoice(item.id)} className={`myra-companion-choice${pendingChoice === item.id ? " is-pending" : ""}`} style={{ "--companion-accent": item.accent, "--companion-accent-2": item.accent2 } as React.CSSProperties}>
                    <CompanionPortrait companion={item} playing={false} size="large" />
                    <span>{item.copy[lang].character}</span>
                    <strong>{item.name}</strong>
                    <p>{item.copy[lang].ability}</p>
                    <i>{copy.choose}<ChevronRight size={13} /></i>
                  </button>
                ))}
              </div>
              <AnimatePresence>
                {pendingChoice && (() => {
                  const pending = COMPANIONS.find(item => item.id === pendingChoice)!;
                  return (
                    <motion.div className="myra-companion-confirm" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }}>
                      <CompanionPortrait companion={pending} playing={false} size="small" />
                      <div><strong>{pending.name}</strong><p>{copy.choiceWarning}</p></div>
                      <div className="myra-companion-confirm-actions">
                        <button onClick={() => setPendingChoice(null)}>{copy.cancelChoice}</button>
                        <button onClick={confirmChoice}>{copy.confirmChoice}</button>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div key="companion" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <section className={`myra-companion-stage${touched ? " is-touched" : ""}`} style={{ "--companion-accent": companion.accent, "--companion-accent-2": companion.accent2 } as React.CSSProperties}>
                <div className="myra-companion-stage-glow" aria-hidden="true" />
                <CompanionPortrait companion={companion} playing={playing} size="large" gift={state.showcasedGiftId} reactionKey={trackId} arriving={justSelected} />
                <div className="myra-companion-stage-status"><i />{companionMood(companion.id, genre, playing, lang)}</div>
              </section>

              <section className="myra-companion-bond-card">
                <div className="myra-companion-bond-top">
                  <div><span>{copy.bond}</span><strong>{copy.level} {level.level}</strong></div>
                  <b>{state.xp} {copy.energy}</b>
                </div>
                <div className="myra-companion-bond-track"><i style={{ transform: `scaleX(${level.progress})` }} /></div>
                <p>{companion.copy[lang].ability}</p>
                <div className="myra-companion-memory">
                  <div><strong>{state.playedTrackIds.length}</strong><span>{copy.tracks}</span></div>
                  <div><strong>{state.discoveredGenres.length}</strong><span>{copy.genres}</span></div>
                  <div><strong>{state.unlockedGiftIds.length}</strong><span>{copy.gifts}</span></div>
                </div>
                <div className="myra-companion-actions">
                  <motion.button whileTap={{ scale: 0.96 }} onClick={touch}><Sparkles size={15} />{copy.touch}</motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => { onStartFlow(); onClose(); }}><span className="myra-companion-action-wave" />{copy.flow}</motion.button>
                </div>
              </section>

              <section className="myra-companion-ritual">
                <div className="myra-companion-ritual-heading">
                  <div><span><Sparkles size={15} />{copy.ritual}</span><p>{copy.ritualSub}</p></div>
                  <b>{ritual.completed}/3</b>
                </div>
                <div className="myra-companion-ritual-tasks">
                  {[
                    { done: ritual.tasks[0], icon: Music2, label: copy.ritualTracks, progress: `${Math.min(ritual.trackCount, 3)}/3` },
                    { done: ritual.tasks[1], icon: Sparkles, label: copy.ritualGenres, progress: `${Math.min(ritual.genreCount, 2)}/2` },
                    { done: ritual.tasks[2], icon: Heart, label: copy.ritualLike, progress: ritual.tasks[2] ? "1/1" : "0/1" },
                  ].map(task => {
                    const Icon = task.icon;
                    return <div key={task.label} className={task.done ? "is-done" : ""}><i>{task.done ? <Check size={13} /> : <Icon size={13} />}</i><span>{task.label}</span><b>{task.progress}</b></div>;
                  })}
                </div>
                <button disabled={!ritual.ready || ritual.claimed} onClick={claimRitual}>
                  {ritual.claimed ? copy.ritualClaimed : ritual.ready ? copy.ritualClaim : copy.ritualLocked}
                </button>
              </section>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  );
}

export function ProfileIdentityShowcase({ controller, onOpen }: { controller: CompanionController; onOpen: () => void }) {
  const { lang } = useLang();
  const unlocked = RESONANCES.filter(gift => controller.state.unlockedGiftIds.includes(gift.id));
  const pinned = controller.state.showcasedGiftId
    ? RESONANCES.find(gift => gift.id === controller.state.showcasedGiftId) ?? unlocked[0]
    : unlocked[0];
  const visible = pinned ? [pinned, ...unlocked.filter(gift => gift.id !== pinned.id)].slice(0, 3) : [];
  return (
    <motion.button whileTap={{ scale: 0.985 }} onClick={onOpen} className="myra-profile-gift-showcase">
      <div className="myra-profile-gift-copy">
        <span>{lang === "ru" ? "КОЛЛЕКЦИЯ ПРОФИЛЯ" : "PROFILE COLLECTION"}</span>
        <strong>{lang === "ru" ? "Твоя музыкальная коллекция" : "Your music identity"}</strong>
        <p>{unlocked.length}/{RESONANCES.length} {lang === "ru" ? "артефактов · знаки · подарки от людей" : "artifacts · badges · gifts from people"}</p>
      </div>
      <div className="myra-profile-gift-stack" aria-hidden="true">
        {visible.length ? visible.map(gift => <GiftVisual key={gift.id} gift={gift} unlocked />) : <span><Gift size={18} /></span>}
      </div>
      <ChevronRight size={17} />
    </motion.button>
  );
}

export function IdentityCollectionSheet({ open, onClose, controller }: { open: boolean; onClose: () => void; controller: CompanionController }) {
  const { lang } = useLang();
  const { state, showcase } = controller;
  const [section, setSection] = useState<"artifacts" | "badges" | "gifts">("artifacts");
  const copy = {
    artifacts: lang === "ru" ? "Артефакты" : "Artifacts",
    badges: lang === "ru" ? "Знаки" : "Badges",
    gifts: lang === "ru" ? "Подарки" : "Gifts",
  };
  return (
    <Sheet open={open} onClose={onClose} z={72}>
      <div className="myra-gift-gallery-sheet">
        <header>
          <div>
            <span>{lang === "ru" ? "МУЗЫКАЛЬНАЯ ИДЕНТИЧНОСТЬ" : "MUSIC IDENTITY"}</span>
            <h2>{lang === "ru" ? "Твоя коллекция" : "Your collection"}</h2>
            <p>{lang === "ru" ? "Спутник растёт вместе со вкусом, знаки отмечают путь, а подарки сохраняют связи между людьми." : "Your companion grows with your taste, badges mark the journey, and gifts preserve connections between people."}</p>
          </div>
          <button onClick={onClose} aria-label={lang === "ru" ? "Закрыть" : "Close"}><X size={16} /></button>
        </header>
        <div className="myra-identity-tabs" role="tablist" aria-label={lang === "ru" ? "Раздел коллекции" : "Collection section"}>
          {(["artifacts", "badges", "gifts"] as const).map(id => (
            <button key={id} role="tab" aria-selected={section === id} data-active={section === id || undefined} onClick={() => setSection(id)}>{copy[id]}</button>
          ))}
        </div>

        {section === "artifacts" && <>
          <div className="myra-gift-gallery-summary">
            <Sparkles size={16} /><strong>{state.unlockedGiftIds.length}/{RESONANCES.length}</strong>
            <span>{lang === "ru" ? "артефактов собрано" : "artifacts collected"}</span>
          </div>
          <div className="myra-resonance-grid myra-gift-gallery-grid">
            {RESONANCES.map(artifact => {
              const unlocked = state.unlockedGiftIds.includes(artifact.id);
              const showcased = state.showcasedGiftId === artifact.id;
              return (
                <button key={artifact.id} disabled={!unlocked} onClick={() => showcase(artifact.id)} className={showcased ? "is-showcased" : ""} style={{ "--gift-accent": artifact.accent } as React.CSSProperties}>
                  <GiftVisual gift={artifact} unlocked={unlocked} />
                  <strong>{artifact.name[lang]}</strong>
                  <span>{!unlocked ? artifact.hint[lang] : showcased ? (lang === "ru" ? "На витрине" : "Showcased") : (lang === "ru" ? "Показать в профиле" : "Show in profile")}</span>
                </button>
              );
            })}
          </div>
        </>}

        {section === "badges" && (
          <div className="myra-identity-empty is-badges">
            <span><BadgeCheck size={22} /></span>
            <strong>{lang === "ru" ? "Знаки видны вокруг аватара" : "Badges live around your avatar"}</strong>
            <p>{lang === "ru" ? "Роль, вклад в сообщество, события и редкие достижения получают разные формы. В имени показываются только два главных — профиль остаётся чистым." : "Role, community contribution, events, and rare achievements have distinct forms. Only two signature badges appear by the name."}</p>
            <div><i /><i /><i /></div>
          </div>
        )}

        {section === "gifts" && (
          <div className="myra-identity-empty is-gifts">
            <span><Gift size={22} /></span>
            <strong>{lang === "ru" ? "Подарки — от людей, не от алгоритма" : "Gifts come from people, not an algorithm"}</strong>
            <p>{lang === "ru" ? "После общего прослушивания или важного релиза здесь появятся подарки с именем отправителя, датой и личным сообщением. Никаких случайных платных коробок." : "After a shared listen or meaningful release, gifts will appear here with the sender, date, and a personal message. No random paid loot boxes."}</p>
            <button disabled><Send size={15} />{lang === "ru" ? "Отправка откроется в бета-версии «Между»" : "Sending opens in the Between beta"}</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
