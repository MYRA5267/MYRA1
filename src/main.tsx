
  import { createRoot } from "react-dom/client";
  import { SentryErrorBoundary } from "./app/sentry";
  import { ErrorFallback } from "./app/errorFallback";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Каждый деплой переименовывает JS-чанки (хэш в имени файла) — вкладка,
  // открытая ДО деплоя, или браузер с закэшированным старым index.html,
  // пытается догрузить чанк, которого на сервере уже нет (404), и Vite шлёт
  // "vite:preloadError" вместо тихого падения. Без этого обработчика
  // пользователь видит "сайт не работает" после каждого нашего деплоя —
  // одна перезагрузка страницы получает актуальный index.html и чинит всё.
  // sessionStorage-флаг — чтобы не уйти в бесконечный цикл перезагрузок,
  // если сервер и правда недоступен, а не просто отдал новый деплой.
  window.addEventListener("vite:preloadError", () => {
    const key = "myra.reloadedAfterPreloadError";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.location.reload();
  });

  createRoot(document.getElementById("root")!).render(
    <SentryErrorBoundary fallback={ErrorFallback}>
      <App />
    </SentryErrorBoundary>,
  );
