import { useState, useRef } from 'react';
import { fetchSampleCsv } from '../api';

export default function CsvUpload({ onFileSelected, isLoading }) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const inputRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      alert('Please select a .csv file.');
      return;
    }
    setFileName(file.name);
    onFileSelected(file);
  }

  async function handleLoadSample(e) {
    e.stopPropagation();
    setLoadingSample(true);
    try {
      const file = await fetchSampleCsv();
      setFileName('synthetic_retail.csv (Pre-packaged Sample)');
      onFileSelected(file);
    } catch (err) {
      console.error('Failed to load sample dataset:', err);
      alert('Could not fetch sample dataset from backend. You can select test_sample.csv from the project root.');
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
    <div className="card">
      <div className="card-header">
        <span className="card-icon">📁</span>
        <h2>Upload Dataset</h2>
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
          {fileName ? '📊' : '⬆️'}
        </div>
        <h3>{fileName ? fileName : 'Drag & drop a CSV file here'}</h3>
        <p>
          {fileName
            ? 'Click to replace with a different file'
            : 'or click to browse — only .csv files are accepted'}
        </p>
        {!isLoading && !loadingSample && (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="button"
              onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
              {fileName ? 'Replace File' : 'Browse CSV'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              id="load-sample-btn"
              onClick={handleLoadSample}
            >
              ⚡ Load Demo Dataset (1,000 Customers)
            </button>
          </div>
        )}
        {(isLoading || loadingSample) && <div className="spinner" style={{ margin: '0 auto' }} />}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={onInputChange}
        id="csv-file-input"
      />

      <div style={{ marginTop: '16px' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Required columns: <code>customer_id, age, tenure_months, past_spend,
          customer_segment, discount_received, purchased, revenue</code>
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Don't have a file?{' '}
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
            Download the synthetic sample dataset
          </a>
          {' '}or generate one with <code>python scripts/generate_data.py</code>
        </p>
      </div>
    </div>
  );
}
