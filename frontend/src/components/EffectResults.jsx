/* EffectResults.jsx — Displays Average Treatment Effect (ATE), Confidence Intervals, and Causal Disclaimers */

export default function EffectResults({ analysisResult }) {
  if (!analysisResult) return null;

  const {
    ate,
    ate_lower,
    ate_upper,
    n_samples,
    treatment_rate,
    methodology,
    disclaimer,
    warnings
  } = analysisResult;

  const atePercent = ate != null ? (ate * 100).toFixed(2) : '—';
  const lowerPercent = ate_lower != null ? (ate_lower * 100).toFixed(2) : '—';
  const upperPercent = ate_upper != null ? (ate_upper * 100).toFixed(2) : '—';
  const isStatisticallySignificant =
    ate_lower != null && ate_upper != null && Math.sign(ate_lower) === Math.sign(ate_upper);

  return (
    <div className="card" id="effect-results-card">
      <div className="card-header">
        <span className="card-icon">📈</span>
        <div style={{ flex: 1 }}>
          <h2>Average Treatment Effect (ATE)</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Population-level causal lift estimated via {methodology || 'Double Machine Learning'}
          </p>
        </div>
        <span className={`badge ${isStatisticallySignificant ? 'badge-pass' : 'badge-warn'}`}>
          {isStatisticallySignificant ? '✓ Statistically Significant (95% CI)' : '⚠️ 95% CI Crosses Zero'}
        </span>
      </div>

      {warnings && warnings.length > 0 && (
        <div className="alert alert-warning">
          <strong>Model Warnings:</strong>
          <ul>
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-box accent-blue">
          <span className="stat-value" style={{ color: 'var(--accent-blue)' }}>
            {ate != null ? (ate > 0 ? `+${atePercent}%` : `${atePercent}%`) : '—'}
          </span>
          <span className="stat-label">Average Treatment Effect (ATE)</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{lowerPercent}%</span>
          <span className="stat-label">95% CI Lower Bound</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{upperPercent}%</span>
          <span className="stat-label">95% CI Upper Bound</span>
        </div>
        <div className="stat-box accent-purple">
          <span className="stat-value">{n_samples?.toLocaleString() ?? '—'}</span>
          <span className="stat-label">Analyzed Customers</span>
        </div>
        <div className="stat-box accent-green">
          <span className="stat-value">
            {treatment_rate != null ? `${(treatment_rate * 100).toFixed(1)}%` : '—'}
          </span>
          <span className="stat-label">Observed Treatment Rate</span>
        </div>
      </div>

      <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border)', marginBottom: '16px' }}>
        <h4 style={{ marginBottom: '6px', color: 'var(--text-primary)' }}>Managerial Interpretation</h4>
        <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>
          Targeting a customer with a discount causes an estimated average lift of{' '}
          <strong style={{ color: 'var(--accent-blue)' }}>{atePercent} percentage points</strong>{' '}
          in purchase probability, with a 95% confidence interval of [
          <strong>{lowerPercent}%</strong>, <strong>{upperPercent}%</strong>].
          Because this is derived using orthogonalized cross-fitting (LinearDML), it removes confounding bias from observed customer characteristics (past spend, tenure, and segments).
        </p>
      </div>

      <div className="alert alert-warning" style={{ margin: 0 }}>
        <strong>🔬 Causal Inference vs. Prediction Distinction:</strong>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
          {disclaimer}
        </p>
      </div>
    </div>
  );
}
