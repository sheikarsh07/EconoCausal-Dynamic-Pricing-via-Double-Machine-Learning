/* CustomerTable.jsx — Searchable, filterable, and exportable customer CATE lift table */
import { useState, useMemo } from 'react';

export default function CustomerTable({ analysisResult, onToast }) {
  if (!analysisResult || !analysisResult.customer_ids) return null;

  const { customer_ids, cate_values, cate_lower, cate_upper } = analysisResult;

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Build rows array with categorization
  const rows = useMemo(() => {
    return customer_ids.map((id, index) => {
      const cate = cate_values[index] ?? 0;
      const lower = cate_lower?.[index] ?? 0;
      const upper = cate_upper?.[index] ?? 0;

      let category = 'marginal';
      let categoryBadge = 'badge-no';
      let categoryLabel = 'Low Lift (0-5%)';

      if (cate > 0.15) {
        category = 'high';
        categoryBadge = 'badge-pass';
        categoryLabel = '🎯 High Lift (>15%)';
      } else if (cate > 0.05) {
        category = 'moderate';
        categoryBadge = 'badge-blue';
        categoryLabel = '⚡ Moderate (5-15%)';
      } else if (cate <= 0) {
        category = 'negative';
        categoryBadge = 'badge-fail';
        categoryLabel = '⛔ Do Not Discount (≤0%)';
      }

      return {
        customer_id: id,
        cate,
        catePercent: (cate * 100).toFixed(2),
        lowerPercent: (lower * 100).toFixed(2),
        upperPercent: (upper * 100).toFixed(2),
        category,
        categoryBadge,
        categoryLabel,
      };
    });
  }, [customer_ids, cate_values, cate_lower, cate_upper]);

  // Filter & sort
  const filteredRows = useMemo(() => {
    let result = rows;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(r => r.customer_id.toLowerCase().includes(q));
    }

    if (filterType === 'high') {
      result = result.filter(r => r.category === 'high');
    } else if (filterType === 'moderate') {
      result = result.filter(r => r.category === 'moderate');
    } else if (filterType === 'positive') {
      result = result.filter(r => r.cate > 0);
    } else if (filterType === 'negative') {
      result = result.filter(r => r.category === 'negative');
    }

    result = [...result].sort((a, b) => {
      if (sortOrder === 'desc') return b.cate - a.cate;
      if (sortOrder === 'asc') return a.cate - b.cate;
      if (sortOrder === 'id') return a.customer_id.localeCompare(b.customer_id);
      return 0;
    });

    return result;
  }, [rows, search, filterType, sortOrder]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Export to CSV function
  function handleExportCsv() {
    try {
      const headers = ['customer_id', 'cate_lift_pct', 'ci_95_lower_pct', 'ci_95_upper_pct', 'recommendation'];
      const csvRows = [headers.join(',')];

      filteredRows.forEach(r => {
        csvRows.push([
          r.customer_id,
          r.catePercent,
          r.lowerPercent,
          r.upperPercent,
          `"${r.categoryLabel.replace(/"/g, '""')}"`,
        ].join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `customer_cate_lift_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onToast) onToast(`Exported ${filteredRows.length} customer CATE records to CSV`, 'success');
    } catch (err) {
      console.error('CSV export failed:', err);
      if (onToast) onToast('Export failed', 'error');
    }
  }

  return (
    <div className="card" id="step-customer-table">
      <div className="card-header">
        <span className="card-icon">👥</span>
        <div style={{ flex: 1 }}>
          <h2>Individual Customer Treatment Effects (CATE)</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Personalized causal lift predictions, confidence intervals, and discount targeting priority
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={handleExportCsv}
          title="Export current filtered table to CSV"
        >
          <span>📥</span> Export Table (.csv)
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Search Customer ID (e.g. C0042)..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            id="customer-search-input"
          />
        </div>

        <div style={{ minWidth: '180px' }}>
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}
            id="customer-filter-select"
          >
            <option value="all">All Lift Categories</option>
            <option value="high">🎯 High Lift (&gt;15%)</option>
            <option value="moderate">⚡ Moderate Lift (5-15%)</option>
            <option value="positive">All Positive Lift (&gt;0%)</option>
            <option value="negative">⛔ Zero / Negative Lift (&le;0%)</option>
          </select>
        </div>

        <div style={{ minWidth: '180px' }}>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value)}
            id="customer-sort-select"
          >
            <option value="desc">Sort: Highest Lift First</option>
            <option value="asc">Sort: Lowest Lift First</option>
            <option value="id">Sort: Customer ID</option>
          </select>
        </div>
      </div>

      {/* Table view */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Estimated CATE Lift</th>
              <th>95% Confidence Interval</th>
              <th>Targeting Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map(row => (
              <tr key={row.customer_id}>
                <td>
                  <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}>
                    {row.customer_id}
                  </code>
                </td>
                <td>
                  <strong style={{ color: row.cate > 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontSize: '0.95rem' }}>
                    {row.cate > 0 ? `+${row.catePercent}%` : `${row.catePercent}%`}
                  </strong>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                  [{row.lowerPercent}%, {row.upperPercent}%]
                </td>
                <td>
                  <span className={`badge ${row.categoryBadge}`}>
                    {row.categoryLabel}
                  </span>
                </td>
              </tr>
            ))}
            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No customer records matched your search or filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Showing <strong>{pagedRows.length}</strong> of <strong>{filteredRows.length.toLocaleString()}</strong> customers (Page {currentPage} of {totalPages})
        </span>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            &larr; Previous
          </button>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
