import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Zap, Sparkles, Wallet, Mic2, Headphones, Lock, RotateCcw, Wrench, Inbox, ChevronRight, ChevronLeft, Send, Loader2, ShieldAlert, Bug, Flag, EyeOff, Eye, CheckCheck, XCircle, ExternalLink, Copy, RefreshCw, Globe } from "./myraIcons";
import { motion } from "motion/react";
import { toast } from "sonner";
import { ls, REPORT_REASONS } from "./data";
import { F, GLASS, Sheet, copyText } from "./lib";
import { useLang } from "./i18n";
import { buildAchievements, type AchievementCounters } from "./achievements";
import type { UserRole } from "./auth";
import {
  isAdmin, supabaseEnabled, distributionChannel, fetchAllSupportThreads, fetchSupportThread,
  sendSupportMessage, markSupportThreadRead, fetchOpenReports, resolveReport, hideTrack,
  fetchPendingCreatorVerificationRequests, reviewCreatorVerificationRequest,
  type SupportMessageRow, type SupportThreadPreview, type OpenReportRow,
  type CreatorVerificationRequestPreview,
} from "./supabase";

// ─── Панель разработчика ──────────────────────────────────────────────────────
// Только для создателей MYRA: в production вход появляется после серверной
// проверки public.admins. Панель объединяет безопасную диагностику, поддержку,
// модерацию и локальные инструменты предпросмотра состояний.

const XP_PRESETS = [500, 2500, 10000];
const BALANCE_PRESETS = [1000, 10000];

export function DevPanelSheet({ open, onClose, level, counters, userRole, onSetRole, cpStatus, onSetCp, balance, onAddBalance, onGrantXp, onOpenAdminSupport, onOpenModeration, uid, adminAccess, simpleFx }: {
  open: boolean; onClose: () => void; level: number;
  counters: AchievementCounters;
  userRole: UserRole; onSetRole: (r: UserRole) => void;
  cpStatus: "none" | "active" | "grace"; onSetCp: (s: "none" | "active" | "grace") => void;
  balance: number; onAddBalance: (amt: number) => void;
  onGrantXp: (xp: number) => void;
  onOpenAdminSupport: () => void;
  onOpenModeration: () => void;
  uid: string | null;
  adminAccess: boolean;
  simpleFx: boolean;
}) {
  const { t } = useLang();
  // achVersion — форс-пересчёт после сброса прогресса кнопкой ниже
  const [achVersion, setAchVersion] = useState(0);
  const achievements = useMemo(() => buildAchievements(counters), [counters]);
  const unlocked = useMemo(() => new Set(ls.get<string[]>("achUnlocked", [])), [achievements, achVersion, open]);
  const runtime = useMemo(() => {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { effectiveType?: string; downlink?: number; saveData?: boolean };
    };
    return {
      build: "1.10.0",
      platform: /Android/i.test(navigator.userAgent) ? "Android WebView" : navigator.platform || "Web",
      online: navigator.onLine,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      cores: nav.hardwareConcurrency ?? "—",
      memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : "—",
      connection: nav.connection?.effectiveType ?? (navigator.onLine ? "online" : "offline"),
      downlink: nav.connection?.downlink ? `${nav.connection.downlink} Mbps` : "—",
      saveData: nav.connection?.saveData === true,
      secure: window.isSecureContext,
      mediaSession: "mediaSession" in navigator,
      pixelRatio: window.devicePixelRatio.toFixed(1),
    };
  }, [open]);

  const copyDiagnostics = async () => {
    const text = [
      `MYRA ${runtime.build}`,
      `${runtime.platform} · ${runtime.viewport}`,
      `online=${runtime.online} cores=${runtime.cores} memory=${runtime.memory}`,
      `connection=${runtime.connection} downlink=${runtime.downlink} saveData=${runtime.saveData}`,
      `secure=${runtime.secure} mediaSession=${runtime.mediaSession} dpr=${runtime.pixelRatio}`,
      `backend=${supabaseEnabled} channel=${distributionChannel} admin=${adminAccess} uid=${uid ?? "none"}`,
      `simpleFx=${simpleFx}`,
      `level=${level} plays=${counters.totalPlays} liked=${counters.likedCount} releases=${counters.releaseCount}`,
    ].join("\n");
    await copyText(text);
    toast("Диагностика скопирована");
  };

  const toggleEruda = async () => {
    if (!import.meta.env.DEV) return;
    const eruda = (await import("eruda")).default;
    if ((window as any).__erudaOn) { eruda.destroy(); (window as any).__erudaOn = false; toast(t("dev.consoleOff")); }
    else { eruda.init(); (window as any).__erudaOn = true; toast(t("dev.consoleOn")); }
  };

  const label = (text: string) => (
    <div className="text-[10px] uppercase tracking-[0.16em] mb-2.5 mt-6" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{text}</div>
  );

  const chip = (text: string, on: boolean, act: () => void, c = "#f472b6") => (
    <button key={text} onClick={act} className="px-4 py-2.5 rounded-full text-xs font-semibold transition-colors" style={{ background: on ? `${c}22` : "color-mix(in srgb, var(--wash) 06%, transparent)", border: `1px solid ${on ? c + "55" : "transparent"}`, color: on ? c : "color-mix(in srgb, var(--fg) 60%, transparent)", fontFamily: F.b }}>
      {text}
    </button>
  );

  return (
    <Sheet open={open} onClose={onClose} z={69}>
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(244,114,182,0.15)", border: "1px solid rgba(244,114,182,0.4)" }}>
              <Wrench size={15} style={{ color: "#f472b6" }} />
            </div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>{t("dev.title")}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="text-xs mb-4" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("dev.sub")}</div>

        <div className="myra-dev-health-grid">
          <div><Globe size={14} /><span>Среда</span><strong>{runtime.platform}</strong></div>
          <div><Zap size={14} /><span>Сборка</span><strong>{runtime.build}</strong></div>
          <div className={runtime.online ? "is-ok" : "is-warn"}><span className="myra-dev-status-dot" /><span>Сеть</span><strong>{runtime.online ? "онлайн" : "офлайн"}</strong></div>
          <div><Bug size={14} /><span>Экран</span><strong>{runtime.viewport}</strong></div>
          <div className={supabaseEnabled ? "is-ok" : "is-warn"}><span className="myra-dev-status-dot" /><span>{t("dev.backend")}</span><strong>{supabaseEnabled ? t("dev.connected") : t("dev.offline")}</strong></div>
          <div className={adminAccess ? "is-ok" : "is-warn"}><ShieldAlert size={14} /><span>{t("dev.access")}</span><strong>{adminAccess ? t("dev.admin") : t("dev.local")}</strong></div>
          <div><Globe size={14} /><span>{t("dev.channel")}</span><strong>{distributionChannel}</strong></div>
          <div><Zap size={14} /><span>{t("dev.effects")}</span><strong>{simpleFx ? t("dev.simple") : t("dev.full")}</strong></div>
        </div>
        <div className="myra-dev-tool-row">
          <button onClick={copyDiagnostics}><Copy size={13} />Копировать диагностику</button>
          {uid && <button onClick={async () => { await copyText(uid); toast(t("dev.uidCopied")); }}><Copy size={13} />{t("dev.copyUid")}</button>}
          <button onClick={() => window.location.reload()}><RefreshCw size={13} />Перезапустить UI</button>
        </div>

        {/* Доступ уже проверен перед показом панели; шторка поддержки повторяет
            проверку самостоятельно как дополнительный рубеж. */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={onOpenAdminSupport} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-2" style={{ ...GLASS, border: "1px solid rgba(34,211,238,0.3)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,211,238,0.14)" }}>
            <Inbox size={15} style={{ color: "#22d3ee" }} />
          </div>
          <div className="flex-1 text-left text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.supportRow")}</div>
          <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.button>

        {/* Очередь модерации повторно проверяет admins при каждом открытии. */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={onOpenModeration} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-2" style={{ ...GLASS, border: "1px solid rgba(248,113,113,0.3)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(248,113,113,0.14)" }}>
            <Flag size={15} style={{ color: "#f87171" }} />
          </div>
          <div className="flex-1 text-left text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.moderationRow")}</div>
          <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.button>

        {/* Консоль отладки прямо на устройстве (eruda): единственный способ
            увидеть реальные ошибки на телефоне без подключения к компьютеру.
            Пакет грузится лениво отдельным чанком только при первом включении */}
        {import.meta.env.DEV && (
          <motion.button whileTap={{ scale: 0.98 }} onClick={toggleEruda} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-2" style={{ ...GLASS, border: "1px solid rgba(250,204,21,0.3)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(250,204,21,0.14)" }}>
              <Bug size={15} style={{ color: "#facc15" }} />
            </div>
            <div className="flex-1 text-left text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.console")}</div>
            <ChevronRight size={15} style={{ color: "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
          </motion.button>
        )}

        {/* XP и уровень */}
        {label(t("dev.xp"))}
        <div className="rounded-2xl p-4" style={GLASS}>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} style={{ color: "#facc15" }} />
            <span className="text-sm font-semibold" style={{ fontFamily: F.b }}>{t("dev.level", level)}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {XP_PRESETS.map(xp => chip(`+${xp.toLocaleString("ru-RU")} XP`, false, () => { onGrantXp(xp); toast(t("dev.xpDone", xp.toLocaleString("ru-RU"))); }, "#facc15"))}
          </div>
        </div>

        {/* Роль */}
        {label(t("dev.role"))}
        <div className="flex gap-2">
          <button onClick={() => { onSetRole("artist"); toast(t("dev.roleSet", t("dev.artist"))); }} className="flex-1 py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2" style={{ background: userRole === "artist" ? "rgba(139,92,246,0.2)" : "color-mix(in srgb, var(--wash) 06%, transparent)", border: `1px solid ${userRole === "artist" ? "rgba(139,92,246,0.55)" : "transparent"}`, color: userRole === "artist" ? "#a78bfa" : "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
            <Mic2 size={13} /> {t("dev.artist")}
          </button>
          <button onClick={() => { onSetRole("listener"); toast(t("dev.roleSet", t("dev.listener"))); }} className="flex-1 py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2" style={{ background: userRole === "listener" ? "rgba(52,211,153,0.16)" : "color-mix(in srgb, var(--wash) 06%, transparent)", border: `1px solid ${userRole === "listener" ? "rgba(52,211,153,0.5)" : "transparent"}`, color: userRole === "listener" ? "#34d399" : "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
            <Headphones size={13} /> {t("dev.listener")}
          </button>
        </div>

        {/* Инструменты студии */}
        {label("Студия")}
        <div className="flex gap-2 flex-wrap">
          {chip("MYRA Pro", cpStatus === "active", () => onSetCp(cpStatus === "active" ? "none" : "active"), "#a78bfa")}
        </div>

        {/* Баланс */}
        {label(t("dev.balance"))}
        <div className="rounded-2xl p-4" style={GLASS}>
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={14} style={{ color: "#34d399" }} />
            <span className="text-sm font-semibold" style={{ fontFamily: F.m }}>{balance.toLocaleString("ru-RU")}₽</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {BALANCE_PRESETS.map(amt => chip(`+${amt.toLocaleString("ru-RU")}₽`, false, () => { onAddBalance(amt); toast(t("dev.balanceDone", amt.toLocaleString("ru-RU"))); }, "#34d399"))}
          </div>
        </div>

        {/* Скрытые достижения — полный список видим только здесь */}
        <div className="flex items-center justify-between mt-6 mb-2.5">
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)", fontFamily: F.m }}>{t("dev.ach")}</div>
          <button
            onClick={() => { ls.set("achUnlocked", []); setAchVersion(v => v + 1); toast(t("dev.achResetDone")); }}
            className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-full"
            style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", fontFamily: F.b }}
          >
            <RotateCcw size={11} /> {t("dev.achReset")}
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {achievements.map(a => {
            const Icon = a.done ? a.icon : Lock;
            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ ...GLASS, opacity: a.done ? 1 : 0.6 }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.done ? "rgba(244,114,182,0.14)" : "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
                  <Icon size={14} style={{ color: a.done ? "#f472b6" : "color-mix(in srgb, var(--fg) 35%, transparent)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ fontFamily: F.b }}>
                    {t(a.key)}
                    {a.done && unlocked.has(a.id) && <span className="ml-2 text-[9px] font-bold" style={{ color: "#f472b6", fontFamily: F.m }}>{t("dev.achSeen")}</span>}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: "color-mix(in srgb, var(--fg) 42%, transparent)", fontFamily: F.b }}>{t(a.key + "Sub")}</div>
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: a.done ? "#f472b6" : "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>
                  {t("rt.achProgress", Math.min(a.have, a.need), a.need)}
                </span>
              </div>
            );
          })}
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={onClose} className="w-full py-3.5 rounded-full text-sm font-semibold mt-6 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #f472b6, #f9a8d4)", color: "#3f0d24", fontFamily: F.b }}>
          <Sparkles size={14} /> {t("dev.close")}
        </motion.button>
      </div>
    </Sheet>
  );
}

// ─── Инбокс поддержки для админов (двух создателей MYRA) ─────────────────────
// Доступ к данным повторно проверяется через isAdmin(uid) при открытии, а RLS
// таблиц остаётся окончательным источником правды даже при подмене клиента.

const fmtThreadTime = (iso: string) => new Date(iso).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function AdminAccessPreview({ uid, kind, onRetry }: { uid: string | null; kind: "support" | "moderation"; onRetry: () => void }) {
  const support = kind === "support";
  const copyUid = async () => {
    if (!uid) return;
    await copyText(uid);
    toast("UID скопирован");
  };

  return (
    <div className="myra-admin-access-preview">
      <div className="myra-admin-access-head">
        <ShieldAlert size={20} />
        <div>
          <strong>{uid ? "Нужно серверное право администратора" : "Сначала войдите в аккаунт"}</strong>
          <p>{uid
            ? "Интерфейс исправен, но Supabase не вернул строку этого пользователя из public.admins. Чужие обращения остаются защищены."
            : "Без авторизации приложение не может безопасно открыть обращения пользователей и очередь жалоб."}</p>
        </div>
      </div>

      {uid && (
        <button className="myra-admin-uid" onClick={copyUid}>
          <Copy size={13} />
          <span>{uid}</span>
          <b>копировать</b>
        </button>
      )}

      <div className="myra-admin-preview-label">ЛОКАЛЬНАЯ ПРОВЕРКА ИНТЕРФЕЙСА</div>
      {support ? (
        <div className="myra-admin-preview-card">
          <Inbox size={16} />
          <div><strong>Тестовое обращение</strong><span>Не загружается обложка релиза</span></div>
          <i>2</i>
        </div>
      ) : (
        <div className="myra-admin-preview-card is-danger">
          <Flag size={16} />
          <div><strong>Тестовая жалоба</strong><span>Проверка карточки модерации</span></div>
          <i>!</i>
        </div>
      )}
      <p className="myra-admin-preview-note">Это безопасное локальное превью: оно ничего не отправляет и не подменяет серверные права.</p>

      <div className="myra-admin-access-actions">
        <button onClick={onRetry}><RefreshCw size={13} />Проверить доступ снова</button>
        <button onClick={() => toast(uid ? "Добавьте этот UID в таблицу public.admins в Supabase" : "Авторизуйтесь в профиле MYRA")}>
          <CheckCheck size={13} />Что сделать
        </button>
      </div>
    </div>
  );
}

function AdminThreadView({ userId, username, onBack }: { userId: string; username: string | null; onBack: () => void }) {
  const { t } = useLang();
  const [messages, setMessages] = useState<SupportMessageRow[] | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchSupportThread(userId).then(({ data }) => setMessages(data));
    // Открыли тред — считаем, что админ увидел сообщения пользователя
    markSupportThreadRead(userId).catch(() => {});
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages]);

  const send = async () => {
    const text = reply.trim();
    if (!text) return;
    setSending(true);
    const { error } = await sendSupportMessage(userId, "support", text);
    setSending(false);
    if (error) { toast(t("dev.supportErr")); return; }
    setReply("");
    load();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold mb-3 flex-shrink-0" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>
        <ChevronLeft size={14} /> {t("dev.supportBack")}
      </button>
      <div className="text-sm font-bold mb-3 flex-shrink-0 truncate" style={{ fontFamily: F.d }}>{username ?? userId.slice(0, 8)}</div>

      <div ref={listRef} className="flex-1 overflow-y-auto flex flex-col gap-3 pb-3" style={{ scrollbarWidth: "none" }}>
        {messages === null && (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
        )}
        {messages?.map(m => (
          <div key={m.id} className={`flex ${m.from_role === "support" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div className="px-4 py-2.5 rounded-[18px] text-sm" style={m.from_role === "support" ? { background: "linear-gradient(135deg, #f472b6, #f9a8d4)", color: "#3f0d24", borderBottomRightRadius: 6, fontFamily: F.b } : { ...GLASS, borderBottomLeftRadius: 6, fontFamily: F.b }}>
                {m.text}
              </div>
              <div className="text-[9px] mt-1 px-1" style={{ textAlign: m.from_role === "support" ? "right" : "left", color: "color-mix(in srgb, var(--fg) 30%, transparent)", fontFamily: F.m }}>
                {m.from_role === "ai" ? `${t("dev.supportAiTag")} · ` : ""}{fmtThreadTime(m.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2.5 flex-shrink-0 pt-1">
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={t("dev.supportReplyPh")}
          rows={1}
          className="flex-1 px-4 py-3 rounded-2xl bg-transparent outline-none text-sm resize-none"
          style={{ ...GLASS, color: "var(--fg)", fontFamily: F.b, maxHeight: 90 }}
        />
        <motion.button whileTap={{ scale: 0.88 }} disabled={sending} onClick={send} className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: reply.trim() ? "linear-gradient(135deg, #f472b6, #f9a8d4)" : "color-mix(in srgb, var(--wash) 8%, transparent)" }}>
          <Send size={16} style={{ color: reply.trim() ? "#3f0d24" : "color-mix(in srgb, var(--fg) 30%, transparent)" }} />
        </motion.button>
      </div>
    </div>
  );
}

export function AdminSupportSheet({ open, onClose, uid }: { open: boolean; onClose: () => void; uid: string | null }) {
  const { t } = useLang();
  // null = проверяем, true/false = результат isAdmin(uid)
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<SupportThreadPreview[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [activeThread, setActiveThread] = useState<SupportThreadPreview | null>(null);

  const loadThreads = useCallback(() => {
    setThreadsLoading(true);
    fetchAllSupportThreads()
      .then(setThreads)
      .catch(() => { setThreads([]); toast("Не удалось загрузить обращения"); })
      .finally(() => setThreadsLoading(false));
  }, []);

  const verifyAccess = useCallback(() => {
    setActiveThread(null);
    if (!uid) { setAllowed(false); return; }
    setAllowed(null);
    isAdmin(uid)
      .then(ok => { setAllowed(ok); if (ok) loadThreads(); })
      .catch(() => setAllowed(false));
  }, [uid, loadThreads]);

  useEffect(() => {
    if (!open) return;
    verifyAccess();
  }, [open, verifyAccess]);

  return (
    <Sheet open={open} onClose={onClose} z={71}>
      <div className="px-6 pt-7 pb-8 flex flex-col" style={{ height: "min(78vh, 640px)" }}>
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.4)" }}>
              <Inbox size={15} style={{ color: "#22d3ee" }} />
            </div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>{t("dev.supportTitle")}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>

        {allowed === null && (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
        )}

        {allowed === false && (
          <AdminAccessPreview uid={uid} kind="support" onRetry={verifyAccess} />
        )}

        {allowed && !activeThread && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
            {threadsLoading && (
              <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
            )}
            {!threadsLoading && threads.length === 0 && (
              <div className="text-xs text-center py-8" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("dev.supportEmpty")}</div>
            )}
            {threads.map(th => (
              <motion.button key={th.userId} whileTap={{ scale: 0.98 }} onClick={() => setActiveThread(th)} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left" style={GLASS}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>{th.username ?? th.userId.slice(0, 8)}</div>
                  <div className="text-xs truncate" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{th.lastText}</div>
                </div>
                {th.unreadCount > 0 && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "#f472b6", color: "#3f0d24", fontFamily: F.m }}>
                    {th.unreadCount}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {allowed && activeThread && (
          <AdminThreadView userId={activeThread.userId} username={activeThread.username} onBack={() => { setActiveThread(null); loadThreads(); }} />
        )}
      </div>
    </Sheet>
  );
}

// ─── Очередь модерации для админов (двух создателей MYRA) ────────────────────
// Как и поддержка, модерация повторно проверяет isAdmin(uid), а RLS таблицы
// reports остаётся окончательным источником правды при подмене клиента.

const fmtReportTime = (iso: string) => new Date(iso).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function reportReasonLabel(code: string, t: (key: string) => string) {
  const found = REPORT_REASONS.find(r => r.code === code);
  return found ? t(found.labelKey) : code;
}

export function ModerationSheet({ open, onClose, uid }: { open: boolean; onClose: () => void; uid: string | null }) {
  const { t } = useLang();
  // null = проверяем, true/false = результат isAdmin(uid)
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reports, setReports] = useState<OpenReportRow[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<CreatorVerificationRequestPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Локальный оверрайд hidden по target_id трека — чтобы кнопка "скрыть/
  // вернуть" переключалась мгновенно, не дожидаясь рефетча всей очереди
  const [hiddenOverride, setHiddenOverride] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchOpenReports(), fetchPendingCreatorVerificationRequests()])
      .then(([nextReports, nextVerificationRequests]) => {
        setReports(nextReports);
        setVerificationRequests(nextVerificationRequests);
      })
      .catch(() => {
        setReports([]);
        setVerificationRequests([]);
        toast(t("mod.loadError"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  const verifyAccess = useCallback(() => {
    if (!uid) { setAllowed(false); return; }
    setAllowed(null);
    setHiddenOverride({});
    isAdmin(uid)
      .then(ok => { setAllowed(ok); if (ok) load(); })
      .catch(() => setAllowed(false));
  }, [uid, load]);

  useEffect(() => {
    if (!open) return;
    verifyAccess();
  }, [open, verifyAccess]);

  const resolve = async (id: string, status: "resolved" | "dismissed") => {
    setBusyId(id);
    const { error } = await resolveReport(id, status);
    setBusyId(null);
    if (error) { toast(t("mod.err")); return; }
    setReports(prev => prev.filter(r => r.id !== id));
    toast(status === "resolved" ? t("mod.resolved") : t("mod.dismissed"));
  };

  const toggleHide = async (targetId: string, currentlyHidden: boolean) => {
    setBusyId(targetId);
    const { error } = await hideTrack(targetId, !currentlyHidden);
    setBusyId(null);
    if (error) { toast(t("mod.err")); return; }
    setHiddenOverride(prev => ({ ...prev, [targetId]: !currentlyHidden }));
    toast(!currentlyHidden ? t("mod.hidden") : t("mod.unhidden"));
  };

  const reviewVerification = async (requestId: string, status: "approved" | "rejected") => {
    setBusyId(requestId);
    const { error } = await reviewCreatorVerificationRequest(requestId, status);
    setBusyId(null);
    if (error) { toast(t("mod.err")); return; }
    setVerificationRequests(prev => prev.filter(request => request.id !== requestId));
    toast(status === "approved" ? t("mod.verifyApproved") : t("mod.verifyRejected"));
  };

  return (
    <Sheet open={open} onClose={onClose} z={71}>
      <div className="px-6 pt-7 pb-8 flex flex-col" style={{ height: "min(78vh, 640px)" }}>
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)" }}>
              <Flag size={15} style={{ color: "#f87171" }} />
            </div>
            <div style={{ fontFamily: F.d, fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>{t("mod.title")}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)" }}>
            <X size={16} />
          </button>
        </div>

        {allowed === null && (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
        )}

        {allowed === false && (
          <AdminAccessPreview uid={uid} kind="moderation" onRetry={verifyAccess} />
        )}

        {allowed && (
          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5" style={{ scrollbarWidth: "none" }}>
            {loading && (
              <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: "color-mix(in srgb, var(--fg) 40%, transparent)" }} /></div>
            )}
            {!loading && reports.length === 0 && verificationRequests.length === 0 && (
              <div className="text-xs text-center py-8" style={{ color: "color-mix(in srgb, var(--fg) 45%, transparent)", fontFamily: F.b }}>{t("mod.empty")}</div>
            )}
            {verificationRequests.length > 0 && (
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] px-1 pt-1" style={{ color: "#c98cff", fontFamily: F.m }}>
                {t("mod.verificationQueue")}
              </div>
            )}
            {verificationRequests.map(request => {
              const busy = busyId === request.id;
              return (
                <div key={request.id} className="p-3.5 rounded-2xl flex flex-col gap-2.5" style={{ ...GLASS, borderColor: "rgba(201,140,255,0.28)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>
                        {request.username ?? request.user_id.slice(0, 8)}
                      </div>
                      <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 38%, transparent)", fontFamily: F.m }}>
                        {fmtReportTime(request.created_at)}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(201,140,255,0.14)", color: "#c98cff", fontFamily: F.m }}>
                      {t("mod.verification")}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl py-2" style={{ background: "color-mix(in srgb, var(--wash) 05%, transparent)" }}>
                      <strong className="block text-sm">{request.releases_count}</strong>
                      <span className="text-[9px]" style={{ color: "color-mix(in srgb, var(--fg) 42%, transparent)" }}>{t("mod.releases")}</span>
                    </div>
                    <div className="rounded-xl py-2" style={{ background: "color-mix(in srgb, var(--wash) 05%, transparent)" }}>
                      <strong className="block text-sm">{request.play_count}</strong>
                      <span className="text-[9px]" style={{ color: "color-mix(in srgb, var(--fg) 42%, transparent)" }}>{t("mod.plays")}</span>
                    </div>
                    <div className="rounded-xl py-2" style={{ background: "color-mix(in srgb, var(--wash) 05%, transparent)" }}>
                      <strong className="block text-sm">{request.has_listener_support ? "✓" : "—"}</strong>
                      <span className="text-[9px]" style={{ color: "color-mix(in srgb, var(--fg) 42%, transparent)" }}>{t("mod.support")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button disabled={busy} onClick={() => reviewVerification(request.id, "approved")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", fontFamily: F.b, opacity: busy ? 0.6 : 1 }}>
                      <CheckCheck size={12} /> {t("mod.approve")}
                    </button>
                    <button disabled={busy} onClick={() => reviewVerification(request.id, "rejected")} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: "rgba(248,113,113,0.14)", color: "#f87171", fontFamily: F.b, opacity: busy ? 0.6 : 1 }}>
                      <XCircle size={12} /> {t("mod.reject")}
                    </button>
                  </div>
                </div>
              );
            })}
            {reports.length > 0 && (
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] px-1 pt-2" style={{ color: "#f87171", fontFamily: F.m }}>
                {t("mod.reportsQueue")}
              </div>
            )}
            {reports.map(r => {
              const isTrack = r.target_type === "track";
              const isRealTrack = isTrack && !r.target_id.startsWith("catalog:");
              const hidden = hiddenOverride[r.target_id] ?? false;
              const busy = busyId === r.id || busyId === r.target_id;
              return (
                <div key={r.id} className="p-3.5 rounded-2xl flex flex-col gap-2" style={GLASS}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", fontFamily: F.m }}>
                      {reportReasonLabel(r.reason, t)}
                    </span>
                    <span className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>{fmtReportTime(r.created_at)}</span>
                  </div>

                  <div className="text-sm font-semibold truncate" style={{ fontFamily: F.b }}>
                    {isTrack ? (r.trackTitle ?? r.target_id) : t("mod.commentTarget")}
                  </div>
                  {r.details && (
                    <div className="text-xs" style={{ color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b }}>{r.details}</div>
                  )}
                  <div className="text-[10px]" style={{ color: "color-mix(in srgb, var(--fg) 35%, transparent)", fontFamily: F.m }}>
                    {t("mod.reporter")}: {r.reporterName ?? r.reporter_id.slice(0, 8)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {isRealTrack && r.trackAudioUrl && (
                      <a href={r.trackAudioUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)", color: "color-mix(in srgb, var(--fg) 70%, transparent)", fontFamily: F.b }}>
                        <ExternalLink size={12} /> {t("mod.openTrack")}
                      </a>
                    )}
                    {isRealTrack && (
                      <button disabled={busy} onClick={() => toggleHide(r.target_id, hidden)} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: hidden ? "rgba(52,211,153,0.15)" : "rgba(250,204,21,0.15)", color: hidden ? "#34d399" : "#facc15", fontFamily: F.b, opacity: busy ? 0.6 : 1 }}>
                        {hidden ? <Eye size={12} /> : <EyeOff size={12} />} {hidden ? t("mod.unhide") : t("mod.hide")}
                      </button>
                    )}
                    <button disabled={busy} onClick={() => resolve(r.id, "resolved")} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: "rgba(34,211,238,0.15)", color: "#22d3ee", fontFamily: F.b, opacity: busy ? 0.6 : 1 }}>
                      <CheckCheck size={12} /> {t("mod.resolve")}
                    </button>
                    <button disabled={busy} onClick={() => resolve(r.id, "dismissed")} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--wash) 07%, transparent)", color: "color-mix(in srgb, var(--fg) 55%, transparent)", fontFamily: F.b, opacity: busy ? 0.6 : 1 }}>
                      <XCircle size={12} /> {t("mod.dismiss")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
