/* CsvUpload.jsx — Interactive drag-and-drop CSV uploader with demo cohort loader */
import { useState, useRef } from 'react';
import { fetchSampleCsv } from '../api';

export default function CsvUpload({ onFileSelected, isLoading, onToast }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const inputRef = useRef(null);

  const requiredColumns = [
    { name: 'customer_id', type: 'string' },
    { name: 'age', type: 'integer' },
    { name: 'tenure_months', type: 'integer' },
    { name: 'past_spend', type: 'float ($)' },
    { name: 'customer_segment', type: '0-3' },
    { name: 'discount_received (T)', type: '0 or 1' },
    { name: 'purchased (Y)', type: '0 or 1' },
  ];

  function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      if (onToast) onToast('Please upload a valid .csv file format', 'error');
      return;
    }
    setFileName(file.name);
    onFileSelected(file);
    if (onToast) onToast(`File loaded: ${file.name}`, 'info');
  }

  async function handleLoadSample(e) {
    e.stopPropagation();
    setLoadingSample(true);
    try {
      const file = await fetchSampleCsv();
      setFileName('synthetic_retail.csv (Pre-built Cohort)');
      onFileSelected(file);
      if (onToast) onToast('Pre-packaged retail dataset loaded (1,000 customers)', 'success');
    } catch (err) {
      console.error('Failed to load sample dataset:', err);
      if (onToast) onToast('Could not fetch sample dataset from backend. Ensure backend is running.', 'error');
    } finally {
      setLoadingSample(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function onInputChange(e) {
    handleFile(e.target.files[0]);
  }

  return (
    <div className="card" id="step-upload">
      <div className="card-header">
        <span className="card-icon">📂</span>
        <div style={{ flex: 1 }}>
          <h2>Step 1: Upload Observational Dataset</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Provide transaction logs containing customer confounders, discount treatment, and purchase outcomes.
          </p>
        </div>
        {fileName && (
          <span className="badge badge-pass">
            ✓ Ready for Validation
          </span>
        )}
      </div>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        id="csv-upload-zone"
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="CSV file upload area"
      >
        <div className="upload-zone-icon">
          {fileName ? '📊' : '☁️'}
        </div>
        
        <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>
          {fileName ? fileName : 'Drag & drop your CSV file here'}
        </h3>
        
        <p style={{ maxWidth: '520px', margin: '0 auto 18px', fontSize: '0.88rem' }}>
          {fileName
            ? 'Click anywhere or drop another file to replace'
            : 'Observational customer purchase history with confounders. Data is processed locally in-memory.'}
        </p>

        {!isLoading && !loadingSample && (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
            >
              <span>📁</span> {fileName ? 'Replace CSV File' : 'Browse Local CSV'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              id="load-sample-btn"
              onClick={handleLoadSample}
            >
              <span>⚡</span> Load Pre-Built Retail Demo (1,000 Customers)
            </button>
          </div>
        )}

        {(isLoading || loadingSample) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div className="spinner" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {loadingSample ? 'Loading demo cohort...' : 'Parsing CSV headers and rows...'}
            </span>
          </div>
        )}
      </div>

      {/* Schema Columns helper */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Expected Dataset Columns &amp; Schema
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            All 7 columns required for DML identification
          </span>
        </div>
        <div className="schema-specs-chips">
          {requiredColumns.map(col => (
            <span key={col.name} className="schema-chip required" title={`Type: ${col.type}`}>
              <strong>{col.name}</strong> ({col.type})
            </span>
          ))}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={onInputChange}
        id="csv-file-input"
      />
    </div>
  );
}
