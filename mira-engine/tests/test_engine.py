"""Offline checks for the daily job maths and sinks. Run: python -m unittest discover -s tests -v  (from mira-engine/)"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'engine'))
import daily_job as J  # noqa: E402

STATE = {'stress': 1, 'stock_share_by_base': {'20': 0.15, '60': 0.45},
         'core_weights': {'SHY': 0.3, 'GLD': 0.1}, 'core_cash_share': 0.6}


class Maths(unittest.TestCase):
    def test_target_weights_sum_to_one(self):
        for s in (0.0, 0.15, 0.45, 0.6):
            w = J.target_weights(STATE, s)
            self.assertAlmostEqual(sum(w.values()), 1.0, places=4)
        self.assertAlmostEqual(J.target_weights(STATE, 0.15)['SPY'], 0.15, places=6)

    def test_advance_return_and_drift(self):
        nav, w, r = J.advance(10.0, {'SPY': 0.5, 'CASH': 0.5}, {'SPY': 0.10, 'CASH': 0.0})
        self.assertAlmostEqual(r, 0.05)
        self.assertAlmostEqual(nav, 10.5)
        self.assertAlmostEqual(sum(w.values()), 1.0)
        self.assertGreater(w['SPY'], 0.5)

    def test_rebalance_cost_is_one_sided_turnover(self):
        nav, w, turn = J.rebalance(10.0, {'SPY': 0.6, 'CASH': 0.4}, {'SPY': 0.2, 'CASH': 0.8}, cost_bps=10)
        self.assertAlmostEqual(turn, 0.4)
        self.assertAlmostEqual(nav, 10.0 * (1 - 0.4 * 10 / 1e4))
        self.assertEqual(w, {'SPY': 0.2, 'CASH': 0.8})

    def test_no_trade_no_cost(self):
        nav, _, turn = J.rebalance(10.0, {'SPY': 1.0}, {'SPY': 1.0})
        self.assertEqual((nav, turn), (10.0, 0.0))

    def test_is_due(self):
        self.assertTrue(J.is_due(None, STATE, '2026-10-14')[0])
        self.assertTrue(J.is_due({'rebalance_month': '2026-09', 'stress': 1}, STATE, '2026-10-01')[0])
        self.assertTrue(J.is_due({'rebalance_month': '2026-10', 'stress': 0}, STATE, '2026-10-14')[0])
        self.assertFalse(J.is_due({'rebalance_month': '2026-10', 'stress': 1}, STATE, '2026-10-14')[0])


class Sinks(unittest.TestCase):
    def test_file_sink_ignores_stale_and_duplicate_dates(self):
        with tempfile.TemporaryDirectory() as d:
            s = J.FileSink(os.path.join(d, 'f.json'))
            self.assertTrue(s.apply_nav('p', 10, '2026-01-02', {'CASH': 1}, {}))
            self.assertFalse(s.apply_nav('p', 11, '2026-01-02', {'CASH': 1}, {}))
            self.assertFalse(s.apply_nav('p', 11, '2026-01-01', {'CASH': 1}, {}))
            self.assertEqual(s.get_pool('p')['nav'], 10)

    def test_supabase_sink_payload_uses_rpc_and_never_the_key_in_body(self):
        calls = []

        def fake(method, path, body=None):
            calls.append((method, path, body))
            return {'applied': True}
        s = J.SupabaseSink('https://x.supabase.co', 'SECRET', http=fake)
        self.assertTrue(s.apply_nav('safe', 10.123456789, '2026-10-14', {'SPY': 0.2}, {'stress': 0}))
        m, path, body = calls[0]
        self.assertEqual((m, path), ('POST', '/rest/v1/rpc/fund_apply_nav'))
        self.assertEqual(body['p_nav'], 10.12345679)
        self.assertNotIn('SECRET', str(body))


if __name__ == '__main__':
    unittest.main()
