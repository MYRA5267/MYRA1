# MYRA Staging — отчёт проверки Supabase

Дата: 2026-07-19
Проект: `MYRA Staging`
Project ref: `evvoemrlaeazcswbyrov`
Регион: `eu-west-1`
Стоимость: `$0/month`

После успешной проверки и явного подтверждения те же миграции применены к
production-проекту `gkyzjguhkjbdglqngmqj`. Контрольные количества данных до и
после совпали: profiles — 7, profile_private — 7, tracks — 1,
support_messages — 2, subscriptions — 7.

## Применённые миграции

1. `myra_base_core`
2. `myra_support_and_donations`
3. `myra_social_moderation_payments`
4. `between_social_identity`
5. `security_hardening`
6. `performance_hardening`
7. `policy_consolidation`
8. `oauth_profile_defaults`

Создано 23 таблицы в `public`; RLS включён на каждой пользовательской таблице.

## Advisors после исправлений

- Security Advisor: `0` замечаний.
- Performance Advisor: `0` предупреждений.
- Осталось 26 записей `unused_index` уровня `INFO`. Для пустой staging-базы это ожидаемо: статистика использования появится только после реальной нагрузки. Удалять эти индексы до профилирования production нельзя.

## Проверенные сценарии доступа

- `anon` читает публичный каталог `tracks` — HTTP 200.
- `anon` не может создать `moment` — HTTP 401.
- `authenticated` с чужим `author_id` блокируется RLS.
- `authenticated` со своим `author_id` проходит RLS; тестовая вставка затем ожидаемо блокируется FK из-за отсутствия тестового профиля.
- `authenticated` не имеет `INSERT` на `companion_profiles`.
- `authenticated` не имеет `INSERT` на `user_gifts`.
- `anon` и `authenticated` не имеют `EXECUTE` на `handle_new_user()`.
- широкая политика `tracks_storage_select_public` отсутствует; точные публичные URL бакета продолжают обслуживаться через public bucket.

## Что исправлено относительно production

- закрыт вызов `SECURITY DEFINER`-функций из клиентского API;
- запрещено перечисление всех объектов бакета `tracks`;
- добавлены недостающие индексы внешних ключей;
- `auth.uid()` в старых RLS-политиках переведён в initplan;
- дублирующие permissive-политики объединены;
- подготовлены таблицы Моментов, спутников, Артефактов, Знаков, Подарков и профильной витрины.

## Состояние production

- Все восемь миграций применены.
- 23 таблицы `public`, RLS включён на каждой.
- Security Advisor: одно внешнее замечание — выключена Leaked Password
  Protection. Оно включается в Dashboard Auth, не SQL-миграцией.
- Performance Advisor: предупреждений нет; 23 новых индекса пока отмечены
  только как `unused_index` уровня INFO, что ожидаемо до накопления нагрузки.
- OAuth-триггер понимает `username`, `full_name`, `name`, `user_name`, не
  доверяет внешнему значению роли и не доступен клиентским ролям через RPC.
