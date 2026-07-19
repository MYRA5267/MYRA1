-- Оптимизации из Supabase Performance Advisor после прогона staging.

begin;

create index if not exists reports_reporter_id_idx on public.reports (reporter_id);
create index if not exists user_artifacts_artifact_idx on public.user_artifacts (artifact_id);
create index if not exists user_badges_badge_idx on public.user_badges (badge_id);
create index if not exists user_gifts_definition_idx on public.user_gifts (gift_id);
create index if not exists profile_showcase_gift_idx on public.profile_showcase (gift_record_id);
create index if not exists profile_showcase_artifact_idx on public.profile_showcase (artifact_record_id);
create index if not exists profile_showcase_badge_idx on public.profile_showcase (badge_record_id);

-- Для старых политик заменяем вызов auth.uid() на initplan-подзапрос.
-- ALTER POLICY сохраняет команду, роли и permissive/restrictive-режим.
do $do$
declare
  policy_row record;
  statement text;
begin
  for policy_row in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        (qual is not null and qual ~ 'auth\.uid\(\)' and qual !~* 'select\s+auth\.uid\(\)')
        or
        (with_check is not null and with_check ~ 'auth\.uid\(\)' and with_check !~* 'select\s+auth\.uid\(\)')
      )
  loop
    statement := format(
      'alter policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );

    if policy_row.qual is not null then
      statement := statement || format(
        ' using (%s)',
        replace(policy_row.qual, 'auth.uid()', '(select auth.uid())')
      );
    end if;

    if policy_row.with_check is not null then
      statement := statement || format(
        ' with check (%s)',
        replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())')
      );
    end if;

    execute statement;
  end loop;
end
$do$;

commit;
