/* AllocationView.jsx — Dynamic budget allocation simulator using CATE estimates */
import { useState } from 'react';
import { requestAllocation } from '../api';

export default function AllocationView({ analysisResult }) {
  if (!analysisResult || !analysisResult.cate_values) return null;

  const [budget, setBudget] = useState(1000);
  const [costPerDiscount, setCostPerDiscount] = useState(10);
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocationData, setAllocationData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  async function handleAllocate(e) {
    e.preventDefault();
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
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail
          ? JSON.stringify(err.response.data.detail)
          : err.message || 'Failed to compute allocation'
      );
    } finally {
      setIsAllocating(false);
    }
  }

  return (
    <div className="card" id="allocation-view-card">
      <div className="card-header">
        <span className="card-icon">🎯</span>
        <div style={{ flex: 1 }}>
          <h2>Dynamic Budget Allocation Simulator</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Allocate fixed marketing spend to maximize causal incremental lift
          </p>
        </div>
        <span className="badge badge-warn">Prototype Simulator</span>
      </div>

      <div className="prototype-banner">
        <strong>⚠️ Decision-Support Prototype Notice:</strong>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
          This simulator implements a greedy heuristic prioritizing customers with the highest positive CATE until budget exhaustion. Real-world continuous discount elasticity, churn dynamics, and multi-period budget rebalancing will be explored in future milestones.
        </p>
      </div>

      <form onSubmit={handleAllocate} style={{ marginBottom: '20px' }}>
        <div className="input-group">
          <div className="input-field">
            <label htmlFor="budget-input">Total Marketing Budget ($)</label>
            <input
              id="budget-input"
              type="number"
              min="1"
              step="10"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              required
            />
          </div>

          <div className="input-field">
            <label htmlFor="cost-per-discount-input">Cost Per Discount ($)</label>
            <input
              id="cost-per-discount-input"
              type="number"
              min="0.1"
              step="0.5"
              value={costPerDiscount}
              onChange={e => setCostPerDiscount(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isAllocating}
            id="run-allocation-btn"
          >
            {isAllocating ? 'Optimizing...' : '⚡ Optimize Allocation'}
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="alert alert-error">
          <strong>Allocation Error:</strong> {errorMsg}
        </div>
      )}

      {allocationData && (
        <div id="allocation-results-section">
          <div className="stat-grid" style={{ marginBottom: '20px' }}>
            <div className="stat-box accent-green">
              <span className="stat-value">{allocationData.n_selected?.toLocaleString()}</span>
              <span className="stat-label">Customers Targeted</span>
            </div>
            <div className="stat-box accent-blue">
              <span className="stat-value">${allocationData.total_cost?.toLocaleString()}</span>
              <span className="stat-label">Total Spend</span>
            </div>
            <div className="stat-box accent-yellow">
              <span className="stat-value">
                {allocationData.budget_used_pct != null
                  ? `${(allocationData.budget_used_pct * 100).toFixed(1)}%`
                  : '—'}
              </span>
              <span className="stat-label">Budget Utilized</span>
            </div>
            <div className="stat-box accent-purple">
              <span className="stat-value">
                +{allocationData.expected_incremental_purchases?.toFixed(1)}
              </span>
              <span className="stat-label">Expected Incremental Purchases</span>
            </div>
          </div>

          {allocationData.allocation_table && allocationData.allocation_table.length > 0 && (
            <div>
              <h4 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>
                Targeted Customer Queue (Top Allocated Cohort)
              </h4>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Customer ID</th>
                      <th>Predicted CATE Lift</th>
                      <th>Discount Cost</th>
                      <th>Cumulative Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocationData.allocation_table.slice(0, 10).map((row, idx) => (
                      <tr key={row.customer_id || idx}>
                        <td>#{idx + 1}</td>
                        <td><code>{row.customer_id}</code></td>
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
              {allocationData.allocation_table.length > 10 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
                  Showing top 10 of {allocationData.n_selected} allocated customers
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
