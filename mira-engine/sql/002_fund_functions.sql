-- Mira Fund Engine, part 2: atomic unit accounting. PAPER (simulated) fund only.
-- Every function locks the pool row(s) FOR UPDATE, so deposits, withdrawals and the daily NAV update serialise.
-- Executable only by service_role (server job + server API routes).

create or replace function public.fund_deposit(p_user text, p_pool text, p_amount numeric, p_ref text default null)
returns jsonb language plpgsql set search_path = public as $$
declare v_pool fund_pools; v_amt numeric(20,2); v_units numeric(24,8); v_prev jsonb; v_u user_units;
begin
  v_amt := round(p_amount, 2);
  if p_user is null or p_user = '' then raise exception 'user required'; end if;
  if v_amt is null or v_amt <= 0 or v_amt > 10000000 then raise exception 'bad amount'; end if;
  select * into v_pool from fund_pools where pool = p_pool for update;
  if not found then raise exception 'unknown pool %', p_pool; end if;
  if p_ref is not null then      -- idempotent retry: same ref returns the first result, mints nothing
    select jsonb_build_object('pool',pool,'amount',amount,'units',units,'nav',nav,'replayed',true) into v_prev
      from fund_events where user_id = p_user and ref = p_ref;
    if v_prev is not null then return v_prev; end if;
  end if;
  v_units := round(v_amt / v_pool.nav, 8);
  if v_units <= 0 then raise exception 'amount too small'; end if;
  insert into user_units(user_id, pool, units, cost) values (p_user, p_pool, v_units, v_amt)
    on conflict (user_id, pool) do update
      set units = user_units.units + excluded.units, cost = user_units.cost + excluded.cost, updated_at = now()
    returning * into v_u;
  update fund_pools set units_total = units_total + v_units where pool = p_pool;
  insert into fund_events(user_id, pool, type, amount, units, nav, ref) values (p_user, p_pool, 'deposit', v_amt, v_units, v_pool.nav, p_ref);
  return jsonb_build_object('pool',p_pool,'amount',v_amt,'units',v_units,'nav',v_pool.nav,
                            'user_units',v_u.units,'value',round(v_u.units * v_pool.nav, 2),'replayed',false);
end $$;

-- withdraw p_amount THB, or everything when p_all (or when the request is within 1 satang of the whole holding)
create or replace function public.fund_withdraw(p_user text, p_pool text, p_amount numeric default null, p_ref text default null, p_all boolean default false)
returns jsonb language plpgsql set search_path = public as $$
declare v_pool fund_pools; v_u user_units; v_prev jsonb; v_value numeric(20,2); v_amt numeric(20,2);
        v_units numeric(24,8); v_cost numeric(20,2);
begin
  select * into v_pool from fund_pools where pool = p_pool for update;
  if not found then raise exception 'unknown pool %', p_pool; end if;
  if p_ref is not null then
    select jsonb_build_object('pool',pool,'amount',amount,'units',units,'nav',nav,'replayed',true) into v_prev
      from fund_events where user_id = p_user and ref = p_ref;
    if v_prev is not null then return v_prev; end if;
  end if;
  select * into v_u from user_units where user_id = p_user and pool = p_pool for update;
  if not found or v_u.units <= 0 then raise exception 'nothing to withdraw'; end if;
  v_value := round(v_u.units * v_pool.nav, 2);
  if p_all or p_amount is null or round(p_amount, 2) >= v_value - 0.01 then
    v_units := v_u.units; v_amt := v_value; v_cost := v_u.cost;      -- full exit: no dust left behind
  else
    v_amt := round(p_amount, 2);
    if v_amt <= 0 then raise exception 'bad amount'; end if;
    v_units := least(round(v_amt / v_pool.nav, 8), v_u.units);
    v_cost := round(v_u.cost * v_units / v_u.units, 2);              -- cost basis leaves pro rata
  end if;
  update user_units set units = units - v_units, cost = greatest(cost - v_cost, 0), updated_at = now()
    where user_id = p_user and pool = p_pool;
  update fund_pools set units_total = units_total - v_units where pool = p_pool;
  insert into fund_events(user_id, pool, type, amount, units, nav, ref) values (p_user, p_pool, 'withdraw', v_amt, v_units, v_pool.nav, p_ref);
  return jsonb_build_object('pool',p_pool,'amount',v_amt,'units',v_units,'nav',v_pool.nav,
                            'user_units',v_u.units - v_units,'replayed',false);
end $$;

-- move value between the user's two pools (a change of mira_split): redeem at one NAV, mint at the other, one transaction
create or replace function public.fund_switch(p_user text, p_from text, p_to text, p_amount numeric, p_ref text default null)
returns jsonb language plpgsql set search_path = public as $$
declare v_a fund_pools; v_b fund_pools; v_u user_units; v_prev jsonb; v_value numeric(20,2); v_amt numeric(20,2);
        v_out numeric(24,8); v_in numeric(24,8); v_cost numeric(20,2);
begin
  if p_from = p_to then raise exception 'same pool'; end if;
  perform 1 from fund_pools where pool in (p_from, p_to) order by pool for update;   -- fixed lock order, no deadlock
  select * into v_a from fund_pools where pool = p_from;
  select * into v_b from fund_pools where pool = p_to;
  if v_a.pool is null or v_b.pool is null then raise exception 'unknown pool'; end if;
  if p_ref is not null then
    select jsonb_build_object('from',p_from,'to',p_to,'replayed',true) into v_prev
      from fund_events where user_id = p_user and ref = p_ref || ':out';
    if v_prev is not null then return v_prev; end if;
  end if;
  select * into v_u from user_units where user_id = p_user and pool = p_from for update;
  if not found or v_u.units <= 0 then raise exception 'nothing to switch'; end if;
  v_value := round(v_u.units * v_a.nav, 2);
  v_amt := least(round(p_amount, 2), v_value);
  if v_amt <= 0 then raise exception 'bad amount'; end if;
  if v_amt >= v_value - 0.01 then v_out := v_u.units; v_amt := v_value;
  else v_out := least(round(v_amt / v_a.nav, 8), v_u.units); end if;
  v_cost := round(v_u.cost * v_out / v_u.units, 2);
  v_in := round(v_amt / v_b.nav, 8);
  update user_units set units = units - v_out, cost = greatest(cost - v_cost, 0), updated_at = now()
    where user_id = p_user and pool = p_from;
  insert into user_units(user_id, pool, units, cost) values (p_user, p_to, v_in, v_cost)
    on conflict (user_id, pool) do update
      set units = user_units.units + excluded.units, cost = user_units.cost + excluded.cost, updated_at = now();
  update fund_pools set units_total = units_total - v_out where pool = p_from;
  update fund_pools set units_total = units_total + v_in where pool = p_to;
  insert into fund_events(user_id, pool, type, amount, units, nav, ref) values
    (p_user, p_from, 'rebalance', v_amt, -v_out, v_a.nav, case when p_ref is null then null else p_ref || ':out' end),
    (p_user, p_to,   'rebalance', v_amt,  v_in,  v_b.nav, case when p_ref is null then null else p_ref || ':in' end);
  return jsonb_build_object('from',p_from,'to',p_to,'amount',v_amt,'units_out',v_out,'units_in',v_in,'replayed',false);
end $$;

-- daily job: set the pool NAV for a market date. Creates the pool on first call. Older or same-date calls are no-ops.
create or replace function public.fund_apply_nav(p_pool text, p_nav numeric, p_as_of date, p_weights jsonb, p_regime jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare v_n int;
begin
  if p_nav is null or p_nav <= 0 then raise exception 'bad nav'; end if;
  insert into fund_pools(pool, nav, as_of, weights) values (p_pool, round(p_nav, 8), p_as_of, coalesce(p_weights,'{}'::jsonb))
    on conflict (pool) do update
      set nav = excluded.nav, as_of = excluded.as_of, weights = excluded.weights, updated_at = now()
      where fund_pools.as_of < excluded.as_of;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('pool',p_pool,'applied',false); end if;
  insert into fund_nav_history(pool, as_of, nav, weights, regime) values (p_pool, p_as_of, round(p_nav, 8), p_weights, p_regime)
    on conflict (pool, as_of) do update set nav = excluded.nav, weights = excluded.weights, regime = excluded.regime;
  insert into fund_events(user_id, pool, type, nav) values (null, p_pool, 'rebalance', round(p_nav, 8));
  return jsonb_build_object('pool',p_pool,'applied',true,'nav',round(p_nav, 8),'as_of',p_as_of);
end $$;

revoke all on function public.fund_deposit(text,text,numeric,text), public.fund_withdraw(text,text,numeric,text,boolean),
  public.fund_switch(text,text,text,numeric,text), public.fund_apply_nav(text,numeric,date,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.fund_deposit(text,text,numeric,text), public.fund_withdraw(text,text,numeric,text,boolean),
  public.fund_switch(text,text,text,numeric,text), public.fund_apply_nav(text,numeric,date,jsonb,jsonb) to service_role;
