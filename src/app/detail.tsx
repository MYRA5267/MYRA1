import React, { useId, useRef, useState } from "react";

// ─── DETAIL — фирменный визуальный мотив MYRA ────────────────────────────────
// Светящаяся полупрозрачная волна в медно-розовых/золотистых/фиолетовых/
// холодных тонах — тот же принцип, что уже даёт Aurora (lib.tsx), но не
// круглые пятна, а органическая лента, ближе к референсу бренда.
//
// Реального кропа референса нет в комплекте — компонент пробует загрузить
// public/detail/detail.webp (см. DETAIL_SRC ниже); пока файла нет, <img>
// молча падает по onError, и остаётся видна процедурная SVG-лента той же
// палитрой, что и --brand-grad (THEMES, lib.tsx): фиолетовый → небо →
// жемчужная роза, плюс медь/золото из референса. Как только файл появится
// в репозитории — он подхватится сам, без правок в местах вызова.
//
// Как и Aurora, полностью декоративный: aria-hidden, pointer-events: none.
// Дыхание/дрейф гасятся классом .fx-simple и prefers-reduced-motion (см.
// theme.css) — так же, как остальной fx-* декор в приложении.

// Respect Vite's relative base so the web build works from a GitHub Pages subfolder too.
const DETAIL_SRC = `${import.meta.env.BASE_URL}detail/detail.webp`;

export type DetailVariant = "full" | "soft" | "blur" | "mobile";

const BASE_STOPS_A = [
  { offset: "0%", color: "#ffb37a" },  // медь
  { offset: "45%", color: "#f6b8c8" }, // жемчужная роза (из --brand-grad)
  { offset: "100%", color: "#a78bfa" }, // фиолетовый (из --brand-grad)
];

const BASE_STOPS_B = [
  { offset: "0%", color: "#ffd88a" },  // золото
  { offset: "50%", color: "#7dd3fc" }, // небо (из --brand-grad)
  { offset: "100%", color: "#a78bfa" }, // фиолетовый
];

/**
 * Атмосферный фирменный слой DETAIL. Полностью декоративный — не должен
 * перекрывать текст/контролы (используется как задний план с mask-image,
 * растворяющим края, см. .myra-detail в theme.css).
 *
 * accent — если задан (обычно track.c2), подмешивается в среднюю точку
 * первой ленты, чтобы DETAIL мягко менялся вместе с текущим треком, а не
 * жил отдельной от музыки жизнью.
 *
 * active — false на паузе: дыхание замедляется (не останавливается резко —
 * см. ТЗ "во время паузы движение должно замедляться").
 */
export const DetailBackdrop = React.memo(function DetailBackdrop({
  variant = "full",
  accent,
  active = true,
  className = "",
}: {
  variant?: DetailVariant;
  accent?: string;
  active?: boolean;
  className?: string;
}) {
  const uid = useId();
  const idA = `detail-a-${uid}`;
  const idB = `detail-b-${uid}`;
  const [photoOk, setPhotoOk] = useState(false);
  const [photoTried, setPhotoTried] = useState(false);

  const stopsA = accent
    ? [BASE_STOPS_A[0], { offset: "45%", color: accent }, BASE_STOPS_A[2]]
    : BASE_STOPS_A;

  return (
    <div
      aria-hidden="true"
      className={`myra-detail myra-detail--${variant}${active ? "" : " myra-detail--paused"} ${className}`}
    >
      {/* Реальный ассет — рендерится всегда (чтобы браузер попытался
          загрузить), но виден только после успешной загрузки; до этого
          момента и при 404 его перекрывает процедурная лента ниже */}
      {!photoTried || photoOk ? (
        <img
          src={DETAIL_SRC}
          alt=""
          loading="lazy"
          decoding="async"
          className="myra-detail-photo"
          style={{ opacity: photoOk ? undefined : 0 }}
          onLoad={() => setPhotoOk(true)}
          onError={() => setPhotoTried(true)}
        />
      ) : null}
      {!photoOk && (
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" focusable="false">
          <defs>
            <linearGradient id={idA} x1="0%" y1="20%" x2="100%" y2="80%">
              {stopsA.map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
            </linearGradient>
            <linearGradient id={idB} x1="100%" y1="10%" x2="0%" y2="90%">
              {BASE_STOPS_B.map(s => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
            </linearGradient>
          </defs>
          <path
            className="myra-detail-ribbon myra-detail-ribbon-a"
            fill={`url(#${idA})`}
            d="M-40,120 C40,60 110,180 190,110 C270,40 330,140 440,90 L440,300 L-40,300 Z"
          />
          <path
            className="myra-detail-ribbon myra-detail-ribbon-b"
            fill={`url(#${idB})`}
            d="M-40,180 C50,220 120,90 210,160 C300,230 340,100 440,150 L440,300 L-40,300 Z"
          />
        </svg>
      )}
      {/* Лёгкая цветовая связь с текущим треком поверх реального фото —
          обычная альфа-подмешка, без mix-blend-mode (см. риски в плане) */}
      {accent && photoOk && (
        <div className="myra-detail-tint" style={{ background: `radial-gradient(circle at 50% 40%, ${accent}2e, transparent 70%)` }} />
      )}
    </div>
  );
});

// A deliberately slim signature membrane. The previous version stacked four
// filtered paths and three bitmap copies inside every timeline. That looked
// oversized on a phone and was expensive for Android WebView's compositor.
const DETAIL_WAVE_PATH = "M-12 30 C55 15 112 20 174 31 C239 43 296 18 360 24 C425 30 478 45 542 31 C611 16 676 20 812 32 L812 47 C690 39 619 48 547 44 C477 40 425 52 356 45 C288 38 236 53 169 44 C104 35 50 46 -12 41 Z";
const DETAIL_WAVE_EDGE = "M-12 30 C55 15 112 20 174 31 C239 43 296 18 360 24 C425 30 478 45 542 31 C611 16 676 20 812 32";

/**
 * Фирменный индикатор прогресса MYRA: органичная стеклянная лента из DETAIL.
 * Прогресс подсвечивает уже прослушанную часть, а при наличии onSeek лента
 * работает как полноценный слайдер мышью, пальцем и с клавиатуры.
 */
export const DetailWave = React.memo(function DetailWave({
  progress,
  buffered,
  playing = false,
  height = 32,
  onSeek,
  compact = false,
  className = "",
  accent = "#d98968",
}: {
  progress: number;
  buffered?: number;
  playing?: boolean;
  height?: number;
  onSeek?: (progress: number) => void;
  compact?: boolean;
  className?: string;
  accent?: string;
}) {
  const rawId = useId().replace(/:/g, "");
  const bufferId = `myra-detail-wave-buffer-${rawId}`;
  const progressId = `myra-detail-wave-progress-${rawId}`;
  const gradientId = `myra-detail-wave-gradient-${rawId}`;
  const bufferGradientId = `myra-detail-wave-buffer-gradient-${rawId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const value = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const loadedValue = Math.max(value, Math.min(100, Number.isFinite(buffered) ? Number(buffered) : value));

  const seekAt = (clientX: number) => {
    if (!onSeek || !rootRef.current) return;
    const bounds = rootRef.current.getBoundingClientRect();
    if (!bounds.width) return;
    onSeek(Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100)));
  };

  return (
    <div
      ref={rootRef}
      className={`myra-detail-wave${playing ? " is-playing" : ""}${loadedValue < 99 ? " is-loading" : " is-loaded"}${compact ? " is-compact" : ""}${onSeek ? " is-interactive" : ""} ${className}`}
      style={{
        height,
        "--myra-wave-accent": accent,
        "--myra-wave-progress": `${value}%`,
        "--myra-wave-buffered": `${loadedValue}%`,
      } as React.CSSProperties}
      role={onSeek ? "slider" : "img"}
      aria-label="Прогресс воспроизведения"
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(value) : undefined}
      aria-valuetext={onSeek ? `${Math.round(value)}% прослушано, ${Math.round(loadedValue)}% загружено` : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onPointerDown={onSeek ? e => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        seekAt(e.clientX);
      } : undefined}
      onPointerMove={onSeek ? e => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) seekAt(e.clientX);
      } : undefined}
      onKeyDown={onSeek ? e => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onSeek(Math.max(0, value - 2)); }
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onSeek(Math.min(100, value + 2)); }
        if (e.key === "Home") { e.preventDefault(); onSeek(0); }
        if (e.key === "End") { e.preventDefault(); onSeek(100); }
      } : undefined}
    >
      <svg viewBox="0 0 800 64" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={bufferId}>
            <rect x="0" y="0" width={Math.max(0, 800 * loadedValue / 100)} height="64" />
          </clipPath>
          <clipPath id={progressId}>
            <rect x="0" y="0" width={Math.max(0, 800 * value / 100)} height="64" />
          </clipPath>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff3ea" stopOpacity="0.96" />
            <stop offset="0.34" stopColor="#ffc4a5" stopOpacity="0.9" />
            <stop offset="0.7" stopColor={accent} stopOpacity="0.88" />
            <stop offset="1" stopColor="#d8c6ff" stopOpacity="0.86" />
          </linearGradient>
          <linearGradient id={bufferGradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#cfa99d" stopOpacity="0.18" />
            <stop offset="0.7" stopColor="#f0c9bd" stopOpacity="0.34" />
            <stop offset="1" stopColor="#f8ded4" stopOpacity="0.48" />
          </linearGradient>
        </defs>

        <path className="myra-detail-wave-ghost" d={DETAIL_WAVE_PATH} />
        <g className="myra-detail-wave-buffer-layer" clipPath={`url(#${bufferId})`}>
          <path d={DETAIL_WAVE_PATH} fill={`url(#${bufferGradientId})`} />
        </g>
        <g clipPath={`url(#${progressId})`}>
          <path className="myra-detail-wave-media-progress" d={DETAIL_WAVE_PATH} fill={`url(#${gradientId})`} />
          <path className="myra-detail-wave-highlight" d={DETAIL_WAVE_EDGE} />
        </g>
        <path className="myra-detail-wave-top-rim" d={DETAIL_WAVE_EDGE} />
      </svg>
      {loadedValue > value + 0.8 && loadedValue < 99.8 && <span className="myra-detail-wave-buffer-head" aria-hidden="true" />}
      {value > 0 && <span className="myra-detail-wave-playhead" aria-hidden="true"><i /></span>}
    </div>
  );
});
