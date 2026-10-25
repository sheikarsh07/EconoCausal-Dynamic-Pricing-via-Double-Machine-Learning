/* DatasetSummary.jsx — Displays validation results, dataset statistics, and the button to initiate causal modeling */

export default function DatasetSummary({ validationResult, onRunAnalysis, isAnalyzing }) {
  if (!validationResult) return null;

  const { is_valid, errors, warnings, summary } = validationResult;

  const naiveDifference =
    summary.outcome_rate_treated != null && summary.outcome_rate_control != null
      ? (summary.outcome_rate_treated - summary.outcome_rate_control) * 100
      : null;

  return (
    <div className="card" id="dataset-summary-card">
      <div className="card-header">
        <span className="card-icon">📋</span>
        <div style={{ flex: 1 }}>
          <h2>Dataset Validation &amp; Summary</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Pre-flight checks and observational characteristics
          </p>
        </div>
        <span className={`badge ${is_valid ? 'badge-pass' : 'badge-fail'}`}>
          {is_valid ? '✓ Valid for Causal Analysis' : '✗ Validation Issues'}
        </span>
      </div>

      {errors && errors.length > 0 && (
        <div className="alert alert-error">
          <strong>Validation Errors:</strong>
          <ul>
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="alert alert-warning">
          <strong>Validation Warnings:</strong>
          <ul>
            {warnings.map((warn, idx) => (
              <li key={idx}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-box accent-blue">
          <span className="stat-value">{summary.n_rows?.toLocaleString() ?? '—'}</span>
          <span className="stat-label">Total Customers</span>
        </div>
        <div className="stat-box accent-green">
          <span className="stat-value">
            {summary.treatment_rate != null
              ? `${(summary.treatment_rate * 100).toFixed(1)}%`
              : '—'}
          </span>
          <span className="stat-label">Treated Rate</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{summary.n_treated?.toLocaleString() ?? '—'}</span>
          <span className="stat-label">Treated (T=1)</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{summary.n_control?.toLocaleString() ?? '—'}</span>
          <span className="stat-label">Control (T=0)</span>
        </div>
        <div className="stat-box accent-purple">
          <span className="stat-value">
            {summary.outcome_rate != null
              ? `${(summary.outcome_rate * 100).toFixed(1)}%`
              : '—'}
          </span>
          <span className="stat-label">Overall Conversion</span>
        </div>
        <div className="stat-box accent-yellow">
          <span className="stat-value">
            {summary.mean_revenue != null ? `$${summary.mean_revenue.toFixed(2)}` : '—'}
          </span>
          <span className="stat-label">Avg Revenue</span>
        </div>
      </div>

      {/* Observational vs Causal Comparison Callout */}
      {summary.outcome_rate_treated != null && summary.outcome_rate_control != null && (
        <div className="alert alert-info" style={{ marginBottom: '20px' }}>
          <strong>⚠️ Observational Association ≠ Causal Effect</strong>
          <p style={{ margin: '6px 0 0', fontSize: '0.875rem' }}>
            Treated purchase rate: <strong>{(summary.outcome_rate_treated * 100).toFixed(1)}%</strong> | 
            Control purchase rate: <strong>{(summary.outcome_rate_control * 100).toFixed(1)}%</strong> | 
            Raw naive difference:{' '}
            <strong>
              {naiveDifference > 0 ? '+' : ''}
              {naiveDifference.toFixed(1)}% pts
            </strong>
            . This raw gap is biased by confounding factors (e.g. higher-spending customers being targeted more often for discounts).
          </p>
        </div>
      )}

      {is_valid && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
          <button
            id="run-analysis-btn"
            className="btn btn-primary"
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                Fitting Double ML Model...
              </>
            ) : (
              '⚡ Estimate Causal Effects (Double ML)'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
