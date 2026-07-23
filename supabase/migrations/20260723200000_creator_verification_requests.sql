-- Настоящая очередь заявок артистов на верификацию.
-- Миграция аддитивная: существующие таблицы и клиенты не затрагиваются.

create table if not exists public.creator_verification_requests (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  status               text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  releases_count       integer not null default 0 check (releases_count >= 0),
  play_count           bigint not null default 0 check (play_count >= 0),
  has_listener_support boolean not null default false,
  reviewer_note        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  reviewed_at          timestamptz
);

create index if not exists creator_verification_requests_status_idx
  on public.creator_verification_requests (status, created_at desc);
create unique index if not exists creator_verification_requests_one_pending_idx
  on public.creator_verification_requests (user_id)
  where status = 'pending';

alter table public.creator_verification_requests enable row level security;

drop policy if exists creator_verification_requests_select_participant_or_admin
  on public.creator_verification_requests;
create policy creator_verification_requests_select_participant_or_admin
  on public.creator_verification_requests for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.admins
      where user_id = (select auth.uid())
    )
  );

drop policy if exists creator_verification_requests_insert_own
  on public.creator_verification_requests;
create policy creator_verification_requests_insert_own
  on public.creator_verification_requests for insert
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
  );

drop policy if exists creator_verification_requests_update_admin
  on public.creator_verification_requests;
create policy creator_verification_requests_update_admin
  on public.creator_verification_requests for update
  using (
    exists (
      select 1 from public.admins
      where user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.admins
      where user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.creator_verification_requests to authenticated;
