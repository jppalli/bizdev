create extension if not exists "pgcrypto";

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  region text,
  genres text,
  reliability_score int not null default 3 check (reliability_score between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  title text not null,
  status text not null default 'sourced' check (status in ('sourced','contacted','evaluating','negotiation','signed','launched','rejected')),
  fit_score int not null default 3 check (fit_score between 1 and 5),
  monetization_score int not null default 3 check (monetization_score between 1 and 5),
  strategic_score int not null default 3 check (strategic_score between 1 and 5),
  next_step text,
  owner text,
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  game_title text not null,
  status text not null default 'draft' check (status in ('draft','review','signed','expired')),
  revenue_share_pct numeric(5,2) not null default 50 check (revenue_share_pct between 0 and 100),
  microtx_share_pct numeric(5,2) not null default 50 check (microtx_share_pct between 0 and 100),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'open' check (status in ('open','in_progress','blocked','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_date date,
  owner text,
  related_type text default 'general' check (related_type in ('opportunity','contract','studio','general')),
  related_id uuid,
  created_at timestamptz not null default now()
);

alter table public.studios enable row level security;
alter table public.opportunities enable row level security;
alter table public.contracts enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "allow authenticated read studios" on public.studios;
create policy "allow authenticated read studios"
on public.studios for select
to anon, authenticated using (true);

drop policy if exists "allow authenticated insert studios" on public.studios;
create policy "allow authenticated insert studios"
on public.studios for insert
to anon, authenticated with check (true);

drop policy if exists "allow authenticated read opps" on public.opportunities;
create policy "allow authenticated read opps"
on public.opportunities for select
to anon, authenticated using (true);

drop policy if exists "allow authenticated insert opps" on public.opportunities;
create policy "allow authenticated insert opps"
on public.opportunities for insert
to anon, authenticated with check (true);

drop policy if exists "allow authenticated read contracts" on public.contracts;
create policy "allow authenticated read contracts"
on public.contracts for select
to anon, authenticated using (true);

drop policy if exists "allow authenticated insert contracts" on public.contracts;
create policy "allow authenticated insert contracts"
on public.contracts for insert
to anon, authenticated with check (true);

drop policy if exists "allow authenticated read tasks" on public.tasks;
create policy "allow authenticated read tasks"
on public.tasks for select
to anon, authenticated using (true);

drop policy if exists "allow authenticated insert tasks" on public.tasks;
create policy "allow authenticated insert tasks"
on public.tasks for insert
to anon, authenticated with check (true);
