create table if not exists public.planning_games (
  id uuid primary key default gen_random_uuid(),
  game_name text not null,
  studio_name text,
  genre text,
  platform text,
  go_live_raw text,
  plan_year int not null check (plan_year in (2026, 2027)),
  plan_quarter int not null check (plan_quarter between 1 and 4),
  sort_order int not null default 0,
  source text not null default 'manual' check (source in ('manual','spreadsheet')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_planning_games_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_planning_games_updated_at on public.planning_games;
create trigger trg_planning_games_updated_at
before update on public.planning_games
for each row execute function public.set_planning_games_updated_at();

alter table public.planning_games enable row level security;

drop policy if exists "allow authenticated read planning games" on public.planning_games;
create policy "allow authenticated read planning games"
on public.planning_games for select
to anon, authenticated using (true);

drop policy if exists "allow authenticated insert planning games" on public.planning_games;
create policy "allow authenticated insert planning games"
on public.planning_games for insert
to anon, authenticated with check (true);

drop policy if exists "allow authenticated update planning games" on public.planning_games;
create policy "allow authenticated update planning games"
on public.planning_games for update
to anon, authenticated using (true) with check (true);
