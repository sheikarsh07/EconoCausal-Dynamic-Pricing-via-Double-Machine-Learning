/* api.js — Axios calls to the EconoCausal FastAPI backend */

import axios from 'axios';

// Base URL — the FastAPI backend runs on port 8000 in development.
const BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180_000,  // 3 minutes — causal model can take time
});

/**
 * Check if the backend is alive.
 * @returns {Promise<{status: string, version: string}>}
 */
export async function checkHealth() {
  const res = await api.get('/health');
  return res.data;
}

/**
 * Fetch the pre-packaged sample synthetic retail dataset.
 * @returns {Promise<File>}
 */
export async function fetchSampleCsv() {
  const res = await api.get('/sample-data', { responseType: 'blob' });
  return new File([res.data], 'synthetic_retail.csv', { type: 'text/csv' });
}

/**
 * Upload a CSV file and validate it.
 * @param {File} file
 * @returns {Promise<ValidationResponse>}
 */
export async function validateCsv(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/validate', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

/**
 * Upload a CSV file and run the full causal analysis.
 * @param {File} file
 * @returns {Promise<AnalysisResponse>}
 */
export async function analyzeCsv(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/analyze', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

/**
 * Request a budget allocation based on CATE estimates.
 * @param {AllocationRequest} payload
 * @returns {Promise<AllocationResponse>}
 */
export async function requestAllocation(payload) {
  const res = await api.post('/allocate', payload);
  return res.data;
}
