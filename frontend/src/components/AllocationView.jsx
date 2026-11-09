/* AllocationView.jsx — Dynamic budget allocation simulator using CATE estimates */
import { useState } from 'react';
import { requestAllocation } from '../api';

export default function AllocationView({ analysisResult, onToast }) {
  if (!analysisResult || !analysisResult.cate_values) return null;

  const [budget, setBudget] = useState(1000);
  const [costPerDiscount, setCostPerDiscount] = useState(10);
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocationData, setAllocationData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const budgetPresets = [500, 1000, 2500, 5000, 10000];

  async function handleAllocate(e) {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setIsAllocating(true);

    try {
      const payload = {
        budget: parseFloat(budget),
        cost_per_discount: parseFloat(costPerDiscount),
        customer_ids: analysisResult.customer_ids,
        cate_values: analysisResult.cate_values,
        cate_lower: analysisResult.cate_lower,
        cate_upper: analysisResult.cate_upper,
      };

      const res = await requestAllocation(payload);
      setAllocationData(res);
      if (onToast) onToast(`Budget optimization completed: ${res.n_selected} customers allocated`, 'success');
    } catch (err) {
      const msg = err.response?.data?.detail
        ? JSON.stringify(err.response.data.detail)
        : err.message || 'Failed to compute allocation';
      setErrorMsg(msg);
      if (onToast) onToast('Allocation failed', 'error');
    } finally {
      setIsAllocating(false);
    }
  }

  // Export Allocation Campaign to CSV
  function handleExportAllocationCsv() {
    if (!allocationData || !allocationData.allocation_table) return;

    try {
      const headers = ['rank', 'customer_id', 'predicted_cate_lift_pct', 'discount_cost_dollars', 'cumulative_cost_dollars'];
      const csvRows = [headers.join(',')];

      allocationData.allocation_table.forEach((row, idx) => {
        csvRows.push([
          idx + 1,
          row.customer_id,
          (row.cate * 100).toFixed(2),
          (row.cost ?? costPerDiscount).toFixed(2),
          (row.cumulative_cost ?? (idx + 1) * costPerDiscount).toFixed(2),
        ].join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `promotional_allocation_campaign_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onToast) onToast(`Exported ${allocationData.allocation_table.length} targeting recommendations to CSV`, 'success');
    } catch (err) {
      console.error('Allocation export failed:', err);
      if (onToast) onToast('Export failed', 'error');
    }
  }

  // Naive comparison baseline: what would random or average allocation yield?
  const nCustomersTargetable = Math.floor(budget / costPerDiscount);
  const naiveExpectedPurchases =
    analysisResult.ate != null && analysisResult.ate > 0
      ? (nCustomersTargetable * analysisResult.ate).toFixed(1)
      : '—';

  return (
    <div className="card" id="step-allocation">
      <div className="card-header">
        <span className="card-icon">🎯</span>
        <div style={{ flex: 1 }}>
          <h2>Step 6: Dynamic Marketing Budget Allocation Simulator</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Constrained optimization: allocate promotional spend to maximize incremental conversions
          </p>
        </div>
        <span className="badge badge-warn">Greedy CATE Optimizer</span>
      </div>

      <div className="prototype-banner">
        <strong>⚠️ Decision-Support Prototype Notice:</strong>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
          This simulator implements a greedy heuristic prioritizing customers with the highest positive CATE (&tau; &gt; 0) until the marketing budget is exhausted. Continuous multi-tier discount elasticities and multi-period rebalancing will be explored in future milestones.
        </p>
      </div>

      {/* Simulator Form */}
      <form onSubmit={handleAllocate} style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '16px' }}>
          <div className="input-field">
            <label htmlFor="budget-input">
              Total Promotional Budget ($)
            </label>
            <input
              id="budget-input"
              type="number"
              min="10"
              step="50"
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              required
            />
            {/* Range slider for interactive feel */}
            <input
              type="range"
              min="200"
              max="10000"
              step="100"
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
            />
            {/* Quick preset buttons */}
            <div className="slider-presets">
              {budgetPresets.map(val => (
                <button
                  key={val}
                  type="button"
                  className={`preset-chip ${budget === val ? 'active' : ''}`}
                  onClick={() => setBudget(val)}
                >
                  ${val.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="input-field">
            <label htmlFor="cost-per-discount-input">
              Unit Cost Per Discount ($)
            </label>
            <input
              id="cost-per-discount-input"
              type="number"
              min="1"
              step="1"
              value={costPerDiscount}
              onChange={e => setCostPerDiscount(Number(e.target.value))}
              required
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
              Face value or margin subsidization cost per distributed coupon
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isAllocating}
          id="run-allocation-btn"
          style={{ width: '100%', padding: '12px 24px', fontSize: '0.95rem' }}
        >
          {isAllocating ? (
            <>
              <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
              <span>Optimizing Customer Allocation...</span>
            </>
          ) : (
            <>
              <span>⚡</span> Run Budget Allocation Simulation
            </>
          )}
        </button>
      </form>

      {errorMsg && (
        <div className="alert alert-error">
          <strong>Allocation Error:</strong> {errorMsg}
        </div>
      )}

      {/* Allocation Results */}
      {allocationData && (
        <div id="allocation-results-section">
          {/* Main Outcome Stat Grid */}
          <div className="stat-grid" style={{ marginBottom: '24px' }}>
            <div className="stat-box accent-green">
              <span className="stat-label">Targeted Customers</span>
              <span className="stat-value">{allocationData.n_selected?.toLocaleString()}</span>
              <span className="stat-sub">Selected for discount</span>
            </div>

            <div className="stat-box accent-blue">
              <span className="stat-label">Total Spend</span>
              <span className="stat-value">${allocationData.total_cost?.toLocaleString()}</span>
              <span className="stat-sub">
                {allocationData.budget_used_pct != null
                  ? `${(allocationData.budget_used_pct * 100).toFixed(1)}% budget used`
                  : '—'}
              </span>
            </div>

            <div className="stat-box accent-purple">
              <span className="stat-label">Expected Incremental Purchases</span>
              <span className="stat-value" style={{ color: 'var(--accent-purple)' }}>
                +{allocationData.expected_incremental_purchases?.toFixed(1)}
              </span>
              <span className="stat-sub">Estimated net lift</span>
            </div>

            <div className="stat-box accent-amber">
              <span className="stat-label">Acquisition Cost / Lift</span>
              <span className="stat-value">
                {allocationData.expected_incremental_purchases && allocationData.expected_incremental_purchases > 0
                  ? `$${(allocationData.total_cost / allocationData.expected_incremental_purchases).toFixed(2)}`
                  : '—'}
              </span>
              <span className="stat-sub">Spend per induced purchase</span>
            </div>
          </div>

          {/* Efficiency Comparison: Causal DML vs Naive / Random Allocation */}
          {allocationData.expected_incremental_purchases && naiveExpectedPurchases !== '—' && (
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
                gap: '14px',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.92rem', color: 'var(--accent-green)' }}>
                  🚀 Efficiency Multiplier: Causal Targeting vs Random / Propensity Baseline
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Allocating ${budget.toLocaleString()} via EconoCausal yields{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    +{allocationData.expected_incremental_purchases.toFixed(1)} purchases
                  </strong>
                  , compared to only{' '}
                  <strong>+{naiveExpectedPurchases} purchases</strong> under unranked/average targeting.
                  You gain{' '}
                  <strong style={{ color: 'var(--accent-green)' }}>
                    {(
                      (allocationData.expected_incremental_purchases / parseFloat(naiveExpectedPurchases) - 1) *
                      100
                    ).toFixed(0)}
                    % more incremental sales
                  </strong>{' '}
                  for the exact same marketing spend!
                </p>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={handleExportAllocationCsv}
              >
                <span>📥</span> Export Campaign List (.csv)
              </button>
            </div>
          )}

          {/* Customer Queue Preview */}
          {allocationData.allocation_table && allocationData.allocation_table.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>
                  Top Ranked Allocation Queue (Highest Marginal Impact)
                </h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Showing top 10 of {allocationData.n_selected} allocated customers
                </span>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Queue Priority</th>
                      <th>Customer ID</th>
                      <th>Predicted CATE Lift</th>
                      <th>Discount Cost</th>
                      <th>Cumulative Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocationData.allocation_table.slice(0, 10).map((row, idx) => (
                      <tr key={row.customer_id || idx}>
                        <td>
                          <span className="badge badge-purple">#{idx + 1}</span>
                        </td>
                        <td>
                          <code>{row.customer_id}</code>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--accent-green)' }}>
                            +{(row.cate * 100).toFixed(2)}%
                          </strong>
                        </td>
                        <td>${row.cost?.toFixed(2) ?? costPerDiscount}</td>
                        <td>${row.cumulative_cost?.toFixed(2) ?? ((idx + 1) * costPerDiscount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
