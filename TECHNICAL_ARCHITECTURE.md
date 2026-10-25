# EconoCausal — Technical Architecture & Causal Methodology Guide

> Comprehensive design document detailing the causal inference methodology, Double Machine Learning identification strategy, and budget optimization engine.

---

## 1. Executive Summary

E-commerce and retail marketing teams routinely distribute promotional discount coupons to drive revenue. However, traditional targeting algorithms rely on **predictive machine learning** (e.g. predicting who will make a purchase). 

This introduces a fundamental commercial flaw:
- High-value, loyal customers have high baseline purchase probabilities.
- Predictive models flag them as "high propensity" and assign them discounts.
- The business gives away margin to customers who **would have purchased regardless**, cannibalizing organic sales.

**EconoCausal** transitions the problem from prediction to **causal inference**: estimating the **Conditional Average Treatment Effect (CATE)** $\tau(X) = \mathbb{E}[Y(1) - Y(0) \mid X]$. This isolates customers whose purchase decisions are *caused* by the promotion (persuadables), excluding both organic buyers (sure things) and unresponsive customers (lost causes).

---

## 2. Core Methodology: Double Machine Learning (DML)

### Why not simple Regression or standard Random Forests?
1. **Omitted Variable & Confounder Bias:** Observational data is not randomized. Marketers already target certain customer segments (e.g., active spenders) more frequently with discounts. A naive comparison between treated and untreated customers conflates the discount's true effect with pre-existing loyalty.
2. **Regularization Bias:** Modern ML models (e.g., gradient boosted trees) use regularization (tree depth, shrinkage) to prevent overfitting. If an ML model is naively fitted on $Y \sim T + X$, the regularization shrinks the treatment coefficient $T$ towards zero, introducing severe bias that does not vanish even with infinite data.

### The Double Machine Learning Solution (Chernozhukov et al., 2018)
EconoCausal uses **Double Machine Learning with Cross-Fitting** via EconML (`LinearDML`):

1. **Propensity Nuisance Model:** 
   $$\hat{m}(X) \approx \mathbb{E}[T \mid X]$$
   Predicts discount assignment probability using a LightGBM Classifier.
2. **Outcome Nuisance Model:** 
   $$\hat{g}(X) \approx \mathbb{E}[Y \mid X]$$
   Predicts baseline purchase outcome from covariates using a LightGBM Regressor.
3. **Neyman Orthogonalization (Frisch-Waugh-Lovell):**
   Compute out-of-fold residuals:
   $$\tilde{T} = T - \hat{m}(X), \quad \tilde{Y} = Y - \hat{g}(X)$$
   By orthogonalizing both $T$ and $Y$ with respect to confounders $X$, the causal effect $\theta(X)$ satisfies Neyman orthogonality: small estimation errors in the nuisance models have zero first-order impact on the causal estimate.
4. **$K$-Fold Cross-Fitting:**
   Nuisance models are trained on fold $K_1$ and used to compute residuals on fold $K_2$. This eliminates Donsker-class Donsker overfitting conditions and yields asymptotically normal, root-$N$ consistent estimates for CATE.

---

## 3. Structural Identification Assumptions (The DAG)

For observational estimates to carry valid causal interpretations, four core assumptions must hold:

```
    Confounders (X)
   /               \
  ▼                 ▼
Discount (T) ───► Purchase (Y)
```

1. **Unconfoundedness (Conditional Ignorability):**
   $$\{Y(1), Y(0)\} \perp T \mid X$$
   All variables influencing both treatment assignment and purchase decisions are observed in $X$ (age, tenure, past spend, customer segment). *Note: This assumption cannot be verified statistically from observational data alone.*
2. **Common Support (Positivity / Overlap):**
   $$0 < \mathbb{P}(T=1 \mid X=x) < 1 \quad \forall x \in \text{supp}(X)$$
   Every customer profile has a non-zero probability of receiving either treatment or control.
3. **Stable Unit Treatment Value Assumption (SUTVA):**
   No interference between units (one user receiving a discount does not influence another user's choice) and no hidden treatment variations.
4. **Temporal Precedence:**
   All features in $X$ are measured strictly prior to the discount offering to avoid collider or mediator conditioning.

---

## 4. Diagnostics & Sensitivity Testing

Observational causal inference requires rigorous falsification checks. EconoCausal implements the **Placebo Treatment Refutation Test** via DoWhy:

- **Procedure:** The true treatment assignment column $T$ is permuted or replaced by an independent synthetic random Bernoulli variable $T_{\text{placebo}} \sim \text{Bernoulli}(p)$. The entire estimation pipeline is re-run across multiple simulations.
- **Expected Outcome:** If the original model truly captured causal signal rather than unadjusted covariate correlation, the estimated placebo effect must drop to approximately zero ($\hat{\tau}_{\text{placebo}} \approx 0$).
- **Scientific Limitation:** Passing this test is a *necessary* consistency check, but **not sufficient proof** of causality. Unobserved confounders not recorded in the database can still introduce residual bias.

---

## 5. Budget Allocation Simulator Architecture

The platform includes an interactive budget optimization simulator:

$$\max_{S \subseteq \{1,\dots,N\}} \sum_{i \in S} \hat{\tau}_i \quad \text{subject to} \quad \sum_{i \in S} c_i \le B$$

- **Current Implementation:**
  A greedy priority queue ranking customers by estimated positive CATE ($\hat{\tau}_i > 0$). Discounts of fixed unit cost $c$ are allocated to the highest-lift customers until budget $B$ is exhausted. Customers with $\hat{\tau}_i \le 0$ are explicitly filtered out.
- **Future Enhancements:**
  - Multi-treatment optimization (5%, 10%, 20% discount tiers)
  - Elasticity curves per customer
  - Direct integration of revenue outcome ($Y_{\text{revenue}}$) to maximize net profit rather than conversion probability.

---

## 6. Technical Evaluation & Key Concepts

### Q1: "Why can't you just run an A/B test (RCT)?"
> **Answer:** In retail and marketing, randomized controlled trials are the gold standard, but running a pure RCT for every discount campaign or customer cohort can be prohibitively expensive, disrupt revenue, or be commercially impractical. EconoCausal enables companies to extract causal insights and policy guidance from historical observational transaction logs while rigorously controlling for selection bias.

### Q2: "How is CATE different from predicting purchase probability?"
> **Answer:** Standard classification calculates $\mathbb{P}(Y=1 \mid T=1, X)$—the absolute likelihood of buying. A loyal VIP might have an 85% baseline probability of buying without a discount, and 87% with a discount (CATE = +2%). A price-sensitive student might have a 10% baseline, but 40% with a discount (CATE = +30%). A predictive model targets the VIP; our causal model targets the student, maximizing incremental return on marketing spend.

### Q3: "What if there is an unobserved confounder?"
> **Answer:** No statistical model can magically eliminate unobserved confounding from purely observational data. That is why our dashboard explicitly states the unconfoundedness assumption, displays the DAG, and runs DoWhy placebo refutations. In production, we complement this with sensitivity analyses (e.g. Rosenbaum bounds / omitted variable bias sensitivity parameters).

### Q4: "Why did you choose LinearDML instead of Causal Forest or Meta-learners (T-Learner / X-Learner)?"
> **Answer:** LinearDML combines non-parametric Machine Learning (LightGBM) for nuisance estimation with an interpretable, low-variance linear representation of effect heterogeneity $\theta(X)$. It scales well to tabular retail data, avoids the extreme variance sometimes found in T-Learners with imbalanced treatment ratios, and natively produces valid standard errors and confidence intervals.

---

## 7. Architecture Verification Checklist

- [x] **Reproducible Synthetic Dataset:** `scripts/generate_data.py` producing 1,000 customers with realistic non-linear confounding.
- [x] **Automated Ingestion & Validation:** Checks for schema, missing values, group size overlap, and binary constraints.
- [x] **Causal Model Engine:** EconML `LinearDML` with cross-fitting and LightGBM nuisance models.
- [x] **Diagnostics Suite:** DoWhy Placebo Treatment Refutation test with empirical p-values.
- [x] **FastAPI Microservice:** Documented REST API with `/health`, `/validate`, `/analyze`, and `/allocate`.
- [x] **React + Plotly Dashboard:** Complete interactive UI featuring drag-and-drop CSV upload, DAG viewer, ATE stat cards, interactive CATE histogram, customer table, and budget simulator.
- [x] **Automated Test Suite:** 42 passing unit and integration tests under `pytest`.
