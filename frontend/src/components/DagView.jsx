/* DagView.jsx — Interactive Causal Directed Acyclic Graph (DAG) and Structural Assumptions */
import { useState } from 'react';

export default function DagView({ assumptions }) {
  const [activeTab, setActiveTab] = useState('dag'); // 'dag' | 'assumptions' | 'math'
  const [hoveredNode, setHoveredNode] = useState(null);

  const defaultAssumptions = [
    {
      title: '1. Unconfoundedness (Conditional Ignorability)',
      desc: 'Given observed covariates X (age, tenure, past spend, segment), discount assignment T is conditionally independent of potential outcomes (Y(0), Y(1)). Cannot be tested from data alone.',
      badge: 'Non-verifiable Assumption',
      color: 'var(--accent-amber)',
    },
    {
      title: '2. Common Support (Positivity / Overlap)',
      desc: 'Every customer profile subpopulation has a strictly non-zero probability of either receiving or not receiving a discount: 0 < P(T=1|X) < 1.',
      badge: 'Empirically Supported',
      color: 'var(--accent-green)',
    },
    {
      title: '3. SUTVA (Stable Unit Treatment Value Assumption)',
      desc: 'One customer receiving a discount does not spill over or alter another customer’s purchase decision; no hidden treatment dosage variations.',
      badge: 'Market Structural Condition',
      color: 'var(--accent-blue)',
    },
    {
      title: '4. Temporal Precedence',
      desc: 'All covariates in X are measured strictly prior to discount issuance; no post-treatment variables are adjusted for (which would induce collider bias).',
      badge: 'Data Pipeline Design',
      color: 'var(--accent-purple)',
    },
  ];

  return (
    <div className="card" id="step-dag">
      <div className="card-header">
        <span className="card-icon">🧭</span>
        <div style={{ flex: 1 }}>
          <h2>Causal Structural Model &amp; Back-Door Identification</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Directed Acyclic Graph (DAG) representing the data generating process and causal identification
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
          <button
            type="button"
            className={`btn-sm btn ${activeTab === 'dag' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('dag')}
          >
            DAG Graph
          </button>
          <button
            type="button"
            className={`btn-sm btn ${activeTab === 'assumptions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('assumptions')}
          >
            Assumptions
          </button>
          <button
            type="button"
            className={`btn-sm btn ${activeTab === 'math' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('math')}
          >
            Orthogonalization
          </button>
        </div>
      </div>

      {activeTab === 'dag' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.25fr) minmax(280px, 1fr)', gap: '24px', alignItems: 'center' }}>
          {/* Interactive SVG Diagram */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.7) 100%)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              border: '1px solid var(--border)',
              position: 'relative',
            }}
          >
            <svg viewBox="0 0 540 260" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
                <marker id="arrowhead-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#38bdf8" />
                </marker>
              </defs>

              {/* Confounders Node */}
              <g
                onMouseEnter={() => setHoveredNode('X')}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x="170" y="20" width="200" height="52" rx="10"
                  fill={hoveredNode === 'X' ? '#1e293b' : '#0f172a'}
                  stroke={hoveredNode === 'X' ? '#f59e0b' : '#d97706'}
                  strokeWidth={hoveredNode === 'X' ? 2.5 : 1.75}
                />
                <text x="270" y="44" fill="#f8fafc" fontSize="13" fontWeight="700" textAnchor="middle">
                  Observed Confounders (X)
                </text>
                <text x="270" y="60" fill="#94a3b8" fontSize="10.5" textAnchor="middle">
                  Age, Tenure, Past Spend, Segment
                </text>
              </g>

              {/* Treatment Node */}
              <g
                onMouseEnter={() => setHoveredNode('T')}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x="30" y="170" width="180" height="56" rx="10"
                  fill={hoveredNode === 'T' ? '#1e293b' : '#0f172a'}
                  stroke={hoveredNode === 'T' ? '#4ade80' : '#22c55e'}
                  strokeWidth={hoveredNode === 'T' ? 2.5 : 1.75}
                />
                <text x="120" y="196" fill="#f8fafc" fontSize="13" fontWeight="700" textAnchor="middle">
                  Discount Offer (T)
                </text>
                <text x="120" y="213" fill="#4ade80" fontSize="10.5" textAnchor="middle">
                  Promotional Treatment (0 or 1)
                </text>
              </g>

              {/* Outcome Node */}
              <g
                onMouseEnter={() => setHoveredNode('Y')}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x="330" y="170" width="180" height="56" rx="10"
                  fill={hoveredNode === 'Y' ? '#1e293b' : '#0f172a'}
                  stroke={hoveredNode === 'Y' ? '#c084fc' : '#a855f7'}
                  strokeWidth={hoveredNode === 'Y' ? 2.5 : 1.75}
                />
                <text x="420" y="196" fill="#f8fafc" fontSize="13" fontWeight="700" textAnchor="middle">
                  Purchase Conversion (Y)
                </text>
                <text x="420" y="213" fill="#c084fc" fontSize="10.5" textAnchor="middle">
                  Observed Outcome (0 or 1)
                </text>
              </g>

              {/* Path: X -> T (Confounding) */}
              <path
                d="M 230 72 L 140 166"
                fill="none"
                stroke={hoveredNode === 'X' || hoveredNode === 'T' ? '#f59e0b' : '#64748b'}
                strokeWidth={hoveredNode === 'X' || hoveredNode === 'T' ? 2.5 : 1.5}
                strokeDasharray="4 3"
                markerEnd="url(#arrowhead)"
              />
              <text x="155" y="112" fill="#f59e0b" fontSize="11" fontStyle="italic" fontWeight="600">
                Back-door path
              </text>

              {/* Path: X -> Y (Direct outcome confounding) */}
              <path
                d="M 310 72 L 400 166"
                fill="none"
                stroke={hoveredNode === 'X' || hoveredNode === 'Y' ? '#f59e0b' : '#64748b'}
                strokeWidth={hoveredNode === 'X' || hoveredNode === 'Y' ? 2.5 : 1.5}
                strokeDasharray="4 3"
                markerEnd="url(#arrowhead)"
              />
              <text x="370" y="112" fill="#f59e0b" fontSize="11" fontStyle="italic" fontWeight="600">
                Baseline tendency
              </text>

              {/* Causal Target Path: T -> Y */}
              <path
                d="M 210 198 L 326 198"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3.5"
                markerEnd="url(#arrowhead-accent)"
              />
              <text x="268" y="190" fill="#38bdf8" fontSize="12" fontWeight="800" textAnchor="middle">
                Causal Effect θ(X)
              </text>
            </svg>

            <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              💡 Hover nodes to trace the confounding paths. Double ML breaks back-door paths via Frisch-Waugh-Lovell residualization.
            </p>
          </div>

          {/* Node detail / Backdoor explanation */}
          <div>
            <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
              {hoveredNode === 'X' && 'Observed Confounders (X)'}
              {hoveredNode === 'T' && 'Treatment Intervention (T)'}
              {hoveredNode === 'Y' && 'Conversion Outcome (Y)'}
              {!hoveredNode && 'The Causal Identification Challenge'}
            </h4>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              {hoveredNode === 'X' &&
                'Features such as past spend and account tenure influence both whether marketers offer a discount and whether the customer purchases. Conditioning on X closes the back-door confounding path.'}
              {hoveredNode === 'T' &&
                'Binary discount allocation. We isolate the component of discount assignment that is orthogonal to customer covariates.'}
              {hoveredNode === 'Y' &&
                'Purchase probability. We model baseline purchase propensity using LightGBM regressor to subtract organic purchases from total purchases.'}
              {!hoveredNode &&
                'Traditional machine learning fits P(Y | T, X), conflating organic buying behavior with discount efficacy. Double Machine Learning uses cross-fitted LightGBM models to orthogonalize both T and Y, isolating the causal parameter θ(X).'}
            </p>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Identification Equation
              </span>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-primary)', margin: '4px 0 0' }}>
                Y - E[Y|X] = θ(X) &middot; (T - E[T|X]) + &epsilon;
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assumptions' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {defaultAssumptions.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${item.color}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.title}</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                {item.desc}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '10px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: item.color,
                }}
              >
                {item.badge}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'math' && (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '20px', border: '1px solid var(--border)' }}>
          <h4 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
            Neyman Orthogonalization &amp; Cross-Fitting (Chernozhukov et al., 2018)
          </h4>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Why can’t you just put T as a feature in XGBoost? Standard regularized ML shrinks treatment coefficients toward zero (regularization bias). Double Machine Learning solves this in 3 rigorous steps:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '0.85rem' }}>Step 1: Propensity Nuisance</span>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0', color: 'var(--text-muted)' }}>
                Fit m(X) = P(T=1|X) with LightGBM to predict who received discounts. Calculate treatment residuals T̃ = T - m(X).
              </p>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--accent-purple)', fontWeight: 700, fontSize: '0.85rem' }}>Step 2: Outcome Nuisance</span>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0', color: 'var(--text-muted)' }}>
                Fit g(X) = E[Y|X] with LightGBM to predict baseline purchase conversion. Calculate outcome residuals Ỹ = Y - g(X).
              </p>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--accent-green)', fontWeight: 700, fontSize: '0.85rem' }}>Step 3: Residuals Regression</span>
              <p style={{ fontSize: '0.8rem', margin: '4px 0 0', color: 'var(--text-muted)' }}>
                Regress Ỹ on T̃ using cross-fitting (5 folds). First-order errors in nuisance models vanish, yielding root-N consistent causal estimates.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
