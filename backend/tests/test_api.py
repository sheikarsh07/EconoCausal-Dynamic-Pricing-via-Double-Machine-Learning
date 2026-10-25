"""
test_api.py — Tests for the FastAPI endpoints.

Uses httpx.AsyncClient (via pytest-asyncio) as an async test client.
"""
import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Add backend to path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from main import app   # FastAPI app


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_csv_bytes(n: int = 200, seed: int = 99) -> bytes:
    rng = np.random.default_rng(seed)
    n_treated = n // 2
    treatment = np.array([1] * n_treated + [0] * (n - n_treated))
    df = pd.DataFrame({
        "customer_id":       [f"C{i:04d}" for i in range(n)],
        "age":               rng.integers(18, 75, size=n).astype(int),
        "tenure_months":     rng.integers(0, 120, size=n).astype(int),
        "past_spend":        np.round(rng.uniform(10, 2000, size=n), 2),
        "customer_segment":  rng.integers(0, 3, size=n).astype(int),
        "discount_received": treatment,
        "purchased":         rng.integers(0, 2, size=n).astype(int),
        "revenue":           np.round(rng.uniform(0, 200, size=n), 2),
    })
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode()


@pytest.fixture
def valid_csv():
    return make_csv_bytes(n=200)


@pytest.fixture
def invalid_csv():
    """CSV missing the 'discount_received' column."""
    rng = np.random.default_rng(1)
    n = 200
    df = pd.DataFrame({
        "customer_id":  [f"C{i}" for i in range(n)],
        "age":          rng.integers(18, 75, size=n),
        "purchased":    rng.integers(0, 2, size=n),
        # deliberately omit discount_received, tenure_months, etc.
    })
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode()


# ─────────────────────────────────────────────────────────────────────────────
# Health endpoint
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_returns_200():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


# ─────────────────────────────────────────────────────────────────────────────
# /validate endpoint
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_validate_valid_csv(valid_csv):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/validate",
            files={"file": ("data.csv", valid_csv, "text/csv")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is True
    assert data["errors"] == []


@pytest.mark.asyncio
async def test_validate_invalid_csv(invalid_csv):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/validate",
            files={"file": ("data.csv", invalid_csv, "text/csv")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_valid"] is False
    assert len(data["errors"]) > 0


@pytest.mark.asyncio
async def test_validate_rejects_non_csv():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/validate",
            files={"file": ("data.xlsx", b"fake excel", "application/octet-stream")},
        )
    assert resp.status_code == 415


@pytest.mark.asyncio
async def test_validate_returns_summary_keys(valid_csv):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/validate",
            files={"file": ("data.csv", valid_csv, "text/csv")},
        )
    data = resp.json()
    for key in ["n_rows", "n_treated", "n_control", "treatment_rate"]:
        assert key in data["summary"], f"Missing summary key: {key}"


# ─────────────────────────────────────────────────────────────────────────────
# /analyze endpoint (marked slow — runs the ML model)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.slow
async def test_analyze_valid_csv(valid_csv):
    pytest.importorskip("econml", reason="econml not installed")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test",
        timeout=120.0,
    ) as client:
        resp = await client.post(
            "/analyze",
            files={"file": ("data.csv", valid_csv, "text/csv")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("error") is None
    assert data["ate"] is not None
    assert isinstance(data["cate_values"], list)
    assert len(data["cate_values"]) == 200


@pytest.mark.asyncio
@pytest.mark.slow
async def test_analyze_invalid_csv_returns_error(invalid_csv):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/analyze",
            files={"file": ("data.csv", invalid_csv, "text/csv")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("error") is not None


# ─────────────────────────────────────────────────────────────────────────────
# /allocate endpoint
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_allocate_basic():
    n = 100
    rng = np.random.default_rng(7)
    payload = {
        "budget": 500.0,
        "cost_per_discount": 10.0,
        "customer_ids": [f"C{i:03d}" for i in range(n)],
        "cate_values":  np.round(rng.uniform(-0.1, 0.3, size=n), 4).tolist(),
        "cate_lower":   np.round(rng.uniform(-0.2, 0.0, size=n), 4).tolist(),
        "cate_upper":   np.round(rng.uniform(0.1, 0.5, size=n), 4).tolist(),
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post("/allocate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("error") is None
    assert data["is_prototype"] is True
    assert data["n_selected"] is not None
    assert data["total_cost"] <= 500.0   # must not exceed budget


@pytest.mark.asyncio
async def test_allocate_respects_budget():
    n = 100
    rng = np.random.default_rng(8)
    budget = 200.0
    cost = 10.0
    payload = {
        "budget": budget,
        "cost_per_discount": cost,
        "customer_ids": [f"C{i:03d}" for i in range(n)],
        "cate_values": [0.2] * n,   # all positive, all equal
        "cate_lower":  [0.0] * n,
        "cate_upper":  [0.4] * n,
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post("/allocate", json=payload)
    data = resp.json()
    assert data["n_selected"] <= int(budget // cost)
    assert data["total_cost"] <= budget


@pytest.mark.asyncio
async def test_allocate_zero_budget_returns_error():
    payload = {
        "budget": 0.01,   # Pydantic allows > 0, but can't afford one discount
        "cost_per_discount": 10.0,
        "customer_ids": ["C001"],
        "cate_values": [0.2],
        "cate_lower": [0.0],
        "cate_upper": [0.4],
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post("/allocate", json=payload)
    # Either 422 (Pydantic budget > 0 check) or 200 with error field
    assert resp.status_code in (200, 422)
    if resp.status_code == 200:
        assert resp.json().get("error") is not None


@pytest.mark.asyncio
async def test_allocate_prominent_prototype_warning():
    payload = {
        "budget": 100.0,
        "cost_per_discount": 10.0,
        "customer_ids": ["C001", "C002"],
        "cate_values": [0.1, 0.2],
        "cate_lower":  [0.0, 0.05],
        "cate_upper":  [0.2, 0.35],
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post("/allocate", json=payload)
    data = resp.json()
    assert data["is_prototype"] is True
    assert len(data["warning"]) > 0
