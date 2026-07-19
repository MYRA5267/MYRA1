import React, { useId } from "react";

const WORD =
  "M75 160 L75 78 L120 132 L165 78 L165 160 " +
  "M214 78 L254 124 L294 78 M254 124 L254 160 " +
  "M343 160 L343 78 M343 78 L377 78 A25 25 0 0 1 377 128 L343 128 M373 128 L409 160 " +
  "M457 160 L497 78 L537 160 M474 133 L520 133";

const C = { pearl: "#fff1e9", champagne: "#f8c7a6", copper: "#d98968", rose: "#bb668b", lilac: "#a876bc", ice: "#d9efff" };

/** Fluid glass wordmark derived from the MYRA brand board. */
export function MyraWordmark({ height = 26, style }: { height?: number; style?: React.CSSProperties }) {
  const u = useId();
  return (
    <svg viewBox="48 55 516 128" height={height} fill="none" role="img" aria-label="MYRA" style={{ display: "block", overflow: "visible", ...style }}>
      <title>MYRA</title>
      <defs>
        <linearGradient id={`${u}-metal`} x1="0" y1="0" x2="1" y2=".6">
          <stop offset="0" stopColor={C.ice} /><stop offset=".2" stopColor={C.pearl} /><stop offset=".54" stopColor={C.champagne} /><stop offset=".82" stopColor={C.copper} /><stop offset="1" stopColor={C.lilac} />
        </linearGradient>
        <filter id={`${u}-glow`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="8" result="b" /><feColorMatrix in="b" values="1 0 0 0 .76  0 1 0 0 .36  0 0 1 0 .23  0 0 0 .55 0" />
        </filter>
      </defs>
      <path d={WORD} stroke={C.copper} strokeOpacity=".34" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${u}-glow)`} />
      <path d={WORD} stroke={`url(#${u}-metal)`} strokeWidth="31" strokeLinecap="round" strokeLinejoin="round" />
      <path d={WORD} stroke="#2a1118" strokeOpacity=".32" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,8)" />
      <path d={WORD} stroke="#fffaf6" strokeOpacity=".72" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" transform="translate(0,-7)" />
    </svg>
  );
}

/**
 * Основной знак приложения. Здесь используется утверждённый растровый мастер,
 * а не приблизительно восстановленная SVG-буква: так M остаётся одинаковой в
 * шапке, PWA и Android-ассетах.
 */
export function MyraIcon({ size = 96, className }: { size?: number; className?: string }) {
  const src = `${import.meta.env.BASE_URL}icon-reference-master.png`;
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="MYRA"
      draggable={false}
      decoding="async"
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

export function MyraBrandLockup({ compact = false }: { compact?: boolean }) {
  if (compact) return <MyraIcon size={42} className="myra-brand-lockup-icon" />;
  return (
    <div className="myra-brand-lockup" aria-label="MYRA Music">
      <MyraIcon size={46} className="myra-brand-lockup-icon" />
      <div className="myra-brand-lockup-copy"><MyraWordmark height={25} /></div>
    </div>
  );
}
