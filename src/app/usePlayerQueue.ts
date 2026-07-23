import { useState, useEffect, useCallback, useMemo, useRef, type MutableRefObject } from "react";
import { toast } from "sonner";
import { TRACKS, type Track } from "./data";
import { useAudio } from "./lib";
import { smartNext, pushHistory } from "./smart";
import { useLang } from "./i18n";
// Алиас trackEvent: в этом файле уже есть локальные переменные с именем track
// (Track-объект в playWave/nextRef), поэтому импортируем функцию под другим именем.
import { track as trackEvent } from "./analytics";

// Очередь и воспроизведение: единственное место, которое реально трогает
// живой <audio> (через useAudio) — playTrack/togglePlay/step/playWave/
// playRadio и автопереход при ended.
//
// currentTrack намеренно НЕ живёт в этом хуке: его пишет ещё и
// handlePublishedRemote в App.tsx, который передаётся параметром В
// useLocalTracks, а useLocalTracks, в свою очередь, отдаёт myTracks —
// один из входов очереди здесь. Если бы currentTrack принадлежал этому
// хуку, получился бы цикл вызовов между ним и useLocalTracks; вместо
// этого currentTrack остаётся состоянием AppInner и приходит сюда
// параметром, как uid/userRole для useSubscription
export function usePlayerQueue(params: {
  currentTrack: Track;
  setCurrentTrack: (updater: Track | ((prev: Track) => Track)) => void;
  myTracks: Track[];
  resolveUrl: (tr: Track) => string;
  registerPlay: (tr: Track) => void;
  likedIds: Set<number>;
  followed: Set<string>;
  fadeRef: MutableRefObject<boolean>;
}) {
  const { currentTrack, setCurrentTrack, myTracks, resolveUrl, registerPlay, likedIds, followed, fadeRef } = params;
  const { t, lang } = useLang();

  const loadedRef = useRef(false);
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const nextRef = useRef<() => void>(() => {});
  const audio = useAudio(() => nextRef.current(), () => fadeRef.current);

  // Каталог — очередь по умолчанию. Отдельное состояние playbackQueue нужно
  // для настоящих контекстов (плейлист, альбом): тогда Next и автопереход
  // идут по выбранному списку, а вкладка «Далее» показывает именно его.
  const catalogQueue = useMemo(() => (myTracks.length ? [...myTracks, ...TRACKS] : TRACKS), [myTracks]);
  const catalogQueueRef = useRef<Track[]>(catalogQueue);
  catalogQueueRef.current = catalogQueue;
  const [queue, setQueue] = useState<Track[]>(catalogQueue);
  const queueRef = useRef<Track[]>(queue);
  queueRef.current = queue;
  const contextQueueRef = useRef(false);
  useEffect(() => {
    if (!contextQueueRef.current) setQueue(catalogQueue);
  }, [catalogQueue]);

  const playTrack = useCallback((tr: Track) => {
    if (currentTrackRef.current.id === tr.id && loadedRef.current) {
      trackEvent(audio.playing ? { name: "track_pause" } : { name: "track_play", source: "toggle", trackId: tr.id });
      audio.toggle();
      return;
    }
    // play() должен происходить прямо в обработчике клика, иначе браузер
    // теряет user activation и может заблокировать звук.
    const previous = currentTrackRef.current;
    contextQueueRef.current = false;
    setQueue(catalogQueueRef.current);
    loadedRef.current = true;
    currentTrackRef.current = tr;
    setCurrentTrack(tr);
    audio.load(resolveUrl(tr), () => {
      currentTrackRef.current = previous;
      setCurrentTrack(previous);
    });
    pushHistory(tr.id);
    registerPlay(tr);
    trackEvent({ name: "track_play", source: "direct", trackId: tr.id });
  }, [audio, resolveUrl, registerPlay, setCurrentTrack]);

  const playTracks = useCallback((tracks: Track[], startIndex = 0) => {
    if (!tracks.length) return;
    const safeIndex = Math.min(Math.max(0, startIndex), tracks.length - 1);
    const nextQueue = [...tracks];
    const next = nextQueue[safeIndex];
    const previous = currentTrackRef.current;
    const previousQueue = queueRef.current;
    const previousWasContext = contextQueueRef.current;
    contextQueueRef.current = true;
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    loadedRef.current = true;
    currentTrackRef.current = next;
    setCurrentTrack(next);
    audio.load(resolveUrl(next), () => {
      contextQueueRef.current = previousWasContext;
      queueRef.current = previousQueue;
      setQueue(previousQueue);
      currentTrackRef.current = previous;
      setCurrentTrack(previous);
    });
    pushHistory(next.id);
    registerPlay(next);
    trackEvent({ name: "track_play", source: "queue", trackId: next.id });
  }, [audio, resolveUrl, registerPlay, setCurrentTrack]);

  const togglePlay = useCallback(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      audio.load(resolveUrl(currentTrack));
      pushHistory(currentTrack.id);
      // Первый запуск через кнопку play — такое же прослушивание, как тап по
      // треку: без registerPlay терялись статистика и ачивка «Первые ноты»
      registerPlay(currentTrack);
      trackEvent({ name: "track_play", source: "toggle", trackId: currentTrack.id });
    } else {
      trackEvent(audio.playing ? { name: "track_pause" } : { name: "track_play", source: "toggle", trackId: currentTrack.id });
      audio.toggle();
    }
  }, [audio, currentTrack, resolveUrl, registerPlay]);

  // Перемешивание и повтор — настоящие, а не декоративные тумблеры: shuffle
  // меняет и ручной next, и автопереход; repeat заново запускает текущий трек
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const shuffleRef = useRef(shuffle); shuffleRef.current = shuffle;
  const repeatRef = useRef(repeat); repeatRef.current = repeat;

  const step = useCallback((dir: 1 | -1) => {
    const prev = currentTrackRef.current;
    const q = queueRef.current;
    let next: Track;
    if (shuffleRef.current && q.length > 1) {
      const pool = q.filter(tr => tr.id !== prev.id);
      next = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const idx = q.findIndex(tr => tr.id === prev.id);
      next = q[(idx + dir + q.length) % q.length] ?? q[0];
    }
    loadedRef.current = true;
    currentTrackRef.current = next;
    setCurrentTrack(next);
    audio.load(resolveUrl(next), () => {
      currentTrackRef.current = prev;
      setCurrentTrack(prev);
    });
    pushHistory(next.id);
    registerPlay(next);
    trackEvent({ name: "track_play", source: "queue", trackId: next.id });
  }, [audio, resolveUrl, registerPlay, setCurrentTrack]);

  // track_skip — только на ручное переключение пользователем; автопереход по
  // shuffle тоже зовёт step, но там это «завершение+play», а не «скип».
  const handleNext = useCallback(() => { trackEvent({ name: "track_skip", direction: "next" }); step(1); }, [step]);
  const handlePrev = useCallback(() => { trackEvent({ name: "track_skip", direction: "prev" }); step(-1); }, [step]);

  // «Прилив» (личный поток): умный подбор без повторов + причина выбора
  const likedRef = useRef(likedIds); likedRef.current = likedIds;
  const followedRef = useRef(followed); followedRef.current = followed;
  const langRef = useRef(lang); langRef.current = lang;
  const playWave = useCallback((silent = false) => {
    const previous = currentTrackRef.current;
    const catalog = catalogQueueRef.current;
    const { track, reason } = smartNext(catalog, likedRef.current, followedRef.current, currentTrackRef.current.id, langRef.current);
    contextQueueRef.current = false;
    setQueue(catalog);
    loadedRef.current = true;
    currentTrackRef.current = track;
    setCurrentTrack(track);
    audio.load(resolveUrl(track), () => {
      currentTrackRef.current = previous;
      setCurrentTrack(previous);
    });
    pushHistory(track.id);
    registerPlay(track);
    trackEvent({ name: "track_play", source: "wave", trackId: track.id });
    if (!silent) toast(`MYRA AI · ${track.title} — ${reason}`);
  }, [audio, resolveUrl, registerPlay, setCurrentTrack]);

  // «Течение» — радио от текущего трека: случайный трек того же жанра.
  // Раньше кнопка молча дублировала «Прилив», хотя называлась иначе
  const playRadio = useCallback(() => {
    const prev = currentTrackRef.current;
    const catalog = catalogQueueRef.current;
    const sameGenre = catalog.filter(tr => tr.genre === prev.genre && tr.id !== prev.id);
    const pool = sameGenre.length ? sameGenre : catalog.filter(tr => tr.id !== prev.id);
    if (!pool.length) return;
    const next = pool[Math.floor(Math.random() * pool.length)];
    contextQueueRef.current = false;
    setQueue(catalog);
    loadedRef.current = true;
    currentTrackRef.current = next;
    setCurrentTrack(next);
    audio.load(resolveUrl(next), () => {
      currentTrackRef.current = prev;
      setCurrentTrack(prev);
    });
    pushHistory(next.id);
    registerPlay(next);
    trackEvent({ name: "track_play", source: "radio", trackId: next.id });
    toast(t("home.radioToast", next.title, next.artist));
  }, [audio, resolveUrl, registerPlay, setCurrentTrack, t]);

  // Стабильная обёртка: playWave пересоздаётся при смене зависимостей, а
  // мемоизации HomeScreen нужен неизменный проп — иначе React.memo бесполезен
  const playWaveRef = useRef<() => void>(() => {});
  const startWave = useCallback(() => playWaveRef.current(), []);

  // Автопереход: повтор → тот же трек заново, перемешивание → случайный,
  // иначе умная волна без повторов. Ручной next — по очереди (или случайно)
  useEffect(() => {
    nextRef.current = () => {
      // Сюда попадаем по событию ended — трек доигран до конца.
      trackEvent({ name: "track_complete", trackId: currentTrackRef.current.id });
      if (repeatRef.current) {
        // после ended элемент на паузе — заново load запускает воспроизведение
        const track = currentTrackRef.current;
        audio.load(resolveUrl(track));
        registerPlay(track);
        trackEvent({ name: "track_play", source: "auto", trackId: track.id });
        return;
      }
      if (contextQueueRef.current && queueRef.current.length > 1) { step(1); return; }
      if (shuffleRef.current) { step(1); return; }
      playWave(true);
    };
    playWaveRef.current = () => playWave();
  }, [playWave, step, audio, resolveUrl, registerPlay]);

  return {
    audio, queue, shuffle, setShuffle, repeat, setRepeat,
    playTrack, playTracks, togglePlay, handleNext, handlePrev, playRadio, startWave,
  };
}
