# EconoCausal: Dynamic Pricing & Promotional Discount Allocation via Double Machine Learning

[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/release/python-3119/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![EconML](https://img.shields.io/badge/EconML-LinearDML-orange.svg)](https://econml.azurewebsites.net)
[![React 19](https://img.shields.io/badge/React-19.3-61dafb.svg)](https://react.dev)
[![Tests Passing](https://img.shields.io/badge/tests-42%20passed-brightgreen.svg)]()

**EconoCausal** is an end-to-end causal inference and decision-support platform designed to estimate the heterogeneous causal effects of promotional discounts on customer purchase behavior and compute optimal discount allocations under constrained marketing budgets.

Standard predictive machine learning models predict who is *likely* to buy, which often results in wasting promotional spend on loyal customers who would have purchased organically. EconoCausal uses **Double Machine Learning (DML)** to isolate the true incremental lift—answering:
> *"Will granting this specific customer a discount **cause** an incremental conversion that would not happen otherwise?"*

---

## 🏗️ System Architecture

```
                  ┌───────────────────────────────────────────────┐
                  │          React + Plotly Dashboard            │
                  │   (Upload, DAG, CATE Plots, Budget Sim)      │
                  └───────────────────────┬───────────────────────┘
                                          │ HTTP / JSON
                                          ▼
                  ┌───────────────────────────────────────────────┐
                  │              FastAPI Backend                  │
                  │  (Validation, Endpoints, Schema Enforcement)  │
                  └───────┬───────────────────────────────┬───────┘
                          │                               │
                          ▼                               ▼
       ┌─────────────────────────────────────┐  ┌─────────────────────────────────┐
       │     EconML (LinearDML) Engine       │  │    DoWhy Sensitivity Suite      │
       │  • Propensity Nuisance: LightGBM    │  │  • Placebo Treatment Refutation │
       │  • Outcome Nuisance: LightGBM       │  │  • Empirical P-Value Diagnostic │
       │  • Orthogonalized Cross-Fitting     │  └─────────────────────────────────┘
       │  • CATE & 95% Confidence Intervals  │
       └──────────────────┬──────────────────┘
                          │
                          ▼
       ┌─────────────────────────────────────┐
       │     Budget Allocation Engine        │
       │  • Greedy CATE-Ranked Optimization  │
       │  • Incremental Purchase Forecasting │
       └─────────────────────────────────────┘
```

---

## ⚡ Quickstart Guide

### 🚀 One-Click Run (Windows)
Double-click [`start.bat`](start.bat) in the repository root to automatically launch both the FastAPI backend and Vite frontend, and open the dashboard in your default browser at `http://localhost:5173`.

Alternatively, with PowerShell:
```powershell
.\run.ps1
```

---

### Manual Setup & Execution

#### 1. Backend Setup
```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Run the test suite
pytest

# Launch FastAPI development server
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
OpenAPI documentation: **`http://localhost:8000/docs`**

#### 2. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
Web dashboard: **`http://localhost:5173`**

---

## 🔬 Predictive Machine Learning vs. Causal Inference

| Dimension | Supervised Machine Learning | Causal Inference (EconoCausal) |
| :--- | :--- | :--- |
| **Target Estimand** | Conditional Expectation: $\mathbb{E}[Y \mid T=1, X]$ | Individual Treatment Effect (CATE): $\mathbb{E}[Y(1) - Y(0) \mid X]$ |
| **Objective** | Predict whether a customer converts | Predict whether discount *causes* conversion |
| **Commercial Pitfall** | Subsidizes loyal buyers who would purchase anyway (**margin loss**) | Focuses spend exclusively on *persuadable* switchers |
| **Confounding** | Conflates selection bias with treatment efficacy | Orthogonalizes nuisance models to eliminate confounding |

---

## 🧪 Testing

A complete automated test suite is provided using `pytest`:

```bash
cd backend
pytest -v
```

All 42 tests validate:
- Dataset validation, missing value handling, and boundary checks (`tests/test_dataset.py`)
- EconML `LinearDML` parameter convergence, ATE intervals, and CATE properties (`tests/test_causal.py`)
- FastAPI endpoints `/health`, `/sample-data`, `/validate`, `/analyze`, and `/allocate` (`tests/test_api.py`)

---

## 📂 Repository Layout

```
├── backend/
│   ├── main.py                  # FastAPI application entry point with CORS
│   ├── schemas.py               # Pydantic v2 schemas for requests & responses
│   ├── requirements.txt         # Pinned Python dependencies
│   ├── pytest.ini               # Pytest configuration
│   ├── core/
│   │   ├── dataset.py           # Ingestion, validation, and schema definitions
│   │   ├── causal_model.py      # EconML LinearDML & DoWhy refutation suite
│   │   └── allocation.py        # Budget allocation optimizer
│   └── tests/
│       ├── conftest.py          # Pytest fixtures and mock dataset generators
│       ├── test_dataset.py      # Ingestion & schema validation tests
│       ├── test_causal.py       # Causal model & CATE sanity tests
│       └── test_api.py          # FastAPI endpoint integration tests
├── frontend/
│   ├── package.json             # React 19, Vite, Plotly, Axios
│   ├── vite.config.js           # Vite build configuration
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Orchestrator dashboard
│       ├── index.css            # Dark-mode design system & tokens
│       ├── api.js               # Axios client for FastAPI
│       └── components/
│           ├── CsvUpload.jsx          # Drag-and-drop CSV uploader with demo loader
│           ├── DatasetSummary.jsx     # Observational metrics & validation status
│           ├── DagView.jsx            # Causal DAG diagram & structural assumptions
│           ├── EffectResults.jsx      # ATE and 95% confidence intervals
│           ├── EffectDistribution.jsx # Interactive Plotly CATE histogram
│           ├── RefutationStatus.jsx   # Placebo sensitivity diagnostic
│           ├── CustomerTable.jsx      # Searchable, paginated customer lift table
│           └── AllocationView.jsx     # Marketing budget optimization simulator
├── data/
│   └── synthetic_retail.csv     # Pre-generated sample dataset (2,000 rows)
├── scripts/
│   └── generate_data.py         # Reproducible synthetic cohort generator
├── test_sample.csv              # Ready-to-upload demo dataset (1,000 rows)
├── start.bat                    # One-click Windows batch launcher
├── run.ps1                      # One-click PowerShell launcher
├── README.md                    # Project documentation
└── TECHNICAL_ARCHITECTURE.md    # Comprehensive technical and methodological guide
```

---

## 📖 In-Depth Methodology
For an exhaustive walkthrough of Double Machine Learning, Neyman orthogonality, cross-fitting mathematics, and sensitivity diagnostics, refer to [**`TECHNICAL_ARCHITECTURE.md`**](TECHNICAL_ARCHITECTURE.md).