create table if not exists public.game_evaluations (
  id uuid primary key default gen_random_uuid(),
  game_name text not null,
  developer_studio text,
  genre text,
  platform text,
  evaluator text,
  evaluation_date date,
  notes text,
  total_score numeric(6,3) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.game_evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.game_evaluations(id) on delete cascade,
  category text not null,
  weight numeric(6,3) not null check (weight >= 0 and weight <= 1),
  score int not null check (score between 1 and 5),
  weighted_score numeric(6,3) not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.game_evaluations enable row level security;
alter table public.game_evaluation_scores enable row level security;

drop policy if exists "allow authenticated read game evals" on public.game_evaluations;
create policy "allow authenticated read game evals"
on public.game_evaluations for select
to anon, authenticated using (true);

drop policy if exists "allow authenticated insert game evals" on public.game_evaluations;
create policy "allow authenticated insert game evals"
on public.game_evaluations for insert
to anon, authenticated with check (true);

drop policy if exists "allow authenticated read game eval rows" on public.game_evaluation_scores;
create policy "allow authenticated read game eval rows"
on public.game_evaluation_scores for select
to anon, authenticated using (true);

drop policy if exists "allow authenticated insert game eval rows" on public.game_evaluation_scores;
create policy "allow authenticated insert game eval rows"
on public.game_evaluation_scores for insert
to anon, authenticated with check (true);
