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

  // Compute CI bar relative percentage for visualization (range approx -10% to +40%)
  const minRange = -5;
  const maxRange = 35;
  const rangeSpan = maxRange - minRange;
  const lowerPos = Math.max(0, Math.min(100, (((parseFloat(lowerPercent) || 0) - minRange) / rangeSpan) * 100));
  const atePos = Math.max(0, Math.min(100, (((parseFloat(atePercent) || 0) - minRange) / rangeSpan) * 100));
  const upperPos = Math.max(0, Math.min(100, (((parseFloat(upperPercent) || 0) - minRange) / rangeSpan) * 100));
  const zeroPos = (((0 - minRange) / rangeSpan) * 100);

  return (
    <div className="card" id="step-results">
      <div className="card-header">
        <span className="card-icon">📈</span>
        <div style={{ flex: 1 }}>
          <h2>Step 3: Average Treatment Effect (ATE) &amp; Population Lift</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Population-level causal lift estimated via {methodology || 'Double Machine Learning (LinearDML)'}
          </p>
        </div>
        <span className={`badge ${isStatisticallySignificant ? 'badge-pass' : 'badge-warn'}`}>
          {isStatisticallySignificant ? '✓ Statistically Significant (95% CI)' : '⚠️ 95% CI Crosses Zero'}
        </span>
      </div>

      {warnings && warnings.length > 0 && (
        <div className="alert alert-warning">
          <strong>Model Warnings:</strong>
          <ul style={{ marginTop: '4px', paddingLeft: '18px' }}>
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main ATE Hero Metric */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          className="stat-box accent-blue"
          style={{
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}
        >
          <span className="stat-label">Average Treatment Effect (ATE)</span>
          <span className="stat-value" style={{ color: 'var(--accent-blue)', fontSize: '2.2rem' }}>
            {ate != null ? (ate > 0 ? `+${atePercent}%` : `${atePercent}%`) : '—'}
          </span>
          <span className="stat-sub" style={{ color: '#7dd3fc', fontWeight: 600 }}>
            True incremental causal lift
          </span>
        </div>

        <div className="stat-box">
          <span className="stat-label">95% Confidence Interval</span>
          <span className="stat-value" style={{ fontSize: '1.45rem' }}>
            [{lowerPercent}%, {upperPercent}%]
          </span>
          <span className="stat-sub">
            {isStatisticallySignificant ? 'Excludes zero (High confidence)' : 'Crosses zero (Uncertain lift)'}
          </span>
        </div>

        <div className="stat-box accent-purple">
          <span className="stat-label">Analyzed Cohort</span>
          <span className="stat-value">{n_samples?.toLocaleString() ?? '—'}</span>
          <span className="stat-sub">Customer cross-fitted rows</span>
        </div>

        <div className="stat-box accent-green">
          <span className="stat-label">Observed Treatment Rate</span>
          <span className="stat-value">
            {treatment_rate != null ? `${(treatment_rate * 100).toFixed(1)}%` : '—'}
          </span>
          <span className="stat-sub">Historical discount share</span>
        </div>
      </div>

      {/* Visual Confidence Interval Slider */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            Confidence Interval Visualization (95% Neyman Orthogonalized Bounds)
          </strong>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Zero-lift threshold marked in red
          </span>
        </div>

        {/* The Graphic Bar */}
        <div style={{ position: 'relative', height: '36px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Zero Line */}
          <div
            style={{
              position: 'absolute',
              left: `${zeroPos}%`,
              top: 0,
              bottom: 0,
              width: '2px',
              background: '#ef4444',
              zIndex: 2,
            }}
            title="Zero Lift Threshold (0%)"
          />

          {/* Confidence Interval Span */}
          <div
            style={{
              position: 'absolute',
              left: `${lowerPos}%`,
              width: `${Math.max(upperPos - lowerPos, 2)}%`,
              top: '8px',
              bottom: '8px',
              background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.25), rgba(168, 85, 247, 0.4), rgba(56, 189, 248, 0.25))',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid rgba(56, 189, 248, 0.6)',
              zIndex: 3,
            }}
          />

          {/* Point Estimate Marker */}
          <div
            style={{
              position: 'absolute',
              left: `calc(${atePos}% - 6px)`,
              top: '4px',
              bottom: '4px',
              width: '12px',
              height: '28px',
              background: 'var(--accent-blue)',
              borderRadius: '3px',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.8)',
              zIndex: 4,
            }}
            title={`Point Estimate (ATE): ${atePercent}%`}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          <span>{minRange}%</span>
          <span style={{ color: '#f87171', fontWeight: 600 }}>0% (No Causal Lift)</span>
          <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>ATE: +{atePercent}%</span>
          <span>+{maxRange}%</span>
        </div>
      </div>

      {/* Decision Guidance Callout */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.7) 100%)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          border: '1px solid var(--border-light)',
          marginBottom: '16px',
        }}
      >
        <h4 style={{ marginBottom: '6px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🎯</span> Marketing Leadership Takeaway
        </h4>
        <p style={{ fontSize: '0.88rem', margin: 0, color: 'var(--text-secondary)' }}>
          Issuing a promotional discount increases a customer's purchase probability by an average of{' '}
          <strong style={{ color: 'var(--accent-blue)' }}>{atePercent} percentage points</strong>{' '}
          across the general population (95% CI: [{lowerPercent}%, {upperPercent}%]).
          Because this estimate is derived using Double Machine Learning, it is not confounded by pre-existing loyalty or high past spend.
        </p>
      </div>

      <div className="alert alert-warning" style={{ margin: 0 }}>
        <strong>🔬 Prediction vs. Causal Attribution Disclaimer:</strong>
        <p style={{ margin: '4px 0 0', fontSize: '0.84rem' }}>
          {disclaimer ||
            'Standard predictive ML forecasts total conversion probability P(Y=1|X, T). It prioritizes organic VIPs who buy anyway. Double Machine Learning estimates the incremental delta E[Y(1) - Y(0) | X], maximizing return on promotional spend.'}
        </p>
      </div>
    </div>
  );
}
