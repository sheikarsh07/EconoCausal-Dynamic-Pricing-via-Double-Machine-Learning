"""
causal_model.py — Double Machine Learning Causal Estimator for EconoCausal
===========================================================================

WHAT THIS FILE DOES
--------------------
This file estimates the *causal effect* of receiving a discount (treatment)
on purchase probability (outcome) using Double Machine Learning (DML).

WHY NOT JUST TRAIN A PREDICTIVE MODEL?
---------------------------------------
A regular ML model (e.g., logistic regression, XGBoost) learns to predict
P(purchased | discount_received, age, tenure, ...).  The problem is that
discount_received correlates with past_spend and tenure (confounders), so
the model's discount coefficient captures both the causal effect AND the
selection bias.  You cannot directly use this coefficient as a causal effect.

HOW DML FIXES THIS
-------------------
DML (Chernozhukov et al., 2018) uses TWO separate ML models:
  1. A "propensity model" that predicts T from X (who gets the discount?).
  2. An "outcome model"  that predicts Y from X (who buys, ignoring T?).

It then regresses the *residuals* of Y (what the outcome model did NOT explain)
on the *residuals* of T (the part of treatment NOT explained by X).  These
residuals are (approximately) free of confounding, so the regression
coefficient is a valid causal estimate.

This is called the "residuals-on-residuals" or "Frisch-Waugh" insight.

CAUSAL ASSUMPTIONS (what we must assume for DML to be valid)
-------------------------------------------------------------
1. UNCONFOUNDEDNESS (selection on observables): After conditioning on X
   (age, tenure, past_spend, segment), the treatment is as good as random.
   This is the key assumption we CANNOT prove from data alone.
   It fails if there are hidden confounders (e.g., a customer loyalty tier
   that affects both discount assignment and purchase probability but is not
   in our dataset).

2. OVERLAP (positivity): Every customer has a non-zero probability of being
   in either the treated or control group.  We can check this roughly by
   looking at the propensity score distribution.

3. SUTVA (stable unit treatment value assumption): One customer's discount
   does not affect another customer's purchase decision.

4. NO POST-TREATMENT VARIABLES IN X: We only use features measured BEFORE
   the discount was issued.  Post-treatment information would create bias.

CAUSAL DAG (text representation)
---------------------------------
  age ─────────────────────────────────────────────────────────────────┐
  tenure_months ─────────────────────────────────────────────────────┐ │
  past_spend ──────┬──────────────────────────────────────────────── │ │
  customer_segment ┘                                                 │ │
         │                                                           ▼ ▼
         └─────────→ discount_received (T) ─────────────→ purchased (Y)
                              ↑ confounding path: X→T and X→Y both
                                (DML breaks this path via residuals)

ESTIMATOR CHOICE: LinearDML
----------------------------
- Treatment: binary (0/1) — this is a *binary* treatment, not a continuous dose.
- Outcome: binary (0/1) — purchase indicator.
- We use LinearDML which fits a linear model for the *conditional average
  treatment effect* (CATE) as a linear function of X.
- The nuisance models (propensity + outcome) are cross-fitted using
  LightGBM, which handles non-linear confounding well.
- Cross-fitting: the data is split into K=5 folds; each fold's residuals
  are computed using a model trained on the other folds, preventing overfitting.

IMPORTANT LIMITATION
--------------------
Because the *treatment* is binary (discount vs. no discount), DML estimates
"what is the average causal effect of *having* a discount vs. *not having* one?"
It does NOT estimate "what is the optimal discount *amount*?".  That would
require a continuous treatment variable (e.g., discount_pct).  This limitation
is clearly labelled in the dashboard.

REFUTATION TESTS (via DoWhy)
-----------------------------
We run one refutation test:
  - Placebo Treatment Refuter: Replace the real treatment with a random
    permutation.  A valid causal model should show ~zero effect on the
    placebo.  If it does not, there may be model specification problems.
Note: passing a refutation test is *necessary but not sufficient* evidence
for a valid causal estimate.  Hidden confounders can still invalidate results.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
# Result type
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class CausalResult:
    """
    Contains the output of a causal analysis run.

    Attributes
    ----------
    ate            : Average Treatment Effect (average across all customers).
    ate_lower      : Lower bound of 95% confidence interval for ATE.
    ate_upper      : Upper bound of 95% confidence interval for ATE.
    cate_values    : Per-customer CATE estimates (same order as input rows).
    cate_lower     : Per-customer lower CI bound.
    cate_upper     : Per-customer upper CI bound.
    n_samples      : Number of rows used.
    treatment_rate : Fraction of customers who were treated.
    refutation     : Summary of the DoWhy refutation test result.
    warnings       : Non-fatal issues to show the user.
    error          : Populated if estimation failed; other fields may be None.
    methodology    : Short description of the method used (for display).
    assumptions    : Causal assumptions the user must evaluate.
    """
    ate:            Optional[float]     = None
    ate_lower:      Optional[float]     = None
    ate_upper:      Optional[float]     = None
    cate_values:    Optional[list[float]] = None
    cate_lower:     Optional[list[float]] = None
    cate_upper:     Optional[list[float]] = None
    n_samples:      Optional[int]       = None
    treatment_rate: Optional[float]     = None
    refutation:     Optional[dict]      = None
    warnings:       list[str]           = field(default_factory=list)
    error:          Optional[str]       = None
    methodology:    str                 = "LinearDML (EconML)"
    assumptions: list[str] = field(default_factory=lambda: [
        "Unconfoundedness: treatment is independent of potential outcomes "
        "given the observed covariates (age, tenure_months, past_spend, "
        "customer_segment). This CANNOT be tested from data alone.",
        "Overlap (positivity): every customer has a non-zero chance of being "
        "in either the treated or control group.",
        "SUTVA: each customer's discount does not affect other customers' "
        "purchase decisions.",
        "No post-treatment covariates: only pre-discount features are used.",
    ])


# ─────────────────────────────────────────────────────────────────────────────
# Main estimation function
# ─────────────────────────────────────────────────────────────────────────────

def run_causal_analysis(
    X: pd.DataFrame,
    T: pd.Series,
    Y: pd.Series,
    n_crossfit_splits: int = 5,
    run_refutation: bool = True,
    refutation_n_simulations: int = 50,
) -> CausalResult:
    """
    Estimate the causal effect of T on Y controlling for X using LinearDML.

    Parameters
    ----------
    X                      : Pre-treatment covariates (confounders).
    T                      : Binary treatment indicator (0 or 1).
    Y                      : Binary outcome (0 or 1).
    n_crossfit_splits      : Number of cross-fitting folds (default 5).
    run_refutation         : Whether to run a DoWhy placebo refutation test.
    refutation_n_simulations: Number of simulations for the refutation test.

    Returns
    -------
    CausalResult with all estimates and metadata.

    Notes
    -----
    - Imports are inside this function to give a clear error if a package is
      not installed, rather than crashing at module import time.
    - LightGBM is used as the nuisance model because it handles categorical-
      like integer columns (customer_segment) without one-hot encoding.
    """
    result_warnings: list[str] = []

    # ── Input validation ────────────────────────────────────────────────────
    if len(X) < 50:
        return CausalResult(
            error=f"Too few samples ({len(X)}). At least 50 rows required."
        )
    if T.nunique() < 2:
        return CausalResult(
            error="Treatment variable has fewer than 2 unique values. "
                  "Both treated (=1) and control (=0) groups must be present."
        )
    if Y.nunique() < 2:
        result_warnings.append(
            "Outcome variable has only one unique value. "
            "Estimates may be numerically unstable."
        )

    n_treated = int((T == 1).sum())
    n_control = int((T == 0).sum())
    if n_treated < 10 or n_control < 10:
        return CausalResult(
            error=f"Insufficient treatment group sizes: "
                  f"treated={n_treated}, control={n_control}. "
                  f"At least 10 in each group required."
        )

    # ── Import ML / causal libraries (late import for clear error messages) ──
    try:
        from econml.dml import LinearDML
        from lightgbm import LGBMClassifier, LGBMRegressor
    except ImportError as exc:
        return CausalResult(
            error=f"Required library not installed: {exc}. "
                  f"Run: pip install econml lightgbm"
        )

    # ── Build nuisance models ───────────────────────────────────────────────
    # model_t: predicts P(T=1|X) — the propensity model
    # model_y: predicts E[Y|X]   — the outcome model
    # Both use LightGBM which is robust to the mixed numeric/integer features.
    model_t = LGBMClassifier(
        n_estimators=100,
        learning_rate=0.05,
        num_leaves=31,
        random_state=42,
        verbose=-1,   # suppress LightGBM's stdout spam
    )
    model_y = LGBMRegressor(
        n_estimators=100,
        learning_rate=0.05,
        num_leaves=31,
        random_state=42,
        verbose=-1,
    )

    # ── Fit LinearDML ───────────────────────────────────────────────────────
    # LinearDML assumes CATE(X) = θ₀ + θ₁·X₁ + θ₂·X₂ + ...
    # This is an approximation — reality may be more non-linear.
    # For a prototype this is acceptable and gives interpretable coefficients.
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")   # suppress convergence warnings
            estimator = LinearDML(
                model_t=model_t,
                model_y=model_y,
                cv=n_crossfit_splits,
                random_state=42,
                discrete_treatment=True,   # tells EconML that T is 0/1
            )
            estimator.fit(Y, T, X=X)
    except Exception as exc:
        return CausalResult(error=f"Model fitting failed: {exc}")

    # ── Extract ATE and per-customer CATE ──────────────────────────────────
    try:
        # ATE = mean of CATE over all customers
        ate = float(estimator.ate(X=X))
        ate_ci = estimator.ate_interval(X=X, alpha=0.05)
        ate_lower = float(ate_ci[0])
        ate_upper = float(ate_ci[1])

        # Per-customer CATE
        cate_point = estimator.effect(X=X).flatten().tolist()
        cate_ci = estimator.effect_interval(X=X, alpha=0.05)
        cate_lower_vals = cate_ci[0].flatten().tolist()
        cate_upper_vals = cate_ci[1].flatten().tolist()

    except Exception as exc:
        return CausalResult(error=f"Effect extraction failed: {exc}")

    # ── DoWhy refutation test ───────────────────────────────────────────────
    refutation_result: Optional[dict] = None
    if run_refutation:
        refutation_result = _run_refutation(X, T, Y)

    return CausalResult(
        ate=round(ate, 6),
        ate_lower=round(ate_lower, 6),
        ate_upper=round(ate_upper, 6),
        cate_values=[round(v, 6) for v in cate_point],
        cate_lower=[round(v, 6) for v in cate_lower_vals],
        cate_upper=[round(v, 6) for v in cate_upper_vals],
        n_samples=len(X),
        treatment_rate=round(float(T.mean()), 4),
        refutation=refutation_result,
        warnings=result_warnings,
    )


# ─────────────────────────────────────────────────────────────────────────────
# DoWhy refutation
# ─────────────────────────────────────────────────────────────────────────────

def _run_refutation(
    X: pd.DataFrame,
    T: pd.Series,
    Y: pd.Series,
    n_simulations: int = 50,
) -> dict:
    """
    Run a DoWhy placebo treatment refutation test.

    The test replaces the real treatment with a random permutation, then
    re-estimates the effect.  A well-specified causal model should produce
    an effect close to zero for the placebo, because a random assignment
    cannot causally affect the outcome.

    Returns a dict with:
      - passed   : bool — True if the placebo effect was near zero
      - ate_original      : ATE with the real treatment
      - ate_placebo_mean  : Mean ATE over n_simulations placebo runs
      - p_value           : fraction of simulations where |placebo| > |original|
      - interpretation    : human-readable explanation
    """
    try:
        import dowhy
        from dowhy import CausalModel
        from econml.dml import LinearDML
        from lightgbm import LGBMClassifier, LGBMRegressor

        # Build DoWhy causal model
        data = X.copy()
        data["treatment"] = T.values
        data["outcome"]   = Y.values

        # Define the causal graph in GML notation
        covariate_edges = "".join(
            f'edge [ source "{col}" target "treatment" ]\n'
            f'edge [ source "{col}" target "outcome" ]\n'
            for col in X.columns
        )
        graph_gml = (
            "graph [\n"
            + "".join(f'node [ id "{col}" label "{col}" ]\n' for col in X.columns)
            + 'node [ id "treatment" label "treatment" ]\n'
            + 'node [ id "outcome" label "outcome" ]\n'
            + covariate_edges
            + 'edge [ source "treatment" target "outcome" ]\n'
            + "]"
        )

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            causal_model = CausalModel(
                data=data,
                treatment="treatment",
                outcome="outcome",
                graph=graph_gml,
            )

            identified_estimand = causal_model.identify_effect(
                proceed_when_unidentifiable=True
            )

            # Use DoWhy's econml estimator bridge
            estimate = causal_model.estimate_effect(
                identified_estimand,
                method_name="backdoor.econml.dml.LinearDML",
                control_value=0,
                treatment_value=1,
                method_params={
                    "init_params": {
                        "model_t": LGBMClassifier(n_estimators=50, verbose=-1,
                                                  random_state=42),
                        "model_y": LGBMRegressor(n_estimators=50, verbose=-1,
                                                 random_state=42),
                        "cv": 3,
                        "discrete_treatment": True,
                        "random_state": 42,
                    },
                    "fit_params": {},
                },
            )
            ate_original = float(estimate.value)

            # Placebo treatment refutation
            refuter = causal_model.refute_estimate(
                identified_estimand,
                estimate,
                method_name="placebo_treatment_refuter",
                placebo_type="permute",
                num_simulations=n_simulations,
                random_seed=42,
            )

        # DoWhy refuter stores p_value (fraction of placebo > original)
        p_value = float(refuter.refutation_result.get("p_value", float("nan")))
        placebo_mean = float(refuter.new_effect)
        # Convention: pass if placebo mean is close to zero
        # and original ATE is not swamped by noise.
        passed = abs(placebo_mean) < 0.05 and (
            np.isnan(p_value) or p_value > 0.05
        )

        interpretation = (
            "PASSED — the placebo treatment produced near-zero effect, which "
            "is consistent with a valid causal model. However, this does NOT "
            "rule out hidden confounders."
            if passed else
            "FAILED — the placebo treatment produced a non-trivial effect "
            f"(mean={placebo_mean:.4f}). This suggests the model may be "
            "picking up spurious correlations rather than causal effects. "
            "Review your covariate set and model specification."
        )

        return {
            "passed":          passed,
            "test_name":       "Placebo Treatment Refuter",
            "ate_original":    round(ate_original, 6),
            "ate_placebo_mean": round(placebo_mean, 6),
            "p_value":         round(p_value, 4) if not np.isnan(p_value) else None,
            "n_simulations":   n_simulations,
            "interpretation":  interpretation,
            "limitation":      (
                "A passing refutation test is necessary but not sufficient. "
                "Unobserved confounders can still bias the estimate."
            ),
        }

    except Exception as exc:
        return {
            "passed":         None,
            "test_name":      "Placebo Treatment Refuter",
            "error":          f"Refutation could not run: {exc}",
            "interpretation": (
                "The refutation test could not be executed. "
                "This does not invalidate the EconML estimate, but you should "
                "treat the result with extra caution."
            ),
        }
