-- Объединяет эквивалентные permissive RLS-политики, чтобы Postgres не
-- вычислял несколько OR-веток для каждой строки.

begin;

drop policy if exists donations_select_own on public.donations;
drop policy if exists donations_select_received on public.donations;
create policy donations_select_participant
  on public.donations for select
  to authenticated
  using (
    from_user = (select auth.uid())
    or to_user_id = (select auth.uid())
  );

drop policy if exists support_messages_select_own on public.support_messages;
drop policy if exists support_messages_select_admin on public.support_messages;
create policy support_messages_select_participant_or_admin
  on public.support_messages for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.admins
      where user_id = (select auth.uid())
    )
  );

drop policy if exists support_messages_insert_own on public.support_messages;
drop policy if exists support_messages_insert_admin on public.support_messages;
create policy support_messages_insert_participant_or_admin
  on public.support_messages for insert
  to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and from_role in ('user', 'ai')
    )
    or (
      from_role = 'support'
      and exists (
        select 1 from public.admins
        where user_id = (select auth.uid())
      )
    )
  );

drop policy if exists reports_select_own on public.reports;
drop policy if exists reports_select_admin on public.reports;
create policy reports_select_participant_or_admin
  on public.reports for select
  to authenticated
  using (
    reporter_id = (select auth.uid())
    or exists (
      select 1 from public.admins
      where user_id = (select auth.uid())
    )
  );

drop policy if exists tracks_select_public on public.tracks;
drop policy if exists tracks_select_admin on public.tracks;
create policy tracks_select_visible_or_admin
  on public.tracks for select
  to anon, authenticated
  using (
    not hidden
    or owner_id = (select auth.uid())
    or exists (
      select 1 from public.admins
      where user_id = (select auth.uid())
    )
  );

drop policy if exists tracks_update_own on public.tracks;
drop policy if exists tracks_update_admin on public.tracks;
create policy tracks_update_owner_or_admin
  on public.tracks for update
  to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.admins
      where user_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.admins
      where user_id = (select auth.uid())
    )
  );

commit;
