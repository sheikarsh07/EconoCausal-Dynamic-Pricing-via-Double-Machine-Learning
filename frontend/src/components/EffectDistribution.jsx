/* EffectDistribution.jsx — Interactive distribution plot of Conditional Average Treatment Effects (CATE) */
import Plot from 'react-plotly.js';

export default function EffectDistribution({ analysisResult }) {
  if (!analysisResult || !analysisResult.cate_values) return null;

  const { cate_values, ate } = analysisResult;

  // Convert to percentages for readability
  const catePercentages = cate_values.map(v => v * 100);
  const atePercent = ate != null ? ate * 100 : null;

  const positiveEffects = catePercentages.filter(v => v > 0).length;
  const positiveRatio = ((positiveEffects / catePercentages.length) * 100).toFixed(1);
  const minCate = Math.min(...catePercentages).toFixed(2);
  const maxCate = Math.max(...catePercentages).toFixed(2);

  return (
    <div className="card" id="cate-distribution-card">
      <div className="card-header">
        <span className="card-icon">📊</span>
        <div style={{ flex: 1 }}>
          <h2>Treatment Effect Heterogeneity (CATE Distribution)</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Variation in discount sensitivity across individual customers
          </p>
        </div>
        <span className="badge badge-yes">
          {positiveRatio}% Positively Impacted
        </span>
      </div>

      <p style={{ fontSize: '0.875rem', marginBottom: '16px' }}>
        While the population ATE provides an average, customers respond differently. Customers with negative or zero CATE do not benefit from promotional discounts and would cause wasted marketing spend.
      </p>

      <div style={{ width: '100%', minHeight: '340px' }}>
        <Plot
          data={[
            {
              x: catePercentages,
              type: 'histogram',
              nbinsx: 35,
              marker: {
                color: '#bc8cff',
                opacity: 0.85,
                line: {
                  color: '#e6edf3',
                  width: 0.5,
                },
              },
              hovertemplate: 'Lift: %{x:.2f}%<br>Customers: %{y}<extra></extra>',
              name: 'Customer CATE',
            },
          ]}
          layout={{
            autosize: true,
            height: 320,
            margin: { l: 50, r: 30, t: 30, b: 50 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: {
              family: 'Inter, sans-serif',
              color: '#8b949e',
              size: 11,
            },
            xaxis: {
              title: { text: 'Estimated Lift in Purchase Probability (Percentage Points)', font: { size: 12, color: '#e6edf3' } },
              zeroline: true,
              zerolinecolor: '#f85149',
              zerolinewidth: 2,
              gridcolor: '#30363d',
              tickfont: { color: '#8b949e' },
            },
            yaxis: {
              title: { text: 'Number of Customers', font: { size: 12, color: '#e6edf3' } },
              gridcolor: '#30363d',
              tickfont: { color: '#8b949e' },
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
                        color: '#58a6ff',
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
                      y: 1,
                      yref: 'paper',
                      text: `ATE: ${atePercent.toFixed(2)}%`,
                      showarrow: true,
                      arrowhead: 2,
                      arrowcolor: '#58a6ff',
                      font: { color: '#58a6ff', size: 11, weight: 'bold' },
                      bgcolor: '#161b22',
                      bordercolor: '#58a6ff',
                      borderwidth: 1,
                      borderpad: 4,
                    },
                  ]
                : []),
            ],
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{ displayModeBar: false, responsive: true }}
        />
      </div>

      <div className="stat-grid" style={{ marginTop: '16px' }}>
        <div className="stat-box">
          <span className="stat-value">{minCate}%</span>
          <span className="stat-label">Min Customer Lift</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">+{maxCate}%</span>
          <span className="stat-label">Max Customer Lift</span>
        </div>
        <div className="stat-box accent-green">
          <span className="stat-value">{positiveEffects}</span>
          <span className="stat-label">Lift &gt; 0 (Persuadable)</span>
        </div>
        <div className="stat-box accent-yellow">
          <span className="stat-value">{catePercentages.length - positiveEffects}</span>
          <span className="stat-label">Lift ≤ 0 (Do Not Discount)</span>
        </div>
      </div>
    </div>
  );
}
