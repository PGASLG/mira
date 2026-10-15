-- Pro-rata fairness test for the Mira fund (PAPER). Runs inside one DO block and ends by raising an exception,
-- so everything it creates is rolled back: no test rows are left in the database.
-- Pass = the final exception text starts with FAIRNESS_OK. Any other error = a failed assertion.
do $$
declare
  r jsonb; v_a numeric; v_b numeric; v_tot numeric; v_pool numeric; v_cnt int;
begin
  -- day 1: pool opens at NAV 10
  perform fund_apply_nav('test_fair', 10, date '2026-01-01', '{"SPY":0.6,"CASH":0.4}', '{"stress":0}');

  -- A deposits 1000 at NAV 10 -> 100 units
  r := fund_deposit('uA', 'test_fair', 1000, 'a1');
  assert (r->>'units')::numeric = 100, 'A units';

  -- NAV +10% -> 11
  perform fund_apply_nav('test_fair', 11, date '2026-01-02', '{"SPY":0.6,"CASH":0.4}', '{"stress":0}');

  -- B deposits 1100 at NAV 11 -> 100 units (late joiner gets no past gain)
  r := fund_deposit('uB', 'test_fair', 1100, 'b1');
  assert (r->>'units')::numeric = 100, 'B units (late joiner must not inherit past gains)';

  -- replay of the same ref must mint nothing
  r := fund_deposit('uB', 'test_fair', 1100, 'b1');
  assert (r->>'replayed')::boolean, 'replay flagged';
  select units into v_b from user_units where user_id = 'uB' and pool = 'test_fair';
  assert v_b = 100, 'replay minted units';

  -- rebalance day: weights change, NAV +10% -> 12.1. Same units, so both earn the same 10% from here.
  perform fund_apply_nav('test_fair', 12.1, date '2026-01-03', '{"SPY":0.2,"CASH":0.8}', '{"stress":2}');
  select units * 12.1 into v_a from user_units where user_id = 'uA' and pool = 'test_fair';
  select units * 12.1 into v_b from user_units where user_id = 'uB' and pool = 'test_fair';
  assert round(v_a, 2) = 1210.00, 'A value 1210 (+21% since entry)';
  assert round(v_b, 2) = 1210.00, 'B value 1210 (+10% since entry)';

  -- A withdraws 605 at NAV 12.1 -> redeems 50 units; cost basis leaves pro rata (500)
  r := fund_withdraw('uA', 'test_fair', 605, 'a-w1');
  assert (r->>'units')::numeric = 50, 'A redeemed units';
  assert (select units from user_units where user_id = 'uA' and pool = 'test_fair') = 50, 'A units left';
  assert (select cost from user_units where user_id = 'uA' and pool = 'test_fair') = 500, 'A cost left';

  -- NAV +10% -> 13.31
  perform fund_apply_nav('test_fair', 13.31, date '2026-01-04', '{"SPY":0.2,"CASH":0.8}', '{"stress":2}');

  -- every user's value sums to units_total x NAV (nothing created or lost)
  select sum(units) * 13.31 into v_tot from user_units where pool = 'test_fair';
  select units_total * nav into v_pool from fund_pools where pool = 'test_fair';
  assert round(v_tot, 2) = round(v_pool, 2), 'user values must sum to pool value';
  assert round(v_pool, 2) = 1996.50, 'pool value 150 units x 13.31';

  -- B withdraws everything: no dust
  r := fund_withdraw('uB', 'test_fair', null, 'b-w1', true);
  assert (r->>'amount')::numeric = 1331.00, 'B payout 100 x 13.31';
  assert (select units from user_units where user_id = 'uB' and pool = 'test_fair') = 0, 'B no dust';
  assert (select units_total from fund_pools where pool = 'test_fair') = 50, 'units_total after B exit';

  -- older / same-date NAV is ignored
  r := fund_apply_nav('test_fair', 99, date '2026-01-04', '{}', '{}');
  assert not (r->>'applied')::boolean, 'stale NAV ignored';

  -- ask for more than held -> exits fully, never negative
  r := fund_withdraw('uA', 'test_fair', 1000000, null);
  assert (r->>'amount')::numeric = 665.50, 'A final 50 x 13.31';

  select count(*) into v_cnt from fund_events where pool = 'test_fair' and user_id is not null;
  raise exception 'FAIRNESS_OK events=%', v_cnt;   -- forces rollback of everything above
end $$;
