"""
allocation.py — Prototype Budget Allocation for EconoCausal
=============================================================

⚠️  PROTOTYPE — NOT A PRODUCTION OPTIMIZER ⚠️
----------------------------------------------
This module implements a simple *greedy* allocation strategy that ranks
customers by their estimated CATE (Conditional Average Treatment Effect)
and assigns discounts to the highest-CATE customers first, up to the budget.

WHY THIS IS A PROTOTYPE
------------------------
1. It uses a fixed discount cost per customer (no varying discount amounts).
2. It ignores uncertainty in CATE estimates (someone with high CATE but
   wide confidence interval might be over-ranked).
3. It assumes the treatment effect is additive and independent across customers.
4. A production system would use a formal constrained optimisation approach
   (e.g., linear programming, bandit algorithms, or policy learning).

WHAT THE OUTPUT MEANS
---------------------
- "recommended_for_discount": customers selected for a discount under budget.
- "expected_incremental_purchases": CATE sum for selected customers (an
  estimate, subject to causal assumptions, not a guaranteed business outcome).
- "cost": total discount spend if all selected customers receive a discount.

The output is explicitly labelled as a prototype in the API response.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd


@dataclass
class AllocationResult:
    """
    Output of the prototype budget allocation.

    Attributes
    ----------
    n_selected          : Number of customers recommended for a discount.
    total_cost          : Total discount cost ($) for selected customers.
    budget_used_pct     : Fraction of the budget consumed.
    expected_incremental_purchases : Sum of CATE values for selected customers
                                     (estimate only — subject to causal assumptions).
    allocation_table    : Per-customer table with recommendation and CATE.
    is_prototype        : Always True — label this clearly in the UI.
    warning             : Prominently displayed caveat.
    error               : Populated if allocation failed.
    """
    n_selected:                     Optional[int]   = None
    total_cost:                     Optional[float] = None
    budget_used_pct:                Optional[float] = None
    expected_incremental_purchases: Optional[float] = None
    allocation_table: Optional[list[dict]] = None
    is_prototype:     bool = True
    warning: str = (
        "⚠️  PROTOTYPE: This allocation is based on CATE estimates that assume "
        "causal identification holds (see Assumptions section). It uses a simple "
        "greedy ranking and does not account for estimate uncertainty. "
        "Do not use for production budget decisions."
    )
    error: Optional[str] = None


def allocate_budget(
    customer_ids: pd.Series,
    cate_values: list[float],
    cate_lower: list[float],
    cate_upper: list[float],
    budget: float,
    cost_per_discount: float = 10.0,
) -> AllocationResult:
    """
    Greedily allocate a marketing budget to customers with the highest CATE.

    Parameters
    ----------
    customer_ids      : Series of customer identifiers (for display only).
    cate_values       : Per-customer CATE point estimates (same order as IDs).
    cate_lower        : Per-customer CATE lower CI bound.
    cate_upper        : Per-customer CATE upper CI bound.
    budget            : Total marketing budget in dollars.
    cost_per_discount : Cost of one discount coupon in dollars (default $10).

    Returns
    -------
    AllocationResult with selected customers and prototype warning.
    """
    # ── Input validation ────────────────────────────────────────────────────
    if budget <= 0:
        return AllocationResult(error="Budget must be a positive number.")
    if cost_per_discount <= 0:
        return AllocationResult(error="Cost per discount must be a positive number.")
    if len(cate_values) == 0:
        return AllocationResult(error="No CATE values provided.")
    if len(customer_ids) != len(cate_values):
        return AllocationResult(
            error="customer_ids and cate_values must have the same length."
        )

    n_max = int(budget // cost_per_discount)
    if n_max == 0:
        return AllocationResult(
            error=f"Budget ${budget:.2f} is less than the cost per discount "
                  f"${cost_per_discount:.2f}. No customers can be selected."
        )

    # ── Build DataFrame and rank by CATE ────────────────────────────────────
    df = pd.DataFrame({
        "customer_id": customer_ids.values,
        "cate":        cate_values,
        "cate_lower":  cate_lower,
        "cate_upper":  cate_upper,
    })

    # Only consider customers with positive CATE (discount predicted to help).
    # Sending a discount to customers with negative CATE could backfire.
    positive_cate = df[df["cate"] > 0].copy()

    # Sort descending by CATE (greedy: highest effect first).
    positive_cate = positive_cate.sort_values("cate", ascending=False).reset_index(drop=True)

    # Select top-N up to budget.
    n_selected = min(n_max, len(positive_cate))
    selected = positive_cate.iloc[:n_selected].copy()
    selected["recommended"] = True

    # Mark non-selected rows.
    not_selected = df[df["cate"] <= 0].copy()
    not_selected["recommended"] = False
    remaining = positive_cate.iloc[n_selected:].copy()
    remaining["recommended"] = False

    full_table = pd.concat([selected, not_selected, remaining], ignore_index=True)
    full_table = full_table.sort_values("cate", ascending=False).reset_index(drop=True)

    total_cost = n_selected * cost_per_discount
    expected_lift = float(selected["cate"].sum()) if n_selected > 0 else 0.0

    return AllocationResult(
        n_selected=n_selected,
        total_cost=round(total_cost, 2),
        budget_used_pct=round(total_cost / budget, 4),
        expected_incremental_purchases=round(expected_lift, 4),
        allocation_table=full_table[[
            "customer_id", "cate", "cate_lower", "cate_upper", "recommended"
        ]].round(6).to_dict(orient="records"),
    )
