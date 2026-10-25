"""
schemas.py — Pydantic Request and Response Schemas for EconoCausal API
=======================================================================

All API endpoints use these schemas for input validation and serialisation.
Pydantic v2 raises clear 422 Unprocessable Entity errors if the client
sends invalid data, with a detailed error body.
"""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────────────────────────────────────
# Shared / common
# ─────────────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:  str = "ok"
    version: str = "0.1.0"


# ─────────────────────────────────────────────────────────────────────────────
# /validate
# ─────────────────────────────────────────────────────────────────────────────

class ValidationResponse(BaseModel):
    is_valid:  bool
    errors:    list[str]
    warnings:  list[str]
    summary:   dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# /analyze
# ─────────────────────────────────────────────────────────────────────────────

class RefutationResult(BaseModel):
    passed:           Optional[bool]  = None
    test_name:        str             = "Placebo Treatment Refuter"
    ate_original:     Optional[float] = None
    ate_placebo_mean: Optional[float] = None
    p_value:          Optional[float] = None
    n_simulations:    Optional[int]   = None
    interpretation:   str             = ""
    limitation:       str             = (
        "A passing refutation test is necessary but not sufficient. "
        "Unobserved confounders can still bias the estimate."
    )
    error:            Optional[str]   = None


class AnalysisResponse(BaseModel):
    ate:            Optional[float]       = None
    ate_lower:      Optional[float]       = None
    ate_upper:      Optional[float]       = None
    cate_values:    Optional[list[float]] = None
    cate_lower:     Optional[list[float]] = None
    cate_upper:     Optional[list[float]] = None
    customer_ids:   Optional[list[str]]   = None
    n_samples:      Optional[int]         = None
    treatment_rate: Optional[float]       = None
    refutation:     Optional[RefutationResult] = None
    warnings:       list[str]             = Field(default_factory=list)
    error:          Optional[str]         = None
    methodology:    str                   = "LinearDML (EconML)"
    assumptions:    list[str]             = Field(default_factory=list)
    disclaimer: str = (
        "These are causal estimates under the stated assumptions, not "
        "predictions. The validity of the causal interpretation depends "
        "on the unconfoundedness assumption, which cannot be tested from "
        "observational data alone."
    )


# ─────────────────────────────────────────────────────────────────────────────
# /allocate
# ─────────────────────────────────────────────────────────────────────────────

class AllocationRequest(BaseModel):
    budget:            float = Field(..., gt=0, description="Total marketing budget ($)")
    cost_per_discount: float = Field(
        10.0, gt=0, description="Cost of one discount coupon ($)"
    )
    # CATE values must come from a prior /analyze call.
    customer_ids: list[str]
    cate_values:  list[float]
    cate_lower:   list[float]
    cate_upper:   list[float]

    @field_validator("cate_values", "cate_lower", "cate_upper")
    @classmethod
    def must_not_be_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("List must not be empty.")
        return v


class AllocationResponse(BaseModel):
    n_selected:                     Optional[int]        = None
    total_cost:                     Optional[float]      = None
    budget_used_pct:                Optional[float]      = None
    expected_incremental_purchases: Optional[float]      = None
    allocation_table: Optional[list[dict[str, Any]]]     = None
    is_prototype:     bool                               = True
    warning:          str                               = ""
    error:            Optional[str]                      = None
