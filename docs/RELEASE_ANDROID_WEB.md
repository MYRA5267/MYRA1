# MYRA: выпуск Android и веб-версии

Актуально для первой публичной версии: приложение бесплатное, iOS не входит в релиз, «Спутник MYRA» скрыт до отдельного запуска.

## 1. Что блокирует публикацию сейчас

1. Заполнить владельца сервиса и контактный email в `public/privacy.html`, затем отдать политику и условия юристу. Плейсхолдеры публиковать нельзя.
2. Убедиться, что все демо-треки и обложки разрешено распространять. Публичные MP3 нельзя использовать как коммерческий каталог без лицензии.
3. Применить `supabase/schema.sql` в production-проекте и проверить Security Advisor.
4. Настроить SMTP, подтверждение email, rate limits и резервные копии Supabase.
5. Создать upload key Android, включить Play App Signing и сохранить ключ/пароли вне Git.
6. Подготовить карточку Google Play: описание, скриншоты, иконка 512×512, feature graphic, возрастной рейтинг, Data safety, privacy URL и URL удаления аккаунта.
7. Прогнать закрытое тестирование на нескольких реальных устройствах и исправить crash/ANR до production rollout.

## 2. Supabase production

### Клиентские переменные

В GitHub Environment `Production` и в хостинге веб-версии добавить:

```text
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=публичный_anon_key
VITE_SENTRY_DSN=dsn_проекта_sentry
VITE_PAYMENTS_ENABLED=false
VITE_DISTRIBUTION_CHANNEL=web
```

`anon`-ключ разрешено хранить во фронтенде: безопасность обеспечивается RLS. `service_role`, ключ ЮKassa и токены Supabase никогда не должны иметь префикс `VITE_` и не должны попадать в приложение.

### База и права

1. Supabase Dashboard → SQL Editor → выполнить `supabase/schema.sql` в новом production-проекте.
2. Добавить аккаунт владельца в администраторы только из SQL Editor:

```sql
insert into public.admins (user_id)
values ('4048efc9-dd74-4ff3-8709-dc7542058d20')
on conflict (user_id) do nothing;
```

3. Проверить, что бакет `tracks` создан, RLS включён на всех таблицах, а обычный пользователь не может читать чужую поддержку, назначать себя админом или менять платежи.
4. Задеплоить функции `delete-account`, `support-chat`, `set-subscription`. Платёжные функции пока можно оставить задеплоенными без секретов: клиент их не показывает при `VITE_PAYMENTS_ENABLED=false`.

### Серверные секреты

```powershell
supabase secrets set OPENROUTER_API_KEY=...
```

Для будущей веб-оплаты:

```powershell
supabase secrets set YOOKASSA_SHOP_ID=... YOOKASSA_SECRET_KEY=...
```

В ЮKassa затем указать webhook:

```text
https://PROJECT_REF.supabase.co/functions/v1/yookassa-webhook
```

## 3. Веб-версия

Веб-приложение уже собирается как PWA:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run preview
```

Бесплатные варианты публикации:

- GitHub Pages — workflow `.github/workflows/deploy-web.yml` уже готов. В репозитории открыть Settings → Pages → Source → GitHub Actions, а переменные добавить в Secrets/Environment.
- Cloudflare Pages — импортировать GitHub-репозиторий, build command `npm run build`, output directory `dist`, затем добавить те же env-переменные. Файл `public/_headers` применит базовые security/cache-заголовки.

После подключения домена открыть и проверить:

- `/` — веб-версия;
- `/privacy.html` — политика;
- `/terms.html` — условия;
- `/delete-account.html` — удаление аккаунта;
- установку PWA на Android и desktop;
- регистрацию, подтверждение email, загрузку трека, «Пульс», поддержку и удаление аккаунта.

## 4. Подпись и Android App Bundle

Для Android не покупают «коммерческий сертификат» как для Windows. Нужен собственный upload key, а Google Play подписывает распространяемые APK через Play App Signing.

Создание upload key выполняется один раз:

```powershell
keytool -genkeypair -v -keystore myra-upload.jks -alias myra-upload -keyalg RSA -keysize 4096 -validity 10000
```

Ключ хранить минимум в двух защищённых резервных копиях. Скопировать `android/keystore.properties.example` в `android/keystore.properties`, указать путь и пароли. Оба файла исключены из Git.

Сборка:

```powershell
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

Результат: `android/app/build/outputs/bundle/release/app-release.aab`. Перед каждой новой загрузкой увеличивать `versionCode`. Проект уже использует `targetSdkVersion 36`.

## 5. Платежи

Первый релиз безопаснее выпустить бесплатным. Не включать фальшивые платежи и не собирать данные карт самостоятельно.

- Google Play: цифровые подписки, подарки с цифровой наградой и функции приложения — Google Play Billing. В Play-сборке использовать `VITE_DISTRIBUTION_CHANNEL=google-play`; текущая ЮKassa будет отключена.
- RuStore: отдельный Android flavor и RuStore Pay SDK для подписок/товаров.
- Web и direct APK: ЮKassa через Supabase Edge Functions и hosted payment page. Секрет хранится только на сервере, финальный статус принимает webhook.
- Прямые чаевые артисту без цифровой награды могут иметь отдельный сценарий, но бейдж за оплату превращает операцию в цифровую выгоду. До юридической и store-проверки награду за платёж не включать.

Архитектурно следующим этапом нужен интерфейс `PaymentProvider` и три реализации: `GooglePlayBillingProvider`, `RuStorePayProvider`, `YooKassaProvider`. Нельзя собирать один Android-бинарник с произвольным переходом между провайдерами.

## 6. Финальная приёмка Android

- cold start, логин/логаут, восстановление сессии;
- плеер, следующий/предыдущий трек, пауза, seek, Bluetooth/гарнитура;
- системное media-уведомление при свёрнутом и закрытом экране;
- входящий звонок/потеря audio focus;
- плохая сеть, offline state, повтор загрузки;
- 60/90/120/144 Гц без постоянных long frames;
- память после 30 минут прослушивания;
- загрузка больших файлов и отмена;
- RLS, жалобы, модерация, поддержка;
- удаление аккаунта из Android и из веба;
- отсутствие тестовых платежей, секретов, персональных данных и нелицензированного контента в production.
