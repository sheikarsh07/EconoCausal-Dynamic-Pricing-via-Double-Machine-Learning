"""
dataset.py — CSV Loading and Validation for EconoCausal
=========================================================

This module is the single source of truth for what a valid input dataset
looks like. It runs before any model is trained, so errors are caught early
with clear, actionable messages.

Design decisions
----------------
- We NEVER silently replace or impute missing values.  Missing data is an
  error that the user must fix before proceeding.  This is honest: imputation
  assumptions can bias causal estimates.
- customer_id is loaded but immediately dropped before features are returned.
  Identifiers must never enter the model.
- The treatment and outcome columns are listed explicitly so there is no
  ambiguity about what the model is estimating.
- Post-treatment variables (purchased, revenue) are separated from
  pre-treatment covariates to prevent causal leakage.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
# Schema definition
# ─────────────────────────────────────────────────────────────────────────────

# Required columns and their expected dtypes (after coercion).
REQUIRED_COLUMNS: dict[str, type] = {
    "customer_id":       str,
    "age":               int,
    "tenure_months":     int,
    "past_spend":        float,
    "customer_segment":  int,
    "discount_received": int,
    "purchased":         int,
    "revenue":           float,
}

# Columns that are pre-treatment covariates (confounders / features for X).
COVARIATE_COLUMNS: list[str] = [
    "age",
    "tenure_months",
    "past_spend",
    "customer_segment",
]

# Treatment variable
TREATMENT_COLUMN = "discount_received"

# Outcome variables
OUTCOME_BINARY_COLUMN  = "purchased"    # binary outcome (0/1)
OUTCOME_REVENUE_COLUMN = "revenue"      # continuous outcome ($)

# Plausibility bounds (inclusive).  Values outside these are flagged, NOT
# silently clipped.  The user must decide how to handle outliers.
PLAUSIBILITY_BOUNDS: dict[str, tuple[float, float]] = {
    "age":               (0,   120),
    "tenure_months":     (0,   600),
    "past_spend":        (0,   1_000_000),
    "revenue":           (0,   1_000_000),
    "customer_segment":  (0,   10),
    "discount_received": (0,   1),
    "purchased":         (0,   1),
}

# Minimum number of rows required for the model to run.
MIN_ROWS = 50

# Minimum number of rows in each treatment group.
MIN_TREATMENT_GROUP_ROWS = 10


# ─────────────────────────────────────────────────────────────────────────────
# Result types
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    """
    Holds the outcome of a CSV validation check.

    Attributes
    ----------
    is_valid      : True only if the dataset is safe to pass to the model.
    errors        : Fatal problems — the model will not run until fixed.
    warnings      : Non-fatal issues — the model can run but results may be
                    unreliable.
    summary       : High-level statistics about the dataset.
    dataframe     : The loaded and lightly cleaned DataFrame, or None on fatal error.
    """
    is_valid:  bool
    errors:    list[str] = field(default_factory=list)
    warnings:  list[str] = field(default_factory=list)
    summary:   dict      = field(default_factory=dict)
    dataframe: Optional[pd.DataFrame] = None


@dataclass
class ModelReadyData:
    """
    Clean, model-ready slices of the dataset.
    customer_id is stored separately and never passed to the model.
    """
    X: pd.DataFrame           # pre-treatment covariates
    T: pd.Series              # treatment indicator
    Y: pd.Series              # primary binary outcome
    Y_revenue: pd.Series      # continuous revenue outcome
    customer_ids: pd.Series   # for merging results back to the UI table


# ─────────────────────────────────────────────────────────────────────────────
# Validation logic
# ─────────────────────────────────────────────────────────────────────────────

def validate_csv(file_content: bytes | str) -> ValidationResult:
    """
    Load and validate a CSV from raw bytes or a string.

    Returns a ValidationResult.  If is_valid is False, dataframe may be None
    or partial — do not pass it to the model.

    Parameters
    ----------
    file_content : the raw CSV content (bytes from a file upload, or a string
                   for testing).
    """
    errors:   list[str] = []
    warnings: list[str] = []

    # ── 1. Parse CSV ────────────────────────────────────────────────────────
    try:
        if isinstance(file_content, bytes):
            df = pd.read_csv(io.BytesIO(file_content))
        else:
            df = pd.read_csv(io.StringIO(file_content))
    except Exception as exc:
        return ValidationResult(
            is_valid=False,
            errors=[f"Could not parse CSV file: {exc}"],
        )

    # ── 2. Required columns ─────────────────────────────────────────────────
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        errors.append(
            f"Missing required columns: {missing_cols}. "
            f"The dataset must contain all of: {list(REQUIRED_COLUMNS.keys())}"
        )
        # Cannot proceed without required columns
        return ValidationResult(is_valid=False, errors=errors)

    # ── 3. Row count ─────────────────────────────────────────────────────────
    if len(df) < MIN_ROWS:
        errors.append(
            f"Dataset has only {len(df)} rows. "
            f"At least {MIN_ROWS} rows are required for stable causal estimation."
        )

    # ── 4. Missing values ────────────────────────────────────────────────────
    for col in REQUIRED_COLUMNS:
        n_missing = df[col].isna().sum()
        if n_missing > 0:
            errors.append(
                f"Column '{col}' has {n_missing} missing value(s). "
                f"Please fix or remove these rows — missing values are not imputed."
            )

    # If there are missing-value errors, report them all before stopping.
    if errors:
        return ValidationResult(is_valid=False, errors=errors, warnings=warnings)

    # ── 5. Type coercion ─────────────────────────────────────────────────────
    type_errors: list[str] = []
    for col, dtype in REQUIRED_COLUMNS.items():
        if col == "customer_id":
            df[col] = df[col].astype(str)
            continue
        try:
            df[col] = df[col].astype(dtype)
        except (ValueError, TypeError) as exc:
            type_errors.append(
                f"Column '{col}' cannot be converted to {dtype.__name__}: {exc}"
            )
    if type_errors:
        errors.extend(type_errors)
        return ValidationResult(is_valid=False, errors=errors, warnings=warnings)

    # ── 6. Binary column values ──────────────────────────────────────────────
    for col in [TREATMENT_COLUMN, OUTCOME_BINARY_COLUMN]:
        bad = df[col][~df[col].isin([0, 1])]
        if not bad.empty:
            errors.append(
                f"Column '{col}' must contain only 0 or 1. "
                f"Found unexpected values: {sorted(bad.unique().tolist())}"
            )

    # ── 7. Duplicate customer_id ─────────────────────────────────────────────
    dup_count = df["customer_id"].duplicated().sum()
    if dup_count > 0:
        warnings.append(
            f"{dup_count} duplicate customer_id value(s) found. "
            f"Each customer should appear once. Duplicates may indicate data "
            f"merge errors or multiple observations per customer."
        )

    # ── 8. Treatment groups ──────────────────────────────────────────────────
    n_treated = int((df[TREATMENT_COLUMN] == 1).sum())
    n_control = int((df[TREATMENT_COLUMN] == 0).sum())
    if n_treated < MIN_TREATMENT_GROUP_ROWS:
        errors.append(
            f"Only {n_treated} treated customer(s) (discount_received=1). "
            f"At least {MIN_TREATMENT_GROUP_ROWS} are required."
        )
    if n_control < MIN_TREATMENT_GROUP_ROWS:
        errors.append(
            f"Only {n_control} control customer(s) (discount_received=0). "
            f"At least {MIN_TREATMENT_GROUP_ROWS} are required."
        )

    # ── 9. Plausibility checks ───────────────────────────────────────────────
    for col, (lo, hi) in PLAUSIBILITY_BOUNDS.items():
        if col not in df.columns:
            continue
        n_out = int(((df[col] < lo) | (df[col] > hi)).sum())
        if n_out > 0:
            warnings.append(
                f"Column '{col}' has {n_out} value(s) outside the expected "
                f"range [{lo}, {hi}]. Please verify these are not data errors."
            )

    # ── 10. Revenue / purchased consistency ──────────────────────────────────
    # Revenue should be 0 when not purchased (but this is a warning, not error,
    # because the user may define revenue differently).
    inconsistent = int(
        ((df[OUTCOME_BINARY_COLUMN] == 0) & (df[OUTCOME_REVENUE_COLUMN] > 0)).sum()
    )
    if inconsistent > 0:
        warnings.append(
            f"{inconsistent} row(s) have purchased=0 but revenue>0. "
            f"This may be intentional (e.g., returns, subscription revenue), "
            f"but please verify."
        )

    # ── 11. Summary statistics ───────────────────────────────────────────────
    summary = {
        "n_rows":          int(len(df)),
        "n_treated":       n_treated,
        "n_control":       n_control,
        "treatment_rate":  round(n_treated / len(df), 4),
        "outcome_rate":    round(float(df[OUTCOME_BINARY_COLUMN].mean()), 4),
        "outcome_rate_treated": round(
            float(df[df[TREATMENT_COLUMN] == 1][OUTCOME_BINARY_COLUMN].mean()), 4
        ),
        "outcome_rate_control": round(
            float(df[df[TREATMENT_COLUMN] == 0][OUTCOME_BINARY_COLUMN].mean()), 4
        ),
        "mean_revenue":    round(float(df[OUTCOME_REVENUE_COLUMN].mean()), 2),
        "columns":         list(df.columns),
        "covariate_columns":  COVARIATE_COLUMNS,
        "treatment_column":   TREATMENT_COLUMN,
        "outcome_column":     OUTCOME_BINARY_COLUMN,
    }

    is_valid = len(errors) == 0
    return ValidationResult(
        is_valid=is_valid,
        errors=errors,
        warnings=warnings,
        summary=summary,
        dataframe=df if is_valid else None,
    )


def prepare_model_data(df: pd.DataFrame) -> ModelReadyData:
    """
    Split a validated DataFrame into model-ready slices.

    This function assumes validate_csv() has already been called and returned
    is_valid=True.  It is a separate step to make the causal assumptions
    explicit: we define exactly what is X, T, and Y.

    The customer_id is returned separately so the UI can join results back
    to individual customers.  It is never passed to any model.
    """
    return ModelReadyData(
        X=df[COVARIATE_COLUMNS].copy(),
        T=df[TREATMENT_COLUMN].copy(),
        Y=df[OUTCOME_BINARY_COLUMN].copy(),
        Y_revenue=df[OUTCOME_REVENUE_COLUMN].copy(),
        customer_ids=df["customer_id"].copy(),
    )
