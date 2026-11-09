/* EffectDistribution.jsx — Interactive distribution plot of Conditional Average Treatment Effects (CATE) */
import Plot from 'react-plotly.js';

export default function EffectDistribution({ analysisResult }) {
  if (!analysisResult || !analysisResult.cate_values) return null;

  const { cate_values, ate } = analysisResult;

  // Convert to percentages for human readability
  const catePercentages = cate_values.map(v => v * 100);
  const atePercent = ate != null ? ate * 100 : null;

  const positiveEffects = catePercentages.filter(v => v > 0).length;
  const zeroOrNegative = catePercentages.filter(v => v <= 0).length;
  const positiveRatio = ((positiveEffects / catePercentages.length) * 100).toFixed(1);
  const minCate = Math.min(...catePercentages).toFixed(1);
  const maxCate = Math.max(...catePercentages).toFixed(1);

  // Compute median
  const sorted = [...catePercentages].sort((a, b) => a - b);
  const medianCate = sorted[Math.floor(sorted.length / 2)].toFixed(1);

  return (
    <div className="card" id="step-heterogeneity">
      <div className="card-header">
        <span className="card-icon">📊</span>
        <div style={{ flex: 1 }}>
          <h2>Step 4: Effect Heterogeneity (CATE Distribution)</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Conditional Average Treatment Effect: how individual customer segments respond to promotions
          </p>
        </div>
        <span className="badge badge-purple">
          {positiveRatio}% Persuadable Cohort
        </span>
      </div>

      {/* Customer Quadrant Segmentation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🎯 Persuadables (Lift &gt; 0)
            </span>
            <span className="badge badge-pass">{positiveRatio}%</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
            {positiveEffects.toLocaleString()} Customers
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Primary discount target: purchase decision is <em>caused</em> by the coupon.
          </p>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⛔ Unresponsive / Sure Things (Lift &le; 0)
            </span>
            <span className="badge badge-fail">{(100 - parseFloat(positiveRatio)).toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
            {zeroOrNegative.toLocaleString()} Customers
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Do not discount: either buy anyway or discount fails to induce conversion.
          </p>
        </div>

        <div className="stat-box accent-blue">
          <span className="stat-label">Lift Spread [Min, Max]</span>
          <span className="stat-value" style={{ fontSize: '1.35rem' }}>
            [{minCate}%, +{maxCate}%]
          </span>
          <span className="stat-sub">Median Lift: +{medianCate}%</span>
        </div>
      </div>

      {/* Plotly Interactive Histogram */}
      <div
        style={{
          width: '100%',
          minHeight: '340px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          padding: '12px',
        }}
      >
        <Plot
          data={[
            {
              x: catePercentages,
              type: 'histogram',
              nbinsx: 35,
              marker: {
                color: '#a855f7',
                opacity: 0.85,
                line: {
                  color: '#c084fc',
                  width: 1,
                },
              },
              hovertemplate: 'Lift: %{x:.2f}%<br>Customers: %{y}<extra></extra>',
              name: 'Customer CATE',
            },
          ]}
          layout={{
            autosize: true,
            height: 310,
            margin: { l: 50, r: 30, t: 30, b: 50 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: {
              family: 'Plus Jakarta Sans, sans-serif',
              color: '#94a3b8',
              size: 11,
            },
            xaxis: {
              title: {
                text: 'Estimated Incremental Lift in Purchase Probability (%)',
                font: { size: 12, color: '#f8fafc' },
              },
              zeroline: true,
              zerolinecolor: '#ef4444',
              zerolinewidth: 2,
              gridcolor: 'rgba(255, 255, 255, 0.08)',
              tickfont: { color: '#94a3b8' },
            },
            yaxis: {
              title: {
                text: 'Number of Customers',
                font: { size: 12, color: '#f8fafc' },
              },
              gridcolor: 'rgba(255, 255, 255, 0.08)',
              tickfont: { color: '#94a3b8' },
            },
            shapes: [
              ...(atePercent != null
                ? [
                    {
                      type: 'line',
                      x0: atePercent,
                      x1: atePercent,
                      y0: 0,
                      y1: 1,
                      yref: 'paper',
                      line: {
                        color: '#38bdf8',
                        width: 2.5,
                        dash: 'dash',
                      },
                    },
                  ]
                : []),
            ],
            annotations: [
              ...(atePercent != null
                ? [
                    {
                      x: atePercent,
                      y: 0.95,
                      yref: 'paper',
                      text: `Population ATE: +${atePercent.toFixed(1)}%`,
                      showarrow: true,
                      arrowhead: 2,
                      arrowcolor: '#38bdf8',
                      ax: 40,
                      ay: -20,
                      font: {
                        color: '#38bdf8',
                        size: 11,
                        weight: 700,
                      },
                      bgcolor: 'rgba(15, 23, 42, 0.85)',
                      bordercolor: '#38bdf8',
                      borderwidth: 1,
                      borderpad: 4,
                    },
                  ]
                : []),
            ],
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </div>
    </div>
  );
}
