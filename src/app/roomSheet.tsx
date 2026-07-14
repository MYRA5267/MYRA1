import { useState, useRef, useEffect } from "react";
import { Play, Pause, Users, Copy, LogOut, X, Radio, KeyRound } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { type Track } from "./data";
import { F, GLASS, SPRING, Sheet, Aurora, Waveform, EQ, copyText } from "./lib";
import { useLang } from "./i18n";
import { supabaseEnabled } from "./supabase";
import { makeRoomCode, isValidRoomCode, connectRoom, broadcastRoomState, disconnectRoom, type RoomHandle, type RoomState } from "./rooms";

type Stage = "menu" | "join" | "room";

/**
 * Настоящие совместные комнаты на Supabase Realtime: код комнаты — это имя
 * канала, так что вход по коду либо реально соединяет с хозяином, либо нет —
 * никакой имитации. Хозяин управляет плейбэком (play/pause/трек), гость
 * получает его состояние через broadcast и синхронизируется автоматически.
 */
export function RoomSheet({ open, onClose, currentTrack, playing, progress, onToggle, onPlayTrack, onSeek, queue, avatar }: {
  open: boolean; onClose: () => void;
  currentTrack: Track; playing: boolean; progress: number;
  onToggle: () => void; onPlayTrack: (t: Track) => void; onSeek: (p: number) => void;
  queue: Track[]; avatar: string;
}) {
  const { t } = useLang();
  const [stage, setStage] = useState<Stage>("menu");
  const [codeInput, setCodeInput] = useState("");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [memberCount, setMemberCount] = useState(1);
  const [remote, setRemote] = useState<RoomState | null>(null);
  const handleRef = useRef<RoomHandle | null>(null);

  const leave = () => {
    if (handleRef.current) disconnectRoom(handleRef.current);
    handleRef.current = null;
    setRoomCode(null);
    setRemote(null);
    setMemberCount(1);
    setStage("menu");
    setCodeInput("");
  };

  useEffect(() => {
    if (!open) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const enterRoom = (code: string, host: boolean) => {
    const handle = connectRoom(code, {
      onState: s => setRemote(s),
      onCount: n => setMemberCount(n),
    });
    if (!handle) { toast(t("room.unavailable")); return; }
    handleRef.current = handle;
    setRoomCode(code);
    setIsHost(host);
    setStage("room");
  };

  const createRoom = () => enterRoom(makeRoomCode(), true);
  const joinRoom = () => {
    const code = codeInput.trim().toUpperCase();
    if (!isValidRoomCode(code)) { toast(t("room.invalidCode")); return; }
    enterRoom(code, false);
  };

  // ХОЗЯИН: рассылает своё состояние сразу при смене трека/паузы и раз в
  // несколько секунд — для тех, кто зашёл посреди трека или отстал по дрейфу
  const liveRef = useRef({ trackId: currentTrack.id, playing, progress });
  liveRef.current = { trackId: currentTrack.id, playing, progress };
  useEffect(() => {
    if (!isHost || !handleRef.current) return;
    broadcastRoomState(handleRef.current, { trackId: currentTrack.id, playing, progress: Math.round(progress) });
  }, [isHost, currentTrack.id, playing]);
  useEffect(() => {
    if (!isHost || stage !== "room") return;
    const iv = setInterval(() => {
      if (handleRef.current) broadcastRoomState(handleRef.current, { trackId: liveRef.current.trackId, playing: liveRef.current.playing, progress: Math.round(liveRef.current.progress) });
    }, 4000);
    return () => clearInterval(iv);
  }, [isHost, stage]);

  // ГОСТЬ: подстраивает свой плеер под полученное состояние хозяина —
  // переключает трек, синхронизирует паузу/воспроизведение и досекундный дрейф
  useEffect(() => {
    if (isHost || !remote) return;
    if (remote.trackId !== currentTrack.id) {
      const tr = queue.find(q => q.id === remote.trackId);
      if (tr) onPlayTrack(tr);
      return;
    }
    if (remote.playing !== playing) onToggle();
    if (Math.abs(remote.progress - progress) > 3) onSeek(remote.progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, isHost]);

  return (
    <Sheet open={open} onClose={onClose} z={59}>
      <div className="relative px-6 pt-7 pb-8 overflow-hidden">
        {stage === "room" && <Aurora c2={currentTrack.c2} opacity={0.5} />}

        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center z-20" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
          <X size={16} />
        </button>

        {stage === "menu" && (
          <div className="relative z-10">
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em" }} className="mb-2">{t("room.title")}</div>
            <div className="text-sm mb-6" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>{t("room.sub")}</div>

            {!supabaseEnabled ? (
              <div className="rounded-2xl p-4 text-sm" style={{ ...GLASS, color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>{t("room.unavailable")}</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <motion.button whileTap={{ scale: 0.97 }} onClick={createRoom} className="w-full py-4 rounded-full text-sm font-bold flex items-center justify-center gap-2" style={{ background: `linear-gradient(135deg, ${currentTrack.c2}, ${currentTrack.c2}99)`, color: "#fff", fontFamily: F.b }}>
                  <Radio size={16} /> {t("room.create")}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStage("join")} className="w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ ...GLASS, fontFamily: F.b }}>
                  <KeyRound size={16} /> {t("room.join")}
                </motion.button>
              </div>
            )}
          </div>
        )}

        {stage === "join" && (
          <div className="relative z-10">
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 22, letterSpacing: "-0.03em" }} className="mb-4">{t("room.join")}</div>
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 5))}
              placeholder={t("room.codePh")}
              className="w-full px-4 py-3.5 rounded-2xl bg-transparent outline-none text-center text-lg tracking-[0.3em] font-bold mb-4"
              style={{ ...GLASS, color: "var(--fg)", fontFamily: F.m }}
              autoFocus
            />
            <div className="flex gap-2.5">
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setStage("menu")} className="px-5 py-3 rounded-full text-sm font-semibold" style={{ ...GLASS, fontFamily: F.b }}>{t("don.back")}</motion.button>
              <motion.button whileTap={{ scale: 0.97 }} disabled={codeInput.length < 5} onClick={joinRoom} className="flex-1 py-3 rounded-full text-sm font-bold" style={{ background: codeInput.length < 5 ? "color-mix(in srgb, var(--wash) 6%, transparent)" : `linear-gradient(135deg, ${currentTrack.c2}, ${currentTrack.c2}99)`, color: codeInput.length < 5 ? "color-mix(in srgb, var(--fg) 30%, transparent)" : "#fff", fontFamily: F.b }}>{t("room.joinBtn")}</motion.button>
            </div>
          </div>
        )}

        {stage === "room" && roomCode && (
          <>
            <div className="relative z-10 flex items-center gap-2.5 mb-5">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[0.14em]" style={{ background: "rgba(248,113,113,0.14)", border: "1px solid rgba(248,113,113,0.35)", color: "#f87171", fontFamily: F.m }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f87171", animation: "orbPulse 1.6s ease-in-out infinite" }} />
                LIVE
              </span>
              <span className="text-[10px] flex items-center gap-1" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}><Users size={11} /> {t("room.listeners", memberCount)}</span>
            </div>

            <button
              onClick={async () => { await copyText(roomCode); toast(t("room.shared", roomCode)); }}
              className="relative z-10 w-full flex items-center justify-between px-4 py-3.5 rounded-2xl mb-5"
              style={GLASS}
            >
              <div className="text-left">
                <div className="text-[10px] uppercase tracking-[0.16em] mb-1" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("room.yourCode")}</div>
                <div className="text-xl font-bold tracking-[0.3em]" style={{ fontFamily: F.m, color: currentTrack.c2 }}>{roomCode}</div>
              </div>
              <Copy size={16} style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)" }} />
            </button>

            {!isHost && (
              <div className="relative z-10 text-xs mb-4 px-1" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>
                {remote ? t("room.hostControls") : t("room.waitingHost")}
              </div>
            )}

            <div className="relative z-10 rounded-[22px] overflow-hidden mb-6" style={GLASS}>
              <div className="flex items-center gap-4 p-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ boxShadow: `0 8px 26px ${currentTrack.c2}44` }}>
                  <img src={currentTrack.img} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate flex items-center gap-2" style={{ fontFamily: F.b }}>
                    {currentTrack.title}
                    {playing && <EQ color={currentTrack.c2} size={10} />}
                  </div>
                  <div className="text-xs truncate mb-2" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{currentTrack.artist}</div>
                  <Waveform progress={progress} color={currentTrack.c2} height={22} seed={currentTrack.id + 3} bars={40} dim playing={playing} onSeek={isHost ? onSeek : undefined} />
                </div>
                {isHost && (
                  <motion.button whileTap={{ scale: 0.85 }} onClick={onToggle} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${currentTrack.c2}, ${currentTrack.c2}aa)` }}>
                    {playing ? <Pause size={16} fill="white" stroke="none" /> : <Play size={16} fill="white" stroke="none" className="ml-0.5" />}
                  </motion.button>
                )}
              </div>
            </div>

            <div className="relative z-10 flex items-center gap-3 mb-6">
              <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover" style={{ border: `2px solid ${currentTrack.c2}` }} />
              <span className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 50%, transparent)", fontFamily: F.b }}>{isHost ? t("room.youHost") : t("room.youGuest")}</span>
            </div>

            <motion.button whileTap={{ scale: 0.96 }} onClick={() => { toast(t("room.left")); leave(); }} className="relative z-10 w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2" style={{ ...GLASS, color: "color-mix(in srgb, var(--fg) 65%, transparent)", fontFamily: F.b }}>
              <LogOut size={13} /> {t("room.leave")}
            </motion.button>
          </>
        )}
      </div>
    </Sheet>
  );
}
