# Mira: two strict sandbox tests (2025-2026 and 2001-2026)

As of 2026-10-15. Research only. No real money. Not investment advice. Rules frozen: nothing here was tuned.

## Test A: strict 2025-2026 (point-in-time, defensive core S3)

- Decisions from 2025-01, money works from 2025-02, after Gemma 4's January 2025 cutoff. Data to 2026-09.
- Leak test: 12 of 12 randomly chosen months give the identical signal when future prices are removed.
- Honest limit: the 2008-now backtest already included these months, so the numbers are not unseen by us. What is strict: point-in-time signals, frozen constants, costs, no tuning. The truly unseen test is the forward ledger.

### A1. Variants, decisions 2025-01 to 2026-09

| Base | Variant | CAGR | Volatility | Sharpe over cash | Worst fall | Avg stock share | Months |
|---|---|---:|---:|---:|---:|---:|---:|
| 30% | fixed | +8.5% | 4.6% | +0.96 | -2.2% | 30% | 19 |
| 30% | trend | +8.5% | 4.6% | +0.96 | -2.2% | 30% | 19 |
| 30% | size | +7.9% | 4.4% | +0.87 | -2.2% | 29% | 19 |
| 30% | gate | +7.5% | 4.1% | +0.83 | -2.1% | 28% | 19 |
| 30% | chain | +7.1% | 4.0% | +0.77 | -2.1% | 28% | 19 |
| 60% | fixed | +12.5% | 8.0% | +1.03 | -4.0% | 60% | 19 |
| 60% | trend | +12.5% | 8.0% | +1.03 | -4.0% | 60% | 19 |
| 60% | size | +8.6% | 6.6% | +0.70 | -3.8% | 51% | 19 |
| 60% | gate | +10.4% | 7.0% | +0.90 | -3.9% | 57% | 19 |
| 60% | chain | +7.5% | 6.1% | +0.59 | -3.8% | 49% | 19 |

### A2. Month by month (decision at month end, base 60%)

| Decision | Stress | Alarms vol/dd/ma | S&P next month | Fixed share | Gate share | Chain share |
|---|---:|---|---:|---:|---:|---:|
| 2025-01 | 0 | 0/0/0 | -1.3% | 60% | 60% | 60% |
| 2025-02 | 0 | 0/0/0 | -5.6% | 60% | 60% | 60% |
| 2025-03 | 1 | 0/0/1 | -0.9% | 60% | 45% | 31% |
| 2025-04 | 2 | 1/0/1 | +6.3% | 60% | 30% | 8% |
| 2025-05 | 0 | 0/0/0 | +5.1% | 60% | 60% | 26% |
| 2025-06 | 0 | 0/0/0 | +2.3% | 60% | 60% | 28% |
| 2025-07 | 0 | 0/0/0 | +2.1% | 60% | 60% | 60% |
| 2025-08 | 0 | 0/0/0 | +3.6% | 60% | 60% | 60% |
| 2025-09 | 0 | 0/0/0 | +2.4% | 60% | 60% | 60% |
| 2025-10 | 0 | 0/0/0 | +0.2% | 60% | 60% | 57% |
| 2025-11 | 0 | 0/0/0 | +0.1% | 60% | 60% | 56% |
| 2025-12 | 0 | 0/0/0 | +1.5% | 60% | 60% | 60% |
| 2026-01 | 0 | 0/0/0 | -0.9% | 60% | 60% | 60% |
| 2026-02 | 0 | 0/0/0 | -4.9% | 60% | 60% | 60% |
| 2026-03 | 1 | 0/0/1 | +10.5% | 60% | 45% | 34% |
| 2026-04 | 0 | 0/0/0 | +5.3% | 60% | 60% | 55% |
| 2026-05 | 0 | 0/0/0 | -1.0% | 60% | 60% | 58% |
| 2026-06 | 0 | 0/0/0 | +0.0% | 60% | 60% | 47% |
| 2026-07 | 0 | 0/0/0 | +2.7% | 60% | 60% | 60% |
| 2026-08 | 0 | 0/0/0 | -0.3% | 60% | 60% | 60% |

### A3. Did the detector see danger in 2025-2026?

| Stress at month end | Months | Share | Average next month | Worst next month | Next month <= -5% |
|---|---:|---:|---:|---:|---:|
| 0 | 17 | 85% | +0.7% | -5.6% | 1 (6%) |
| 1 | 2 | 10% | +4.8% | -0.9% | 0 (0%) |
| 2 | 1 | 5% | +6.3% | +6.3% | 0 (0%) |

Falls of 8% or more in one month: **0**; stress was 2 or 3 at the month end before **0** of them.

Declared rule on 2025-2026 (few months: read as a check, not a verdict):

| Base | Variant | Fixed worst fall | Variant worst fall | Shallower by | CAGR gap | Sharpe fixed / variant | Result |
|---|---|---:|---:|---:|---:|---|---|
| 30% | gate | -2.2% | -2.1% | nan% | -1.0 pts | +0.96 / +0.83 | **INCONCLUSIVE (fixed never fell 5%)** |
| 30% | chain | -2.2% | -2.1% | nan% | -1.4 pts | +0.96 / +0.77 | **INCONCLUSIVE (fixed never fell 5%)** |
| 60% | gate | -4.0% | -3.9% | nan% | -2.0 pts | +1.03 / +0.90 | **INCONCLUSIVE (fixed never fell 5%)** |
| 60% | chain | -4.0% | -3.8% | nan% | -4.9 pts | +1.03 / +0.59 | **INCONCLUSIVE (fixed never fell 5%)** |

### A4. Baht range model on the same window (decisions from 2025-02)

| Horizon | Method | Origins | 50% range held | 80% range held | 95% range held | Pinball gain vs random walk |
|---|---|---:|---:|---:|---:|---:|
| 7 days | blend | 85 | 53% | 81% | 96% | -0.1% |
| 30 days | rw_now | 82 | 60% | 87% | 95% | -2.4% |
| 90 days | rw_hist | 74 | 53% | 86% | 100% | +0.0% |

A good 80% range holds about 80%. The earlier REPORT_fx_range.md notes 2025+ is seen data for FX.

### A5. AI layer on the same sealed window (from REPORT_sandbox_2025.md)

- With headlines: AI minus anchor +0.0022 [-0.0030, +0.0063], no measurable difference (n=348).
- With price history: AI minus anchor +0.0067 [+0.0019, +0.0114], the AI is worse (n=720).
- The AI cannot be tested sealed before 2025: Gemma 4 data ends January 2025, so earlier windows are contaminated.

## Test B: long test 2001-2026 (S&P 500 total return + cash)

- Sleeve: SPY total return. Defensive side: 3-month T-bill (no bond or gold fund exists for the whole span). Costs 10 bps. Decisions 2001-01 to 2026-09.
- Leak test: 12 of 12 random months give the identical signal with future prices removed.
- Defensive side is plain cash, so the numbers are harder on the engine than the core S3 version (bonds and gold helped in 2008 and 2022, and in 2000-2002).

### B. Variants, ALL 2001-2026

| Base | Variant | CAGR | Volatility | Sharpe over cash | Worst fall | Avg stock share | Months |
|---|---|---:|---:|---:|---:|---:|---:|
| 30% | fixed | +4.1% | 4.5% | +0.52 | -17.3% | 30% | 308 |
| 30% | trend | +4.2% | 3.3% | +0.74 | -5.9% | 23% | 308 |
| 30% | size | +4.1% | 4.2% | +0.56 | -11.4% | 29% | 308 |
| 30% | gate | +4.2% | 3.3% | +0.74 | -7.8% | 26% | 308 |
| 30% | chain | +4.2% | 3.2% | +0.75 | -5.5% | 25% | 308 |
| 60% | fixed | +6.2% | 9.0% | +0.52 | -33.4% | 60% | 308 |
| 60% | trend | +6.6% | 6.6% | +0.74 | -11.9% | 47% | 308 |
| 60% | size | +5.7% | 6.3% | +0.63 | -14.5% | 49% | 308 |
| 60% | gate | +6.6% | 6.5% | +0.75 | -16.9% | 51% | 308 |
| 60% | chain | +5.9% | 5.5% | +0.76 | -7.7% | 45% | 308 |

### B. Variants, 2001-2007 (outside the 2008-now backtest)

| Base | Variant | CAGR | Volatility | Sharpe over cash | Worst fall | Avg stock share | Months |
|---|---|---:|---:|---:|---:|---:|---:|
| 30% | fixed | +2.7% | 4.0% | -0.01 | -9.3% | 30% | 84 |
| 30% | trend | +4.1% | 2.1% | +0.61 | -2.7% | 20% | 84 |
| 30% | size | +2.6% | 3.9% | -0.03 | -8.9% | 30% | 84 |
| 30% | gate | +3.4% | 2.7% | +0.23 | -4.4% | 24% | 84 |
| 30% | chain | +3.4% | 2.7% | +0.23 | -4.2% | 24% | 84 |
| 60% | fixed | +2.4% | 8.1% | -0.01 | -20.6% | 60% | 84 |
| 60% | trend | +5.4% | 4.2% | +0.61 | -6.2% | 39% | 84 |
| 60% | size | +3.0% | 5.6% | +0.06 | -13.7% | 50% | 84 |
| 60% | gate | +4.0% | 5.4% | +0.23 | -10.3% | 49% | 84 |
| 60% | chain | +4.2% | 4.4% | +0.33 | -6.4% | 43% | 84 |

### B. Variants, 2008-2016

| Base | Variant | CAGR | Volatility | Sharpe over cash | Worst fall | Avg stock share | Months |
|---|---|---:|---:|---:|---:|---:|---:|
| 30% | fixed | +2.8% | 4.7% | +0.56 | -16.0% | 30% | 108 |
| 30% | trend | +2.8% | 3.3% | +0.81 | -5.1% | 23% | 108 |
| 30% | size | +3.3% | 4.0% | +0.79 | -9.9% | 29% | 108 |
| 30% | gate | +3.2% | 3.2% | +0.91 | -6.3% | 26% | 108 |
| 30% | chain | +3.3% | 3.1% | +1.00 | -4.0% | 25% | 108 |
| 60% | fixed | +5.1% | 9.4% | +0.56 | -30.3% | 60% | 108 |
| 60% | trend | +5.4% | 6.5% | +0.81 | -10.0% | 46% | 108 |
| 60% | size | +5.3% | 6.0% | +0.85 | -11.6% | 48% | 108 |
| 60% | gate | +6.1% | 6.5% | +0.91 | -13.0% | 51% | 108 |
| 60% | chain | +5.2% | 5.2% | +0.96 | -6.0% | 44% | 108 |

### B. Variants, 2017-2026

| Base | Variant | CAGR | Volatility | Sharpe over cash | Worst fall | Avg stock share | Months |
|---|---|---:|---:|---:|---:|---:|---:|
| 30% | fixed | +6.4% | 4.7% | +0.83 | -7.0% | 30% | 116 |
| 30% | trend | +5.6% | 4.0% | +0.77 | -5.9% | 26% | 116 |
| 30% | size | +5.9% | 4.5% | +0.75 | -6.9% | 29% | 116 |
| 30% | gate | +5.8% | 3.7% | +0.90 | -5.1% | 27% | 116 |
| 30% | chain | +5.6% | 3.6% | +0.84 | -5.0% | 26% | 116 |
| 60% | fixed | +10.2% | 9.3% | +0.83 | -14.5% | 60% | 116 |
| 60% | trend | +8.6% | 8.0% | +0.77 | -11.9% | 53% | 116 |
| 60% | size | +8.2% | 7.1% | +0.80 | -9.1% | 50% | 116 |
| 60% | gate | +9.1% | 7.3% | +0.90 | -10.7% | 54% | 116 |
| 60% | chain | +7.8% | 6.3% | +0.83 | -7.1% | 47% | 116 |

### B. Crisis replay (cumulative return)

Base 30%:

| Crisis | fixed | trend | size | gate | chain |
|---|---:|---:|---:|---:|---:|
| Dot-com 2001-01..2002-10 | -6.4% | +4.7% | -6.9% | -1.4% | -1.6% |
| GFC 2007-10..2009-03 | -12.6% | -1.5% | -8.1% | -5.2% | -3.8% |
| Covid 2020-01..03 | -2.3% | -5.9% | -4.9% | -2.2% | -2.9% |
| 2022 bear 2021-12..2022-10 | -2.7% | -2.6% | -2.6% | -2.6% | -2.6% |

Base 60%:

| Crisis | fixed | trend | size | gate | chain |
|---|---:|---:|---:|---:|---:|
| Dot-com 2001-01..2002-10 | -16.9% | +4.7% | -12.6% | -7.3% | -5.0% |
| GFC 2007-10..2009-03 | -25.9% | -5.0% | -11.3% | -12.2% | -6.0% |
| Covid 2020-01..03 | -5.1% | -11.9% | -7.7% | -4.7% | -5.4% |
| 2022 bear 2021-12..2022-10 | -7.1% | -6.6% | -4.6% | -6.6% | -4.5% |

### B. Did the detector see danger, 2001-2026?

| Stress at month end | Months | Share | Average next month | Worst next month | Next month <= -5% |
|---|---:|---:|---:|---:|---:|
| 0 | 208 | 68% | +1.1% | -7.9% | 9 (4%) |
| 1 | 35 | 11% | +1.1% | -8.8% | 5 (14%) |
| 2 | 52 | 17% | +0.1% | -10.7% | 13 (25%) |
| 3 | 13 | 4% | -1.5% | -16.5% | 6 (46%) |

Falls of 8% or more in one month: **13**; stress was 2 or 3 at the month end before **11** of them.

### B. Declared success rule

Declared rule on ALL 2001-2026:

| Base | Variant | Fixed worst fall | Variant worst fall | Shallower by | CAGR gap | Sharpe fixed / variant | Result |
|---|---|---:|---:|---:|---:|---|---|
| 30% | gate | -17.3% | -7.8% | 55% | +0.1 pts | +0.52 / +0.74 | **PASS** |
| 30% | chain | -17.3% | -5.5% | 68% | +0.1 pts | +0.52 / +0.75 | **PASS** |
| 60% | gate | -33.4% | -16.9% | 50% | +0.4 pts | +0.52 / +0.75 | **PASS** |
| 60% | chain | -33.4% | -7.7% | 77% | -0.3 pts | +0.52 / +0.76 | **PASS** |

Declared rule on 2001-2007 (outside the 2008-now backtest):

| Base | Variant | Fixed worst fall | Variant worst fall | Shallower by | CAGR gap | Sharpe fixed / variant | Result |
|---|---|---:|---:|---:|---:|---|---|
| 30% | gate | -9.3% | -4.4% | 52% | +0.8 pts | -0.01 / +0.23 | **PASS** |
| 30% | chain | -9.3% | -4.2% | 55% | +0.7 pts | -0.01 / +0.23 | **PASS** |
| 60% | gate | -20.6% | -10.3% | 50% | +1.6 pts | -0.01 / +0.23 | **PASS** |
| 60% | chain | -20.6% | -6.4% | 69% | +1.8 pts | -0.01 / +0.33 | **PASS** |

Declared rule on 2008-2016:

| Base | Variant | Fixed worst fall | Variant worst fall | Shallower by | CAGR gap | Sharpe fixed / variant | Result |
|---|---|---:|---:|---:|---:|---|---|
| 30% | gate | -16.0% | -6.3% | 60% | +0.4 pts | +0.56 / +0.91 | **PASS** |
| 30% | chain | -16.0% | -4.0% | 75% | +0.6 pts | +0.56 / +1.00 | **PASS** |
| 60% | gate | -30.3% | -13.0% | 57% | +1.0 pts | +0.56 / +0.91 | **PASS** |
| 60% | chain | -30.3% | -6.0% | 80% | +0.1 pts | +0.56 / +0.96 | **PASS** |

Declared rule on 2017-2026:

| Base | Variant | Fixed worst fall | Variant worst fall | Shallower by | CAGR gap | Sharpe fixed / variant | Result |
|---|---|---:|---:|---:|---:|---|---|
| 30% | gate | -7.0% | -5.1% | 28% | -0.6 pts | +0.83 / +0.90 | **FAIL** |
| 30% | chain | -7.0% | -5.0% | 28% | -0.8 pts | +0.83 / +0.84 | **FAIL** |
| 60% | gate | -14.5% | -10.7% | 26% | -1.1 pts | +0.83 / +0.90 | **FAIL** |
| 60% | chain | -14.5% | -7.1% | 51% | -2.4 pts | +0.83 / +0.83 | **FAIL** |

### B. Paired difference of monthly returns, annualised, 6-month block bootstrap 95%

| Base | Comparison | Window | Mean per year | 95% interval |
|---|---|---|---:|---|
| 30% | gate - fixed | ALL 2001-2026 | +0.1% | [-0.6%, +0.8%] |
| 30% | gate - fixed | 2001-2007 | +0.7% | [-0.5%, +1.7%] |
| 30% | chain - fixed | ALL 2001-2026 | +0.0% | [-0.8%, +0.9%] |
| 30% | chain - fixed | 2001-2007 | +0.7% | [-0.5%, +1.6%] |
| 60% | gate - fixed | ALL 2001-2026 | +0.2% | [-1.2%, +1.6%] |
| 60% | gate - fixed | 2001-2007 | +1.4% | [-0.9%, +3.3%] |
| 60% | chain - fixed | ALL 2001-2026 | -0.6% | [-2.7%, +1.5%] |
| 60% | chain - fixed | 2001-2007 | +1.5% | [-1.9%, +4.1%] |

## What these tests do and do not show

- They test the rules as frozen. They do not predict the future and they are not advice.
- A shallower fall costs growth; the table shows by how much. Judge both columns, not only the fall.
- Test A is short (about 18 months). Test B has few independent crises (about four). Treat both as evidence about a regime gauge, not proof of a crash predictor.
- The only truly unseen evidence is the forward ledger (FORWARD_TEST_REPORT.md), scored from 2026-10.

