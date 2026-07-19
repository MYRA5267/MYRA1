-- MYRA / «Между»: социальные Моменты и профильная идентичность.
--
-- Миграция подготавливается локально и должна сначала применяться в Supabase
-- Branch. Она не выдаёт клиенту права создавать подарки, знаки, артефакты или
-- опыт спутника: такие операции выполняет только доверенная Edge Function.

begin;

-- ---------------------------------------------------------------------------
-- Моменты: короткие публикации, связанные с треком и конкретной позицией.
-- media_path хранит путь в приватном Storage bucket, не публичный URL.
-- ---------------------------------------------------------------------------

create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  track_id text,
  track_pct numeric(5,2),
  kind text not null default 'text' check (kind in ('text', 'image', 'video', 'voice')),
  body text not null default '' check (char_length(body) <= 1200),
  media_path text,
  visibility text not null default 'public' check (visibility in ('public', 'followers')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (track_pct is null or (track_pct >= 0 and track_pct <= 100)),
  check (body <> '' or media_path is not null),
  check (expires_at > created_at)
);

create index if not exists moments_author_created_idx on public.moments (author_id, created_at desc);
create index if not exists moments_expires_idx on public.moments (expires_at desc);
create index if not exists moments_track_idx on public.moments (track_id, created_at desc) where track_id is not null;

alter table public.moments enable row level security;

drop policy if exists moments_select_visible on public.moments;
create policy moments_select_visible
  on public.moments for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or (
      expires_at > now()
      and (
        visibility = 'public'
        or exists (
          select 1
          from public.user_follows uf
          where uf.follower_id = (select auth.uid())
            and uf.followee_id = moments.author_id
        )
      )
    )
  );

drop policy if exists moments_insert_own on public.moments;
create policy moments_insert_own
  on public.moments for insert
  to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists moments_delete_own on public.moments;
create policy moments_delete_own
  on public.moments for delete
  to authenticated
  using (author_id = (select auth.uid()));

revoke all on public.moments from anon, authenticated;
grant select, insert, delete on public.moments to authenticated;

-- Просмотр каждого Момента учитывается один раз на аккаунт.
create table if not exists public.moment_views (
  moment_id uuid not null references public.moments(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (moment_id, viewer_id)
);

create index if not exists moment_views_viewer_idx on public.moment_views (viewer_id, viewed_at desc);
alter table public.moment_views enable row level security;

drop policy if exists moment_views_select_participant on public.moment_views;
create policy moment_views_select_participant
  on public.moment_views for select
  to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (
      select 1 from public.moments m
      where m.id = moment_views.moment_id
        and m.author_id = (select auth.uid())
    )
  );

drop policy if exists moment_views_insert_own on public.moment_views;
create policy moment_views_insert_own
  on public.moment_views for insert
  to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (
      select 1
      from public.moments m
      where m.id = moment_views.moment_id
    )
  );

revoke all on public.moment_views from anon, authenticated;
grant select, insert on public.moment_views to authenticated;

create table if not exists public.moment_reactions (
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('heart', 'spark', 'wave', 'goosebumps', 'repeat')),
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);

create index if not exists moment_reactions_user_idx on public.moment_reactions (user_id, created_at desc);
alter table public.moment_reactions enable row level security;

drop policy if exists moment_reactions_select_authenticated on public.moment_reactions;
create policy moment_reactions_select_authenticated
  on public.moment_reactions for select
  to authenticated
  using (
    exists (
      select 1
      from public.moments m
      where m.id = moment_reactions.moment_id
    )
  );

drop policy if exists moment_reactions_insert_own on public.moment_reactions;
create policy moment_reactions_insert_own
  on public.moment_reactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.moments m
      where m.id = moment_reactions.moment_id
    )
  );

drop policy if exists moment_reactions_update_own on public.moment_reactions;
create policy moment_reactions_update_own
  on public.moment_reactions for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.moments m
      where m.id = moment_reactions.moment_id
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.moments m
      where m.id = moment_reactions.moment_id
    )
  );

drop policy if exists moment_reactions_delete_own on public.moment_reactions;
create policy moment_reactions_delete_own
  on public.moment_reactions for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.moment_reactions from anon, authenticated;
grant select, insert, update, delete on public.moment_reactions to authenticated;

-- ---------------------------------------------------------------------------
-- Спутники и коллекционные сущности. Каталоги публично читаются только после
-- входа. Записи владения видимы в профиле, но клиент не может создавать их.
-- ---------------------------------------------------------------------------

create table if not exists public.companion_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  companion_id text not null check (companion_id in ('luma', 'spark', 'echo')),
  xp integer not null default 0 check (xp >= 0),
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companion_profiles enable row level security;
drop policy if exists companion_profiles_select_public on public.companion_profiles;
create policy companion_profiles_select_public
  on public.companion_profiles for select
  to authenticated
  using (true);
revoke all on public.companion_profiles from anon, authenticated;
grant select on public.companion_profiles to authenticated;

create table if not exists public.artifact_definitions (
  id text primary key,
  name_ru text not null,
  name_en text not null,
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
  accent text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.artifact_definitions enable row level security;
drop policy if exists artifact_definitions_select_active on public.artifact_definitions;
create policy artifact_definitions_select_active
  on public.artifact_definitions for select
  to authenticated
  using (active = true);
revoke all on public.artifact_definitions from anon, authenticated;
grant select on public.artifact_definitions to authenticated;

create table if not exists public.user_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  artifact_id text not null references public.artifact_definitions(id),
  source text not null,
  granted_at timestamptz not null default now(),
  unique (user_id, artifact_id)
);

create index if not exists user_artifacts_user_idx on public.user_artifacts (user_id, granted_at desc);
create index if not exists user_artifacts_artifact_idx on public.user_artifacts (artifact_id);
alter table public.user_artifacts enable row level security;
drop policy if exists user_artifacts_select_public on public.user_artifacts;
create policy user_artifacts_select_public
  on public.user_artifacts for select
  to authenticated
  using (true);
revoke all on public.user_artifacts from anon, authenticated;
grant select on public.user_artifacts to authenticated;

create table if not exists public.badge_definitions (
  id text primary key,
  name_ru text not null,
  name_en text not null,
  kind text not null check (kind in ('status', 'achievement', 'event')),
  accent text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.badge_definitions enable row level security;
drop policy if exists badge_definitions_select_active on public.badge_definitions;
create policy badge_definitions_select_active
  on public.badge_definitions for select
  to authenticated
  using (active = true);
revoke all on public.badge_definitions from anon, authenticated;
grant select on public.badge_definitions to authenticated;

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badge_definitions(id),
  source text not null,
  granted_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id, granted_at desc);
create index if not exists user_badges_badge_idx on public.user_badges (badge_id);
alter table public.user_badges enable row level security;
drop policy if exists user_badges_select_public on public.user_badges;
create policy user_badges_select_public
  on public.user_badges for select
  to authenticated
  using (true);
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;

create table if not exists public.gift_definitions (
  id text primary key,
  name_ru text not null,
  name_en text not null,
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
  accent text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.gift_definitions enable row level security;
drop policy if exists gift_definitions_select_active on public.gift_definitions;
create policy gift_definitions_select_active
  on public.gift_definitions for select
  to authenticated
  using (active = true);
revoke all on public.gift_definitions from anon, authenticated;
grant select on public.gift_definitions to authenticated;

create table if not exists public.user_gifts (
  id uuid primary key default gen_random_uuid(),
  gift_id text not null references public.gift_definitions(id),
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text check (message is null or char_length(message) <= 280),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists user_gifts_recipient_idx on public.user_gifts (recipient_id, created_at desc);
create index if not exists user_gifts_sender_idx on public.user_gifts (sender_id, created_at desc);
create index if not exists user_gifts_definition_idx on public.user_gifts (gift_id);
alter table public.user_gifts enable row level security;

drop policy if exists user_gifts_select_visible on public.user_gifts;
create policy user_gifts_select_visible
  on public.user_gifts for select
  to authenticated
  using (
    is_public = true
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

-- INSERT намеренно отсутствует. Edge Function проверит каталог, лимит,
-- платёжный статус (если появится) и только затем создаст подарок service role.
revoke all on public.user_gifts from anon, authenticated;
grant select on public.user_gifts to authenticated;

create table if not exists public.profile_showcase (
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  gift_record_id uuid references public.user_gifts(id) on delete cascade,
  artifact_record_id uuid references public.user_artifacts(id) on delete cascade,
  badge_record_id uuid references public.user_badges(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  check (num_nonnulls(gift_record_id, artifact_record_id, badge_record_id) = 1)
);

create index if not exists profile_showcase_gift_idx on public.profile_showcase (gift_record_id);
create index if not exists profile_showcase_artifact_idx on public.profile_showcase (artifact_record_id);
create index if not exists profile_showcase_badge_idx on public.profile_showcase (badge_record_id);

alter table public.profile_showcase enable row level security;
drop policy if exists profile_showcase_select_public on public.profile_showcase;
create policy profile_showcase_select_public
  on public.profile_showcase for select
  to authenticated
  using (true);

-- Запись витрины также идёт через доверенную функцию: простая polymorphic
-- FK-схема не способна сама доказать, что выбранный объект принадлежит user_id.
revoke all on public.profile_showcase from anon, authenticated;
grant select on public.profile_showcase to authenticated;

commit;
