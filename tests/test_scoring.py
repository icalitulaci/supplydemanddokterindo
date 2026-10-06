"""The seven reference cases from specialist-demand-dashboard-prompt.md.

Each case states its pillar D situation in words; the inputs below are chosen to produce it
(national median M = 1.0 per 100k unless the case needs something else).
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scoring import score_pair  # noqa: E402


class ReferenceCases(unittest.TestCase):
    def test_1_general_hospital_no_anesthesiologist(self):
        r = score_pair(specialty="Sp.An", general=True, tiers={}, counts={"Sp.An": 0},
                       peer_median=2, kab_total=0, density=0.0, national_median=1.0, kab_name="X")
        self.assertEqual((r["A"], r["B"], r["C"], r["D"]), (35, 0, 15, 20))
        self.assertEqual(r["total"], 70)
        self.assertEqual(r["label"], "High")

    def test_2_kmk_heart_madya_no_cardiologist(self):
        r = score_pair(specialty="Sp.JP", general=True, tiers={"jantung": "Madya"}, counts={"Sp.JP": 0},
                       peer_median=1, kab_total=3, density=0.4, national_median=1.0, kab_name="X")
        self.assertEqual((r["A"], r["B"], r["C"], r["D"]), (0, 30, 15, 12))
        self.assertEqual(r["total"], 57)
        self.assertEqual(r["label"], "High")  # hard-gap override lifts Moderate to High

    def test_3_single_internist_80_beds(self):
        r = score_pair(specialty="Sp.PD", general=True, tiers={}, counts={"Sp.PD": 1},
                       peer_median=2, kab_total=40, density=1.5, national_median=1.0, kab_name="X")
        self.assertEqual((r["A"], r["B"], r["C"], r["D"]), (12, 0, 7.5, 0))
        self.assertEqual(r["total"], 19.5)
        self.assertEqual(r["label"], "Low")

    def test_4_relevance_gate_blocks_cardiac_surgeon(self):
        r = score_pair(specialty="Sp.BTKV", general=True, tiers={}, counts={"Sp.BTKV": 0},
                       peer_median=0, kab_total=0, density=0.0, national_median=0.1, kab_name="X")
        self.assertEqual((r["A"], r["B"], r["C"], r["D"]), (0, 0, 0, 0))
        self.assertEqual(r["total"], 0)
        self.assertEqual(r["label"], "Low")

    def test_5_either_group_satisfied_by_nuclear_medicine(self):
        counts = {"Sp.Onk.Rad": 0, "Sp.KN": 1}
        for s in ("Sp.Onk.Rad", "Sp.KN"):
            r = score_pair(specialty=s, general=True, tiers={"kanker": "Utama"}, counts=counts,
                           peer_median=0, kab_total=1, density=1.0, national_median=1.0, kab_name="X")
            self.assertEqual(r["B"], 0, s)

    def test_6_stroke_paripurna_no_rehab(self):
        r = score_pair(specialty="Sp.KFR", general=True, tiers={"stroke": "Paripurna"}, counts={"Sp.KFR": 0},
                       peer_median=1, kab_total=10, density=1.2, national_median=1.0, kab_name="X")
        self.assertEqual((r["A"], r["B"], r["C"], r["D"]), (0, 30, 15, 0))
        self.assertEqual(r["total"], 45)
        self.assertEqual(r["label"], "High")

    def test_7_rsia_kia_madya_no_pediatric_surgeon(self):
        r = score_pair(specialty="Sp.BA", general=False, tiers={"kia": "Madya"}, counts={"Sp.BA": 0},
                       peer_median=0, kab_total=0, density=0.0, national_median=0.1, kab_name="X")
        self.assertEqual((r["A"], r["B"], r["C"], r["D"]), (0, 30, 0, 20))
        self.assertEqual(r["total"], 50)
        self.assertEqual(r["label"], "High")


class ExtraRules(unittest.TestCase):
    def test_either_group_both_missing_scores_both(self):
        counts = {"Sp.Onk.Rad": 0, "Sp.KN": 0}
        for s in ("Sp.Onk.Rad", "Sp.KN"):
            r = score_pair(specialty=s, general=True, tiers={"kanker": "Utama"}, counts=counts,
                           peer_median=0, kab_total=1, density=1.0, national_median=1.0, kab_name="X")
            self.assertEqual(r["B"], 30, s)

    def test_single_specialist_at_utama_scores_10(self):
        r = score_pair(specialty="Sp.JP", general=True, tiers={"jantung": "Utama"}, counts={"Sp.JP": 1},
                       peer_median=1, kab_total=5, density=2.0, national_median=1.0, kab_name="X")
        self.assertEqual(r["B"], 10)

    def test_missing_population_marks_d_unavailable(self):
        r = score_pair(specialty="Sp.An", general=True, tiers={}, counts={"Sp.An": 0},
                       peer_median=2, kab_total=0, density=None, national_median=1.0, kab_name="X")
        self.assertIsNone(r["D"])
        self.assertEqual(r["total"], 50)
        self.assertTrue(any("no population data" in x for x in r["reasons"]))

    def test_total_capped_at_100(self):
        r = score_pair(specialty="Sp.An", general=True, tiers={"kia": "Madya"}, counts={"Sp.An": 0},
                       peer_median=3, kab_total=0, density=0.0, national_median=1.0, kab_name="X")
        self.assertEqual(r["total"], 100)


if __name__ == "__main__":
    unittest.main()
