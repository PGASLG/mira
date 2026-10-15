# Mira forward test: declared rule (frozen)

Declared: 2026-10-15, before any forward result exists. Research only. Not investment advice.

Rule hash: bb6bfa8d9d2a051c

## Question

Does the gate-only variant (stock share = base x gate[stress]) keep growth close to the fixed dial while making falls much shallower, on data from 2026-10 onward that played no part in designing it?

## Fixed rules (same code as mira_invest.py, unchanged)

- Alarms from daily S&P 500 at month end: vol ratio 20d/250d > 1.5; drawdown <= -10% from 1-year high; close below 200-day average. Stress = number of alarms (0 to 3).
- Gate: {0: 1.0, 1: 0.75, 2: 0.5, 3: 0.25}. Base dials: 30% and 60% stocks. Rest in the defensive core S3. Cost 10 bps per change.
- First decision: month end 2026-09; first scored return month: 2026-10. Nothing earlier counts.
- A decision at month end t sets the share for month t+1. The core return uses the allocator's extra one-month lag, so a decision is scored when month t+2 has closed. The first decision is treated as already held (no entry cost).
- Every month one row is appended to mira_forward_ledger.csv with the data known at that month end. Rows are never edited.

## Success rule (declared now)

Judged only after at least 12 scored months, separately for each base dial:
1. gate worst fall at least 30% shallower than fixed worst fall, AND
2. gate CAGR no more than 2 points below fixed CAGR, AND
3. gate Sharpe over cash not below fixed Sharpe.
If fixed never falls 5% or more from a peak in those months the result is INCONCLUSIVE, not a pass.

## What may NOT change

Alarm thresholds, gate values, base dials, cost, windows, the success rule, and the allocator core. The program refuses to run if the rule hash differs. A new idea becomes a NEW test with a new declaration date.

## Known limits

- Few months, one regime; a calm year can show no falls and says little.
- Sleeve is the S&P 500 total return (SPY); the core mixes 15 ETFs; costs are an estimate; no taxes.
- The backtest timing quirk (sleeve earns month t+1, core month t+2) is kept on purpose so the forward test matches it.
