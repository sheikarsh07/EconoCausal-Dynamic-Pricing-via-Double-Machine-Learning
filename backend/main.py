"""
main.py — FastAPI Application Entry Point for EconoCausal
==========================================================

Run with:
    uvicorn main:app --reload --port 8000

The frontend (Vite dev server at http://localhost:5173) is allowed via CORS.
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

# Make sure the backend directory is on the Python path when running from
# any working directory.
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, File, UploadFile, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    HealthResponse,
    ValidationResponse,
    AnalysisResponse,
    AllocationRequest,
    AllocationResponse,
    RefutationResult,
)
from core.dataset import validate_csv, prepare_model_data
from core.causal_model import run_causal_analysis
from core.allocation import allocate_budget

# ─────────────────────────────────────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="EconoCausal API",
    description=(
        "Research prototype for causal effect estimation of marketing discounts. "
        "All causal estimates depend on the stated assumptions and should not "
        "be treated as ground truth."
    ),
    version="0.1.0",
)

# CORS — allow the Vite dev server to talk to the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default
        "http://127.0.0.1:5173",
        "http://localhost:3000",   # fallback if CRA / other tool used
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check() -> HealthResponse:
    """
    Simple liveness check.  Returns 200 if the server is running.
    The frontend polls this on startup to confirm the backend is available.
    """
    return HealthResponse()


@app.get("/sample-data", tags=["Data"])
def get_sample_dataset() -> Response:
    """
    Download a ready-to-test synthetic retail CSV dataset.
    """
    sample_path = Path(__file__).parent.parent / "data" / "synthetic_retail.csv"
    if not sample_path.exists():
        from scripts.generate_data import generate_dataset
        df = generate_dataset(n=1000)
        df.to_csv(sample_path, index=False)

    with open(sample_path, "r", encoding="utf-8") as f:
        csv_text = f.read()

    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=synthetic_retail.csv"},
    )


@app.post("/validate", response_model=ValidationResponse, tags=["Data"])
async def validate_dataset(file: UploadFile = File(...)) -> ValidationResponse:
    """
    Upload a CSV file and validate it against the EconoCausal schema.

    Returns:
    - is_valid : whether the file is safe to send to /analyze
    - errors   : fatal problems (must fix before analysis)
    - warnings : non-fatal issues (analysis can proceed, results may vary)
    - summary  : dataset statistics (row count, treatment rate, etc.)

    The file is NOT stored anywhere — it is validated in memory and discarded.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=415,
            detail="Only .csv files are accepted.",
        )

    try:
        content = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read file: {exc}")

    result = validate_csv(content)
    return ValidationResponse(
        is_valid=result.is_valid,
        errors=result.errors,
        warnings=result.warnings,
        summary=result.summary,
    )


@app.post("/analyze", response_model=AnalysisResponse, tags=["Causal Analysis"])
async def analyze_dataset(file: UploadFile = File(...)) -> AnalysisResponse:
    """
    Upload a CSV file and run the full causal analysis pipeline.

    Steps:
    1. Validate the CSV (returns errors if invalid).
    2. Prepare model-ready data (drop customer_id, split X/T/Y).
    3. Fit LinearDML with LightGBM nuisance models + cross-fitting.
    4. Extract ATE and per-customer CATE with 95% confidence intervals.
    5. Run a DoWhy placebo treatment refutation test.

    Returns causal estimates with uncertainty bounds and a refutation summary.

    ⚠️  The validity of these estimates depends on the unconfoundedness
    assumption (selection on observables), which cannot be verified from data.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=415, detail="Only .csv files are accepted.")

    content = await file.read()
    validation = validate_csv(content)

    if not validation.is_valid:
        return AnalysisResponse(
            error="Dataset validation failed: " + "; ".join(validation.errors),
            warnings=validation.warnings,
        )

    model_data = prepare_model_data(validation.dataframe)

    causal_result = run_causal_analysis(
        X=model_data.X,
        T=model_data.T,
        Y=model_data.Y,
        run_refutation=True,
    )

    if causal_result.error:
        return AnalysisResponse(
            error=causal_result.error,
            warnings=causal_result.warnings,
        )

    # Build refutation schema object
    refutation_schema: RefutationResult | None = None
    if causal_result.refutation:
        r = causal_result.refutation
        refutation_schema = RefutationResult(
            passed=r.get("passed"),
            test_name=r.get("test_name", "Placebo Treatment Refuter"),
            ate_original=r.get("ate_original"),
            ate_placebo_mean=r.get("ate_placebo_mean"),
            p_value=r.get("p_value"),
            n_simulations=r.get("n_simulations"),
            interpretation=r.get("interpretation", ""),
            limitation=r.get("limitation", ""),
            error=r.get("error"),
        )

    return AnalysisResponse(
        ate=causal_result.ate,
        ate_lower=causal_result.ate_lower,
        ate_upper=causal_result.ate_upper,
        cate_values=causal_result.cate_values,
        cate_lower=causal_result.cate_lower,
        cate_upper=causal_result.cate_upper,
        customer_ids=model_data.customer_ids.tolist(),
        n_samples=causal_result.n_samples,
        treatment_rate=causal_result.treatment_rate,
        refutation=refutation_schema,
        warnings=causal_result.warnings,
        assumptions=causal_result.assumptions,
    )


@app.post("/allocate", response_model=AllocationResponse, tags=["Allocation"])
def allocate(request: AllocationRequest) -> AllocationResponse:
    """
    Prototype budget allocation: given CATE estimates from /analyze,
    recommend which customers to target with a discount under a fixed budget.

    The allocation is a simple greedy rank-by-CATE strategy.
    It is clearly labelled as a prototype and should NOT be used for
    production budget decisions.

    Expects the customer_ids, cate_values, cate_lower, cate_upper from a
    prior /analyze response.
    """
    import pandas as pd

    result = allocate_budget(
        customer_ids=pd.Series(request.customer_ids),
        cate_values=request.cate_values,
        cate_lower=request.cate_lower,
        cate_upper=request.cate_upper,
        budget=request.budget,
        cost_per_discount=request.cost_per_discount,
    )

    return AllocationResponse(
        n_selected=result.n_selected,
        total_cost=result.total_cost,
        budget_used_pct=result.budget_used_pct,
        expected_incremental_purchases=result.expected_incremental_purchases,
        allocation_table=result.allocation_table,
        is_prototype=True,
        warning=result.warning,
        error=result.error,
    )
