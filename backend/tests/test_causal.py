"""
test_causal.py — Tests for the causal model module.

NOTE: These tests import EconML and LightGBM. They are skipped automatically
if those packages are not installed (e.g., during a quick lint-only CI run).

Causal model tests intentionally use small datasets (200–500 rows) and
disable DoWhy refutation to keep the test suite fast. A separate slow test
is provided for the full refutation pipeline.
"""
import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Skip the entire module if EconML is not installed.
pytest.importorskip("econml", reason="econml not installed — skipping causal tests")

from core.causal_model import run_causal_analysis
from core.dataset import validate_csv, prepare_model_data


def df_to_bytes(df: pd.DataFrame) -> bytes:
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode()


class TestInputValidation:
    def test_too_few_rows_returns_error(self, valid_df):
        tiny = valid_df.head(10)
        result = validate_csv(df_to_bytes(tiny))
        # Validation should reject before reaching the model
        assert not result.is_valid

    def test_missing_treatment_group_returns_error(self):
        """If one treatment group is absent, causal_model should error."""
        import numpy as _np
        rng = _np.random.default_rng(1)
        n = 100
        df = pd.DataFrame({
            "age":               rng.integers(18, 75, size=n).astype(int),
            "tenure_months":     rng.integers(0, 120, size=n).astype(int),
            "past_spend":        rng.uniform(10, 2000, size=n),
            "customer_segment":  rng.integers(0, 3, size=n).astype(int),
        })
        X = df
        T = pd.Series([1] * n, name="discount_received")  # all treated
        Y = pd.Series(rng.integers(0, 2, size=n).astype(int), name="purchased")
        result = run_causal_analysis(X, T, Y, run_refutation=False)
        assert result.error is not None
        assert "Insufficient" in result.error or "2 unique" in result.error


class TestCausalModelOutput:
    def test_run_returns_ate(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        assert result.is_valid
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(data.X, data.T, data.Y, run_refutation=False)
        assert cr.error is None, f"Unexpected error: {cr.error}"
        assert cr.ate is not None
        assert isinstance(cr.ate, float)

    def test_ate_confidence_interval_valid(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(data.X, data.T, data.Y, run_refutation=False)
        assert cr.error is None
        assert cr.ate_lower is not None
        assert cr.ate_upper is not None
        # Lower bound should be less than upper bound
        assert cr.ate_lower <= cr.ate_upper

    def test_ate_is_within_ci(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(data.X, data.T, data.Y, run_refutation=False)
        assert cr.error is None
        # ATE should be within its own 95% CI
        assert cr.ate_lower <= cr.ate <= cr.ate_upper

    def test_cate_values_length(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(data.X, data.T, data.Y, run_refutation=False)
        assert cr.error is None
        assert len(cr.cate_values) == len(valid_df)
        assert len(cr.cate_lower) == len(valid_df)
        assert len(cr.cate_upper) == len(valid_df)

    def test_cate_ci_lower_leq_upper(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(data.X, data.T, data.Y, run_refutation=False)
        assert cr.error is None
        for lo, hi in zip(cr.cate_lower, cr.cate_upper):
            assert lo <= hi, f"CI lower {lo} > upper {hi}"

    def test_ate_is_finite(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(data.X, data.T, data.Y, run_refutation=False)
        assert cr.error is None
        assert np.isfinite(cr.ate)

    def test_n_samples_correct(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(data.X, data.T, data.Y, run_refutation=False)
        assert cr.n_samples == len(valid_df)

    def test_assumptions_are_listed(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(data.X, data.T, data.Y, run_refutation=False)
        assert isinstance(cr.assumptions, list)
        assert len(cr.assumptions) >= 3


class TestRefutation:
    @pytest.mark.slow
    def test_refutation_runs_without_error(self, valid_df):
        """
        Slow test — runs the DoWhy refutation. Mark with -m slow to include.
        """
        pytest.importorskip("dowhy", reason="dowhy not installed")
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(
            data.X, data.T, data.Y,
            run_refutation=True,
            refutation_n_simulations=5,   # fast: just 5 simulations
        )
        assert cr.error is None
        assert cr.refutation is not None
        assert "interpretation" in cr.refutation

    @pytest.mark.slow
    def test_refutation_has_required_keys(self, valid_df):
        pytest.importorskip("dowhy", reason="dowhy not installed")
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        cr = run_causal_analysis(
            data.X, data.T, data.Y,
            run_refutation=True,
            refutation_n_simulations=5,
        )
        assert cr.refutation is not None
        for key in ["test_name", "interpretation"]:
            assert key in cr.refutation
