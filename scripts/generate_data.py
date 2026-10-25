"""
generate_data.py — Synthetic Retail Dataset Generator for EconoCausal
======================================================================

PURPOSE
-------
This script creates a *synthetic* dataset that mimics a retail promotion
experiment. The data is NOT real: it is generated from a known causal model
so that we can check whether our causal estimator recovers the true effect.

CAUSAL STORY
------------
A retail company sends discount coupons (treatment) to some customers.
The business question is: "Does receiving a discount *cause* more purchases?"

The key challenge is confounding:
- Customers who have bought more in the past are BOTH more likely to receive
  a discount (company targets loyal customers) AND more likely to buy again.
- A naive ML model would see high correlation between discount and purchase,
  but part of that correlation is due to the customer's history, not the
  discount itself.
- Our causal model must control for pre-treatment history to isolate the
  true discount effect.

TRUE CAUSAL GRAPH (DAG)
-----------------------
    age  tenure  past_spend  segment
      \\      |      /           |
       \\     |     /            |
        [discount_received]  ← treatment (binary: 0 or 1)
               |
               ↓
           [purchased]       ← outcome (binary: 0 or 1)
               |
           [revenue]         ← secondary outcome (continuous, only if purchased)

Confounders: age, tenure_months, past_spend, customer_segment
(These influence BOTH who gets a discount AND whether they buy.)

TRUE AVERAGE TREATMENT EFFECT (ATE)
------------------------------------
The script uses a *known* probability uplift so we can verify our estimator.
The discount increases purchase probability by approximately +0.10 (10 pp)
on average, but the effect is *heterogeneous*:
- High-value customers (past_spend > median) get slightly more uplift
- Younger customers respond a bit more than older customers

FIELDS
------
customer_id       : str  — unique customer identifier (excluded from model features)
age               : int  — customer age in years (18–75), pre-treatment covariate
tenure_months     : int  — months since first purchase (0–120), pre-treatment covariate
past_spend        : float — total spend in the 6 months before the campaign ($, 0–5000)
customer_segment  : int  — 0=Budget, 1=Regular, 2=Premium (encoded for modelling)
discount_received : int  — treatment: 1 if the customer received a discount, else 0
purchased         : int  — outcome: 1 if the customer made a purchase in the next 30 days
revenue           : float — revenue from the customer in the next 30 days ($, 0 if purchased=0)

UNITS
-----
- age: years
- tenure_months: months
- past_spend: US dollars
- discount_received: binary indicator (no units)
- purchased: binary indicator (no units)
- revenue: US dollars
"""

import argparse
import numpy as np
import pandas as pd
from pathlib import Path


# ─────────────────────────────────────────────
# Configurable constants
# ─────────────────────────────────────────────
DEFAULT_N = 2000          # number of customers
DEFAULT_SEED = 42         # random seed for reproducibility
TRUE_ATE_APPROX = 0.10   # approximate average treatment effect on P(purchased)
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "synthetic_retail.csv"


def generate_dataset(n: int = DEFAULT_N, seed: int = DEFAULT_SEED) -> pd.DataFrame:
    """
    Generate a synthetic retail dataset with a known causal structure.

    Parameters
    ----------
    n    : number of customers to generate
    seed : random seed (set this for reproducibility)

    Returns
    -------
    pd.DataFrame with columns documented in the module docstring.
    """
    rng = np.random.default_rng(seed)

    # ── Pre-treatment covariates (confounders) ──────────────────────────────
    age = rng.integers(18, 76, size=n).astype(int)                 # uniform 18–75
    tenure_months = rng.integers(0, 121, size=n).astype(int)       # uniform 0–120
    # past_spend is log-normal (right-skewed, like real retail spend)
    past_spend = np.round(
        rng.lognormal(mean=5.5, sigma=1.2, size=n).clip(0, 5000), 2
    )
    # segment is ordinal: 0=Budget, 1=Regular, 2=Premium
    segment = rng.choice([0, 1, 2], size=n, p=[0.45, 0.40, 0.15])

    # ── Treatment assignment (observational, not randomised) ─────────────────
    # Propensity to receive a discount depends on confounders.
    # This is why naive correlation of discount->purchase is biased.
    logit_treatment = (
        -0.5                                  # intercept
        + 0.01 * (tenure_months - 60)         # loyal customers targeted more
        + 0.0003 * (past_spend - 250)         # high spenders targeted more
        + 0.3 * (segment - 1)                 # premium customers get more
        - 0.005 * (age - 40)                  # slightly younger targeted more
    )
    prob_treatment = 1 / (1 + np.exp(-logit_treatment))
    discount_received = rng.binomial(1, prob_treatment).astype(int)

    # ── Potential outcomes (the causal model) ───────────────────────────────
    # Base purchase probability depends on confounders
    logit_base = (
        -1.2                                  # intercept (baseline purchase rate ~23%)
        + 0.01 * (tenure_months - 60)         # more tenure -> more loyal -> more likely
        + 0.0004 * (past_spend - 250)         # higher spenders more likely to buy
        + 0.4 * (segment - 1)                 # premium customers buy more
        - 0.008 * (age - 40)                  # slightly younger buy a bit more
    )

    # Heterogeneous treatment effect:
    # - Average lift ≈ +0.10 on the probability scale (TRUE_ATE_APPROX)
    # - High spenders and young customers benefit slightly more
    treatment_effect_logit = (
        0.45                                  # average effect (≈ +0.10 on prob scale)
        + 0.0002 * (past_spend - 250)         # heterogeneity: big spenders respond more
        - 0.003 * (age - 40)                  # heterogeneity: younger respond more
    )

    logit_outcome = logit_base + discount_received * treatment_effect_logit
    prob_purchase = 1 / (1 + np.exp(-logit_outcome))
    purchased = rng.binomial(1, prob_purchase).astype(int)

    # ── Secondary outcome: revenue ───────────────────────────────────────────
    # Revenue is only non-zero when a customer purchases.
    # Revenue depends on segment and past_spend (not on discount directly).
    base_revenue = (
        20
        + 0.05 * past_spend
        + 15 * segment
        + rng.normal(0, 10, size=n)
    ).clip(5, None)
    revenue = np.round(purchased * base_revenue, 2)

    # ── Assemble DataFrame ───────────────────────────────────────────────────
    df = pd.DataFrame({
        "customer_id":        [f"CUST_{i:05d}" for i in range(n)],
        "age":                age,
        "tenure_months":      tenure_months,
        "past_spend":         past_spend,
        "customer_segment":   segment,
        "discount_received":  discount_received,
        "purchased":          purchased,
        "revenue":            revenue,
    })

    return df


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic retail dataset for EconoCausal"
    )
    parser.add_argument("--n", type=int, default=DEFAULT_N,
                        help=f"Number of customers (default: {DEFAULT_N})")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED,
                        help=f"Random seed (default: {DEFAULT_SEED})")
    parser.add_argument("--output", type=str, default=str(OUTPUT_PATH),
                        help=f"Output CSV path (default: {OUTPUT_PATH})")
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    df = generate_dataset(n=args.n, seed=args.seed)
    df.to_csv(output_path, index=False)

    # ── Print summary statistics ─────────────────────────────────────────────
    print(f"[OK] Generated {len(df):,} customer records -> {output_path}")
    print(f"\n--- Dataset Summary ---")
    print(f"Treatment rate (discount_received=1): {df['discount_received'].mean():.1%}")
    print(f"Outcome rate   (purchased=1):          {df['purchased'].mean():.1%}")
    treated = df[df["discount_received"] == 1]["purchased"].mean()
    control = df[df["discount_received"] == 0]["purchased"].mean()
    print(f"  Purchase rate | treated:             {treated:.1%}")
    print(f"  Purchase rate | control:             {control:.1%}")
    print(f"  Naive difference (BIASED):           {treated - control:+.3f}")
    print(f"  True ATE (approx):                   ~+{TRUE_ATE_APPROX:.2f}")
    print(f"\nNote: naive difference != true ATE because treatment assignment")
    print(f"is confounded by past_spend, segment, tenure_months, and age.")
    print(f"\nColumn dtypes:\n{df.dtypes.to_string()}")
    print(f"\nFirst 3 rows:\n{df.head(3).to_string(index=False)}")


if __name__ == "__main__":
    main()
