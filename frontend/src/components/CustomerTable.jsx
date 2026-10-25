/* CustomerTable.jsx — Searchable and paginated table of customer-level CATE estimates */
import { useState, useMemo } from 'react';

export default function CustomerTable({ analysisResult }) {
  if (!analysisResult || !analysisResult.customer_ids) return null;

  const { customer_ids, cate_values, cate_lower, cate_upper } = analysisResult;

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'positive', 'negative'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (highest lift first), 'asc'
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Build rows array
  const rows = useMemo(() => {
    return customer_ids.map((id, index) => ({
      customer_id: id,
      cate: cate_values[index] ?? 0,
      lower: cate_lower?.[index] ?? 0,
      upper: cate_upper?.[index] ?? 0,
    }));
  }, [customer_ids, cate_values, cate_lower, cate_upper]);

  // Filter & sort
  const filteredRows = useMemo(() => {
    let result = rows;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(r => r.customer_id.toLowerCase().includes(q));
    }

    if (filterType === 'positive') {
      result = result.filter(r => r.cate > 0);
    } else if (filterType === 'negative') {
      result = result.filter(r => r.cate <= 0);
    }

    result = [...result].sort((a, b) => {
      return sortOrder === 'desc' ? b.cate - a.cate : a.cate - b.cate;
    });

    return result;
  }, [rows, search, filterType, sortOrder]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="card" id="customer-table-card">
      <div className="card-header">
        <span className="card-icon">👥</span>
        <div style={{ flex: 1 }}>
          <h2>Individual Customer Treatment Effects (CATE)</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Personalized causal lift estimates and 95% confidence bounds
          </p>
        </div>
        <span className="badge badge-yes">
          {filteredRows.length.toLocaleString()} matching customers
        </span>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search by Customer ID (e.g. C001)..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          id="customer-search-input"
          style={{ maxWidth: '280px' }}
        />

        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
          id="customer-filter-select"
          style={{ maxWidth: '200px' }}
        >
          <option value="all">All Customers</option>
          <option value="positive">Lift &gt; 0 (Persuadable)</option>
          <option value="negative">Lift ≤ 0 (Do Not Discount)</option>
        </select>

        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
          id="customer-sort-select"
          style={{ maxWidth: '220px' }}
        >
          <option value="desc">Sort: Highest Lift First</option>
          <option value="asc">Sort: Lowest Lift First</option>
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Estimated CATE (Lift)</th>
              <th>95% Confidence Interval</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No customer records match the current filters.
                </td>
              </tr>
            ) : (
              pagedRows.map(row => {
                const liftPct = (row.cate * 100).toFixed(2);
                const lowerPct = (row.lower * 100).toFixed(2);
                const upperPct = (row.upper * 100).toFixed(2);
                const isPositive = row.cate > 0;

                return (
                  <tr key={row.customer_id}>
                    <td>
                      <code>{row.customer_id}</code>
                    </td>
                    <td>
                      <strong style={{ color: isPositive ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                        {isPositive ? `+${liftPct}%` : `${liftPct}%`}
                      </strong>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        [{lowerPct}%, {upperPct}%]
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${isPositive ? 'badge-yes' : 'badge-no'}`}>
                        {isPositive ? 'Discount Recommended' : 'No Discount'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} customers
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            disabled={currentPage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ← Previous
          </button>
          <span style={{ padding: '6px 10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            disabled={currentPage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
