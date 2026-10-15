# What a licensed partner would handle (NOT built here, and not legal advice)

This engine is a **paper** simulation. Pooling real customer money and returning gains is a regulated fund activity in
Thailand. Do not connect real money to it. Before any real-money version, a licensed partner and counsel must cover at
least the points below. Confirm each against current SEC Thailand (and, where relevant, BOT, AMLO and PDPA) rules.

- [ ] **Licence / structure**: who is the licensed entity (asset management company, private fund, or distribution through
      an existing licensed fund and a selling agent). The app may need to be only a front end for the partner's funds.
- [ ] **Fund registration and prospectus / fund fact sheet**, investment policy, risk labels, fees.
- [ ] **Custody**: assets held by a licensed custodian, segregated from Mira's own money; a fund supervisor.
- [ ] **Unit registrar and NAV calculation / audit**: official NAV, cut-off times, subscription/redemption settlement
      (T+n), NAV errors procedure. The simulated daily NAV here is not an official NAV.
- [ ] **Payments**: licensed payment / e-money rails; never hold customer cash in Mira's own bank account.
- [ ] **KYC / AML / CFT**: identity verification, suitability assessment, sanctions and PEP screening, suspicious
      transaction reporting, record keeping.
- [ ] **Suitability and conduct rules**: investment advice is itself licensed; research disclaimers are not enough if the
      product recommends or executes allocations for a person.
- [ ] **Marketing rules**: no promised or guaranteed returns, required risk warnings, past performance wording.
- [ ] **Data protection (PDPA)**: consent, retention, cross-border transfer (Supabase / Vercel regions), breach process.
- [ ] **Tax**: withholding on gains/dividends, reporting, how it differs by instrument.
- [ ] **Client reporting**: statements, confirmations, complaint handling, dispute process.
- [ ] **Operational risk**: model governance and change control (the model code is frozen by hash for the forward test),
      disaster recovery, incident response, audit trail (`fund_events` is a start, not a ledger of record).
- [ ] **P2P lending side (Lender screen)**: a separate licence topic; not covered by a fund licence.

Until these exist: keep the label "simulation / paper money" on every screen that shows fund values.
