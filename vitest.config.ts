import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

// react() нужен здесь же, где мы его подключаем в vite.config.ts: lib.tsx —
// это .tsx-файл с JSX в других экспортах (TiltCard, Sheet и т.д.), и без
// плагина esbuild не разберёт файл целиком, даже если useAudio JSX не использует.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: { environment: "jsdom" },
});
