-- Mira Fund Engine, part 1: tables + RLS. PAPER (simulated) fund only. Additive: touches no existing table.
-- All writes go through the service role (daily job + server API routes). Users may only SELECT.

create table if not exists public.fund_pools (
  pool        text primary key,                       -- 'safe' | 'growth' (any text, so tests can use their own pool)
  nav         numeric(20,8) not null check (nav > 0), -- value of one unit, in simulated THB
  units_total numeric(24,8) not null default 0 check (units_total >= 0),
  as_of       date not null,                          -- market date the NAV reflects
  weights     jsonb not null default '{}'::jsonb,     -- weights held after the last rebalance, e.g. {"SPY":0.2,"SHY":0.3,"CASH":0.1}
  updated_at  timestamptz not null default now()
);

create table if not exists public.fund_nav_history (
  pool    text not null references public.fund_pools(pool),
  as_of   date not null,
  nav     numeric(20,8) not null check (nav > 0),
  weights jsonb,
  regime  jsonb,                                      -- stress level, alarms, e_size, gate ... (model state of that day)
  primary key (pool, as_of)
);

create table if not exists public.user_units (
  user_id    text not null,                           -- Clerk user id (auth.jwt()->>'sub')
  pool       text not null references public.fund_pools(pool),
  units      numeric(24,8) not null default 0 check (units >= 0),
  cost       numeric(20,2) not null default 0 check (cost >= 0),  -- simulated THB still invested (cost basis)
  updated_at timestamptz not null default now(),
  primary key (user_id, pool)
);

create table if not exists public.fund_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    text,                                    -- null = pool-level rebalance
  pool       text not null references public.fund_pools(pool),
  type       text not null check (type in ('deposit','withdraw','rebalance')),
  amount     numeric(20,2),
  units      numeric(24,8),                           -- signed for a user-level rebalance (move between pools)
  nav        numeric(20,8),
  ref        text,                                    -- client idempotency key
  created_at timestamptz not null default now()
);
create unique index if not exists fund_events_user_ref_uq on public.fund_events (user_id, ref) where ref is not null;
create index if not exists fund_events_user_idx on public.fund_events (user_id, created_at desc);

alter table public.fund_pools        enable row level security;
alter table public.fund_nav_history  enable row level security;
alter table public.user_units        enable row level security;
alter table public.fund_events       enable row level security;

revoke all on public.fund_pools, public.fund_nav_history, public.user_units, public.fund_events from anon, authenticated;
grant select on public.fund_pools, public.fund_nav_history, public.user_units, public.fund_events to authenticated;

create policy fund_pools_read on public.fund_pools for select to authenticated using (true);
create policy fund_nav_history_read on public.fund_nav_history for select to authenticated using (true);
create policy user_units_own_read on public.user_units for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
create policy fund_events_own_read on public.fund_events for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));
-- No INSERT/UPDATE/DELETE policies: with RLS on, authenticated users cannot write. service_role bypasses RLS.
