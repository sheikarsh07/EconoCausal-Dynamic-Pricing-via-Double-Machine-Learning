/* RefutationStatus.jsx — Sensitivity analysis & Placebo Treatment Refutation Test */

export default function RefutationStatus({ refutation }) {
  if (!refutation) return null;

  const {
    passed,
    test_name,
    ate_original,
    ate_placebo_mean,
    p_value,
    n_simulations,
    interpretation,
    limitation,
    error,
  } = refutation;

  if (error) {
    return (
      <div className="card" id="step-refutation">
        <div className="card-header">
          <span className="card-icon">🧪</span>
          <div style={{ flex: 1 }}>
            <h2>Step 5: Sensitivity &amp; Falsification Diagnostics</h2>
          </div>
          <span className="badge badge-warn">Diagnostic Inconclusive</span>
        </div>
        <div className="alert alert-warning">
          <strong>Refutation Test Could Not Run:</strong> {error}
        </div>
      </div>
    );
  }

  const origAtePct = ate_original != null ? (ate_original * 100).toFixed(2) : '—';
  const placeboAtePct = ate_placebo_mean != null ? (ate_placebo_mean * 100).toFixed(3) : '—';

  return (
    <div className="card" id="step-refutation">
      <div className="card-header">
        <span className="card-icon">🧪</span>
        <div style={{ flex: 1 }}>
          <h2>Step 5: Causal Falsification &amp; Sensitivity Testing</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            DoWhy Placebo Treatment Refutation: Testing model stability against synthetic random noise
          </p>
        </div>
        <span className={`badge ${passed ? 'badge-pass' : 'badge-fail'}`}>
          {passed ? '✓ PASSED (Effect Nullified on Placebo)' : '✗ FAILED (Spurious Signal)'}
        </span>
      </div>

      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-box accent-blue">
          <span className="stat-label">Original ATE</span>
          <span className="stat-value">{origAtePct}%</span>
          <span className="stat-sub">Estimated on actual discounts</span>
        </div>

        <div className="stat-box accent-purple">
          <span className="stat-label">Placebo ATE (Target &approx; 0%)</span>
          <span className="stat-value" style={{ color: passed ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {placeboAtePct}%
          </span>
          <span className="stat-sub">Mean effect under random noise</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Refutation P-Value</span>
          <span className="stat-value">
            {p_value != null ? p_value.toFixed(3) : '—'}
          </span>
          <span className="stat-sub">H₀: Placebo effect equals zero</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Placebo Iterations</span>
          <span className="stat-value">{n_simulations ?? 50}</span>
          <span className="stat-sub">Permuted Monte Carlo runs</span>
        </div>
      </div>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <h4 style={{ marginBottom: '6px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💡</span> Scientific Intuition &amp; Interpretation
        </h4>
        <p style={{ fontSize: '0.88rem', margin: 0, color: 'var(--text-secondary)' }}>
          {interpretation || (
            passed
              ? `When true discount assignments are scrambled into pure random Bernoulli noise across ${n_simulations ?? 50} simulations, the estimated causal effect collapses to approximately zero (${placeboAtePct}%). This confirms the LinearDML estimator is not reporting spurious background correlation from unadjusted covariate drift.`
              : `The placebo effect did not cleanly drop to zero. The model may be picking up spurious associations in the data.`
          )}
        </p>
      </div>

      <div className="alert alert-warning" style={{ margin: 0 }}>
        <strong>⚠️ Methodological Boundary &amp; Limitation:</strong>
        <p style={{ margin: '4px 0 0', fontSize: '0.84rem' }}>
          {limitation ||
            'Passing this placebo refutation test is a necessary falsification check, but NOT sufficient mathematical proof of unconfoundedness. Unmeasured confounders (e.g., competing sales campaigns or offline marketing) can still introduce residual bias.'}
        </p>
      </div>
    </div>
  );
}
