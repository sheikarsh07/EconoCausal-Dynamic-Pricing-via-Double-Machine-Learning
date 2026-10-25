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
      <div className="card" id="refutation-status-card">
        <div className="card-header">
          <span className="card-icon">🧪</span>
          <h2>Causal Sensitivity &amp; Refutation</h2>
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
    <div className="card" id="refutation-status-card">
      <div className="card-header">
        <span className="card-icon">🧪</span>
        <div style={{ flex: 1 }}>
          <h2>Causal Diagnostics: {test_name || 'Placebo Treatment Refuter'}</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Falsification test replacing real treatment assignments with random noise
          </p>
        </div>
        <span className={`badge ${passed ? 'badge-pass' : 'badge-fail'}`}>
          {passed ? '✓ PASSED (Effect Nullified)' : '✗ FAILED / INCONCLUSIVE'}
        </span>
      </div>

      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-box accent-blue">
          <span className="stat-value">{origAtePct}%</span>
          <span className="stat-label">Original Estimated ATE</span>
        </div>
        <div className="stat-box accent-purple">
          <span className="stat-value">{placeboAtePct}%</span>
          <span className="stat-label">Mean Placebo Effect (Expected ~0%)</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{p_value != null ? p_value.toFixed(3) : '—'}</span>
          <span className="stat-label">Refutation P-Value (H₀: effect=0)</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{n_simulations ?? 10}</span>
          <span className="stat-label">Placebo Simulations</span>
        </div>
      </div>

      <div className="refutation-box" style={{ marginBottom: '16px' }}>
        <h4 style={{ marginBottom: '6px', color: 'var(--text-primary)' }}>Scientific Intuition</h4>
        <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-secondary)' }}>
          {interpretation || (
            passed
              ? `When discount assignments are permuted with independent random placebos, the estimated effect drops to approximately zero (${placeboAtePct}%). This confirms that the model is not reporting spurious correlation from unadjusted trends.`
              : `The placebo effect did not cleanly drop to zero. The model may be capturing spurious associations.`
          )}
        </p>
      </div>

      <div className="alert alert-warning" style={{ margin: 0 }}>
        <strong>⚠️ Crucial Methodological Limitation:</strong>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
          {limitation ||
            'A passing refutation test is a necessary sanity check, but NOT sufficient proof of causality. Unobserved confounders (e.g. competitor actions, unrecorded customer intent) can still bias observational estimates.'}
        </p>
      </div>
    </div>
  );
}
