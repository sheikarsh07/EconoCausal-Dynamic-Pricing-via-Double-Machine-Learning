/* App.jsx — Main EconoCausal Research Prototype Dashboard */
import { useState, useEffect } from 'react';
import { checkHealth, validateCsv, analyzeCsv } from './api';
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

  // Check backend health on load
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

  // Handle file selection and initiate CSV validation
  async function handleFileSelected(file) {
    setSelectedFile(file);
    setValidationResult(null);
    setAnalysisResult(null);
    setGlobalError(null);
    setIsValidating(true);

    try {
      const res = await validateCsv(file);
      setValidationResult(res);
    } catch (err) {
      console.error('Validation error:', err);
      setGlobalError(
        err.response?.data?.detail
          ? JSON.stringify(err.response.data.detail)
          : err.message || 'Dataset validation failed'
      );
    } finally {
      setIsValidating(false);
    }
  }

  // Run full Double Machine Learning causal analysis
  async function handleRunAnalysis() {
    if (!selectedFile) return;

    setGlobalError(null);
    setIsAnalyzing(true);

    try {
      const res = await analyzeCsv(selectedFile);
      if (res.error) {
        setGlobalError(`Model error: ${res.error}`);
      } else {
        setAnalysisResult(res);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setGlobalError(
        err.response?.data?.detail
          ? JSON.stringify(err.response.data.detail)
          : err.message || 'Causal analysis request failed'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="app-layout">
      {/* Dashboard Header */}
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1>EconoCausal</h1>
            <p>
              Double Machine Learning (DML) for Promotional Discount Allocation under Fixed Budget
            </p>
          </div>

          <div>
            <div className={`app-backend-status ${backendStatus}`}>
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>•</span>
              {backendStatus === 'ok' && `Backend Connected (v${backendVersion})`}
              {backendStatus === 'checking' && 'Checking FastAPI Backend (port 8000)...'}
              {backendStatus === 'error' && 'Backend Disconnected — ensure server is running on :8000'}
            </div>
          </div>
        </div>
      </header>

      {/* Global Error Banner */}
      {globalError && (
        <div className="alert alert-error" style={{ marginBottom: '24px' }}>
          <strong>Error:</strong> {globalError}
        </div>
      )}

      {/* Workflow Sections */}
      <main className="sections">
        {/* Step 1: Upload */}
        <section id="step-upload">
          <CsvUpload
            onFileSelected={handleFileSelected}
            isLoading={isValidating}
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

        {/* Step 3: Analysis Loading State */}
        {isAnalyzing && (
          <div className="card loading-state">
            <div className="spinner" />
            <h3 style={{ marginTop: '16px' }}>Estimating Heterogeneous Treatment Effects...</h3>
            <p style={{ maxWidth: '600px', margin: '8px auto 0', fontSize: '0.875rem' }}>
              Orthogonalizing nuisance models via LightGBM cross-fitting and computing per-customer CATE confidence intervals. Running sensitivity refutations in the background.
            </p>
          </div>
        )}

        {/* Step 4: Causal Estimation Results & Diagnostics */}
        {analysisResult && (
          <section id="step-results" className="sections">
            <EffectResults analysisResult={analysisResult} />
            <EffectDistribution analysisResult={analysisResult} />
            <RefutationStatus refutation={analysisResult.refutation} />
            <CustomerTable analysisResult={analysisResult} />
            <AllocationView analysisResult={analysisResult} />
          </section>
        )}
      </main>

      <footer style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        EconoCausal Platform &bull; EconML LinearDML &bull; DoWhy Refutation &bull; React &bull; FastAPI
      </footer>
    </div>
  );
}
