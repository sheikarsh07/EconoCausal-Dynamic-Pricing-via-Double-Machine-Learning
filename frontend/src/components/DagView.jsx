/* DagView.jsx — Causal Directed Acyclic Graph (DAG) and Structural Assumptions */

export default function DagView({ assumptions }) {
  const defaultAssumptions = [
    'Unconfoundedness (Conditional Ignorability): Given observed covariates X (age, tenure, past spend, segment), treatment assignment T is conditionally independent of potential outcomes (Y(0), Y(1)).',
    'Common Support (Positivity / Overlap): Every customer sub-population defined by X has a non-zero probability of receiving treatment: 0 < P(T=1|X) < 1.',
    'SUTVA (Stable Unit Treatment Value Assumption): One customer receiving a discount does not spill over or alter another customer’s purchase decision; no hidden treatment variations.',
    'Temporal Precedence: All covariates in X are strictly pre-treatment; no post-treatment variables are adjusted for (which would induce collider or mediator bias).'
  ];

  const assumptionList = assumptions && assumptions.length > 0 ? assumptions : defaultAssumptions;

  return (
    <div className="card" id="dag-view-card">
      <div className="card-header">
        <span className="card-icon">🧭</span>
        <div>
          <h2>Causal Structural Model (DAG)</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Identification strategy via the Back-Door Criterion
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.2fr) minmax(280px, 1fr)', gap: '20px', alignItems: 'center' }}>
        {/* SVG Diagram */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border)' }}>
          <svg viewBox="0 0 540 260" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#8b949e" />
              </marker>
              <marker
                id="arrowhead-accent"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#58a6ff" />
              </marker>
            </defs>

            {/* Confounders Node */}
            <rect x="180" y="20" width="180" height="50" rx="8" fill="#21262d" stroke="#d29922" strokeWidth="2" />
            <text x="270" y="45" fill="#e6edf3" fontSize="13" fontWeight="600" textAnchor="middle">
              Observed Confounders (X)
            </text>
            <text x="270" y="60" fill="#8b949e" fontSize="10" textAnchor="middle">
              Age, Tenure, Spend, Segment
            </text>

            {/* Treatment Node */}
            <rect x="40" y="170" width="160" height="54" rx="8" fill="#21262d" stroke="#3fb950" strokeWidth="2" />
            <text x="120" y="196" fill="#e6edf3" fontSize="13" fontWeight="600" textAnchor="middle">
              Discount Received (T)
            </text>
            <text x="120" y="212" fill="#3fb950" fontSize="10" textAnchor="middle">
              Treatment (0 or 1)
            </text>

            {/* Outcome Node */}
            <rect x="340" y="170" width="160" height="54" rx="8" fill="#21262d" stroke="#bc8cff" strokeWidth="2" />
            <text x="420" y="196" fill="#e6edf3" fontSize="13" fontWeight="600" textAnchor="middle">
              Customer Purchase (Y)
            </text>
            <text x="420" y="212" fill="#bc8cff" fontSize="10" textAnchor="middle">
              Outcome (Binary / Revenue)
            </text>

            {/* Path: X -> T (Confounding) */}
            <path d="M 230 70 L 140 166" fill="none" stroke="#8b949e" strokeWidth="1.75" strokeDasharray="4 3" markerEnd="url(#arrowhead)" />
            <text x="160" y="112" fill="#d29922" fontSize="11" fontStyle="italic">backdoor</text>

            {/* Path: X -> Y (Confounding) */}
            <path d="M 310 70 L 400 166" fill="none" stroke="#8b949e" strokeWidth="1.75" strokeDasharray="4 3" markerEnd="url(#arrowhead)" />
            <text x="375" y="112" fill="#d29922" fontSize="11" fontStyle="italic">direct</text>

            {/* Causal Target Path: T -> Y */}
            <path d="M 200 197 L 336 197" fill="none" stroke="#58a6ff" strokeWidth="3" markerEnd="url(#arrowhead-accent)" />
            <text x="270" y="190" fill="#58a6ff" fontSize="12" fontWeight="700" textAnchor="middle">
              Causal Effect θ(X)
            </text>
          </svg>

          <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            LinearDML orthogonalizes T and Y against X (Frisch-Waugh-Lovell) to isolate the true causal effect θ(X).
          </p>
        </div>

        {/* Identification Summary & Assumptions */}
        <div>
          <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Identification Assumptions</h4>
          <ul className="assumption-list">
            {assumptionList.map((item, idx) => (
              <li key={idx}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
