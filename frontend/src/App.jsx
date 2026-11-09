/* App.jsx — Main EconoCausal Research & Decision Platform */
import { useState, useEffect } from 'react';
import { checkHealth, validateCsv, analyzeCsv, fetchSampleCsv } from './api';
import CsvUpload from './components/CsvUpload';
import DatasetSummary from './components/DatasetSummary';
import DagView from './components/DagView';
import EffectResults from './components/EffectResults';
import EffectDistribution from './components/EffectDistribution';
import RefutationStatus from './components/RefutationStatus';
import CustomerTable from './components/CustomerTable';
import AllocationView from './components/AllocationView';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'ok' | 'error'
  const [backendVersion, setBackendVersion] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [toasts, setToasts] = useState([]);

  // Toast notification helper
  function showToast(message, type = 'info') {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  }

  // Ping backend on startup
  useEffect(() => {
    async function ping() {
      try {
        const res = await checkHealth();
        if (res.status === 'ok') {
          setBackendStatus('ok');
          setBackendVersion(res.version || '0.1.0');
        } else {
          setBackendStatus('error');
        }
      } catch (err) {
        console.error('Backend health ping failed:', err);
        setBackendStatus('error');
      }
    }
    ping();
  }, []);

  // Handle file selection and validate CSV
  async function handleFileSelected(file) {
    setSelectedFile(file);
    setValidationResult(null);
    setAnalysisResult(null);
    setGlobalError(null);
    setIsValidating(true);
    setActiveStep(2);

    try {
      const res = await validateCsv(file);
      setValidationResult(res);
      if (res.is_valid) {
        showToast('Dataset validated successfully', 'success');
      } else {
        showToast('Dataset has validation issues', 'warn');
      }
    } catch (err) {
      console.error('Validation error:', err);
      const msg = err.response?.data?.detail
        ? JSON.stringify(err.response.data.detail)
        : err.message || 'Dataset validation failed';
      setGlobalError(msg);
      showToast('Validation failed', 'error');
    } finally {
      setIsValidating(false);
    }
  }

  // Trigger one-click sample load from top bar
  async function handleQuickDemo() {
    setGlobalError(null);
    try {
      showToast('Loading pre-built cohort...', 'info');
      const file = await fetchSampleCsv();
      handleFileSelected(file);
    } catch (err) {
      console.error('Failed to load demo:', err);
      showToast('Backend offline. Please start backend on :8000', 'error');
    }
  }

  // Run full Double Machine Learning causal analysis
  async function handleRunAnalysis() {
    if (!selectedFile) return;

    setGlobalError(null);
    setIsAnalyzing(true);
    showToast('Running Double Machine Learning cross-fitting...', 'info');

    try {
      const res = await analyzeCsv(selectedFile);
      if (res.error) {
        setGlobalError(`Model error: ${res.error}`);
        showToast('Estimation error', 'error');
      } else {
        setAnalysisResult(res);
        setActiveStep(3);
        showToast('Causal analysis & refutations completed!', 'success');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      const msg = err.response?.data?.detail
        ? JSON.stringify(err.response.data.detail)
        : err.message || 'Causal analysis request failed';
      setGlobalError(msg);
      showToast('Analysis request failed', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  }

  function scrollToSection(id, stepNumber) {
    setActiveStep(stepNumber);
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className="app-layout">
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : t.type === 'warn' ? '⚠️' : 'ℹ️'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Main Top Header & Branding */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-logo-area">
            <div className="brand-icon-badge">
              <span>⚡</span>
            </div>
            <div>
              <h1 className="brand-title">EconoCausal</h1>
              <p className="brand-subtitle">
                AI Promotional Pricing &amp; Discount Allocation Engine via Double Machine Learning (DML)
              </p>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={handleQuickDemo}
              title="Instantly load the 1,000 customer benchmark dataset"
            >
              <span>⚡</span> Try Demo Dataset
            </button>

            <div className={`backend-status-pill ${backendStatus}`}>
              <div className="pulse-dot" />
              <span>
                {backendStatus === 'ok' && `Backend Connected (v${backendVersion})`}
                {backendStatus === 'checking' && 'Connecting to API (:8000)...'}
                {backendStatus === 'error' && 'Backend Disconnected (Port 8000)'}
              </span>
            </div>
          </div>
        </div>

        {/* Workflow Stepper Bar */}
        <nav className="stepper-bar" aria-label="Workflow progress">
          <button
            type="button"
            className={`step-item ${activeStep === 1 ? 'active' : ''} ${selectedFile ? 'completed' : ''}`}
            onClick={() => scrollToSection('step-upload', 1)}
          >
            <div className="step-number">{selectedFile ? '✓' : '1'}</div>
            <span>1. Upload Data</span>
          </button>

          <div className={`step-connector ${validationResult ? 'completed' : ''}`} />

          <button
            type="button"
            className={`step-item ${activeStep === 2 ? 'active' : ''} ${validationResult ? 'completed' : ''}`}
            onClick={() => scrollToSection('step-validation', 2)}
          >
            <div className="step-number">{validationResult ? '✓' : '2'}</div>
            <span>2. Validation &amp; DAG</span>
          </button>

          <div className={`step-connector ${analysisResult ? 'completed' : ''}`} />

          <button
            type="button"
            className={`step-item ${activeStep === 3 ? 'active' : ''} ${analysisResult ? 'completed' : ''}`}
            onClick={() => scrollToSection('step-results', 3)}
          >
            <div className="step-number">{analysisResult ? '✓' : '3'}</div>
            <span>3. Causal Lift (ATE)</span>
          </button>

          <div className={`step-connector ${analysisResult ? 'completed' : ''}`} />

          <button
            type="button"
            className={`step-item ${activeStep === 4 ? 'active' : ''} ${analysisResult ? 'completed' : ''}`}
            onClick={() => scrollToSection('step-heterogeneity', 4)}
          >
            <div className="step-number">{analysisResult ? '✓' : '4'}</div>
            <span>4. Heterogeneity (CATE)</span>
          </button>

          <div className={`step-connector ${analysisResult ? 'completed' : ''}`} />

          <button
            type="button"
            className={`step-item ${activeStep === 5 ? 'active' : ''} ${analysisResult ? 'completed' : ''}`}
            onClick={() => scrollToSection('step-allocation', 5)}
          >
            <div className="step-number">{analysisResult ? '✓' : '5'}</div>
            <span>5. Budget Optimizer</span>
          </button>
        </nav>
      </header>

      {/* Global Error Alert */}
      {globalError && (
        <div className="alert alert-error" style={{ marginBottom: '24px' }}>
          <strong>Error encountered:</strong> {globalError}
        </div>
      )}

      {/* Predictive ML vs Causal DML Executive Comparison Card */}
      <section className="comparison-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: '#f8fafc', marginBottom: '4px' }}>
              Why Predictive Machine Learning Fails at Discount Allocation
            </h3>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              Standard predictive models predict <em>who buys</em>. Causal inference isolates <em>who buys only because of the discount</em>.
            </p>
          </div>
          <span className="badge badge-blue">Causal Value Proposition</span>
        </div>

        <div className="comparison-grid">
          <div className="comparison-card flawed">
            <span className="comparison-card-badge badge-warning-soft">
              Standard Predictive ML (Supervised)
            </span>
            <h4 style={{ fontSize: '0.98rem', marginBottom: '6px', color: '#f8fafc' }}>
              Targets "High Propensity" Customers
            </h4>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
              Flagging loyal VIPs with 85% natural purchase rates wastes marketing margin on customers who would have bought anyway, subsidizing organic sales.
            </p>
          </div>

          <div className="comparison-card causal">
            <span className="comparison-card-badge badge-success-soft">
              EconoCausal (Double Machine Learning)
            </span>
            <h4 style={{ fontSize: '0.98rem', marginBottom: '6px', color: '#f8fafc' }}>
              Targets "Persuadable" Incremental Lift
            </h4>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
              Orthogonalizes confounders to measure &tau;(X) = E[Y(1) - Y(0) | X]. Discounts are reserved exclusively for price-sensitive switchers, maximizing profit.
            </p>
          </div>
        </div>
      </section>

      {/* Main Workflow Sections */}
      <main className="sections">
        {/* Step 1: Upload */}
        <section id="step-upload">
          <CsvUpload
            onFileSelected={handleFileSelected}
            isLoading={isValidating}
            onToast={showToast}
          />
        </section>

        {/* Step 2: Dataset Validation & DAG Identification */}
        {validationResult && (
          <section id="step-validation" className="sections">
            <DatasetSummary
              validationResult={validationResult}
              onRunAnalysis={handleRunAnalysis}
              isAnalyzing={isAnalyzing}
            />
            <DagView assumptions={analysisResult?.assumptions} />
          </section>
        )}

        {/* Loading Spinner during Double ML Estimation */}
        {isAnalyzing && (
          <div className="card loading-state">
            <div className="spinner" />
            <h3 style={{ marginTop: '20px', fontSize: '1.25rem' }}>
              Fitting Double Machine Learning (LinearDML)...
            </h3>
            <p style={{ maxWidth: '640px', margin: '8px auto 0', fontSize: '0.88rem' }}>
              Cross-fitting propensity and outcome models using LightGBM across 5 folds. Computing Neyman-orthogonalized CATE bounds and executing DoWhy placebo falsification refutations.
            </p>
          </div>
        )}

        {/* Step 3: Causal Estimation Results & Diagnostics */}
        {analysisResult && (
          <section id="step-results" className="sections">
            <EffectResults analysisResult={analysisResult} />
            <EffectDistribution analysisResult={analysisResult} />
            <RefutationStatus refutation={analysisResult.refutation} />
            <CustomerTable analysisResult={analysisResult} onToast={showToast} />
            <AllocationView analysisResult={analysisResult} onToast={showToast} />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          marginTop: '64px',
          paddingTop: '24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
        }}
      >
        <div>
          <strong>EconoCausal</strong> &bull; Double Machine Learning Promotional Pricing Engine
        </div>
        <div>
          Powered by EconML &bull; DoWhy &bull; LightGBM &bull; FastAPI &bull; React
        </div>
      </footer>
    </div>
  );
}
