"""
conftest.py — Shared pytest fixtures for EconoCausal backend tests.
"""
import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Make sure 'backend/' is on sys.path so imports work regardless of where
# pytest is invoked from.
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic data fixtures
# ─────────────────────────────────────────────────────────────────────────────

def _make_df(n: int = 200, seed: int = 0) -> pd.DataFrame:
    """Helper: generate a small but valid synthetic dataset."""
    rng = np.random.default_rng(seed)
    n_treated = n // 2
    n_control = n - n_treated
    treatment = np.array([1] * n_treated + [0] * n_control)
    return pd.DataFrame({
        "customer_id":       [f"C{i:04d}" for i in range(n)],
        "age":               rng.integers(18, 75, size=n).astype(int),
        "tenure_months":     rng.integers(0, 120, size=n).astype(int),
        "past_spend":        np.round(rng.uniform(10, 2000, size=n), 2),
        "customer_segment":  rng.integers(0, 3, size=n).astype(int),
        "discount_received": treatment,
        "purchased":         rng.integers(0, 2, size=n).astype(int),
        "revenue":           np.round(rng.uniform(0, 200, size=n), 2),
    })


@pytest.fixture
def valid_df() -> pd.DataFrame:
    return _make_df(n=200)


@pytest.fixture
def valid_csv_bytes(valid_df) -> bytes:
    buf = io.StringIO()
    valid_df.to_csv(buf, index=False)
    return buf.getvalue().encode()


@pytest.fixture
def small_valid_df() -> pd.DataFrame:
    """Minimal valid dataset (exactly at the minimum row threshold)."""
    return _make_df(n=50)
