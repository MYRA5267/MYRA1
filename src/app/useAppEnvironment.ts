import { useState, useEffect, useCallback } from "react";
import { ls } from "./data";
import { isWeakEnvironment, type ThemeName } from "./lib";

// Три независимых друг от друга кусочка "среды приложения" — тема, слабый-
// девайс-режим, десктопный layout. Ни один не завязан на плеер/подписки/
// соцслой, поэтому вынесены как есть, без изменения поведения.

// Все темы доступны бесплатно; здесь только честный циклический переключатель.
export function useThemeCycle() {
  const [theme, setTheme] = useState<ThemeName>(() => ls.get<ThemeName>("theme", "dark"));
  const toggleTheme = useCallback(() => {
    setTheme(th => {
      const next: ThemeName = th === "dark" ? "light" : th === "light" ? "neon" : "dark";
      ls.set("theme", next);
      return next;
    });
  }, []);
  return { theme, setTheme, toggleTheme };
}

// Упрощённая графика: слабые Android-устройства (и любой Android WebView —
// у него компоновка backdrop-filter объективно хуже Chrome, независимо от
// мощности процессора) роняют слои композитора — мигающие/пропадающие
// элементы под грузом backdrop-filter и блюров
export function useSimpleFx() {
  const [simpleFx, setSimpleFxState] = useState(() => {
    // Явный выбор пользователя всегда важнее автоэвристики
    try { if (localStorage.getItem("myra.simpleFx") !== null) return ls.get("simpleFx", false); } catch { /* приватный режим */ }
    return isWeakEnvironment();
  });
  const toggleSimpleFx = useCallback(() => {
    setSimpleFxState((s: boolean) => { ls.set("simpleFx", !s); return !s; });
  }, []);
  return { simpleFx, toggleSimpleFx };
}

// Десктопный сайдбар маунтится только на широких экранах: hidden lg:flex
// прятал его CSS-ом, но React-поддерево (со своей волной и rAF-циклом)
// продолжало жить и работать вхолостую на каждом телефоне
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return isDesktop;
}
