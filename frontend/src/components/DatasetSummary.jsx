/* DatasetSummary.jsx — Displays validation results, dataset statistics, and the button to initiate causal modeling */

export default function DatasetSummary({ validationResult, onRunAnalysis, isAnalyzing }) {
  if (!validationResult) return null;

  const { is_valid, errors, warnings, summary } = validationResult;

  const naiveDifference =
    summary.outcome_rate_treated != null && summary.outcome_rate_control != null
      ? (summary.outcome_rate_treated - summary.outcome_rate_control) * 100
      : null;

  return (
    <div className="card" id="step-validation">
      <div className="card-header">
        <span className="card-icon">📋</span>
        <div style={{ flex: 1 }}>
          <h2>Step 2: Dataset Validation &amp; Cohort Summary</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Pre-flight diagnostics, sample sizes, and observational conversion metrics
          </p>
        </div>
        <span className={`badge ${is_valid ? 'badge-pass' : 'badge-fail'}`}>
          {is_valid ? '✓ Validated for Double ML' : '✗ Schema Validation Errors'}
        </span>
      </div>

      {errors && errors.length > 0 && (
        <div className="alert alert-error">
          <strong>Validation Errors:</strong>
          <ul style={{ marginTop: '6px', paddingLeft: '20px' }}>
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings && warnings.length > 0 && (
        <div className="alert alert-warning">
          <strong>Validation Warnings:</strong>
          <ul style={{ marginTop: '6px', paddingLeft: '20px' }}>
            {warnings.map((warn, idx) => (
              <li key={idx}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Observational Metrics Grid */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-box accent-blue">
          <span className="stat-label">Total Cohort</span>
          <span className="stat-value">{summary.n_rows?.toLocaleString() ?? '—'}</span>
          <span className="stat-sub">Validated customer rows</span>
        </div>

        <div className="stat-box accent-green">
          <span className="stat-label">Discounted (T=1)</span>
          <span className="stat-value">{summary.n_treated?.toLocaleString() ?? '—'}</span>
          <span className="stat-sub">
            {summary.treatment_rate != null ? `${(summary.treatment_rate * 100).toFixed(1)}% treatment rate` : '—'}
          </span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Control (T=0)</span>
          <span className="stat-value">{summary.n_control?.toLocaleString() ?? '—'}</span>
          <span className="stat-sub">
            {summary.treatment_rate != null ? `${((1 - summary.treatment_rate) * 100).toFixed(1)}% baseline rate` : '—'}
          </span>
        </div>

        <div className="stat-box accent-purple">
          <span className="stat-label">Overall Conversion</span>
          <span className="stat-value">
            {summary.outcome_rate != null ? `${(summary.outcome_rate * 100).toFixed(1)}%` : '—'}
          </span>
          <span className="stat-sub">Gross purchase rate</span>
        </div>

        <div className="stat-box accent-amber">
          <span className="stat-label">Avg Past Spend</span>
          <span className="stat-value">
            {summary.mean_revenue != null ? `$${summary.mean_revenue.toFixed(2)}` : '—'}
          </span>
          <span className="stat-sub">Historical customer spend</span>
        </div>
      </div>

      {/* Observational Confounding Callout */}
      {summary.outcome_rate_treated != null && summary.outcome_rate_control != null && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.1rem' }}>⚖️</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                Observational Disparity (Naive Comparison)
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Treated conversion: <strong>{(summary.outcome_rate_treated * 100).toFixed(1)}%</strong> &bull; 
              Control conversion: <strong>{(summary.outcome_rate_control * 100).toFixed(1)}%</strong> &bull; 
              Raw observed delta:{' '}
              <span style={{ color: naiveDifference > 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                {naiveDifference > 0 ? '+' : ''}{naiveDifference.toFixed(1)}% pts
              </span>.
              This raw difference is distorted by selection bias because past spend and tenure influence who received discounts.
            </p>
          </div>

          <button
            className="btn btn-primary"
            type="button"
            onClick={onRunAnalysis}
            disabled={!is_valid || isAnalyzing}
            id="run-analysis-btn"
            style={{ padding: '12px 24px', fontSize: '0.95rem' }}
          >
            {isAnalyzing ? (
              <>
                <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                <span>Computing Causal DML Models...</span>
              </>
            ) : (
              <>
                <span>⚡</span> Run Double Machine Learning Analysis
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
