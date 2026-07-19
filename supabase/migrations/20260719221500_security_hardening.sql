-- Закрывает предупреждения Supabase Security Advisor, обнаруженные 2026-07-19.
-- Сначала применять в Supabase Branch и проверять загрузку/воспроизведение трека.

begin;

-- Публичному бакету не нужна SELECT-политика для доступа по точному getPublicUrl.
-- Удаление политики запрещает перечисление всех объектов через Storage API.
drop policy if exists "tracks_storage_select_public" on storage.objects;

-- Это триггерные функции. Клиентские роли не должны вызывать SECURITY DEFINER
-- напрямую через RPC; штатные триггеры продолжат исполняться от владельца.
-- to_regprocedure делает миграцию переносимой: rls_auto_enable есть в production,
-- но отсутствует в чистой исходной schema.sql.
do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'revoke execute on function public.handle_new_user() from public, anon, authenticated';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

-- Индексы для существующих внешних ключей из Performance Advisor.
create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists donations_from_user_idx on public.donations (from_user);

commit;
